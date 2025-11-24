async function commandAddPhoto() {
    if (!unlocked) return writeLine("🔒 Vault locked");

    const API_KEY = "AIzaSyB3pv6r37RxeXOgiNcS4hT46cbyBzrBk9A";
    const FOLDER_ID = "1btpnxT69QtdcX_dW4gC_ekRrzUAxg7zI";
    const MAX_FILES = 10000;     // <-- capacity up to 10,000
    const DRIVE_PAGE_SIZE = 1000; // Drive max per page is 1000
    const ITEMS_PER_PAGE = 20;

    let originalFiles = []; // all fetched files (never mutated by filter)
    let allFiles = []; // currently filtered + sorted files shown in gallery
    let currentPage = 0;

    // Sorting state
    let sortBy = "modified"; // "modified" | "created" | "name"
    let sortDir = -1; // -1 => desc (newest first), 1 => asc (oldest/name A->Z)

    // Create gallery wrapper (only once)
    let wrapper = document.getElementById("gdrive-gallery");
    if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.id = "gdrive-gallery";
        wrapper.style.padding = "10px 0 10px 0";
        wrapper.style.fontFamily = "sans-serif";

        wrapper.innerHTML = `

    <div id="gdrive-toolbar">
      <div class="left">
        <select id="sortSelect" class="gdrive-select" aria-label="Sort by">
          <option value="modified">Modified time</option>
          <option value="created">Created time</option>
          <option value="name">Name</option>
        </select>
        <button id="sortDirBtn" class="gdrive-toggle" title="Toggle sort direction" aria-label="Toggle sort direction">Date Modified ▼</button>

        <!-- NEW: Separate Day / Month / Year filters -->
        <select id="dayFilter" class="gdrive-select" aria-label="Filter by days">
          <option value="0">Day</option>
          ${Array.from({length:30}, (_,i)=>`<option value="${i+1}">${i+1}</option>`).join("")}
        </select>

        <select id="monthFilter" class="gdrive-select" aria-label="Filter by months">
          <option value="0">Months</option>
          ${Array.from({length:12}, (_,i)=>`<option value="${i+1}">${i+1}</option>`).join("")}
        </select>

        <select id="yearFilter" class="gdrive-select" aria-label="Filter by years">
          <option value="0">Years</option>
          ${Array.from({length:10}, (_,i)=>`<option value="${i+1}">${i+1}</option>`).join("")}
        </select>
      </div>
      <div class="right">
        <div style="color:#666; font-size:13px; display:none;"></div>
      </div>
    </div>

    <div id="gallery"></div>

    <div style="margin-top:15px; text-align:center;">
        <button id="prevBtn" style="padding:6px 10px; margin-right:10px; cursor:pointer;"><i class="fa-solid fa-angle-left"></i></button>
        <button id="nextBtn" style="padding:6px 10px; cursor:pointer;"><i class="fa-solid fa-angle-right"></i></button>
    </div>
    <p id="pageInfo" style="text-align:center; margin-top:10px; color:#777;"></p>
`;
        document.getElementById("terminal").appendChild(wrapper);
    }

    const gallery = wrapper.querySelector("#gallery");
    const prevBtn = wrapper.querySelector("#prevBtn");
    const nextBtn = wrapper.querySelector("#nextBtn");
    const pageInfo = wrapper.querySelector("#pageInfo");

    // toolbar elements
    const sortSelect = wrapper.querySelector("#sortSelect");
    const sortDirBtn = wrapper.querySelector("#sortDirBtn");
    const dayFilter = wrapper.querySelector("#dayFilter");
    const monthFilter = wrapper.querySelector("#monthFilter");
    const yearFilter = wrapper.querySelector("#yearFilter");

    // Lightbox element (single, reused)
    let lightbox = document.getElementById("gdrive-lightbox");
    if (!lightbox) {
        lightbox = document.createElement("div");
        lightbox.id = "gdrive-lightbox";
        Object.assign(lightbox.style, {
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.85)",
            zIndex: 9999,
        });
        lightbox.innerHTML = `
            <div id="lightbox">
                <div id="lb-controls">
                    <button id="lb-close" aria-label="Close">Close ✕</button>
                </div>
                <button id="lb-prev">⟨</button>
                <img id="lb-img" src="" />
                <button id="lb-next">⟩</button>
            </div>
        `;
        document.body.appendChild(lightbox);
    }
    const lbImg = lightbox.querySelector("#lb-img");
    const lbClose = lightbox.querySelector("#lb-close");
    const lbPrev = lightbox.querySelector("#lb-prev");
    const lbNext = lightbox.querySelector("#lb-next");

    lbClose.onclick = () => { lightbox.style.display = "none"; lbImg.src = ""; };
    lightbox.onclick = (e) => { if (e.target === lightbox) { lightbox.style.display = "none"; lbImg.src = ""; } };
    lbPrev.onclick = (e) => { e.stopPropagation(); showLightbox(currentLightboxIndex - 1); };
    lbNext.onclick = (e) => { e.stopPropagation(); showLightbox(currentLightboxIndex + 1); };
    document.addEventListener("keydown", (e) => {
        if (lightbox.style.display === "flex" || lightbox.style.display === "block") {
            if (e.key === "ArrowLeft") showLightbox(currentLightboxIndex - 1);
            if (e.key === "ArrowRight") showLightbox(currentLightboxIndex + 1);
            if (e.key === "Escape") { lightbox.style.display = "none"; lbImg.src = ""; }
        }
    });

    let currentLightboxIndex = -1;
    function showLightbox(index) {
        if (!allFiles || allFiles.length === 0) return;
        index = (index + allFiles.length) % allFiles.length;
        currentLightboxIndex = index;
        const f = allFiles[index];
        // better large image URL
        const largeUrl = `https://drive.google.com/thumbnail?id=${f.id}&sz=s200`;
        lbImg.src = largeUrl;
        lightbox.style.display = "flex";
    }

    // Fetch up to MAX_FILES images using paging (Drive pageSize up to 1000)
    async function fetchAllImages() {
        let files = [];
        let pageToken = null;
        try {
            do {
                const url =
                    `https://www.googleapis.com/drive/v3/files` +
                    `?q='${FOLDER_ID}' in parents and mimeType contains 'image/'` +
                    `&fields=nextPageToken,files(id,name,createdTime,modifiedTime,thumbnailLink,parents)` +
                    `&pageSize=${DRIVE_PAGE_SIZE}` +
                    (pageToken ? `&pageToken=${pageToken}` : "") +
                    `&key=${API_KEY}`;
                const res = await fetch(url);
                const data = await res.json();
                if (data && data.files && data.files.length) {
                    files = files.concat(data.files);
                }
                pageToken = data.nextPageToken;
                // stop when we reach MAX_FILES
                if (files.length >= MAX_FILES) break;
            } while (pageToken);
        } catch (err) {
            console.error("Error fetching images:", err);
            writeLine("⚠️ Error fetching images. Check console for details.");
        }
        // trim to MAX_FILES in case
        return files.slice(0, MAX_FILES);
    }

    // IntersectionObserver for lazy loading
    const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.dataset.src;
                if (src && img.src !== src) {
                    img.src = src;
                }
                img.removeAttribute("data-src");
                obs.unobserve(img);
            }
        });
    }, { root: null, rootMargin: "200px", threshold: 0.01 });

    // Helper: diff YMD
    function diffYMD(fromDate, toDate) {
        let y1 = fromDate.getFullYear(), m1 = fromDate.getMonth(), d1 = fromDate.getDate();
        let y2 = toDate.getFullYear(), m2 = toDate.getMonth(), d2 = toDate.getDate();
        let years = y2 - y1;
        let months = m2 - m1;
        let days = d2 - d1;
        if (days < 0) {
            const prevMonthLastDay = new Date(y2, m2, 0).getDate();
            days += prevMonthLastDay;
            months -= 1;
        }
        if (months < 0) {
            months += 12;
            years -= 1;
        }
        return { years, months, days };
    }

    // Filtering helper (updated: day/month/year selects, show items age >= selected)
