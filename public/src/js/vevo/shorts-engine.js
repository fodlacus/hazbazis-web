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

// --- 1. INDÍTÁS & AUTH NYOMOZÁS ---
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("✅ BEJELENTKEZVE. UID:", user.uid);
      // Ezt az ID-t keresd a Firebase-ben a 'felhasznalok' alatt!
      currentUser = user;
    } else {
      console.warn("⚠️ NINCS BEJELENTKEZVE FELHASZNÁLÓ!");
      currentUser = null;
    }
    loadVideos();
  });
});

// --- 2. VIDEÓK BETÖLTÉSE (DEBUG MÓDBAN) ---
async function loadVideos() {
  try {
    const q = query(collection(db, "lakasok"), orderBy("order", "asc"));
    const snapshot = await getDocs(q);

    allVideos = [];
    snapshot.forEach((doc) => {
      const data = doc.data();

      // DEBUG: Nézzük meg, mi jön valójában!
      console.log(`Videó (${doc.id}) adatai:`, data);

      if (data.videoUrl) {
        // Biztonságos adatkinyerés
        // Ha valamelyik adat hiányzik, 0-t vagy üres stringet adunk
        allVideos.push({
          id: doc.id,
          videoUrl: data.videoUrl,
          kepek: data.kepek || [],

          // HELYSZÍN JAVÍTÁS
          varos: data.varos || data.telepules || "Helyszín nincs megadva",
          utca: data.utca || "",

          // ÁR JAVÍTÁS (String tisztítás, ha van benne 'Ft' vagy szóköz)
          ar: parseNumber(data.ar || data.vetelar || data.iranyar),

          // MÉRET JAVÍTÁS
          alapterulet: parseNumber(data.alapterulet || data.meret),
          szobaszam: parseNumber(data.szobaszam || data.szoba),

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
    alert("Adatbázis hiba: " + error.message);
  }
}

// Segédfüggvény a számok tisztításához
function parseNumber(value) {
  if (!value) return 0;
  // Ha szám, visszaadjuk
  if (typeof value === "number") return value;
  // Ha string (pl. "50 000 000 Ft"), kiszedjük a nem szám karaktereket
  if (typeof value === "string") {
    const cleaned = value.replace(/\D/g, ""); // Csak számjegyek maradnak
    return parseInt(cleaned) || 0;
  }
  return 0;
}

// --- 3. MODAL KEZELÉS ---

window.openFilterModal = function () {
  const modal = document.getElementById("filter-modal");
  const content = document.getElementById("filter-content");

  // DEBUG: Működik a gomb?
  console.log("🔍 Szűrő gomb megnyomva!");

  if (!modal) {
    alert("Hiba: Nem találom a modal ablakot a HTML-ben (id='filter-modal')");
    return;
  }

  modal.classList.remove("hidden");
  setTimeout(() => content.classList.remove("translate-y-full"), 10);

  loadUserFilters();
};

window.closeFilterModal = function () {
  const modal = document.getElementById("filter-modal");
  const content = document.getElementById("filter-content");
  if (!modal) return;
  content.classList.add("translate-y-full");
  setTimeout(() => modal.classList.add("hidden"), 300);
};

// --- 4. SZŰRŐK BETÖLTÉSE (AZ IGAZSÁG PILLANATA) ---
async function loadUserFilters() {
  const listContainer = document.getElementById("saved-filters-list");

  // 1. ELLENŐRZÉS: Van user?
  if (!currentUser) {
    listContainer.innerHTML = `
            <div class="text-center py-4">
                <p class="text-white mb-2">Nem vagy bejelentkezve!</p>
                <a href="../../../index.html" class="text-[#E2F1B0] underline">Jelentkezz be a főoldalon</a>
            </div>`;
    return;
  }

  // 2. ELLENŐRZÉS: Jó helyen keresünk?
  // Kiírjuk az útvonalat alert-ben, hogy lásd!
  const path = `felhasznalok/${currentUser.uid}/mentett_keresesek`;
  console.log("📂 Keresés itt:", path);

  try {
    const subColRef = collection(
      db,
      "felhasznalok",
      currentUser.uid,
      "mentett_keresesek"
    );
    const snapshot = await getDocs(subColRef);

    if (snapshot.empty) {
      listContainer.innerHTML = `
                <div class="text-center py-4 text-gray-400">
                    <p>Nincs mentett keresésed ezen a fiókon.</p>
                    <p class="text-xs mt-2">Te ID-d: ${currentUser.uid}</p>
                </div>`;
      return;
    }

    listContainer.innerHTML = "";

    snapshot.forEach((doc) => {
      const data = doc.data();
      const btn = document.createElement("button");
      btn.className =
        "w-full text-left p-4 bg-white/5 hover:bg-[#E2F1B0] hover:text-black rounded-xl transition group border border-white/10 mb-2";

      const nev = data.nev || data.elnevezes || "Mentett keresés";
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
    listContainer.innerHTML = `<p class="text-red-400 text-center">Hiba: ${error.message}</p>`;
  }
}

function runSavedFilterProcess(criteria) {
  const matchingIds = [];

  allVideos.forEach((video) => {
    let match = true;
    if (criteria.telepules && video.varos !== criteria.telepules) match = false;
    if (criteria.maxAr && video.ar > Number(criteria.maxAr)) match = false;
    if (criteria.minTerulet && video.alapterulet < Number(criteria.minTerulet))
      match = false;

    // LOGOLÁS: Hogy lásd miért dobja el a videót
    if (!match)
      console.log(
        `Videó ${video.id} kiesett. Feltétel:`,
        criteria,
        "Videó adat:",
        video
      );

    if (match) matchingIds.push(video.id);
  });

  const filteredVideos = allVideos.filter((video) =>
    matchingIds.includes(video.id)
  );
  renderVideos(filteredVideos);

  const modalList = document.getElementById("saved-filters-list");
  if (matchingIds.length > 0) {
    window.closeFilterModal();
  } else {
    alert("Ennek a keresésnek sajnos egyetlen videó sem felel meg.");
  }
}

// --- 5. RENDERELÉS ---
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

  // FORMATÁLÁS JAVÍTVA
  const arKijelzes =
    data.ar > 0
      ? Number(data.ar).toLocaleString() + " Ft"
      : "Ár megegyezés szerint";
  const meretKijelzes = data.alapterulet > 0 ? `${data.alapterulet} m²` : "";

  // "undefined szoba" elkerülése
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
                <h3>${data.varos}, ${data.utca}</h3>
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
