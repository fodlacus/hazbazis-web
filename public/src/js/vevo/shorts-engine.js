// src/js/vevo/shorts-engine.js

import { adatbazis as db } from "../util/firebase-config.js";
import {
  collection,
  query,
  orderBy,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const videoFeed = document.querySelector(".video-feed");
let allVideos = [];

// --- 1. A KATEGÓRIÁK DEFINIÁLÁSA (TE ÍROD A SZABÁLYOKAT!) ---
// Ez a "fix" lista, ami alapján szűrünk. Bármikor bővítheted.
const PRESET_FILTERS = [
  {
    id: "budapest",
    title: "Budapest",
    icon: "🏙️",
    color: "from-blue-600 to-blue-900",
    filter: (v) => v.varos === "Budapest",
  },
  {
    id: "videk",
    title: "Vidéki Élet",
    icon: "🌳",
    color: "from-green-600 to-green-900",
    filter: (v) =>
      v.varos !== "Budapest" && v.varos !== "Helyszín nincs megadva",
  },
  {
    id: "olcso",
    title: "50M alatt",
    icon: "💰",
    color: "from-yellow-600 to-yellow-900",
    filter: (v) => v.ar > 0 && v.ar <= 50000000,
  },
  {
    id: "luxus",
    title: "Luxus",
    icon: "💎",
    color: "from-purple-600 to-purple-900",
    filter: (v) => v.ar >= 100000000,
  },
  {
    id: "csaladi",
    title: "Családi (3+ szoba)",
    icon: "👨‍👩‍👧‍👦",
    color: "from-red-600 to-red-900",
    filter: (v) => v.szobaszam >= 3,
  },
  {
    id: "kezdo",
    title: "Kezdő lakás",
    icon: "🔑",
    color: "from-teal-600 to-teal-900",
    filter: (v) => v.szobaszam > 0 && v.szobaszam <= 2,
  },
  {
    id: "erkelyes",
    title: "Erkélyes",
    icon: "☀️",
    color: "from-orange-600 to-orange-900",
    filter: (v) => v.erkely === true,
  },
  {
    id: "nagy",
    title: "Nagy terek (80m²+)",
    icon: "📐",
    color: "from-gray-600 to-gray-900",
    filter: (v) => v.alapterulet >= 80,
  },
];

// --- 2. INDÍTÁS ---
document.addEventListener("DOMContentLoaded", () => {
  setupGlobalClicks();
  loadVideos();
});

// --- 3. GOMB FIGYELŐ ---
function setupGlobalClicks() {
  document.addEventListener("click", (e) => {
    const filterBtn = e.target.closest(".filter-trigger-btn");
    const closeBtn = e.target.closest(".close-filter-btn");

    if (filterBtn) openFilterModal();
    if (closeBtn) closeFilterModal();
  });
}

// --- 4. VIDEÓK BETÖLTÉSE ---
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
          varos: data.varos || data.telepules || "Helyszín nincs megadva",
          utca: data.utca || "",
          ar: parseNumber(data.ar || data.vetelar || data.iranyar),
          alapterulet: parseNumber(data.alapterulet || data.meret),
          szobaszam: parseNumber(data.szobaszam || data.szoba),
          erkely: !!data.erkely,
        });
      }
    });

    if (allVideos.length === 0) {
      videoFeed.innerHTML =
        '<div style="color:white; text-align:center; padding-top:40vh;">Nincs feltöltött videó.</div>';
    } else {
      renderVideos(allVideos);
    }
  } catch (error) {
    console.error("Hiba:", error);
  }
}

function parseNumber(val) {
  if (!val) return 0;
  if (typeof val === "number") return val;
  return parseInt(val.replace(/\D/g, "")) || 0;
}

