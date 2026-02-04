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
  // Gombfigyelő indítása
  setupGlobalClicks();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("✅ BEJELENTKEZVE. UID:", user.uid);
      currentUser = user;
    } else {
      console.log("⚠️ Nincs bejelentkezve senki.");
    }
    loadVideos();
  });
});

// --- 2. A "GOLYÓÁLLÓ" KATTINTÁS FIGYELŐ ---
function setupGlobalClicks() {
  document.addEventListener("click", (e) => {
    // Megnézzük, hogy amire kattintottál (vagy a szülője) az a Szűrő Gomb-e?
    const filterBtn = e.target.closest(".filter-trigger-btn");
    const closeBtn = e.target.closest(".close-filter-btn");

    if (filterBtn) {
      console.log("🖱️ Gomb kattintás elkapva!"); // Ezt látnod kell a konzolon!
      openFilterModal();
    }

    if (closeBtn) {
      closeFilterModal();
    }
  });
}

// --- 3. VIDEÓK BETÖLTÉSE ---
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
          // Biztosítjuk, hogy legyen alapértelmezett szöveg
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

// --- 4. MODAL LOGIKA ---
function openFilterModal() {
  const modal = document.getElementById("filter-modal");
  const content = document.getElementById("filter-content");
  if (!modal) return; // Ha nincs modal a HTML-ben, kilépünk

  modal.classList.remove("hidden");
  setTimeout(() => content.classList.remove("translate-y-full"), 10);
  loadUserFilters();
}

function closeFilterModal() {
  const modal = document.getElementById("filter-modal");
  const content = document.getElementById("filter-content");
  if (!modal) return;

  content.classList.add("translate-y-full");
  setTimeout(() => modal.classList.add("hidden"), 300);
}

// --- 5. SZŰRŐK BETÖLTÉSE ---
async function loadUserFilters() {
  const listContainer = document.getElementById("saved-filters-list");
  listContainer.innerHTML = '<p class="text-white text-center">Betöltés...</p>';

  if (!currentUser) {
    listContainer.innerHTML =
      '<p class="text-red-400 text-center py-4">Nem vagy bejelentkezve!</p>';
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
      // Stílusok
      btn.className =
        "w-full text-left p-4 bg-white/5 hover:bg-[#E2F1B0] hover:text-black rounded-xl transition border border-white/10 mb-2";

      const nev = data.nev || "Mentett keresés";
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

      // Itt direktben hívjuk a logikát
      btn.onclick = () => runSavedFilterProcess(data);
      listContainer.appendChild(btn);
    });
  } catch (error) {
    listContainer.innerHTML = `<p class="text-red-400 text-center">Hiba: ${error.message}</p>`;
  }
}

function runSavedFilterProcess(criteria) {
  const matchingIds = [];

  console.log("Szűrés indul ezzel:", criteria);

  allVideos.forEach((video) => {
    let match = true;
    // Feltételek vizsgálata
    if (criteria.telepules && video.varos !== criteria.telepules) match = false;
    if (criteria.maxAr && video.ar > Number(criteria.maxAr)) match = false;
    if (criteria.minTerulet && video.alapterulet < Number(criteria.minTerulet))
      match = false;

    if (match) matchingIds.push(video.id);
  });

  console.log("Találatok:", matchingIds);

  const filtered = allVideos.filter((v) => matchingIds.includes(v.id));
  renderVideos(filtered);

  // Visszajelzés
  const list = document.getElementById("saved-filters-list");
  if (matchingIds.length > 0) {
    closeFilterModal();
  } else {
    alert("Sajnos nincs találat erre a keresésre a videók között.");
  }
}

// --- 6. RENDERELÉS ---
function renderVideos(list) {
  videoFeed.innerHTML = "";
  list.forEach((videoData) => {
    const el = createVideoCard(videoData);
    videoFeed.appendChild(el);
  });
}

function createVideoCard(data) {
  const container = document.createElement("div");
  container.className = "video-container";
  const azonosito = data.id.startsWith("HB") ? data.id : `#${data.id}`;

  // Szövegek formázása
  const arText =
    data.ar > 0 ? Number(data.ar).toLocaleString() + " Ft" : "Ár nincs megadva";
  const meretText = data.alapterulet > 0 ? `${data.alapterulet} m²` : "";
  const szobaText = data.szobaszam > 0 ? `• ${data.szobaszam} szoba` : "";

  container.innerHTML = `
        <video src="${data.videoUrl}" loop playsinline muted poster="${
    data.kepek ? data.kepek[0] : ""
  }"></video>
        <div class="play-icon">▶</div>

        <div class="video-overlay">
            <div class="controls">
                <a href="../../../index.html" class="menu-btn" title="Főoldal">🏠</a>
                
                <button class="details-btn filter-trigger-btn" style="border-color: #E2F1B0; color: #E2F1B0;" title="Mentett Szűrések">
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
                <h3>${data.varos}, ${data.utca}</h3>
                <p class="text-xl font-bold text-white mb-1">${arText}</p>
                <p class="specs">${meretText} ${szobaText}</p>
            </div>
        </div>
    `;

  // Események
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