// Unified range filter: day/month/year all work as N <= age < N+1
function applyFilter() {
    const now = new Date();
    if (!originalFiles || originalFiles.length === 0) {
        allFiles = [];
        return;
    }

    const dayVal = Number(dayFilter.value || 0);
    const monthVal = Number(monthFilter.value || 0);
    const yearVal = Number(yearFilter.value || 0);

    // If all filters are 0 → show all
    if (dayVal === 0 && monthVal === 0 && yearVal === 0) {
        allFiles = [...originalFiles];
        return;
    }

    allFiles = originalFiles.filter(file => {
        const fileDate = file.modifiedTime
            ? new Date(file.modifiedTime)
            : (file.createdTime ? new Date(file.createdTime) : now);

        if (fileDate > now) return false;

        const diff = diffYMD(fileDate, now);

        // Exact time differences
        const diffMs = Math.abs(now - fileDate);
        const ageDays = diffMs / (1000 * 60 * 60 * 24);    // fractional days
        const ageMonths = ageDays / 30;                    // approx
        const ageYears = ageDays / 365;                    // approx

        // DAY RANGE: N ≤ days < N+1
        if (dayVal > 0) {
            return ageDays >= dayVal && ageDays < (dayVal + 1);
        }

        // MONTH RANGE: N ≤ months < N+1
        if (monthVal > 0) {
            return ageMonths >= monthVal && ageMonths < (monthVal + 1);
        }

        // YEAR RANGE: N ≤ years < N+1
        if (yearVal > 0) {
            return ageYears >= yearVal && ageYears < (yearVal + 1);
        }

        return true;
    });
}



    // Sorting helper (operates on allFiles)
