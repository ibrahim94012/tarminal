/* ---------- Terminal Vault (Button System) ---------- */

const term = document.getElementById("terminal");
const inputWrap = document.querySelector(".input-wrap");
const input = document.getElementById("cmdInput");
const sendBtn = document.getElementById("sendBtn");

let unlocked = false;
let vaultData = { entries: [] };

/* ---------- Utility Functions ---------- */

function writeLine(html = "") {
  const el = document.createElement("div");
  el.className = "line";
  el.innerHTML = html;
  term.appendChild(el);
  term.scrollTop = term.scrollHeight;
}

function now() {
  return new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" });
}

/* ---------- Init ---------- */

async function showIntro() {
  writeLine(`<strong>Terminal Vault</strong> <span class="muted">(${now()})</span>`);
  writeLine('<span class="muted">Click a button below to start.</span>');
}

/* ---------- Commands ---------- */

async function commandAdd() {
  if (!unlocked) return writeLine("🔒 Vault locked");

  const formId = "addForm-" + Date.now();
  const html = `
  <form id="${formId}" class="glass-card" aria-label="Add new entry (glass)">
    <h3><i class="fa-solid fa-plus"></i> Add New Entry</h3>

    <label for="${formId}-platform">Platform/Service</label>
    <input id="${formId}-platform" name="platform" required autocomplete="organization">

    <label for="${formId}-username">Username</label>
    <input id="${formId}-username" name="username" autocomplete="username">

    <label for="${formId}-email">Email</label>
    <input id="${formId}-email" type="email" name="email" autocomplete="email">

    <label for="${formId}-mobile">Mobile</label>
    <input id="${formId}-mobile" name="mobile" inputmode="tel" autocomplete="tel">

    <label for="${formId}-password">Password</label>
    <input id="${formId}-password" type="password" name="password" required autocomplete="new-password">

    <label for="${formId}-note">Note</label>
    <textarea id="${formId}-note" name="note" rows="2"></textarea>

    <div class="glass-actions">
      <button type="submit" id="${formId}-submit" class="btn btn-primary">Submit</button>
      <button type="button" id="${formId}-cancel" class="btn btn-cancel">Cancel</button>
    </div>
  </form>
  `;
  writeLine(html);

  const form = document.getElementById(formId);
  const cancel = document.getElementById(`${formId}-cancel`);
  const submit = document.getElementById(`${formId}-submit`);

  cancel.onclick = () => {
    form.remove();
    writeLine("❌ Entry cancelled");
  };

  form.onsubmit = async e => {
    e.preventDefault();
    submit.disabled = true;
    submit.textContent = "⏳ Saving...";

    const fd = new FormData(form);
    const entry = {
      id: Date.now().toString(36),
      platform: fd.get("platform")?.trim() || "-",
      username: fd.get("username")?.trim() || "-",
      email: fd.get("email")?.trim() || "-",
      mobile: fd.get("mobile")?.trim() || "-",
      password: fd.get("password")?.trim() || "-",
      note: fd.get("note")?.trim() || "-",
      created: new Date().toISOString()
    };

    vaultData.entries.push(entry);

    try {
      const gfd = new FormData();
      for (let [k, v] of Object.entries(entry)) gfd.append(k, v);

      const res = await fetch("https://script.google.com/macros/s/AKfycbxXAZAZOM-MjHZs5z9i90WXyLyKMIOu0qU5H1ab0KJx8e-9VU4aQtL0ZwvHZiWjAthPww/exec", {
        method: "POST",
        mode: "cors",
        body: gfd
      });

      if (res.ok) {
        writeLine(`✅ Added <span class="idtag">${entry.id}</span> (${entry.platform})`);
      } else {
        writeLine("⚠️ Could not save to Google Sheet (server error). Saved locally only.");
      }
    } catch (err) {
      writeLine("❌ Network error — entry saved locally only.");
    }

    form.remove();
  };
}

