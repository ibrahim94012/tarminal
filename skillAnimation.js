document.addEventListener('DOMContentLoaded', () => {
  const boxes = document.querySelectorAll('.skill-box');

  // সেটিংস (আপনি চাইলে মান বদলাতে পারেন)
  const visibleThreshold = 0.5; // ভিউপোর্টে কতো অনুপাতে দেখা গেলে trigger করবে (0-1)
  const defaultDuration = 1200; // মিলিসেকেন্ডে পূর্ণ অ্যানিমেশন সময়

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  boxes.forEach(box => {
    const meter = box.querySelector('.skill-meter');
    const percEl = box.querySelector('.skill-persentage');

    // টার্গেট %
    let target = 0;
    if (box.dataset.skill) {
      target = parseInt(box.dataset.skill, 10) || 0;
    } else if (percEl) {
      target = parseInt(percEl.textContent.replace('%', ''), 10) || 0;
    }

    // ফিল এলিমেন্ট তৈরি (যদি না থাকে)
    let fill = box.querySelector('.skill-meter-fill');
    if (!fill) {
      fill = document.createElement('div');
      fill.className = 'skill-meter-fill';
      meter.appendChild(fill);
    }
    // আরিয়া স্টেট আপডেট
    function setFillPercent(n) {
      const clamped = Math.max(0, Math.min(100, Math.round(n)));
      fill.style.width = clamped + '%';
      fill.setAttribute('aria-valuenow', clamped);
      if (percEl) percEl.textContent = clamped + '%';
    }
    setFillPercent(0);

    // অ্যানিমেশন কন্ট্রোল ভ্যারিয়েবল
    let animated = false;
    let animFrameId = null;
    let animStart = null;
    let animFrom = 0; // শুরুর % (dynamic)
    let animTo = target; // লক্ষ্য % (fixed per box)

    // অ্যানিমেশন — এখন startPercent প্যারামিটার নেওয়া যায়
    function animateFill(duration = defaultDuration, startPercent = null) {
      // যদি ইতোমধ্যে সম্পূর্ণ দেয়া থাকে, কিছু না কর
      const currentNow = parseInt(fill.getAttribute('aria-valuenow') || '0', 10);
      if (currentNow >= animTo) return;

      if (animated) return; // prevent double start
      animated = true;
      animStart = null;

      if (startPercent === null) {
        animFrom = currentNow;
      } else {
        animFrom = Math.max(0, Math.min(100, Math.round(startPercent)));
      }
      const remaining = animTo - animFrom;
      // যদি টার্গেট 0 হয় বা remaining <=0 কিছু না কর
      if (animTo <= 0 || remaining <= 0) {
        animated = false;
        return;
      }

      // সময়কে বাকি অংশ অনুযায়ী স্কেল করা (যদি স্টার্ট থেকে পুরো সময় নেওয়া হয় তাহলে duration 그대로)
      // এখানে ধরে নিচ্ছি defaultDuration হল 0 -> target সময়, তাই remaining/target অনুপাত নেব
      const scaledDuration = (animTo > 0) ? Math.max(120, Math.round(duration * (remaining / animTo))) : duration;

      function frame(ts) {
        if (!animStart) animStart = ts;
        const elapsed = ts - animStart;
        const progress = Math.min(elapsed / scaledDuration, 1);
        const eased = easeOutCubic(progress);
        const current = Math.round(animFrom + eased * remaining);
        setFillPercent(current);

        if (progress < 1) {
          animFrameId = requestAnimationFrame(frame);
        } else {
          animFrameId = null;
          animated = false;
        }
      }
      animFrameId = requestAnimationFrame(frame);
    }

    function pauseAnimation() {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      // animated flag reset but keep current value so we can resume
      animated = false;
      animStart = null;
    }

    function resetFill() {
      // ongoing animation cancel
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      animated = false;
      animStart = null;
      setFillPercent(0);
    }

    // ভিউপোর্টে কতটা দেখা যাচ্ছে সেটার আনুমানিক হিসাব
    function visibleRatioOfBox(el) {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      // আড়াআড়িভাবে দেখা কিনা সেই ব্যাসিক চেক
      if (rect.width === 0 || rect.height === 0) return 0;
      const vertVisible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
      const horizVisible = Math.min(rect.right, vw) - Math.max(rect.left, 0);
      if (vertVisible <= 0 || horizVisible <= 0) return 0;
      // আমরা সহজেই ভেরটিকাল রেশিও বিবেচনা করছি
      const vRatio = Math.min(1, vertVisible / rect.height);
      return vRatio;
    }

    // IntersectionObserver ব্যবহার (smooth thresholds)
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: buildThresholdList()
    };

    function buildThresholdList() {
      const thresholds = [];
      for (let i = 0; i <= 1.0; i += 0.01) thresholds.push(i);
      return thresholds;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const ratio = entry.intersectionRatio; // 0..1

        if (ratio >= visibleThreshold) {
          // পর্যাপ্ত পরিমাণ দেখলে অ্যানিমেট শুরু/রিসেট না করে resume
          // যদি আগে থেকে কিছু ছিলো (আর না চালু থাকে) তখন বাকি অংশ থেকে চালাবে
          const currentNow = parseInt(fill.getAttribute('aria-valuenow') || '0', 10);
          if (currentNow >= animTo) {
            // already at/above target — nothing
            return;
          }
          animateFill(defaultDuration, currentNow);
        } else {
          // যদি ইউজার সত্যিই স্ক্রল করে সেকশনটি viewport থেকে তুলেছে (অর্থাৎ ইউজার visible অবস্থায়),
          // তখন রিসেট করা বুদ্ধিমানের কাজ — কিন্তু visibility change কারণে না।
          if (document.visibilityState === 'visible') {
            resetFill();
          } else {
            // ট্যাব hidden ইত্যাদি হলে শুধু pause কর — রিসেট না করা হবে
            pauseAnimation();
          }
        }
      });
    }, observerOptions);

    observer.observe(box);

    // --- ভিসিবিলিটি হ্যান্ডলিং ---
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // পেজ hidden হলে পজ করুন (রিসেট করবেন না) — যাতে ফিরে এলেই আগের মান থেকে রেসাম করা যায়
        pauseAnimation();
      } else {
        // পেজ visible হলে চেক করুন DOM এ ওই বক্স ভিউতে আছে কি না, থাকলে resume / start
        const ratio = visibleRatioOfBox(box);
        if (ratio >= visibleThreshold) {
          const currentNow = parseInt(fill.getAttribute('aria-valuenow') || '0', 10);
          if (currentNow < animTo) {
            // resume (scaled duration used inside animateFill)
            animateFill(defaultDuration, currentNow);
          }
        } else {
          // visible কিন্তু box অদৃশ্য -> কিছু না কর অথবা reset করতে চাইলে uncomment করুন
          // resetFill();
        }
      }
    });

    // Optional: উইন্ডো রিসাইজ/স্ক্রল এ চেক করে observer ছাড়া resume দরকার হলে handle করা যাবে
    window.addEventListener('scroll', () => {
      // যদি ইউজার স্ক্রল করে এসে বক্স ভিউতে আনে, তাহলে animate কর
      const ratio = visibleRatioOfBox(box);
      if (ratio >= visibleThreshold) {
        const currentNow = parseInt(fill.getAttribute('aria-valuenow') || '0', 10);
        if (currentNow < animTo) animateFill(defaultDuration, currentNow);
      }
    }, { passive: true });

  }); // boxes.forEach end
});
