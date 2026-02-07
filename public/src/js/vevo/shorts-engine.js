// src/js/vevo/shorts-engine.js

import { adatbazis as db } from "../util/firebase-config.js";
import {
  collection,
  query,
  orderBy,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GLOBÁLIS VÁLTOZÓK ---
const videoFeed = document.querySelector(".video-feed");
let allVideos = [];
let currentView = "main";
window.isGloballyMuted = true;

const BP_DISTRICTS = [
  "I.",
  "II.",
  "III.",
  "IV.",
  "V.",
  "VI.",
  "VII.",
  "VIII.",
  "IX.",
  "X.",
  "XI.",
  "XII.",
  "XIII.",
  "XIV.",
  "XV.",
  "XVI.",
  "XVII.",
  "XVIII.",
  "XIX.",
  "XX.",
  "XXI.",
  "XXII.",
  "XXIII.",
];

const MAIN_CATEGORIES = [
  {
    id: "budapest",
    title: "Budapest",
    icon: "🏙️",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "selector",
    selectorType: "kerulet",
    hint: "Kerületek szerint",
  },
  {
    id: "videk",
    title: "Vidéki Élet",
    icon: "🌳",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "selector",
    selectorType: "telepules",
    hint: "Városok és falvak",
  },
  {
    id: "lakopark",
    title: "Lakópark",
    icon: "🏢",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "selector",
    selectorType: "lakopark_telepules",
    hint: "Városválasztó",
  },
  {
    id: "alberlet",
    title: "Albérlet",
    icon: "🔑",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "selector",
    selectorType: "alberlet_telepules",
    hint: "Város + Kerület",
  },
  {
    id: "garazs",
    title: "Garázs",
    icon: "🚗",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "selector",
    selectorType: "garazs_telepules",
    hint: "Helyszín szerint",
  },
  {
    id: "olcso",
    title: "50M alatt",
    icon: "💰",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "selector",
    selectorType: "olcso_telepules",
    hint: "Településenként",
  },
  {
    id: "luxus",
    title: "Luxus",
    icon: "💎",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "selector",
    selectorType: "luxus_telepules",
    hint: "Városok szerint",
  },
  {
    id: "hb_id",
    title: "HB Kereső",
    icon: "🔍",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "selector",
    selectorType: "hb_search",
    hint: "Egyedi azonosító",
  },
];

// --- INDÍTÁS ---
document.addEventListener("DOMContentLoaded", () => {
  loadVideos();
  setupGlobalClicks();
});

function setupGlobalClicks() {
  document.addEventListener("click", (e) => {
    if (e.target.closest(".filter-trigger-btn")) window.openFilterModal();
    if (e.target.closest(".close-filter-btn")) closeFilterModal();
  });
}

// --- ADATOK BETÖLTÉSE ---
async function loadVideos() {
  try {
    const q = query(collection(db, "lakasok"), orderBy("order", "asc"));
    const snapshot = await getDocs(q);
    allVideos = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.videoUrl) {
        allVideos.push({
          id: doc.id,
          ...data,
          vételár: Number(data.vételár) || 0,
          telepules: data.telepules || "Budapest",
          kerulet: data.kerulet || "",
        });
      }
    });

    if (allVideos.length > 0) renderVideos(allVideos);
    const lastId = sessionStorage.getItem("lastShortId");
    if (lastId) {
      scrollToVideo(lastId);
      sessionStorage.removeItem("lastShortId"); // Töröljük, hogy ne ugorjon oda legközelebb is magától
    }
  } catch (error) {
    console.error("Firebase hiba:", error);
  }
}

// --- MODAL ÉS RÁCS KEZELÉS ---
window.openFilterModal = () => {
  const modal = document.getElementById("filter-modal");
  const content = document.getElementById("filter-content");
  if (!modal) return;
  modal.classList.remove("hidden");
  setTimeout(() => content.classList.remove("translate-y-full"), 10);
  renderDiscoveryGrid(currentView);
};

