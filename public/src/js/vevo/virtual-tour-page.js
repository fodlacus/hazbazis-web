import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

let viewer = null;

// INDÍTÁS
window.addEventListener("DOMContentLoaded", async () => {
  // 1. ID kiolvasása az URL-ből
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  if (!id) {
    alert("Hiba: Nincs ingatlan kiválasztva.");
    window.history.back();
    return;
  }

  // 2. Adatok lekérése
  try {
    const docRef = doc(adatbazis, "lakasok", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      document.getElementById("ingatlan-nev").innerText =
        data.nev || "Ingatlan bejárás";

      // Van-e virtuális séta adat?
      if (data.virtual_tour && data.virtual_tour.alaprajz_url) {
        initTour(data.virtual_tour);
      } else {
        alert("Ehhez az ingatlanhoz még nincs feltöltve virtuális séta.");
        window.history.back();
      }
    } else {
      alert("Az ingatlan nem található.");
      window.history.back();
    }
  } catch (e) {
    console.error("Hiba:", e);
  }
});

function initTour(tourData) {
  // Kép betöltése
  document.getElementById("alaprajz-img").src = tourData.alaprajz_url;

  // Pannellum jelenetek (Scenes) előkészítése
  const scenes = {};
  tourData.szobak.forEach((szoba) => {
    scenes[szoba.id] = {
      title: szoba.nev,
      type: "equirectangular",
      // "type": "flat", // Ha csak sima fotóid vannak, kapcsold be ezt!
      panorama: szoba.panorama_url,
      autoLoad: true,
      yaw: szoba.kezdo_irany || 0,
      showControls: true,
    };
  });

  const elsoSzobaId = tourData.szobak[0].id;

  // Pannellum Indítása
  viewer = pannellum.viewer("panorama", {
    default: {
      firstScene: elsoSzobaId,
      sceneFadeDuration: 1000,
      compass: false,
    },
    scenes: scenes,
  });

  // Pöttyök kirajzolása
  renderPins(tourData.szobak);
  highlightPin(elsoSzobaId);
  updateInfo(elsoSzobaId, tourData);

  // Váltás figyelése
  viewer.on("scenechange", (newId) => {
    highlightPin(newId);
    updateInfo(newId, tourData);
  });
}

function renderPins(szobak) {
  const container = document.getElementById("alaprajz-pins");
  container.innerHTML = "";

  szobak.forEach((szoba) => {
    const btn = document.createElement("button");
    // Pozícionálás % alapján
    btn.style.left = `${szoba.x}%`;
    btn.style.top = `${szoba.y}%`;

    btn.className =
      "absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white bg-[#3D4A16] shadow-lg hover:scale-125 transition-all z-20 cursor-pointer flex items-center justify-center";
    btn.innerHTML = '<i class="fa-solid fa-eye text-[10px] text-white"></i>';

    btn.dataset.id = szoba.id;

    btn.onclick = () => {
      viewer.loadScene(szoba.id);
    };

    container.appendChild(btn);
  });
}

function highlightPin(id) {
  document.querySelectorAll("#alaprajz-pins button").forEach((btn) => {
    if (btn.dataset.id === id) {
      btn.classList.add("pin-active"); // CSS-ben definiált piros pulzálás
      btn.classList.remove("bg-[#3D4A16]");
    } else {
      btn.classList.remove("pin-active");
      btn.classList.add("bg-[#3D4A16]");
    }
  });
}

function updateInfo(id, data) {
  const szoba = data.szobak.find((s) => s.id === id);
  if (szoba) {
    document.getElementById(
      "aktualis-szoba"
    ).innerText = `Helyiség: ${szoba.nev}`;
  }
}

// ==========================================================
// SEGÉD: KOORDINÁTA KERESŐ (Csak fejlesztéshez!)
// Kattints az alaprajzra, és megmondja az X, Y százalékot!
// ==========================================================
document.addEventListener("click", (e) => {
  if (e.target.id === "alaprajz-img") {
    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const msg = `POZÍCIÓ MÁSOLÁSHOZ:\n"x": ${x.toFixed(1)},\n"y": ${y.toFixed(
      1
    )}`;
    console.log(msg);
    alert(msg);
  }
});
