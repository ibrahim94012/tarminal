const schoolBtn = document.querySelector(".school");
const collegeBtn = document.querySelector(".college");

let schoolActive = false;
let collegeActive = false;

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
      box.style.display = "none";
    }, 1500); // wait for CSS transition
  });
}

// School button
schoolBtn.addEventListener("click", () => {
  const schoolCanva = document.querySelector(".school-canva");

  if (!schoolActive) {
    showContainers(".school-content");
    schoolCanva?.classList.add("active-school");
    schoolActive = true;
  } else {
    hideContainers(".school-content");
    schoolCanva?.classList.remove("active-school");
    schoolActive = false;
  }
});

// College button
collegeBtn.addEventListener("click", () => {
  const collegeCanva = document.querySelector(".college-canva");

  if (!collegeActive) {
    showContainers(".college-content");
    collegeCanva?.classList.add("active-college");
    collegeActive = true;
  } else {
    hideContainers(".college-content");
    collegeCanva?.classList.remove("active-college");
    collegeActive = false;
  }
});