function closeFilterModal() {
  const modal = document.getElementById("filter-modal");
  const content = document.getElementById("filter-content");
  if (!modal) return;
  content.classList.add("translate-y-full");
  setTimeout(() => modal.classList.add("hidden"), 300);
}

function renderDiscoveryGrid(view = "main") {
  const grid = document.getElementById("discovery-grid");
  const modalTitle = document.querySelector("#filter-content h3");
  if (!grid) return;

  grid.innerHTML = "";
  currentView = view;

  // Mindig visszaállítjuk a rácsot, kivéve a HB keresőnél
  if (view !== "hb_search") {
    grid.className = "grid grid-cols-2 gap-3 overflow-y-auto flex-1 pb-4 pr-1";
  }

  handleBackButtonVisibility(view, modalTitle);

  if (view === "main") {
    renderMainMenu(grid, modalTitle);
    return;
  }

  if (view === "kerulet") {
    renderDistrictMenu(grid, modalTitle);
    return;
  }

  if (view.includes("_telepules") || view === "telepules") {
    renderTelepulesMenu(view, grid, modalTitle);
    return;
  }

  if (view === "hb_search") {
    renderHBSearch(grid, modalTitle);
    return;
  }

  if (view === "alberlet_kerulet") {
    renderAlberletKeruletMenu(grid, modalTitle);
    return;
  }
}

function createTile(
  title,
  icon,
  color,
  onClick,
  infoText = "Megtekintés",
  bgImg = null
) {
  const btn = document.createElement("button");
  btn.className = `relative h-32 rounded-2xl overflow-hidden shadow-lg border border-[#E2F1B0]/20 transition active:scale-95 bg-cover bg-center bg-[#3D4A16]`;

  if (bgImg) btn.style.backgroundImage = `url('${bgImg}')`;

  btn.innerHTML = `
      <div class="absolute inset-0 bg-gradient-to-br ${color} opacity-70 mix-blend-multiply"></div>
      <div class="absolute inset-0 flex flex-col items-center justify-center text-white p-2 z-10">
          ${
            icon
              ? `<div class="text-3xl mb-1 drop-shadow-lg">${icon}</div>`
              : ""
          }
          <div class="font-bold text-base leading-tight text-center drop-shadow-md uppercase tracking-wide">${title}</div>
          <div class="text-[10px] mt-2 bg-[#E2F1B0] text-[#3D4A16] px-3 py-0.5 rounded-full font-bold shadow-sm opacity-90">
              ${infoText}
          </div>
      </div>
  `;
  btn.onclick = onClick;
  return btn;
}

// --- SZŰRÉS ÉS RENDERELÉS ---
function applyFilterAndStart(filterFn) {
  if (typeof filterFn !== "function") {
    console.error("Hiba: A szűrőfeltétel nem egy függvény!", filterFn);
    return;
  }
  const filtered = allVideos.filter(filterFn);
  renderVideos(filtered);
  closeFilterModal();
}

function renderVideos(list) {
  videoFeed.innerHTML = "";
  console.log(`Keresési segédlet: ${list.length} találat megjelenítve.`);
  list.forEach((data) => videoFeed.appendChild(createVideoCard(data)));
  setupVideoObserver();
}

