// src/js/vevo/shorts-engine.js

import { adatbazis as db, auth } from "../util/firebase-config.js";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const videoFeed = document.querySelector(".video-feed");
let allVideos = [];
let currentUser = null;

// --- 1. INDÍTÁS ---
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    loadVideos();
  });
});

// --- 2. VIDEÓK BETÖLTÉSE (ADAT JAVÍTÁSSAL) ---
async function loadVideos() {
  try {
    const q = query(collection(db, "lakasok"), orderBy("order", "asc"));
    const snapshot = await getDocs(q);

    allVideos = [];
    snapshot.forEach((doc) => {
      const data = doc.data();

      if (data.videoUrl) {
        // ITT A JAVÍTÁS: "VAGY" (||) jelekkel minden variációt figyelünk!
        allVideos.push({
          id: doc.id,

          // Videó és Kép
          videoUrl: data.videoUrl,
          kepek: data.kepek || [],

          // Város (varos VAGY telepules)
          varos: data.varos || data.telepules || "Ismeretlen hely",
          utca: data.utca || "",

          // Ár (ar VAGY vetelar VAGY iranyar) -> Számmá alakítva
          ar: Number(data.ar || data.vetelar || data.iranyar || 0),

          // Méret (alapterulet VAGY meret)
          alapterulet: Number(data.alapterulet || data.meret || 0),

          // Szobák
          szobaszam: Number(data.szobaszam || data.szoba || 0),

          // Egyéb
          erkely: data.erkely ? true : false,
        });
      }
    });

    if (allVideos.length === 0) {
      videoFeed.innerHTML =
        '<div style="color:white; text-align:center; padding-top:40vh;">Nincs feltöltött videó.</div>';
      return;
    }

    renderVideos(allVideos);
  } catch (error) {
    console.error("Hiba:", error);
  }
}

// --- 3. MODAL KEZELÉS (GLOBALIZÁLVA) ---

// Kitetettük a window-ra, hogy a HTML gomb megtalálja!
window.openFilterModal = function () {
  const modal = document.getElementById("filter-modal");
  const content = document.getElementById("filter-content");
  if (!modal) return;

  modal.classList.remove("hidden");
  setTimeout(() => content.classList.remove("translate-y-full"), 10);

  // Betöltjük a listát
  loadUserFilters();
};

window.closeFilterModal = function () {
  const modal = document.getElementById("filter-modal");
  const content = document.getElementById("filter-content");
  if (!modal) return;

  content.classList.add("translate-y-full");
  setTimeout(() => modal.classList.add("hidden"), 300);
};

// --- 4. SZŰRŐ LOGIKA ---

async function loadUserFilters() {
  const listContainer = document.getElementById("saved-filters-list");

  if (!currentUser) {
    listContainer.innerHTML =
      '<p class="text-white text-center py-4">Jelentkezz be a mentett keresésekhez!</p>';
    return;
  }

  try {
    const subColRef = collection(
      db,
      "felhasznalok",
      currentUser.uid,
      "mentett_keresesek"
    );
    const snapshot = await getDocs(subColRef);

    if (snapshot.empty) {
      listContainer.innerHTML =
        '<p class="text-gray-400 text-center py-4">Nincs mentett keresésed.</p>';
      return;
    }

    listContainer.innerHTML = "";

    snapshot.forEach((doc) => {
      const data = doc.data();
      const btn = document.createElement("button");
      btn.className =
        "w-full text-left p-4 bg-white/5 hover:bg-[#E2F1B0] hover:text-black rounded-xl transition group border border-white/10 mb-2";

      const nev = data.nev || data.elnevezes || "Mentett keresés";
      // Kijelezzük a főbb feltételeket
      const reszletek = [
        data.telepules,
        data.minTerulet ? `Min ${data.minTerulet}m²` : null,
        data.maxAr ? `Max ${data.maxAr / 1000000}M` : null,
      ]
        .filter(Boolean)
        .join(" • ");

      btn.innerHTML = `
                <div class="font-bold text-lg">${nev}</div>
                <div class="text-sm text-gray-400 group-hover:text-black/70">${
                  reszletek || "Minden feltétel"
                }</div>
            `;

      btn.onclick = () => runSavedFilterProcess(data);
      listContainer.appendChild(btn);
    });
  } catch (error) {
    console.error("Hiba:", error);
    listContainer.innerHTML =
      '<p class="text-red-400 text-center">Hiba történt.</p>';
  }
}