// --- 5. MODAL ÉS RÁCS GENERÁLÁSA ---
function openFilterModal() {
  const modal = document.getElementById("filter-modal");
  const content = document.getElementById("filter-content");
  if (!modal) return;

  modal.classList.remove("hidden");
  setTimeout(() => content.classList.remove("translate-y-full"), 10);

  renderDiscoveryGrid(); // Rács generálása
}

function closeFilterModal() {
  const modal = document.getElementById("filter-modal");
  const content = document.getElementById("filter-content");
  if (!modal) return;
  content.classList.add("translate-y-full");
  setTimeout(() => modal.classList.add("hidden"), 300);
}

// ITT ÉPÍTJÜK FEL A CSEMPÉKET
function renderDiscoveryGrid() {
  const grid = document.getElementById("discovery-grid");
  grid.innerHTML = ""; // Törlés

  PRESET_FILTERS.forEach((category) => {
    // Megszámoljuk előre, hány videó van ebben a kategóriában
    const count = allVideos.filter(category.filter).length;

    const card = document.createElement("button");
    // Modern, TikTok-szerű csempe design
    card.className = `relative h-32 rounded-2xl overflow-hidden shadow-lg transform transition active:scale-95 hover:scale-105 group border border-white/10`;

    card.innerHTML = `
            <div class="absolute inset-0 bg-gradient-to-br ${category.color} opacity-80 group-hover:opacity-100 transition"></div>
            
            <div class="absolute inset-0 flex flex-col items-center justify-center text-white p-2">
                <div class="text-4xl mb-2 drop-shadow-md">${category.icon}</div>
                <div class="font-bold text-lg text-center leading-tight drop-shadow-md">${category.title}</div>
                <div class="text-xs mt-1 bg-black/30 px-2 py-1 rounded-full border border-white/20">
                    ${count} videó
                </div>
            </div>
        `;

    // KATTINTÁSRA SZŰRÜNK
    card.onclick = () => {
      if (count === 0) {
        alert("Jelenleg nincs ilyen videó a rendszerben.");
        return;
      }
      applyCategoryFilter(category);
    };

    grid.appendChild(card);
  });
}

// --- 6. SZŰRÉS LOGIKA ---
function applyCategoryFilter(category) {
  console.log("Szűrés erre:", category.title);

  // A PRESET_FILTERS-ben megírt .filter függvényt használjuk
  const filtered = allVideos.filter(category.filter);

  renderVideos(filtered);
  closeFilterModal();
}

// --- 7. RENDERELÉS ---
function renderVideos(list) {
  videoFeed.innerHTML = "";
  list.forEach((videoData) => {
    const el = createVideoCard(videoData);
    videoFeed.appendChild(el);
  });
  // Frissítés után újraindítjuk a figyelőt
  setupVideoObserver();
}

// Add ezt a loadVideos végéhez vagy a renderVideos után:
function setupAutoPlay() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.play().catch(() => {}); // Automatikus lejátszás ha látható
        } else {
          entry.target.pause();
        }
      });
    },
    { threshold: 0.7 }
  );

  document.querySelectorAll("video").forEach((v) => observer.observe(v));
}