async function commandList() {
  if (!unlocked) return writeLine("🔒 Vault locked");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/1GOKMUAeNefOMPE8KflSIqeoodHYFesaD6aJgRGCi5Ng/values/${encodeURIComponent("Sheet12!A:Z")}?key=AIzaSyACww_yoqNc1ZnF14GTf-WmOR0_gYO8bms`;

  try {
    const res = await fetch(url);
    if (!res.ok) return writeLine("❌ Google Sheet fetch failed");

    const data = await res.json();
    const rows = data.values || [];
    if (rows.length <= 1) return writeLine("— no entries —");

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const id = r[0] || "-", platform = r[1] || "-", user = r[2] || "-", email = r[3] || "-", mobile = r[4] || "-";
      writeLine(`<div class="list-item"><span class="idtag">${id}</span> — <strong>${platform}</strong> <span class="muted">${user}</span> <span class="muted">${email} ${mobile}</span></div>`);
    }
  } catch (err) {
    writeLine("⚠️ Network error: " + err.message);
  }
}

async function commandExport() {
  if (!unlocked) return writeLine("🔒 Vault locked");

  const blob = new Blob([JSON.stringify(vaultData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "josna.json";
  a.click();
  URL.revokeObjectURL(url);
  writeLine("⬇️ josna.json exported");
}

async function commandImport() {
  if (!unlocked) return writeLine("🔒 Vault locked");

  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "application/json";
  inp.style.display = "none";
  document.body.appendChild(inp);
  inp.onchange = async () => {
    const file = inp.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      if (!Array.isArray(obj.entries)) return writeLine("Invalid file");
      vaultData = obj;
      writeLine("✅ Imported");
    } catch {
      writeLine("Invalid JSON");
    }
    inp.remove();
  };
  inp.click();
}


async function commandView() {
  if (!unlocked) return writeLine("🔒 Vault locked");

  // পুরানো ফর্ম থাকলে মুছে ফেলি
  const oldForm = document.querySelector(".viewForm");
  if (oldForm) oldForm.remove();

  // ইনপুট ফর্ম
  const form = document.createElement("form");
  form.className = "viewForm";
  form.innerHTML = `
    <div style="
      margin:15px 0;
      padding:16px;
      border-radius:15px;
      max-width:380px;
      animation:fadeIn 0.4s ease;

      background-color: rgba(255, 255, 255, 0.062);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.5);
    ">
      <label style="display:block; margin-bottom:8px; color:var(--accent,#f6b544); font-weight:600;">Enter Entry ID:</label>
      <input type="text" id="viewId" placeholder="e.g. 1001" required
        style="width:100%; padding:10px; border:1px solid rgba(255, 255, 255, 1); border-radius:8px; background: transparent; color:#fff; font-size:15px;">
      <button type="submit" style="
        margin-top:12px;
        background:var(--accent,#f6b544);
        color:#111;
        border:none;
        padding:10px 16px;
        border-radius:8px;
        cursor:pointer;
        font-weight:600;
        transition:0.2s;
      " onmouseover="this.style.background='#e0a63e'" onmouseout="this.style.background='#f6b544'"><i class="fa-solid fa-magnifying-glass"></i> View</button>
    </div>
  `;
  writeLine(form.outerHTML);

  // CSS একবারই যোগ করব
  if (!document.getElementById("vaultViewCSS")) {
    const style = document.createElement("style");
    style.id = "vaultViewCSS";
    style.textContent = `
      @keyframes fadeIn {
        from {opacity:0; transform:translateY(6px);}
        to {opacity:1; transform:translateY(0);}
      }
      .viewCard {
        border-radius:15px;
        padding:16px;
        margin-top:14px;
        animation:fadeIn 0.4s ease;

        background-color: rgba(255, 255, 255, 0.062);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.5);
      }
      .viewCard .title {
        font-size:18px;
        font-weight:600;
        color:#f6b544;
        margin-bottom:12px;
      }
      .gridWrap {
        display:grid;
        grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));
        gap:10px;
      }
      .field {
        display:flex;
        align-items:center;
        justify-content:space-between;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius:8px;
        padding:8px 10px;
        font-size:14px;
        color:#fff;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.5);
      }
      .field strong {
        color:#ccc;
      }
      .field span {
        color:#f6b544;
        font-weight:500;
        margin:0 6px;
      }
      .copyBtn {
        background: transparent;
        color:#FFF;
        border: 1px solid #fff;
        border-radius:6px;
        padding:5px 8px;
        cursor:pointer;
        font-size:13px;
        transition:0.2s;
      }
      .copyBtn:hover {
        background: #ffffff67;
        color: #fff;
        transform:scale(1.05);
      }
    `;
    document.head.appendChild(style);
  }

  // সাবমিট ইভেন্ট
  const newForm = document.querySelector(".viewForm");
  newForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = newForm.querySelector("#viewId").value.trim();
    if (!id) return;

    const url = `https://sheets.googleapis.com/v4/spreadsheets/1GOKMUAeNefOMPE8KflSIqeoodHYFesaD6aJgRGCi5Ng/values/${encodeURIComponent("Sheet12!A:Z")}?key=AIzaSyACww_yoqNc1ZnF14GTf-WmOR0_gYO8bms`;

    writeLine("<i class=\"fa-solid fa-hourglass-end\"></i> Fetching data...");
    try {
      const res = await fetch(url);
      const data = await res.json();
      const row = (data.values || []).find((r, i) => i > 0 && r[0] === id);

      if (!row) return writeLine(`❌ <span style="color:#f66;">No entry found for ID:</span> <b>${id}</b>`);

      // সুন্দরভাবে Grid আকারে ডেটা দেখানো
      writeLine(`
        <div class="viewCard">
          <div class="title">${row[1] || "Untitled"} <span style="color:#FFF;">[${id}]</span></div>
          <div class="gridWrap">
            <div class="field"><strong>Username:</strong> <span>${row[2] || "-"}</span> <button class="copyBtn" data-copy="${row[2] || ""}"><i class="fa-solid fa-copy"></i></button></div>
            <div class="field"><strong>Mobile:</strong> <span>${row[3] || "-"}</span> <button class="copyBtn" data-copy="${row[3] || ""}"><i class="fa-solid fa-copy"></i></button></div>
            <div class="field"><strong>Email:</strong> <span>${row[4] || "-"}</span> <button class="copyBtn" data-copy="${row[4] || ""}"><i class="fa-solid fa-copy"></i></button></div>
            <div class="field"><strong>Password:</strong> <span>${row[5] || "-"}</span> <button class="copyBtn" data-copy="${row[5] || ""}"><i class="fa-solid fa-copy"></i></button></div>
            <div class="field"><strong>Note:</strong> <span>${row[6] || "-"}</span> <button class="copyBtn" data-copy="${row[6] || ""}"><i class="fa-solid fa-copy"></i></button></div>
          </div>
        </div>
      `);

      // কপি বাটন হ্যান্ডলার
      document.querySelectorAll(".copyBtn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const text = btn.getAttribute("data-copy");
          if (!text) return alert("No data to copy!");
          await navigator.clipboard.writeText(text);
          btn.innerHTML = '<i class="fa-solid fa-check-to-slot"></i>';
          btn.style.background = "transprent";
          btn.style.color = "#fff";
          setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-copy"></i>';
            btn.style.background = "transprent";
            btn.style.color = "#fff";
          }, 1500);
        });
      });

    } catch (err) {
      writeLine("⚠️ Network error: " + err.message);
    }
  });
}



