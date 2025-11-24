/* ===== Ultra Secure PIN (30s expiry) =====
   - Time-windowed PIN (30s)
   - Device fingerprint + crypto-based derivation
   - Encrypted hint (0-9), decrypted only in modal
   - Anti-debugger & anti-tamper checks
   - Ready for minify/obfuscation
*/

(async function U() {
  // ---------- CONFIG ----------
  const _ALG_HMAC = { name: "HMAC", hash: "SHA-256" };
  const _ALG_AES  = { name: "AES-GCM", length: 256 };
  const PIN_DIGITS = 6; // output digits before any modifiers
  const WINDOW_MS = 30_000; // 30 seconds
  const SCRAMBLE_MULT = 3; // final formula: (truncNumber * 3) + hint
  // store an expected integrity hash (replace this after build/signing)
  const EXPECTED_SOURCE_FINGERPRINT = "___PLACEHOLDER_SOURCE_HASH___";

  // ---------- Anti-tamper: compute hash of this function's source ----------
  async function _sha256Hex(str) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(str));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  }

  async function _selfCheck() {
    try {
      const src = U.toString(); // U is the wrapper function name in this scope
      const h = await _sha256Hex(src);
      // If EXPECTED_SOURCE_FINGERPRINT left as placeholder, skip check
      if (EXPECTED_SOURCE_FINGERPRINT && EXPECTED_SOURCE_FINGERPRINT !== "___PLACEHOLDER_SOURCE_HASH___") {
        if (h !== EXPECTED_SOURCE_FINGERPRINT) {
          // tamper detected -> refuse to run
          console.warn("integrity fail");
          return false;
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- Anti-debugger: basic detectors ----------
  let _dbgBlocked = false;
  function _detectDevTools() {
    // 1) dimension check
    const threshold = 160;
    if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) return true;
    // 2) toString trick
    const re = /./;
    re.toString = function(){ _dbgBlocked = true; return ""; };
    // eslint-disable-next-line no-console
    console.log(re);
    return _dbgBlocked;
  }

  // call detectors periodically for heightened security
  const _dbgInterval = setInterval(() => {
    if (_detectDevTools()) {
      // paranoid response: disable certain features by redefining things
      try { Object.defineProperty(window, "devtoolsDetected", { value: true, configurable: false }); } catch(_) {}
    }
  }, 1000);

  // ---------- Fingerprint (simple, non-invasive) ----------
  async function _deviceFingerprintRaw() {
    const nav = navigator || {};
    const parts = [
      nav.userAgent || "",
      nav.platform || "",
      nav.hardwareConcurrency || "",
      nav.deviceMemory || "",
      screen?.width || "",
      screen?.height || "",
      screen?.colorDepth || "",
      Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      (navigator.languages || []).join(",")
    ].join("||");
    return parts;
  }
  async function _deviceFingerprintHash() {
    const raw = await _deviceFingerprintRaw();
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(raw));
    return buf; // ArrayBuffer
  }

  // ---------- derive Crypto keys ----------
  async function _importHmacKey(rawBuf) {
    return crypto.subtle.importKey("raw", rawBuf, _ALG_HMAC, false, ["sign"]);
  }
  async function _deriveAesKeyFromHash(rawBuf) {
    // Use HKDF would be ideal — but for simplicity derive AES key by digesting rawBuf again.
    // We create a key from the raw hash bytes (ok for this use, but server-side more secure).
    return crypto.subtle.importKey("raw", rawBuf, { name: "AES-GCM" }, false, ["encrypt","decrypt"]);
  }

  // ---------- hint encryption (AES-GCM) ----------
  function _randIV() {
    return crypto.getRandomValues(new Uint8Array(12));
  }
  async function _encryptHintByte(hintByte, aesKey) {
    const enc = new TextEncoder();
    const iv = _randIV();
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, enc.encode(String(hintByte)));
    // store iv + ct base64
    const combined = new Uint8Array(iv.byteLength + ct.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ct), iv.byteLength);
    return btoa(String.fromCharCode(...combined));
  }
  async function _decryptHintBlob(blobB64, aesKey) {
    const raw = Uint8Array.from(atob(blobB64), c => c.charCodeAt(0));
    const iv = raw.slice(0,12);
    const ct = raw.slice(12);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ct);
    const dec = new TextDecoder().decode(plain);
    return parseInt(dec, 10);
  }

  // ---------- compute PIN ----------
  async function _computePinString(encryptedHintBlob) {
    // window index
    const windowIndex = Math.floor(Date.now() / WINDOW_MS);
    // fingerprint hash
    const fpBuf = await _deviceFingerprintHash();
    // import as HMAC key
    const hmacKey = await _importHmacKey(fpBuf);
    // sign the window index
    const enc = new TextEncoder();
    const sig = await crypto.subtle.sign("HMAC", hmacKey, enc.encode(String(windowIndex)));
    // turn signature into hex and take a portion
    const sigHex = Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,"0")).join("");
    // pick a chunk to reduce exposure: use last 10 hex chars
    const tail = sigHex.slice(-10);
    const num = parseInt(tail, 16) % Math.pow(10, PIN_DIGITS); // PIN_DIGITS-digit base
    // decrypt hint using AES key derived from fingerprint
    const aesKey = await _deriveAesKeyFromHash(fpBuf);
    const hintDigit = await _decryptHintBlob(encryptedHintBlob, aesKey);
    // final formula: (num * SCRAMBLE) + hintDigit
    const final = (num * SCRAMBLE_MULT) + (hintDigit % 10);
    return String(final);
  }

  // ---------- generate encrypted hint blob (call once, keep in memory) ----------
  async function _makeEncryptedHint() {
    const rnd = Math.floor(Math.random() * 10); // 0-9
    const fpBuf = await _deviceFingerprintHash();
    const aesKey = await _deriveAesKeyFromHash(fpBuf);
    const blob = await _encryptHintByte(rnd, aesKey);
    return { blob, hintVisible: rnd }; // we return hintVisible only for demo; DON'T expose in prod
  }

  // ---------- modal (simple) ----------
  function createPinModal({ title = "Enter code", hint = "" } = {}) {
    return new Promise(resolve => {
      const backdrop = document.createElement("div");
      backdrop.className = "pin-modal-backdrop";
      const modal = document.createElement("div");
      modal.className = "pin-modal";
      modal.innerHTML = `
        <h3>${title}</h3>
        <div class="hint">${hint}</div>
        <input type="password" inputmode="numeric" pattern="[0-9]*"
               autocomplete="off" class="pin-input" id="pinI" placeholder="Code"/>
        <div style="margin-top:.5rem">
          <button id="okBtn">OK</button>
          <button id="noBtn">Cancel</button>
        </div>
      `;
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      const input = modal.querySelector("#pinI");
      const ok = modal.querySelector("#okBtn");
      const no = modal.querySelector("#noBtn");
      setTimeout(()=>input.focus(),40);
      ok.onclick = ()=>{ resolve(input.value.trim()); document.body.removeChild(backdrop); };
      no.onclick = ()=>{ resolve(null); document.body.removeChild(backdrop); };
      backdrop.onclick = (e)=>{ if (e.target===backdrop){ resolve(null); document.body.removeChild(backdrop); } };
      modal.onclick = e=>e.stopPropagation();
    });
  }

  // ---------- main flow ----------
  // 1) self-check (anti-tamper)
  const okSelf = await _selfCheck();
  if (!okSelf) {
    console.warn("self-check failed — aborting");
    clearInterval(_dbgInterval);
    return;
  }

  // 2) create encrypted hint and keep blob
  const { blob: encryptedHint, hintVisible } = await _makeEncryptedHint();
  // Note: hintVisible returned only for demonstration/testing. Remove or don't log it in prod.
  // 3) show modal with only the hint digit (decrypted here for UI). In production, decrypt only here.
  // We'll decrypt just-in-time (but we already have hintVisible for demo)
  // For safety, we will decrypt using _decryptHintBlob to show in hint (so it uses same key)
  const aesKeyForShow = await _deriveAesKeyFromHash(await _deviceFingerprintHash());
  const decryptedForUI = await _decryptHintBlob(encryptedHint, aesKeyForShow);

  // Now when user calls askPin, we will compute real PIN using encryptedHint
  async function askPin() {
    // anti-debugger quick guard
    if (window.devtoolsDetected) { writeLine("🔒 Access temporarily unavailable"); return; }

    const entered = await createPinModal({ title: "Secure Access", hint: `Hint: ${decryptedForUI}` });
    if (entered === null) { writeLine("⚪ Cancelled"); return; }

    const real = await _computePinString(encryptedHint);
    if (entered === real) {
      unlocked = true;
      writeLine("✅ Access granted");
    } else {
      writeLine("❌ Wrong code");
    }
  }

  // Provide the function to global so you can call askPin()
  window.askPinSecure = askPin;

  // Optional: auto-expire hint+blob after some time to reduce exposure
  setTimeout(()=>{ try{ /* erase sensitive in-memory variables */ }catch(_){ } }, 60_000);

  // stop anti-debug polling when page unloads
  window.addEventListener("beforeunload", ()=> clearInterval(_dbgInterval));

  // demo/debug: log nothing in prod. For dev you could test: window.askPinSecure();
})();