function applySort(keepPage = false) {
    const comparator = (a, b) => {
        if (sortBy === "name") {
            const na = (a.name || "").toLowerCase();
            const nb = (b.name || "").toLowerCase();
            if (na < nb) return -1 * sortDir;
            if (na > nb) return 1 * sortDir;
            return 0;
        } else if (sortBy === "created") {
            const ta = new Date(a.createdTime || a.modifiedTime || 0).getTime();
            const tb = new Date(b.createdTime || b.modifiedTime || 0).getTime();
            return (ta - tb) * sortDir;
        } else {
            const ta = new Date(a.modifiedTime || a.createdTime || 0).getTime();
            const tb = new Date(b.modifiedTime || b.createdTime || 0).getTime();
            return (ta - tb) * sortDir;
        }
    };

    allFiles.sort((a, b) => comparator(a, b));

    if (!keepPage) currentPage = 0;

    const arrow = sortDir === -1
        ? '<i class="fa-solid fa-angle-down"></i>'
        : '<i class="fa-solid fa-angle-up"></i>';

    const label =
        sortBy === "name" ? "Name" :
        sortBy === "created" ? "Created" :
        "Modified";

    // FIXED ↓
    sortDirBtn.innerHTML = `${label} ${arrow}`;

    renderPage();
}


    // Render one page
    function renderPage() {
        gallery.innerHTML = "";

        const start = currentPage * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageItems = allFiles.slice(start, end);
        const now = new Date();

        pageItems.forEach((f, idx) => {
            const globalIndex = start + idx; // for lightbox navigation

            const container = document.createElement("div");
            container.className = "gdrive-container";

            const img = document.createElement("img");
            const thumb = f.thumbnailLink || `https://drive.google.com/thumbnail?id=${f.id}&sz=s200`;
            img.dataset.src = thumb;
            img.alt = f.name || "";
            img.className = "gdrive-img gdrive-lazy";
            img.loading = "lazy";

            const caption = document.createElement("div");
            caption.className = "caption";
            caption.style.padding = "5px 8px";
            caption.style.fontSize = "12px";
            caption.style.color = "#444";
            caption.textContent = "Loading date...";

            // Responsive hide (initial)
            if (window.innerWidth <= 580) {
                caption.style.display = "none";
            } else {
                caption.style.display = "block";
            }

            // NEW badge placeholder
            const newBadge = document.createElement("div");
            Object.assign(newBadge.style, {
                position: "absolute",
                top: "5px",
                left: "5px",
                background: "#ff3b30",
                color: "#fff",
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: "bold",
                display: "none",
                zIndex: 6
            });
            newBadge.textContent = "NEW";

            // Anniversary badge placeholder
            const annBadge = document.createElement("div");
            Object.assign(annBadge.style, {
                position: "absolute",
                top: "6px",
                left: "6px",
                background: "linear-gradient(90deg, #ff1b1b, #ff9b1b)",
                color: "#fff",
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: "700",
                display: "none",
                zIndex: 6,
                boxShadow: ` 0 0 10px #ff1b1b, 0 0 20px #ff9b1b)`
            });
            annBadge.textContent = "years old";

            // Menu button (ellipsis vertical)
            const menuWrap = document.createElement("div");
            menuWrap.className = "gmenu";
            menuWrap.innerHTML = `
                <button aria-label="menu" title="Menu"><i class="fa-light fa-circle-ellipsis-vertical"></i></button>
                <div class="gmenu-panel" role="menu">
                    <button class="menu-download"><i style="width: 20px; " class="fa-solid fa-download"></i> Download</button>
                    <button class="menu-open-link"><i style="width: 20px; " class="fa-solid fa-file"></i> file</button>
                    <button class="menu-open-parent"><i style="width: 20px; " class="fa-solid fa-folder-open"></i> folder</button>
                </div>
            `;
            // prevent container click when interacting with menu
            menuWrap.addEventListener("click", (ev) => { ev.stopPropagation(); });
            // toggle panel
            const mbtn = menuWrap.querySelector("button");
            const mpanel = menuWrap.querySelector(".gmenu-panel");
            mbtn.addEventListener("click", (ev) => {
                ev.stopPropagation();
                // close any other open panels
                document.querySelectorAll(".gmenu .gmenu-panel").forEach(p => { if (p !== mpanel) p.style.display = "none"; });
                mpanel.style.display = mpanel.style.display === "block" ? "none" : "block";
            });
            // close on outside click
            document.addEventListener("click", () => { mpanel.style.display = "none"; });

            // menu actions
            menuWrap.querySelector(".menu-download").addEventListener("click", (e) => {
                e.stopPropagation();
                const dlUrl = `https://drive.google.com/uc?export=download&id=${f.id}`;
                const a = document.createElement("a");
                a.href = dlUrl;
                a.download = f.name || "image.jpg";
                document.body.appendChild(a);
                a.click();
                a.remove();
                mpanel.style.display = "none";
            });
            menuWrap.querySelector(".menu-open-link").addEventListener("click", (e) => {
                e.stopPropagation();
                const fileUrl = `https://drive.google.com/file/d/${f.id}/view`;
                window.open(fileUrl, "_blank");
                mpanel.style.display = "none";
            });
            menuWrap.querySelector(".menu-open-parent").addEventListener("click", async (e) => {
                e.stopPropagation();
                if (f.parents && f.parents.length) {
                    const parentId = f.parents[0];
                    const folderUrl = `https://drive.google.com/drive/folders/${parentId}`;
                    window.open(folderUrl, "_blank");
                } else {
                    const fileUrl = `https://drive.google.com/file/d/${f.id}/view`;
                    window.open(fileUrl, "_blank");
                }
                mpanel.style.display = "none";
            });

            container.appendChild(img);
            container.appendChild(caption);
            container.appendChild(newBadge);
            container.appendChild(annBadge);
            container.appendChild(menuWrap);

            // When image loaded (from lazy src), show Modified date from Drive metadata and badges
            img.addEventListener("load", async () => {
                const now = new Date();
                let modifiedDate = null;
                if (f.modifiedTime) {
                    modifiedDate = new Date(f.modifiedTime);
                } else if (f.createdTime) {
                    modifiedDate = new Date(f.createdTime);
                } else {
                    modifiedDate = new Date();
                }
                if (modifiedDate > now) modifiedDate = now;

                const { years, months, days } = diffYMD(modifiedDate, now);
                const diffTime = Math.abs(now - modifiedDate);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const pad2 = n => String(n).padStart(2, "0");

                // NEW badge: within 7 days
                if (diffDays <= 7) {
                    newBadge.style.display = "block";
                } else {
                    newBadge.style.display = "none";
                }

                // Anniversary badge: for >=1 year
                if (years >= 1) {
                    const annText = `${years} years old`;
                    annBadge.textContent = annText;
                    annBadge.style.display = "block";
                    annBadge.style.color = "#fff";

                    if (years >= 7) {
                        annBadge.style.background = "linear-gradient(90deg, #ff1b1b, #ff9b1b)";
                        annBadge.style.boxShadow = "0 4px 12px #ff1b1b, 0 4px 12px #ff9b1b";
                    } 
                    else if (years >= 6) {
                        annBadge.style.background = "linear-gradient(90deg, #ff3d3d, #ff7b1b)";
                        annBadge.style.boxShadow = "0 4px 12px #ff3d3d, 0 4px 12px #ff7b1b";
                    }
                    else if (years >= 5) {
                        annBadge.style.background = "linear-gradient(90deg, #f4b000, #ffd84d)";
                        annBadge.style.boxShadow = "0 4px 12px #f4b000, 0 4px 12px #ffd84d";
                    }
                    else if (years >= 4) {
                        annBadge.style.background = "linear-gradient(90deg, #ffce32, #ffa600)";
                        annBadge.style.boxShadow = "0 4px 12px #ffce32, 0 4px 12px #ffa600";
                    }
                    else if (years >= 3) {
                        annBadge.style.background = "linear-gradient(90deg, #8a00ff, #b44dff)";
                        annBadge.style.boxShadow = "0 4px 12px #8a00ff, 0 4px 12px #b44dff";
                    }
                    else if (years >= 2) {
                        annBadge.style.background = "linear-gradient(90deg, #6a00ff, #9d4dff)";
                        annBadge.style.boxShadow = "0 4px 12px #6a00ff, 0 4px 12px #9d4dff";
                    }
                    else {
                        annBadge.style.background = "linear-gradient(90deg, #5200ff, #8f4dff)";
                        annBadge.style.boxShadow = "0 4px 12px #5200ff, 0 4px 12px #8f4dff";
                    }

                } else {
                    annBadge.style.display = "none";
                }

                // Caption text (friendly human readable)
                if (years >= 1) {
                    caption.textContent = `${pad2(years)} year ${pad2(months)} month ${pad2(days)} day's ago`;
                } else if (months >= 1) {
                    if (days > 0) caption.textContent = `${months} month ${days} day's ago`;
                    else caption.textContent = `${months} month's ago`;
                } else {
                    caption.textContent = `${diffDays} day's ago`;
                }
            });

            // open lightbox on click (use global index)
            container.addEventListener("click", () => {
                showLightbox(globalIndex);
            });

            gallery.appendChild(container);

            // observe image for lazy loading
            io.observe(img);
        });

        const totalPages = Math.ceil(allFiles.length / ITEMS_PER_PAGE) || 1;
        // compute filter label
        let filterLabel = "";
        if (Number(dayFilter.value) > 0) filterLabel = `${dayFilter.value}+ days`;
        else if (Number(monthFilter.value) > 0) filterLabel = `${monthFilter.value}+ months`;
        else if (Number(yearFilter.value) > 0) filterLabel = `${yearFilter.value}+ years`;

        pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages} — ${allFiles.length} items ${filterLabel ? `(${filterLabel})` : ''}`;
        prevBtn.disabled = currentPage === 0;
        nextBtn.disabled = currentPage >= totalPages - 1;
    }

    // Button events
    prevBtn.onclick = () => {
        if (currentPage > 0) {
            currentPage--;
            renderPage();
        }
    };
    nextBtn.onclick = () => {
        const totalPages = Math.ceil(allFiles.length / ITEMS_PER_PAGE);
        if (currentPage < totalPages - 1) {
            currentPage++;
            renderPage();
        }
    };

    // Toolbar events
    sortSelect.addEventListener("change", (e) => {
        sortBy = e.target.value;
        applySort(); // resets to page 0
    });
    sortDirBtn.addEventListener("click", () => {
        // toggle direction
        sortDir = sortDir === -1 ? 1 : -1;
        applySort();
    });

    // When user changes one filter, reset the other two so only one active at a time
    dayFilter.addEventListener("change", (e) => {
        if (Number(e.target.value) > 0) {
            monthFilter.value = "0";
            yearFilter.value = "0";
        }
        applyFilter();
        applySort(false);
    });
    monthFilter.addEventListener("change", (e) => {
        if (Number(e.target.value) > 0) {
            dayFilter.value = "0";
            yearFilter.value = "0";
        }
        applyFilter();
        applySort(false);
    });
    yearFilter.addEventListener("change", (e) => {
        if (Number(e.target.value) > 0) {
            dayFilter.value = "0";
            monthFilter.value = "0";
        }
        applyFilter();
        applySort(false);
    });

    // INITIAL LOAD
    writeLine("⏳ Fetching photos from Google Drive (up to 10,000)...");
    originalFiles = await fetchAllImages();
    // initial filter = all
    dayFilter.value = "0";
    monthFilter.value = "0";
    yearFilter.value = "0";
    applyFilter();
    // default sort: modified desc
    sortBy = "modified";
    sortDir = -1;
    applySort(false); // this will set currentPage = 0 and render
    writeLine(`✅ ${originalFiles.length} photos Loaded!`);
}