function createVideoCard(data) {
  const container = document.createElement("div");
  container.className = "video-container";

  const arText =
    data.vételár > 0
      ? Number(data.vételár).toLocaleString() + " Ft"
      : "Ár: Érdeklődjön telefonon";
  const muteIcon = window.isGloballyMuted ? "🔇" : "🔊";
  const muteBorder = window.isGloballyMuted
    ? "rgba(255, 255, 255, 0.2)"
    : "#E2F1B0";

  container.innerHTML = `
        <video src="${data.videoUrl}" loop playsinline muted></video>
        <div class="play-icon" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 4rem; color: white; opacity: 0; pointer-events: none; z-index: 10;">▶</div>
        <div class="video-overlay">
            <div class="controls">
                <a href="../../../index.html" class="menu-btn" title="Főoldal">🏠</a>
                <button class="filter-trigger-btn" style="border-color: #E2F1B0;" title="Keresés és szűrés">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E2F1B0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                    </svg>
                </button>
                
                <button class="bkk-btn" style="border-color: #E2F1B0; font-size: 1.2rem;" title="Közlekedés és környék infó">🚌</button>
                
                <button class="mute-btn" style="border-color: ${muteBorder}">${muteIcon}</button>
                <button class="info-btn">📄</button>
            </div>
            <div class="video-info">
                <span class="brand-badge">${data.id}</span>
                <h3>${data.telepules}${
    data.kerulet ? `, ${data.kerulet}` : ""
  }${data.utca ? `, ${data.utca}` : ""}</h3>
                <p class="text-xl font-bold text-white mb-1">${arText}</p>
                <p class="specs">${data.alapterület || 0} m² • ${
    data.szobák || 0
  } szoba</p>
            </div>
        </div>
    `;

  const video = container.querySelector("video");
  const playIcon = container.querySelector(".play-icon");

  // --- BKK GOMB ESEMÉNYKEZELŐ ---
  container.querySelector(".bkk-btn").onclick = (e) => {
    e.stopPropagation();
    // Meghívjuk a korábban megírt ablakmegnyitó logikát, átadva a videó adatait
    if (typeof window.mutassKozlekedest === "function") {
      window.mutassKozlekedest(data);
    } else {
      console.error("A mutassKozlekedest függvény még nincs betöltve!");
    }
  };

  container.addEventListener("click", (e) => {
    if (e.target.closest("button") || e.target.closest("a")) return;
    if (video.paused) {
      video.play();
      playIcon.style.opacity = "0";
    } else {
      video.pause();
      playIcon.style.opacity = "1";
    }
  });

  container.querySelector(".mute-btn").onclick = (e) => {
    e.stopPropagation();
    toggleGlobalMute();
  };
  container.querySelector(".info-btn").onclick = (e) => {
    e.stopPropagation();
    sessionStorage.setItem("lastShortId", data.id);
    window.location.href = `adatlap.html?id=${data.id}`;
  };

  return container;
}
// --- SEGÉDFUNKCIÓK ---
window.toggleGlobalMute = function () {
  window.isGloballyMuted = !window.isGloballyMuted;
  document
    .querySelectorAll("video")
    .forEach((v) => (v.muted = window.isGloballyMuted));
  document.querySelectorAll(".mute-btn").forEach((btn) => {
    btn.innerHTML = window.isGloballyMuted ? "🔇" : "🔊";
    btn.style.borderColor = window.isGloballyMuted
      ? "rgba(255, 255, 255, 0.2)"
      : "#E2F1B0";
  });
};

function setupVideoObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
          video.muted = window.isGloballyMuted;
        } else {
          video.pause();
          video.currentTime = 0;
        }
      });
    },
    { threshold: 0.6 }
  );

  document
    .querySelectorAll(".video-container video")
    .forEach((v) => observer.observe(v));
}

window.szuroTorlese = function () {
  currentView = "main";
  renderVideos(allVideos);
  closeFilterModal();
};

function scrollToVideo(id) {
  setTimeout(() => {
    const targetVideo = document
      .querySelector(`.info-btn[data-id="${id}"]`)
      ?.closest(".video-container");
    if (targetVideo) {
      targetVideo.scrollIntoView({ behavior: "smooth" });
    }
  }, 500); // Hagyunk egy kis időt a renderelésnek
}

