document.addEventListener("DOMContentLoaded", () => {
  const schoolBtn = document.querySelector(".school");
  const collegeBtn = document.querySelector(".college");

  let schoolActive = false;
  let collegeActive = false;

  // track whether activation was done automatically by scroll
  let autoSchoolActivated = false;
  let autoCollegeActivated = false;

  function showContainers(selector) {
    const boxes = document.querySelectorAll(selector);
    boxes.forEach(box => {
      const delay = parseFloat(box.getAttribute("delay-second")) || 0;
      box.style.display = "block";
      setTimeout(() => {
        box.classList.add("show");
      }, delay * 1000);
    });
  }

  function hideContainers(selector) {
    const boxes = document.querySelectorAll(selector);
    boxes.forEach(box => {
      box.classList.remove("show");
      setTimeout(() => {
        box.style.display = "block";
      }, 1500); // wait for CSS transition
    });
  }

  // Button handlers (preserve original manual toggle behavior)
  schoolBtn?.addEventListener("click", () => {
    const schoolCanva = document.querySelector(".school-canva");

    if (!schoolActive) {
      showContainers(".school-content");
      schoolCanva?.classList.add("active-school");
      schoolActive = true;
      // if user manually toggles, clear auto-flag so scroll won't override
      autoSchoolActivated = false;
    } else {
      hideContainers(".school-content");
      schoolCanva?.classList.remove("active-school");
      schoolActive = false;
      autoSchoolActivated = false;
    }
  });

  collegeBtn?.addEventListener("click", () => {
    const collegeCanva = document.querySelector(".college-canva");

    if (!collegeActive) {
      showContainers(".college-content");
      collegeCanva?.classList.add("active-college");
      collegeActive = true;
      autoCollegeActivated = false;
    } else {
      hideContainers(".college-content");
      collegeCanva?.classList.remove("active-college");
      collegeActive = false;
      autoCollegeActivated = false;
    }
  });

  // IntersectionObserver to auto-activate when .education-tree-canvas comes into view
const target = document.querySelector(".education-tree-canvas");

if (target) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {

        // ৫০% ভিউতে এলে — SHOW
        if (entry.intersectionRatio >= 0.5) {
          if (!schoolActive) {
            showContainers(".school-content");
            document
              .querySelector(".school-canva")
              ?.classList.add("active-school");
            schoolActive = true;
          }

          if (!collegeActive) {
            showContainers(".college-content");
            document
              .querySelector(".college-canva")
              ?.classList.add("active-college");
            collegeActive = true;
          }
        }

        // ০% ভিউ (পুরো লুকানো) — HIDE
        else if (entry.intersectionRatio === 0) {
          if (schoolActive) {
            hideContainers(".school-content");
            document
              .querySelector(".school-canva")
              ?.classList.remove("active-school");
            schoolActive = false;
          }

          if (collegeActive) {
            hideContainers(".college-content");
            document
              .querySelector(".college-canva")
              ?.classList.remove("active-college");
            collegeActive = false;
          }
        }

      });
    },
    {
      threshold: [0, 0.5, 1],
    }
  );

  observer.observe(target);
}


});