function createVideoCard(data) {
  const container = document.createElement("div");
  container.className = "video-container";

  const azonosito = data.id.startsWith("HB") ? data.id : `#${data.id}`;
  const arText =
    data.ar > 0
      ? Number(data.ar).toLocaleString() + " Ft"
      : "Ár: Érdeklődjön telefonon";
  const meretText = data.alapterulet > 0 ? `${data.alapterulet} m²` : "";
  const szobaText = data.szobaszam > 0 ? `• ${data.szobaszam} szoba` : "";

  // Vizuális állapotok előkészítése
  const muteIcon = window.isGloballyMuted ? "🔇" : "🔊";
  const muteBorder = window.isGloballyMuted
    ? "rgba(255, 255, 255, 0.2)"
    : "#E2F1B0";

  container.innerHTML = `
        <video src="${data.videoUrl}" loop playsinline muted poster="${
    data.kepek ? data.kepek[0] : ""
  }"></video>
        <div class="play-icon" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 4rem; color: white; opacity: 0; pointer-events: none; z-index: 10;">▶</div>
        <div class="video-overlay">
            <div class="controls">
                <a href="../../../index.html" class="menu-btn" title="Főoldal">🏠</a>
                <button class="details-btn filter-trigger-btn" style="border-color: #E2F1B0; color: #E2F1B0;" title="Kategóriák">🔍</button>
                <button class="mute-btn" style="border-color: ${muteBorder}; color: white;">${muteIcon}</button>
                <button class="info-btn" title="Adatlap">📄</button>
            </div>
            <div class="video-info">
                <span class="brand-badge">${azonosito}</span>
                <h3>${data.varos}, ${data.utca}</h3>
                <p class="text-xl font-bold text-white mb-1">${arText}</p>
                <p class="specs">${meretText} ${szobaText}</p>
            </div>
        </div>
    `;

  const video = container.querySelector("video");
  const playIcon = container.querySelector(".play-icon");
  const muteBtn = container.querySelector(".mute-btn");
  const infoBtn = container.querySelector(".info-btn");

  // Play/Pause kezelése (kivéve ha gombra kattintunk)
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

  // Némítás gomb eseménykezelő
  muteBtn.onclick = (e) => {
    e.stopPropagation();
    if (typeof window.toggleGlobalMute === "function") {
      window.toggleGlobalMute();
    } else {
      // Fallback ha nincs kész a globális függvény
      window.isGloballyMuted = !window.isGloballyMuted;
      document
        .querySelectorAll("video")
        .forEach((v) => (v.muted = window.isGloballyMuted));
      document
        .querySelectorAll(".mute-btn")
        .forEach(
          (btn) => (btn.innerText = window.isGloballyMuted ? "🔇" : "🔊")
        );
    }
  };

  // Adatlap gomb eseménykezelő
  infoBtn.onclick = (e) => {
    e.stopPropagation();
    window.location.href = `adatlap.html?id=${data.id}`;
  };

  // Kezdő némítás állapot beállítása
  video.muted = window.isGloballyMuted;

  return container;
}

// window.isGloballyMuted = true;

window.toggleGlobalMute = function () {
  // Állapot váltása
  window.isGloballyMuted = !window.isGloballyMuted;

  // 1. Minden videó némítása/visszahangosítása
  const allVideos = document.querySelectorAll("video");
  allVideos.forEach((v) => {
    v.muted = window.isGloballyMuted;
  });

  // 2. AZ ÖSSZES némító gomb ikonjának frissítése a képernyőn
  const allMuteBtns = document.querySelectorAll(".mute-btn");
  allMuteBtns.forEach((btn) => {
    btn.innerHTML = window.isGloballyMuted ? "🔇" : "🔊";

    // Opcionális: adjunk neki egy kis vizuális visszajelzést (piros keret ha némítva van)
    if (window.isGloballyMuted) {
      btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
    } else {
      btn.style.borderColor = "#E2F1B0"; // A hazbazis zöldes színe
    }
  });
};

window.szuroTorlese = function () {
  renderVideos(allVideos);
  closeFilterModal();
};

function setupVideoObserver() {
  const observerOptions = {
    root: null, // A teljes képernyőt figyeli
    threshold: 0.6, // Akkor vált, ha a videó 60%-a látszik
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;

      if (entry.isIntersecting) {
        // Ez a videó van a fókuszban
        video.play().catch((e) => console.log("Autoplay blokkolva"));
        video.muted = window.isGloballyMuted;
      } else {
        // Ez a videó kiment a látótérből -> STOP és NÉMÍT
        video.pause();
        video.currentTime = 0; // Opcionális: visszaugrik az elejére
      }
    });
  }, observerOptions);

  // Minden videót figyelünk, ami a DOM-ban van
  document.querySelectorAll(".video-container video").forEach((v) => {
    observer.observe(v);
  });
}