window.searchByHBID = function () {
  const input = document.getElementById("hb-input");
  if (!input) return;

  const rawId = input.value.trim().toUpperCase();
  if (!rawId) {
    alert("Kérlek, írj be egy azonosítót!");
    return;
  }

  const foundIndex = allVideos.findIndex(
    (v) =>
      (v.id && v.id.toUpperCase().includes(rawId)) ||
      (v.azon && v.azon.toUpperCase().includes(rawId))
  );

  if (foundIndex !== -1) {
    const reorderedList = [...allVideos];
    const targetVideo = reorderedList.splice(foundIndex, 1)[0];
    reorderedList.unshift(targetVideo);

    // 1. Kirajzoljuk az új sorrendet
    renderVideos(reorderedList);

    // 2. Kényszerítjük a lejátszót, hogy az elejére ugorjon
    // Megkeressük a konténert, amiben a videók vannak
    const container =
      document.getElementById("video-container") ||
      document.querySelector(".shorts-container");

    if (container) {
      // Ha sima görgetős a felületed:
      container.scrollTo({ top: 0, behavior: "instant" });
    }

    // Ha Swiper.js-t használsz, akkor ez is kellhet:
    if (window.swiperInstance) {
      window.swiperInstance.slideTo(0, 0); // Azonnali ugrás az első diára
    }

    // 3. UI takarítás
    closeFilterModal();

    // Biztonsági görgetés a teljes ablakra
    window.scrollTo(0, 0);
  } else {
    alert("Nincs találat erre az azonosítóra: " + rawId);
  }
};

function renderHBSearch(grid, modalTitle) {
  modalTitle.innerText = "Keresés HB-ID alapján";
  grid.className = "flex flex-col gap-4 p-6";
  grid.innerHTML = `
    <div class="bg-white/5 p-6 rounded-2xl border border-[#E2F1B0]/20 text-center">
        <input type="text" id="hb-input" placeholder="HB-407050" 
               class="w-full bg-black/40 border border-[#E2F1B0]/30 p-4 rounded-xl text-white text-center font-mono outline-none focus:border-[#E2F1B0]">
        <button onclick="window.searchByHBID()" class="w-full mt-4 bg-[#E2F1B0] text-[#3D4A16] font-bold py-4 rounded-xl active:scale-95 transition">
            KERESÉS
        </button>
    </div>
  `;
}
function handleBackButtonVisibility(view, modalTitle) {
  const titleContainer = modalTitle.parentElement;
  const existingBack = titleContainer.querySelector(".back-nav-btn");

  if (view !== "main") {
    if (!existingBack) {
      const backBtn = document.createElement("button");
      backBtn.className =
        "back-nav-btn mr-3 p-2 bg-white/10 rounded-full text-white active:scale-90 transition";
      backBtn.innerHTML = "⬅️";
      backBtn.onclick = () => renderDiscoveryGrid("main");
      titleContainer.prepend(backBtn);
    }
  } else if (existingBack) {
    existingBack.remove();
  }
}

function renderMainMenu(grid, modalTitle) {
  modalTitle.innerText = "Keresési segédlet 🧭";
  MAIN_CATEGORIES.forEach((cat) => {
    grid.appendChild(
      createTile(
        cat.title,
        cat.icon,
        cat.color,
        () => {
          renderDiscoveryGrid(cat.selectorType);
        },
        cat.hint
      )
    );
  });
}

function renderDistrictMenu(grid, modalTitle) {
  modalTitle.innerText = "Budapesti kerületek";
  BP_DISTRICTS.forEach((ker) => {
    const count = allVideos.filter(
      (v) => v.telepules === "Budapest" && v.kerulet === ker
    ).length;
    const bgImg = `https://media.hazbazis.hu/shorts/filter-img/${ker.replace(
      ".",
      ""
    )}.webp`;
    grid.appendChild(
      createTile(
        ker,
        "",
        count > 0 ? "from-blue-600/80 to-blue-900/80" : "opacity-40",
        () => {
          if (count > 0)
            applyFilterAndStart(
              (v) => v.telepules === "Budapest" && v.kerulet === ker
            );
        },
        `${count} videó`,
        bgImg
      )
    );
  });
}

