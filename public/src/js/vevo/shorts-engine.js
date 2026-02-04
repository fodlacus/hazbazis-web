import { adatbazis as db } from "../util/firebase-config.js";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  doc,
  increment,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- GLOBÁLIS VÁLTOZÓK ---
const videoFeed = document.querySelector(".video-feed");
const searchInput = document.getElementById("search-input");
let isGloballyMuted = true; // Alapból némítva (böngészők szeretik)
let allVideos = [];

// --- 1. INDÍTÁS ---
document.addEventListener("DOMContentLoaded", () => {
  loadVideos();
});

// --- 2. ADATOK BETÖLTÉSE (Lakasok + VideoURL + Order) ---
async function loadVideos() {
  try {
    // Csak azokat kérjük le, ahol van 'videoUrl'
    // És sorrendbe állítjuk az 'order' mező szerint
    const q = query(collection(db, "lakasok"), orderBy("order", "asc"));

    const snapshot = await getDocs(q);

    allVideos = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Csak akkor adjuk hozzá, ha tényleg van videója
      if (data.videoUrl) {
        allVideos.push({ id: doc.id, ...data });
      }
    });

    if (allVideos.length === 0) {
      videoFeed.innerHTML =
        '<div style="color:white; text-align:center; padding-top:40vh;">Nincs feltöltött videó.</div>';
      return;
    }

    renderVideos(allVideos);
  } catch (error) {
    console.error("Hiba a videók betöltésekor:", error);
    // Ha hiányzik az index, a konzol dobni fog egy linket, arra kattints rá!
    if (error.message.includes("index")) {
      alert("Hiányzó Firebase Index! Nézd meg a konzolt a linkért.");
    }
  }
}

// --- 3. MEGJELENÍTÉS ÉS RENDERELÉS ---
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

  // Extrák ikonjai (Ingatlan specifikus)
  let extrasInfo = `${data.alapterulet} m² • ${data.szobaszam} szoba`;
  if (data.erkely > 0) extrasInfo += " • Erkély";

  // Azononosító
  const azonosito = data.id.startsWith("HB") ? data.id : `#${data.id}`;

  container.innerHTML = `
        <video 
            src="${data.videoUrl}" 
            loop 
            playsinline 
            muted 
            poster="${data.kepek ? data.kepek[0] : ""}" 
        ></video>
        
        <div class="play-icon">▶</div>

        <div class="video-overlay">
            <div class="controls">
                <a href="../../../index.html" class="menu-btn" title="Főoldal">🏠</a>
                
                <button class="mute-btn">${
                  isGloballyMuted ? "🔇" : "🔊"
                }</button>
                
                <button onclick="window.location.href='adatlap.html?id=${
                  data.id
                }'" title="Adatlap">
                    📄
                </button>
            </div>

            <div class="video-info">
                <span class="brand-badge">${azonosito}</span>
                <h3>${data.varos}, ${data.utca || "Központ"}</h3>
                <p>${Number(data.ar).toLocaleString()} Ft</p>
                <p class="specs">${extrasInfo}</p>
            </div>
        </div>
    `;

  // --- ESEMÉNYKEZELŐK (Javítva) ---

  const video = container.querySelector("video");
  const muteBtn = container.querySelector(".mute-btn");
  const playIcon = container.querySelector(".play-icon");

  // 1. Play/Pause (Kattintás a videóra)
  container.addEventListener("click", (e) => {
    // Ha gombra kattintottunk, ne álljon meg
    if (e.target.closest("button") || e.target.closest("a")) return;

    if (video.paused) {
      video.play();
      playIcon.style.opacity = "0";
    } else {
      video.pause();
      playIcon.style.opacity = "1";
    }
  });

  // 2. Némítás kezelés
  video.muted = isGloballyMuted; // Beállítás indításkor

  muteBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Ne indítsa el a videót a háttérben
    toggleGlobalMute();
  });

  return container;
}

// --- 4. VEZÉRLÉS LOGIKA ---

function toggleGlobalMute() {
  isGloballyMuted = !isGloballyMuted;

  // Minden videót frissítünk
  document
    .querySelectorAll("video")
    .forEach((v) => (v.muted = isGloballyMuted));

  // Minden gombot frissítünk
  document.querySelectorAll(".mute-btn").forEach((btn) => {
    btn.textContent = isGloballyMuted ? "🔇" : "🔊";
  });
}

// --- 5. KERESÉS ---
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    // Kisbetűsítjük és levágjuk a felesleges szóközöket
    const rawTerm = e.target.value.toLowerCase().trim();

    // Ha törölte a mezőt, töltsük vissza az összeset
    if (!rawTerm) {
      renderVideos(allVideos);
      return;
    }

    // TRÜKK: Szavakra bontjuk a keresést (pl. "Debrecen lakás" -> ["debrecen", "lakás"])
    const searchWords = rawTerm.split(/\s+/);

    const filtered = allVideos.filter((v) => {
      // Összefűzzük az adatokat egy nagy "kereshető szöveggé"
      // + Hozzáadjuk a "lakás ingatlan eladó" szavakat is, hogy ezekre is lehessen keresni!
      const content = `
                  ${v.varos} 
                  ${v.utca || ""} 
                  ${v.leiras || ""} 
                  ${v.ar} 
                  lakás ház ingatlan eladó
              `.toLowerCase();

      // LOGIKA: Csak azt adjuk vissza, ahol a beírt szavak MINDEGYIKE szerepel
      // Így a "Debrecen 50 millió" működni fog (város + ár)
      return searchWords.every((word) => content.includes(word));
    });

    // Ha nincs találat, írjunk ki egy szép üzenetet
    if (filtered.length === 0) {
      videoFeed.innerHTML = `
          <div style="height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; color: rgba(255,255,255,0.5);">
              <p style="font-size: 1.2rem;">Nincs találat erre: "${rawTerm}"</p>
              <p style="font-size: 0.9rem; margin-top: 10px;">Tipp: Próbáld ragozás nélkül (pl. "Debrecen")</p>
              
              <button onclick="window.szuroTorlese()" 
                  style="margin-top: 20px; padding: 10px 20px; background: rgba(255,255,255,0.1); border-radius: 20px; border: none; color: white; cursor: pointer;">
                  Szűrő törlése ✕
              </button>
          </div>`;
    } else {
      renderVideos(filtered);
    }
  });
}

// --- 6. OBSERVER (TikTok effekt) ---
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const video = entry.target.querySelector("video");
      if (!video) return;

      if (entry.isIntersecting) {
        // Ha beúszott a képbe
        video.currentTime = 0; // Mindig elölről kezdje
        video
          .play()
          .catch(() => console.log("Autoplay tiltva (interakció kell)"));
      } else {
        // Ha kiúszott
        video.pause();
      }
    });
  },
  { threshold: 0.6 }
); // Akkor vált, ha 60%-ban látszik

// EXPORTÁLJUK A TÖRLÉS FUNKCIÓT A GLOBÁLIS TÉRBE (HÍD)
window.szuroTorlese = function () {
  // 1. Töröljük a mezőt
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";

  // 2. Visszatöltjük az eredeti listát a memóriából (nem kell újra adatbázis hívás!)
  renderVideos(allVideos);
};
