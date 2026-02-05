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
    id: "csaladi",
    title: "Családi (3+ szoba)",
    icon: "👨‍👩‍👧‍👦",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "direct",
    filter: (v) => v.szobák >= 3,
  },
  {
    id: "kezdo",
    title: "Kezdő lakás",
    icon: "🔑",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "direct",
    filter: (v) => v.szobák > 0 && v.szobák <= 2,
  },
  {
    id: "lakopark",
    title: "Lakópark",
    icon: "🏢",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "selector", // Választót nyit meg, ahol ott lesz a Metrodom
    selectorType: "lakoparkok",
  },
  {
    id: "alberlet",
    title: "Albérlet",
    icon: "🏠",
    color: "from-[#3D4A16] to-[#5D6D2E]",
    type: "direct",
    filter: (v) => v.tipus === "Albérlet",
  }, // Itt is ellenőrizd a mezőt!
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

  // 1. Vissza gomb logika (Mindig látható, ha nem a főmenüben vagyunk)
  const titleContainer = modalTitle.parentElement;
  if (view !== "main" && !titleContainer.querySelector(".back-nav-btn")) {
    const backBtn = document.createElement("button");
    backBtn.className =
      "back-nav-btn mr-3 p-2 bg-white/10 rounded-full text-white";
    backBtn.innerHTML = "⬅️";
    backBtn.onclick = () => renderDiscoveryGrid("main");
    titleContainer.prepend(backBtn);
  }

  if (view === "main") {
    titleContainer.querySelector(".back-nav-btn")?.remove();
    modalTitle.innerText = "Felfedezés 🌍";
    MAIN_CATEGORIES.forEach((cat) => {
      const count = allVideos.filter(cat.filter || (() => true)).length;
      grid.appendChild(
        createTile(
          cat.title,
          cat.icon,
          cat.color,
          () => {
            if (count === 0 && cat.type === "direct")
              return alert("Nincs lejátszható videó!");
            if (cat.type === "selector") renderDiscoveryGrid(cat.selectorType);
            else applyFilterAndStart(cat.filter);
          },
          count
        )
      );
    });
    return;
  }

  if (view === "kerulet") {
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
          count > 0
            ? "from-blue-500/80 to-blue-700/80"
            : "from-gray-800/80 to-gray-900/80 opacity-40",
          () => {
            if (count > 0)
              applyFilterAndStart(
                (v) => v.telepules === "Budapest" && v.kerulet === ker
              );
            else alert("Nincs videó ebben a kerületben!");
          },
          count,
          bgImg
        )
      );
    });
    return;
  }

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
      const count = allVideos.filter((item) => item.telepules === v).length;
      const bgImg = `https://media.hazbazis.hu/static/cities/${v.toLowerCase()}.jpg`;
      grid.appendChild(
        createTile(
          v,
          "",
          "from-green-600/80 to-green-800/80",
          () => applyFilterAndStart((item) => item.telepules === v),
          count,
          bgImg
        )
      );
    });
    return;
  }

  if (view === "lakoparkok") {
    modalTitle.innerText = "Válassz lakóparkot";
    const parkok = [
      ...new Set(
        allVideos
          .filter((v) => v.lakopark_e === "Igen")
          .map((v) => v.lakopark_nev)
      ),
    ]
      .filter(Boolean)
      .sort();
    if (parkok.length === 0)
      grid.innerHTML =
        '<div class="col-span-2 text-center text-white/50 pt-10 text-sm italic">Nincs rögzített lakópark.</div>';
    parkok.forEach((nev) => {
      const count = allVideos.filter((v) => v.lakopark_nev === nev).length;
      const bgImg = `https://media.hazbazis.hu/static/lakoparkok/${nev
        .toLowerCase()
        .replace(/\s+/g, "-")}.jpg`;
      grid.appendChild(
        createTile(
          nev,
          "",
          "from-[#3D4A16] to-[#5D6D2E]",
          () => applyFilterAndStart((v) => v.lakopark_nev === nev),
          count,
          bgImg
        )
      );
    });
    return;
  }
}

function createTile(title, icon, color, onClick, count = null, bgImg = null) {
  const btn = document.createElement("button");
  // Alapértelmezett háttér az arculati zöld, ha nincs kép
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
          ${
            count !== null
              ? `<div class="text-[10px] mt-2 bg-[#E2F1B0] text-[#3D4A16] px-3 py-0.5 rounded-full font-bold shadow-sm">
                  ${count} videó
              </div>`
              : ""
          }
      </div>
  `;
  btn.onclick = onClick;
  return btn;
}

// --- SZŰRÉS ÉS RENDERELÉS ---
function applyFilterAndStart(filterFn) {
  const filtered = allVideos.filter(filterFn);
  renderVideos(filtered);
  closeFilterModal();
}

function renderVideos(list) {
  videoFeed.innerHTML = "";
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