function renderTelepulesMenu(view, grid, modalTitle) {
  let filterBase = (v) => true;

  // 1. Meghatározzuk a kategória alapfeltételét
  if (view === "telepules") {
    modalTitle.innerText = "Vidéki városok";
    filterBase = (v) => v.telepules !== "Budapest" && v.kategoria !== "kiado";
  } else if (view === "alberlet_telepules") {
    modalTitle.innerText = "Albérletek városonként";
    filterBase = (v) => v.kategoria === "kiado";
  } else if (view === "garazs_telepules") {
    modalTitle.innerText = "Garázsok városonként";
    filterBase = (v) => v.tipus === "Garázs";
  } else if (view === "olcso_telepules") {
    modalTitle.innerText = "Olcsó ingatlanok (50M alatt)";
    filterBase = (v) =>
      v.vételár > 0 && v.vételár <= 50000000 && v.kategoria !== "kiado";
  } else if (view === "luxus_telepules") {
    modalTitle.innerText = "Luxus ingatlanok (>120M)";
    filterBase = (v) => v.vételár >= 120000000;
  } else if (view === "lakopark_telepules") {
    modalTitle.innerText = "Lakóparkok városonként";
    filterBase = (v) => v.lakopark_e === "Igen";
  }

  // 2. Kigyűjtjük azokat a városokat, ahol van az adott feltételnek megfelelő videó
  const varosok = [
    ...new Set(allVideos.filter(filterBase).map((v) => v.telepules)),
  ]
    .filter(Boolean)
    .sort();

  // 3. Legeneráljuk a csempéket a pontos darabszámmal
  varosok.forEach((v) => {
    const count = allVideos.filter(
      (item) => filterBase(item) && item.telepules === v
    ).length;

    grid.appendChild(
      createTile(
        v,
        "",
        "from-[#3D4A16] to-green-800",
        () => {
          // Speciális eset: Albérletnél Budapesten belül menjünk kerületekre
          if (v === "Budapest" && view === "alberlet_telepules") {
            renderDiscoveryGrid("alberlet_kerulet");
          } else {
            applyFilterAndStart(
              (item) => filterBase(item) && item.telepules === v
            );
          }
        },
        `${count} videó`
      )
    );
  });
}

function renderAlberletKeruletMenu(grid, modalTitle) {
  modalTitle.innerText = "Budapesti albérletek";
  BP_DISTRICTS.forEach((ker) => {
    const count = allVideos.filter(
      (v) =>
        v.kategoria === "kiado" &&
        v.telepules === "Budapest" &&
        v.kerulet === ker
    ).length;
    const bgImg = `https://media.hazbazis.hu/shorts/filter-img/${ker.replace(
      ".",
      ""
    )}.webp`;

    grid.appendChild(
      createTile(
        ker,
        "",
        count > 0 ? "from-blue-600/80 to-blue-900/80" : "opacity-40",
        () => {
          if (count > 0)
            applyFilterAndStart(
              (v) =>
                v.kategoria === "kiado" &&
                v.telepules === "Budapest" &&
                v.kerulet === ker
            );
        },
        `${count} kiadó`,
        bgImg
      )
    );
  });
}
// Minden videóhoz hozzáadjuk, településtől függetlenül
function addTransitButton(videoData, iconContainer) {
  const bkkBtn = document.createElement("div");
  bkkBtn.className =
    "flex flex-col items-center gap-1 group cursor-pointer mb-4";

  // Átadjuk a videó adatait a kattintáskezelőnek
  bkkBtn.onclick = () => window.mutassKozlekedest(videoData);

  bkkBtn.innerHTML = `
      <div class="w-11 h-11 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 group-hover:bg-[#E2F1B0] group-hover:text-black transition-all shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="7" y="10" width="10" height="8" rx="2"></rect>
              <path d="M17 18v1"></path><path d="M7 18v1"></path>
              <path d="M14 18h-4"></path><path d="M8 6h8"></path>
              <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7"></path>
          </svg>
      </div>
      <span class="text-[8px] font-bold uppercase tracking-wider text-white/80">Közlekedés</span>
  `;
  iconContainer.appendChild(bkkBtn);
}