/* ---------- PIN ---------- */
function getDhakaHMParts() {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
  const parts = fmt.formatToParts(new Date());
  const hour = parseInt(parts.find(p => p.type === "hour").value, 10);
  const minute = parseInt(parts.find(p => p.type === "minute").value, 10);
  return { hour, minute };
}

function getDynamicPin() {
  const { hour, minute } = getDhakaHMParts();
  // keep same behavior as before (concatenate hour and minute)
  return `${hour}${minute}`;
}

/*
  createPinModal() -> shows a modal with an input and returns a Promise
  resolves to the entered PIN (string) when user submits, or null when cancelled.
*/
function createPinModal({ title = "Enter PIN", hint = "" } = {}) {
  return new Promise(resolve => {
    // create backdrop
    const backdrop = document.createElement("div");
    backdrop.className = "pin-modal-backdrop";

    // modal container
    const modal = document.createElement("div");
    modal.className = "pin-modal";
    modal.innerHTML = `
      <h3>${title}</h3>
      <div class="hint">${hint}</div>
      <input inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" class="pin-input" id="pinModalInput" placeholder="PIN" />
      <div class="pin-row">
        <button class="pin-btn" id="pinModalSubmit">Unlock</button>
        <button class="pin-btn secondary" id="pinModalCancel">Cancel</button>
      </div>
      <div class="pin-error" id="pinModalError"></div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const input = modal.querySelector("#pinModalInput");
    const submit = modal.querySelector("#pinModalSubmit");
    const cancel = modal.querySelector("#pinModalCancel");
    const errorDiv = modal.querySelector("#pinModalError");

    // focus and select input
    setTimeout(() => input.focus(), 50);

    function cleanup() {
      submit.removeEventListener("click", onSubmit);
      cancel.removeEventListener("click", onCancel);
      backdrop.removeEventListener("keydown", onKeyDown);
      document.body.removeChild(backdrop);
    }

    function onSubmit() {
      const val = input.value.trim();
      resolve(val);
      cleanup();
    }

    function onCancel() {
      resolve(null);
      cleanup();
    }

    function onKeyDown(e) {
      if (e.key === "Enter") {
        onSubmit();
      } else if (e.key === "Escape") {
        onCancel();
      }
    }

    submit.addEventListener("click", onSubmit);
    cancel.addEventListener("click", onCancel);
    backdrop.addEventListener("keydown", onKeyDown);

    // allow clicking outside to cancel
    backdrop.addEventListener("click", (ev) => {
      if (ev.target === backdrop) onCancel();
    });

    // prevent clicks inside modal from closing
    modal.addEventListener("click", (ev) => ev.stopPropagation());
  });
}

/*
  askPin() - uses modal instead of prompt/alert.
  Assumes `writeLine` and `unlocked` exist in your environment (like in your vault).
*/
async function askPin() {
  // optional: provide a hint (do not reveal actual PIN obviously)
  const entered = await createPinModal({
    title: "Vault PIN",
    // hint: "Enter the dynamic PIN (based on Dhaka time)."
  });

  // user cancelled
  if (entered === null) {
    writeLine("⚪ PIN entry cancelled");
    return;
  }

  // check
  if (entered === getDynamicPin()) {
    unlocked = true;
    writeLine("✅ Vault unlocked");
  } else {
    // don't use alert; show error state via writeLine (and you can add visual feedback)
    writeLine("❌ Wrong PIN");
  }
}


/* ---------- UI Button System ---------- */

function createButtons() {
  const bar = document.createElement("div");
  bar.className = "btn-bar";
  bar.style.display = "flex";
  bar.style.flexWrap = "wrap";
  bar.style.gap = "8px";
  bar.style.margin = "10px 0";
  bar.innerHTML = `
    <button class="b" data-cmd="unlock"><i class="fa-solid fa-unlock-keyhole"></i></button>
    <button class="b" data-cmd="add"><i class="fa-solid fa-plus"></i></button>
    <button class="b" data-cmd="list"><i class="fa-solid fa-list-dropdown"></i></button>
    <button class="b" data-cmd="view"><i class="fa-solid fa-eye"></i></button>
    <button class="b" data-cmd="export"><i class="fa-solid fa-file-export"></i></button>
    <button class="b" data-cmd="import"><i class="fa-solid fa-file-import"></i></button>
    <button class="b" data-cmd="lock"><i class="fa-solid fa-lock"></i></button>
    <button class="b" data-cmd="clear"><i class="fa-solid fa-trash"></i></button>
  `;
  document.querySelector(".vault").insertBefore(bar, term);

  bar.addEventListener("click", async e => {
    const btn = e.target.closest("button[data-cmd]");
    if (!btn) return;
    const cmd = btn.dataset.cmd;

    switch (cmd) {
      case "unlock": await askPin(); break;
      case "lock": unlocked = false; writeLine("🔒 Locked"); break;
      case "add": await commandAdd(); break;
      case "list": await commandList(); break;
      case "view": await commandView(); break;
      case "export": await commandExport(); break;
      case "import": await commandImport(); break;
      case "clear": term.innerHTML = ""; break;
    }
  });
}

/* ---------- Run ---------- */

showIntro();
createButtons();
inputWrap.style.display = "none"; // hide old input system



/* ---------- Terminal helpers (updated) ---------- */

function writeLine(html = "", autoScroll = true) {
  const el = document.createElement("div");
  el.className = "line";
  el.innerHTML = html;
  term.appendChild(el);
  // autoscroll only when requested (default true to keep existing behavior)
  if (autoScroll) {
    term.scrollTop = term.scrollHeight;
  }
}

async function showIntro() {
  // write intro WITHOUT auto-scroll so page stays at top
  writeLine(`<strong>Terminal Vault</strong> <span class="muted">(${now()})</span>`, false);
  writeLine('<span class="muted">Click a button below to start.</span>', false);

  // make sure term is at the top after initial writes
  // use scrollTo for explicit behavior; if you don't want smooth animation use behavior: 'auto'
  term.scrollTo({ top: 0, behavior: 'auto' });
}
