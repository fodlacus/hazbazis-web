import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

let viewer = null;
let currentTourData = null;
let aktualisSzintId = null;

// INDÍTÁS
window.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  if (!id) return alert("Hiba: Nincs ingatlan ID.");

  try {
    const docSnap = await getDoc(doc(adatbazis, "lakasok", id));
    if (docSnap.exists()) {
      const data = docSnap.data();
      document.getElementById("ingatlan-nev").innerText =
        data.nev || "Ingatlan bejárás";

      if (data.virtual_tour) {
        // Támogatjuk a régi (egyszintes) és új (többszintes) formátumot is
        const tourData = normalizaldAzAdatokat(data.virtual_tour);
        initTour(tourData);
      } else {
        alert("Nincs virtuális séta adat.");
      }
    }
  } catch (e) {
    console.error("Hiba:", e);
  }
});

// ADATOK EGYSÉGESÍTÉSE (Hogy a régi egyszintes is működjön)
function normalizaldAzAdatokat(rawData) {
  if (rawData.tobb_szintes) return rawData;

  // Ha régi típusú, átalakítjuk "egy szintesre"
  return {
    tobb_szintes: true,
    szintek: [
      {
        id: "alap",
        nev: "Alaprajz",
        alaprajz_url: rawData.alaprajz_url,
        szobak: rawData.szobak,
      },
    ],
  };
}

function initTour(tourData) {
  currentTourData = tourData;

  // 1. Pannellum Scene-ek összerakása (Minden szoba egy helyre, szinttől függetlenül)
  const scenes = {};
  let elsoSzobaId = null;

  tourData.szintek.forEach((szint) => {
    szint.szobak.forEach((szoba) => {
      if (!elsoSzobaId) elsoSzobaId = szoba.id; // Az legelső szint legelső szobája a start

      scenes[szoba.id] = {
        title: szoba.nev,
        type: "equirectangular",
        panorama: szoba.panorama_url,
        autoLoad: true,
        yaw: szoba.kezdo_irany || 0,
        hotSpots: (szoba.hotspots || []).map((h) => ({
          pitch: h.pitch || -10,
          yaw: h.yaw || 0,
          type: "scene",
          text: h.szoveg,
          sceneId: h.cel_id,
        })),
      };
    });
  });

  // 2. Pannellum Indítása
  viewer = pannellum.viewer("panorama", {
    default: {
      firstScene: elsoSzobaId,
      sceneFadeDuration: 1000,
      compass: false,
    },
    scenes: scenes,
  });

  // 3. Eseményfigyelő: Ha szobát váltunk (akár nyíllal, akár térképen)
  viewer.on("scenechange", (ujSzobaId) => {
    frissitsdAHelyszint(ujSzobaId);
  });

  // 4. Első állapot beállítása
  frissitsdAHelyszint(elsoSzobaId);
  renderSzintValaszto();
}

// FŐ LOGIKA: Hol vagyunk most?
function frissitsdAHelyszint(szobaId) {
  // Megkeressük, melyik szinten van ez a szoba
  let talaltSzint = null;
  let talaltSzoba = null;

  for (const szint of currentTourData.szintek) {
    const s = szint.szobak.find((r) => r.id === szobaId);
    if (s) {
      talaltSzint = szint;
      talaltSzoba = s;
      break;
    }
  }

  if (talaltSzint) {
    // Ha szintet váltottunk (pl. felmentünk a lépcsőn), cseréljük az alaprajzot!
    if (aktualisSzintId !== talaltSzint.id) {
      valtsSzintet(talaltSzint.id);
    }

    // Frissítjük a kiírást és a piros pöttyöt
    document.getElementById(
      "aktualis-szoba"
    ).innerText = `${talaltSzint.nev} - ${talaltSzoba.nev}`;
    highlightPin(szobaId);
  }
}

// UI: Szintválasztó Gombok (Tabok) Generálása
function renderSzintValaszto() {
  const kontener = document.getElementById("szint-valaszto");
  kontener.innerHTML = "";

  // Ha csak 1 szint van, nem kellenek gombok
  if (currentTourData.szintek.length <= 1) {
    kontener.style.display = "none";
    return;
  }

  currentTourData.szintek.forEach((szint) => {
    const btn = document.createElement("button");
    btn.innerText = szint.nev;
    btn.className = `px-3 py-1 text-xs font-bold rounded-full border transition-all whitespace-nowrap
                         ${
                           szint.id === aktualisSzintId
                             ? "bg-[#E2F1B0] text-[#3D4A16] border-transparent"
                             : "bg-transparent text-white/60 border-white/20 hover:bg-white/10"
                         }`;

    btn.onclick = () => {
      // Gombra kattintva betöltjük a szint első szobáját
      valtsSzintet(szint.id);
      // Opcionális: oda is ugorhatunk az első szobába
      viewer.loadScene(szint.szobak[0].id);
    };

    // ID-t adunk neki, hogy később színezzük
    btn.dataset.szintId = szint.id;
    kontener.appendChild(btn);
  });
}

// UI: Alaprajz és Pöttyök Cseréje
function valtsSzintet(szintId) {
  aktualisSzintId = szintId;
  const szint = currentTourData.szintek.find((s) => s.id === szintId);

  // 1. Alaprajz kép csere
  document.getElementById("alaprajz-img").src = szint.alaprajz_url;

  // 2. Gombok frissítése (aktív állapot)
  const gombok = document.querySelectorAll("#szint-valaszto button");
  gombok.forEach((btn) => {
    if (btn.dataset.szintId === szintId) {
      btn.className =
        "px-3 py-1 text-xs font-bold rounded-full border transition-all whitespace-nowrap bg-[#E2F1B0] text-[#3D4A16] border-transparent";
    } else {
      btn.className =
        "px-3 py-1 text-xs font-bold rounded-full border transition-all whitespace-nowrap bg-transparent text-white/60 border-white/20 hover:bg-white/10";
    }
  });

  // 3. Pöttyök (Pin-ek) újrarajzolása az új szinthez
  renderPins(szint.szobak);
}

function renderPins(szobak) {
  const container = document.getElementById("alaprajz-pins");
  container.innerHTML = "";

  szobak.forEach((szoba) => {
    const btn = document.createElement("button");
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
  // Csak a jelenlegi szint pöttyeit nézzük
  document.querySelectorAll("#alaprajz-pins button").forEach((btn) => {
    if (btn.dataset.id === id) {
      btn.classList.add("pin-active"); // CSS animáció
      btn.classList.remove("bg-[#3D4A16]");
    } else {
      btn.classList.remove("pin-active");
      btn.classList.add("bg-[#3D4A16]");
    }
  });
}