window.mutassKozlekedest = async function (videoData) {
  // 1. Megnyitjuk/Létrehozzuk a panelt
  const panel =
    document.getElementById("transit-panel") || createTransitPanel();

  // 2. Aktiváljuk a láthatóságot (legyőzzük a transform-ot)
  panel.style.transform = "translateY(0)";

  // 3. Ellenőrizzük, hogy Budapest-e a helyszín
  if (videoData.telepules !== "Budapest") {
    panel.innerHTML = `
          <div style="width: 50px; height: 5px; background: rgba(255,255,255,0.2); border-radius: 10px; margin: 0 auto 20px auto;"></div>
          <div style="padding: 20px; text-align: center;">
              <div style="font-size: 3rem; margin-bottom: 15px;">📍</div>
              <h2 style="color: #E2F1B0; margin-bottom: 10px; text-transform: uppercase;">Hamarosan...</h2>
              <p style="color: rgba(255,255,255,0.7); font-size: 0.9rem; line-height: 1.6; margin-bottom: 25px;">
                  A hivatalos közlekedési és környék-információs szolgáltatásunk jelenleg csak <b>Budapest</b> területén érhető el. 
                  <br><br>Fejlesztőink már dolgoznak a vidéki hálózat bővítésén!
              </p>
              <button onclick="closeTransitPanel()" style="width: 100%; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 15px; border-radius: 1rem; font-weight: bold; text-transform: uppercase;">Értem</button>
          </div>
      `;
    return;
  }

  // 4. Ha Budapest, akkor jöhet a betöltési animáció
  panel.innerHTML = `
    <div style="width: 50px; height: 5px; background: rgba(255,255,255,0.2); border-radius: 10px; margin: 0 auto 20px auto;"></div>
    <div style="padding: 40px; text-align: center; color: #E2F1B0;">
        <div class="animate-pulse">Kapcsolódás a BKK Futár rendszeréhez...</div>
    </div>`;

  try {
    // Itt hívjuk a Cloudflare-t
    const response = await fetch(
      `/api/bkk-proximity?lat=${videoData.lat}&lon=${videoData.lng}`
    );
    const data = await response.json();

    // Ezt a függvényt majd megírjuk, ha megjönnek a valós adatok
    if (typeof renderTransitContent === "function") {
      renderTransitContent(panel, data);
    } else {
      panel.innerHTML +=
        '<p style="text-align:center">Adatok sikeresen fogadva!</p>';
    }
  } catch (error) {
    panel.innerHTML = `
        <div style="width: 50px; height: 5px; background: rgba(255,255,255,0.2); border-radius: 10px; margin: 0 auto 20px auto;"></div>
        <div style="padding: 40px; text-align: center; color: rgba(255,255,255,0.5);">
            <p>Átmeneti hiba az adatlekérésben.</p>
            <button onclick="closeTransitPanel()" style="margin-top:20px; color: white; text-decoration: underline;">Bezárás</button>
        </div>`;
  }
};

function createTransitPanel() {
  let panel = document.getElementById("transit-panel");
  if (panel) return panel;

  panel = document.createElement("div");
  panel.id = "transit-panel";
  // Elegáns, becsúszó sötét panel CSS-sel
  panel.style =
    "position: fixed; bottom: 0; left: 0; width: 100%; min-height: 40vh; background: rgba(0,0,0,0.9); backdrop-filter: blur(10px); z-index: 1000; border-top-left-radius: 2rem; border-top-right-radius: 2rem; transform: translateY(100%); transition: transform 0.3s ease-out; color: white; font-family: sans-serif; padding: 20px; box-sizing: border-box; border-top: 1px solid rgba(255,255,255,0.1);";

  document.body.appendChild(panel);
  return panel;
}
