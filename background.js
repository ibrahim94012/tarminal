// কনফিগারেশন — প্রয়োজনমতো বদলান
const IMG_COUNT = 10;             // 0..9 পর্যন্ত ইমেজ সংখ্যা
const PATH = 'background/';       // ফোল্ডার পথ
const EXT = '.jpg';               // এক্সটেনশন
const STORAGE_KEY = 'bg_last_index';

// উপকারী: যদি localStorage অসাধারণ কোনো কারণে না চলে, try/catch ব্যবহার করছি
function safeGetLast() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? null : parseInt(v, 10);
  } catch (e) {
    return null;
  }
}
function safeSetLast(i) {
  try {
    localStorage.setItem(STORAGE_KEY, String(i));
  } catch (e) {
    // ignore
  }
}

// নতুন ইনডেক্স বাছাই — আগেরটি (যদি থাকে) ছাড়া
function pickNewIndex(count, prev) {
  if (!Number.isInteger(count) || count <= 0) return 0;
  if (count === 1) return 0;
  const choices = [];
  for (let i = 0; i < count; i++) if (i !== prev) choices.push(i);
  const r = Math.floor(Math.random() * choices.length);
  return choices[r];
}

// আগেই সিলেক্ট করা ইমেজ প্রিলোড করব যাতে ফ্লিকার কম হয়
function preload(src, cb) {
  const img = new Image();
  img.onload = () => cb && cb(true);
  img.onerror = () => cb && cb(false);
  img.src = src;
}

// বাইডি-তে ব্যাকগ্রাউন্ড সেট করা
function applyBackground(index) {
  const url = `${PATH}${index}${EXT}`;
  document.body.style.backgroundImage = `url('${url}')`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundRepeat = 'no-repeat';
  document.body.style.backgroundPosition = 'center center';

  // ✅ যদি ০.jpg হয়, তাহলে .vault এর ব্যাকগ্রাউন্ড রেড হবে
  const vault = document.querySelector('.vault');
  if (vault) {
    if (index === 0) {
      vault.style.background = 'rgba(48, 48, 48, 0.06)';
    } else {
      vault.style.background = ''; // আগের স্টাইল রিসেট করবে
      vault.style.backdropFilter = '';
    }
  }
}

// সম্পূর্ণ লজিক
(function initRandomBgOnVisit() {
  const prev = safeGetLast();
  const next = pickNewIndex(IMG_COUNT, prev);
  const src = `${PATH}${next}${EXT}`;

  preload(src, (ok) => {
    applyBackground(next);
    safeSetLast(next);
  });
})();
