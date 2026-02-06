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
  },
  {
    id: "videk",
    title: "Vidéki Élet",
    icon: "🌳",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "selector",
    selectorType: "telepules",
  },
  {
    id: "lakopark",
    title: "Lakópark",
    icon: "🏢",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "selector",
    selectorType: "lakopark_telepules",
  },
  {
    id: "alberlet",
    title: "Albérlet",
    icon: "🔑",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "selector",
    selectorType: "alberlet_telepules",
  },
  {
    id: "garazs",
    title: "Garázs",
    icon: "🚗",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "direct",
    filter: (v) => v.tipus === "Garázs",
  },
  {
    id: "olcso",
    title: "50M alatt",
    icon: "💰",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "direct",
    filter: (v) => v.vételár > 0 && v.vételár <= 50000000,
  },
  {
    id: "luxus",
    title: "Luxus",
    icon: "💎",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "direct",
    filter: (v) => v.vételár >= 120000000,
  },
  {
    id: "hb_id",
    title: "HB Kereső",
    icon: "🔍",
    color: "from-blue-900 to-blue-700",
    type: "selector",
    selectorType: "hb_search",
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

  // 1. Vissza gomb és rács stílus alaphelyzetbe állítása
  if (view !== "hb_search") {
    grid.className = "grid grid-cols-2 gap-3 overflow-y-auto flex-1 pb-4 pr-1";
  }
  handleBackButtonVisibility(view, modalTitle);

  // --- NÉZET: FŐMENÜ (Keresési segédlet) ---
  if (view === "main") {
    modalTitle.innerText = "Keresési segédlet 🧭";

    MAIN_CATEGORIES.forEach((cat) => {
      // Itt már nem számoltatunk a rendszerrel minden megnyitáskor (Teljesítmény optimalizálás)
      const infoText = "Megtekintés ➔";

      grid.appendChild(
        createTile(
          cat.title,
          cat.icon,
          cat.color,
          () => {
            if (cat.type === "selector") {
              renderDiscoveryGrid(cat.selectorType);
              return;
            }
            applyFilterAndStart(cat.filter);
          },
          cat.id === "hb_id" ? null : infoText
        )
      );
    });
    return;
  }

  // --- NÉZET: HB-ID KERESŐ ---
  if (view === "hb_search") {
    modalTitle.innerText = "Keresés HB-ID alapján";
    grid.className = "flex flex-col gap-4 p-6";

    grid.innerHTML = `
        <div class="bg-white/5 p-6 rounded-2xl border border-[#E2F1B0]/20">
            <p class="text-xs text-white/50 mb-4 italic text-center">Add meg az ingatlan pontos azonosítóját!</p>
            <input type="text" id="hb-input" 
                placeholder="Például: HB-407050" 
                class="w-full bg-black/40 border border-[#E2F1B0]/30 p-4 rounded-xl text-white text-center text-lg font-mono outline-none focus:border-[#E2F1B0] transition-all">
            
            <button onclick="window.searchByHBID()" 
                class="w-full mt-4 bg-[#E2F1B0] text-[#3D4A16] font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all">
                KERESÉS INDÍTÁSA
            </button>
        </div>
        <p class="text-[10px] text-center text-white/30 uppercase tracking-widest mt-2">Hazbazis Intelligent Search</p>
    `;
    return;
  }

  // --- NÉZET: LAKÓPARK -> TELEPÜLÉS ---
  if (view === "lakopark_telepules") {
    modalTitle.innerText = "Lakóparkok városonként";
    const varosok = [
      ...new Set(
        allVideos.filter((v) => v.lakopark_e === "Igen").map((v) => v.telepules)
      ),
    ]
      .filter(Boolean)
      .sort();

    varosok.forEach((v) => {
      grid.appendChild(
        createTile(
          v,
          "",
          "from-[#3D4A16] to-green-800",
          () => {
            if (v === "Budapest") renderDiscoveryGrid("lakopark_kerulet");
            else renderDiscoveryGrid("lakoparkok_listaja", { city: v });
          },
          "Felfedezés"
        )
      );
    });
    return;
  }

  // --- NÉZET: ALBÉRLET -> TELEPÜLÉS ---
  if (view === "alberlet_telepules") {
    modalTitle.innerText = "Albérletek városonként";
    const varosok = [
      ...new Set(
        allVideos.filter((v) => v.kategoria === "kiado").map((v) => v.telepules)
      ),
    ]
      .filter(Boolean)
      .sort();

    varosok.forEach((v) => {
      grid.appendChild(
        createTile(
          v,
          "",
          "from-[#3D4A16] to-blue-800",
          () => {
            if (v === "Budapest") renderDiscoveryGrid("alberlet_kerulet");
            else
              applyFilterAndStart(
                (item) => item.kategoria === "kiado" && item.telepules === v
              );
          },
          "Lista ➔"
        )
      );
    });
    return;
  }

  // --- NÉZET: KERÜLET (Képekkel támogatva) ---
  if (view === "kerulet") {
    modalTitle.innerText = "Budapesti kerületek";
    BP_DISTRICTS.forEach((ker) => {
      // Itt csak azt nézzük meg, létezik-e találat (gyorsabb, mint a darabszám)
      const hasVideo = allVideos.some(
        (v) => v.telepules === "Budapest" && v.kerulet === ker
      );
      const bgImg = `https://media.hazbazis.hu/shorts/filter-img/${ker.replace(
        ".",
        ""
      )}.webp`;

      grid.appendChild(
        createTile(
          ker,
          "",
          hasVideo ? "from-blue-600/80 to-blue-900/80" : "opacity-40",
          () => {
            if (hasVideo)
              applyFilterAndStart(
                (v) => v.telepules === "Budapest" && v.kerulet === ker
              );
          },
          hasVideo ? "Választás" : "Nincs videó",
          bgImg
        )
      );
    });
    return;
  }

  // --- NÉZET: VIDÉKI VÁROSOK ---
  if (view === "telepules") {
    modalTitle.innerText = "Vidéki városok";
    const varosok = [
      ...new Set(
        allVideos
          .filter((v) => v.telepules !== "Budapest")
          .map((v) => v.telepules)
      ),
    ]
      .filter(Boolean)
      .sort();

    varosok.forEach((v) => {
      grid.appendChild(
        createTile(
          v,
          "",
          "from-green-700 to-green-900",
          () => applyFilterAndStart((item) => item.telepules === v),
          "Mutasd"
        )
      );
    });
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
                <a href="../../../index.html" class="menu-btn">🏠</a>
                <button class="filter-trigger-btn" style="border-color: #E2F1B0;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E2F1B0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                    </svg>
                </button>
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

  // Szigorú szűrés: csak akkor indítunk, ha van találat
  const matches = allVideos.filter(
    (v) =>
      (v.id && v.id.toUpperCase().includes(rawId)) ||
      (v.azon && v.azon.toUpperCase().includes(rawId))
  );

  if (matches.length > 0) {
    renderVideos(matches);
    closeFilterModal();
  } else {
    alert("Nincs találat erre az azonosítóra: " + rawId);
  }
};

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
  } else {
    if (existingBack) existingBack.remove();
  }
}