function runSavedFilterProcess(criteria) {
  // 1. LÉPÉS: Belső tábla generálása (Csak HB számok!)
  const matchingIds = [];

  allVideos.forEach((video) => {
    let match = true;

    if (criteria.telepules && video.varos !== criteria.telepules) match = false;

    // Figyeljük, hogy string vagy number jön-e, ezért a Number() biztonságosabb
    if (criteria.maxAr && video.ar > Number(criteria.maxAr)) match = false;
    if (criteria.minTerulet && video.alapterulet < Number(criteria.minTerulet))
      match = false;
    if (criteria.minSzoba && video.szobaszam < Number(criteria.minSzoba))
      match = false;

    if (match) matchingIds.push(video.id);
  });

  // 2. LÉPÉS: Szűrés
  const filteredVideos = allVideos.filter((video) =>
    matchingIds.includes(video.id)
  );
  renderVideos(filteredVideos);

  // UI Feedback & Close
  const modalList = document.getElementById("saved-filters-list");
  if (matchingIds.length > 0) {
    window.closeFilterModal();
  } else {
    alert("Sajnos ennek a keresésnek egyetlen videó sem felel meg.");
  }
}

// --- 5. RENDERELÉS ---
function renderVideos(list) {
  videoFeed.innerHTML = "";
  list.forEach((videoData) => {
    const el = createVideoCard(videoData);
    videoFeed.appendChild(el);
    observer.observe(el);
  });
}

function createVideoCard(data) {
  const container = document.createElement("div");
  container.className = "video-container";
  const azonosito = data.id.startsWith("HB") ? data.id : `#${data.id}`;

  // FORMATÁLÁS: Ha nincs ár, ne írja ki, hogy NaN
  const arKijelzes =
    data.ar > 0
      ? Number(data.ar).toLocaleString() + " Ft"
      : "Ár megegyezés szerint";
  const meretKijelzes = data.alapterulet > 0 ? `${data.alapterulet} m²` : "";
  const szobaKijelzes = data.szobaszam > 0 ? `• ${data.szobaszam} szoba` : "";

  container.innerHTML = `
        <video src="${data.videoUrl}" loop playsinline muted poster="${
    data.kepek ? data.kepek[0] : ""
  }"></video>
        <div class="play-icon">▶</div>

        <div class="video-overlay">
            <div class="controls">
                <a href="../../../index.html" class="menu-btn" title="Főoldal">🏠</a>
                
                <button onclick="window.openFilterModal()" class="details-btn" style="border-color: #E2F1B0; color: #E2F1B0;" title="Mentett Szűrések">
                    🔍
                </button>

                <button class="mute-btn">${
                  window.isGloballyMuted ? "🔇" : "🔊"
                }</button>
                
                <button onclick="window.location.href='adatlap.html?id=${
                  data.id
                }'" title="Adatlap">📄</button>
            </div>

            <div class="video-info">
                <span class="brand-badge">${azonosito}</span>
                <h3>${data.varos}, ${data.utca || ""}</h3>
                <p class="text-xl font-bold text-white mb-1">${arKijelzes}</p>
                <p class="specs">${meretKijelzes} ${szobaKijelzes}</p>
            </div>
        </div>
    `;

  // Eseménykezelők
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

  const muteBtn = container.querySelector(".mute-btn");
  video.muted = window.isGloballyMuted || true;
  muteBtn.onclick = (e) => {
    e.stopPropagation();
    toggleGlobalMute();
  };

  return container;
}

// --- GLOBÁLIS SEGÉDEK ---
window.isGloballyMuted = true;
function toggleGlobalMute() {
  window.isGloballyMuted = !window.isGloballyMuted;
  document
    .querySelectorAll("video")
    .forEach((v) => (v.muted = window.isGloballyMuted));
  document
    .querySelectorAll(".mute-btn")
    .forEach((btn) => (btn.textContent = window.isGloballyMuted ? "🔇" : "🔊"));
}

window.szuroTorlese = function () {
  renderVideos(allVideos);
};

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const video = entry.target.querySelector("video");
      if (!video) return;
      if (entry.isIntersecting) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  },
  { threshold: 0.6 }
);
