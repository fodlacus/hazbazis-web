// src/js/vevo/shorts-engine.js

// Importáljuk az Auth-ot is!
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
  // Figyeljük, hogy be van-e lépve a felhasználó
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    loadVideos(); // Videók betöltése
  });
});

// --- 2. VIDEÓK BETÖLTÉSE ---
async function loadVideos() {
  try {
    const q = query(collection(db, "lakasok"), orderBy("order", "asc"));
    const snapshot = await getDocs(q);

    allVideos = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.videoUrl) {
        // Biztosítjuk, hogy a számok tényleg számok legyenek
        allVideos.push({
          id: doc.id,
          ...data,
          ar: Number(data.ar),
          alapterulet: Number(data.alapterulet || data.meret),
          szobaszam: Number(data.szobaszam),
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

// --- 3. SZŰRŐ GOMB ÉS LOGIKA ---

// Ezt hívja a HTML, amikor megnyílik a modal
window.loadUserFilters = async function () {
  const listContainer = document.getElementById("saved-filters-list");

  if (!currentUser) {
    listContainer.innerHTML =
      '<p class="text-white text-center">Jelentkezz be a mentett keresésekhez!</p>';
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
        '<p class="text-gray-400 text-center">Nincs mentett keresésed.</p>';
      return;
    }

    listContainer.innerHTML = "";

    snapshot.forEach((doc) => {
      const data = doc.data();
      const btn = document.createElement("button");
      btn.className =
        "w-full text-left p-4 bg-white/5 hover:bg-[#E2F1B0] hover:text-black rounded-xl transition group border border-white/10 mb-2";

      const nev = data.nev || data.elnevezes || "Mentett keresés";
      // Kijelezzük a főbb feltételeket, hogy tudja mit választ
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

      // KATTINTÁS: Itt indul a folyamat
      btn.onclick = () => runSavedFilterProcess(data);

      listContainer.appendChild(btn);
    });
  } catch (error) {
    console.error("Hiba:", error);
    listContainer.innerHTML =
      '<p class="text-red-400 text-center">Hiba történt.</p>';
  }
};

// --- A FOLYAMAT VEZÉRLÉSE ---
function runSavedFilterProcess(criteria) {
  // 1. LÉPÉS: Belső tábla generálása (Csak HB számok!)
  const allowedHbNumbers = generateInternalIdTable(criteria);

  console.log("✅ Generált HB lista:", allowedHbNumbers);

  // 2. LÉPÉS: Szűrés kizárólag a HB számok alapján
  applyIdFilter(allowedHbNumbers);

  // UI Feedback
  const modalList = document.getElementById("saved-filters-list");
  if (allowedHbNumbers.length > 0) {
    modalList.innerHTML = `<div class="text-center py-4">
              <div class="text-[#E2F1B0] text-3xl font-bold mb-2">✓</div>
              <p class="text-white">Szűrés aktiválva!</p>
              <p class="text-gray-400 text-sm">${allowedHbNumbers.length} videó felelt meg.</p>
          </div>`;
    setTimeout(() => closeFilterModal(), 1000);
  } else {
    alert("Ennek a keresésnek sajnos egyetlen videó sem felel meg.");
  }
}

// --- 1. ALRENDSZER: ID LISTA GYÁRTÁS ---
function generateInternalIdTable(criteria) {
  // Ez a függvény végigmegy az összes ismert videón, és kiválogatja
  // azokat a HB számokat, amik megfelelnek a feltételeknek.

  const matchingIds = [];

  allVideos.forEach((video) => {
    let match = true;

    // Vizsgálatok (Adatbázis mezők alapján)
    if (criteria.telepules && video.varos !== criteria.telepules) match = false;
    if (criteria.maxAr && video.ar > criteria.maxAr) match = false;
    if (criteria.minAr && video.ar < criteria.minAr) match = false;
    if (criteria.minTerulet && video.alapterulet < criteria.minTerulet)
      match = false;
    if (criteria.minSzoba && video.szobaszam < criteria.minSzoba) match = false;
    if (criteria.kellErkely === true && !video.erkely) match = false;

    // Ha minden feltételnek megfelelt, felírjuk a HB számát a listára
    if (match) {
      matchingIds.push(video.id);
    }
  });

  return matchingIds; // Ez adja vissza pl: ['HB-12345', 'HB-67890']
}

// --- 2. ALRENDSZER: MEGJELENÍTÉS ID ALAPJÁN ---
function applyIdFilter(idList) {
  // Ez a függvény már nem tud semmit az árról vagy városról.
  // Csak azt nézi: "A videó ID-ja benne van a kapott listában?"

  const filteredVideos = allVideos.filter((video) => idList.includes(video.id));
  renderVideos(filteredVideos);
}

// --- A MATEMATIKA: Itt hasonlítjuk össze a videót a feltétellel ---
function applySavedFilter(criteria) {
  console.log("Szűrés erre:", criteria);

  const filtered = allVideos.filter((video) => {
    // 1. Település (Ha van megadva a szűrőben)
    if (criteria.telepules && video.varos !== criteria.telepules) return false;

    // 2. Ár (maxAr) - A képen 'null' volt, de ha van, figyeljük
    if (criteria.maxAr && video.ar > criteria.maxAr) return false;

    // 3. Méret (minTerulet) - A képen '40' volt
    if (criteria.minTerulet && video.alapterulet < criteria.minTerulet)
      return false;

    // 4. Szobák (minSzoba)
    if (criteria.minSzoba && video.szobaszam < criteria.minSzoba) return false;

    // 5. Egyéb bool feltételek (Csak ha TRUE a keresésben!)
    if (criteria.kellErkely === true && !video.erkely) return false;
    // if (criteria.kellLift === true && !video.lift) return false; // Ha van lift adatod

    return true; // Ha minden teszten átment
  });

  // Modal bezárása és videók frissítése
  document.getElementById(
    "saved-filters-list"
  ).innerHTML = `<p class="text-center text-green-400">Szűrés kész! ${filtered.length} találat.</p>`;
  setTimeout(() => closeFilterModal(), 800);

  if (filtered.length === 0) {
    alert("Sajnos egyik videó sem felel meg ennek a keresésnek.");
    // Nem töröljük a listát, hogy lássa az üzenetet
  } else {
    renderVideos(filtered);
  }
}

// --- 4. RENDERELÉS (A Gomb beillesztésével) ---
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

  // A HTML ugyanaz, csak hozzáadtuk a SZŰRŐ GOMBOT (🔍 ikon)
  container.innerHTML = `
        <video src="${data.videoUrl}" loop playsinline muted poster="${
    data.kepek ? data.kepek[0] : ""
  }"></video>
        <div class="play-icon">▶</div>

        <div class="video-overlay">
            <div class="controls">
                <a href="../../../index.html" class="menu-btn" title="Főoldal">🏠</a>
                
                <button onclick="openFilterModal()" class="details-btn" style="border-color: #E2F1B0; color: #E2F1B0;" title="Mentett Szűrések">
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
                <h3>${data.varos}, ${data.utca || "Központ"}</h3>
                <p>${Number(data.ar).toLocaleString()} Ft</p>
                <p class="specs">${data.alapterulet} m² • ${
    data.szobaszam
  } szoba</p>
            </div>
        </div>
    `;

  // Eseménykezelők bekötése (Ugyanaz mint eddig)
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

  // Mute gomb logika
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

// Observer (TikTok effekt)
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
