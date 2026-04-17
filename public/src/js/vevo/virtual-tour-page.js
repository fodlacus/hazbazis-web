import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

let viewer = null;
let currentTourData = null;
let aktualisSzintId = null;
let aktualisSzobaIdGlob = null;

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
  if (!rawData || typeof rawData !== "object") {
    return { tobb_szintes: true, szintek: [] };
  }

  const biztonsagosSzintek = (tomb) =>
    (Array.isArray(tomb) ? tomb : []).map((sz) => ({
      ...sz,
      szobak: Array.isArray(sz.szobak) ? sz.szobak : [],
    }));

  // VT szerkesztő / Firestore: gyakran csak { szintek: [...] }, tobb_szintes nélkül
  if (Array.isArray(rawData.szintek) && rawData.szintek.length > 0) {
    return {
      tobb_szintes: true,
      szintek: biztonsagosSzintek(rawData.szintek),
    };
  }

  // Régi egyszintes: alaprajz_url + szobak a dokumentum gyökerében
  return {
    tobb_szintes: true,
    szintek: [
      {
        id: "alap",
        nev: "Alaprajz",
        alaprajz_url: rawData.alaprajz_url,
        szobak: Array.isArray(rawData.szobak) ? rawData.szobak : [],
      },
    ],
  };
}

function panoramaUrlErvenyes(szoba) {
  const u = szoba && szoba.panorama_url != null ? String(szoba.panorama_url).trim() : "";
  return u.length > 0;
}

/** Első olyan szoba (sorrend szerint), amit meg tudunk jeleníteni (van panoráma URL). */
function elsoMegjelenithetoSzobaId(tourData) {
  for (const szint of tourData.szintek || []) {
    for (const szoba of szint.szobak || []) {
      if (!panoramaUrlErvenyes(szoba)) continue;
      const tipus = szoba.tipus || "pano";
      if (tipus === "pano" || tipus === "sima") return szoba.id;
    }
  }
  return null;
}

function initTour(tourData) {
  currentTourData = tourData;

  // 1. Pannellum Scene-ek – csak érvényes panoráma URL-lel (üres / hiányzó URL Pannellum belső hibát okoz)
  const scenes = {};

  tourData.szintek.forEach((szint) => {
    (szint.szobak || []).forEach((szoba) => {
      const tipus = szoba.tipus || "pano";
      if (tipus !== "pano") return;
      if (!panoramaUrlErvenyes(szoba)) {
        console.warn(
          "[VT] Panoráma kihagyva (nincs panorama_url):",
          szoba.id || szoba.nev
        );
        return;
      }
      scenes[szoba.id] = {
        title: szoba.nev,
        type: "equirectangular",
        panorama: String(szoba.panorama_url).trim(),
        autoLoad: true,
        yaw: szoba.kezdo_irany || 0,
        hotSpots: [],
      };
    });
  });

  // Hotspotok: csak olyan cel_id, amihez van Pannellum-jelenet (különben összeomlik a viewer)
  tourData.szintek.forEach((szint) => {
    (szint.szobak || []).forEach((szoba) => {
      const sc = scenes[szoba.id];
      if (!sc) return;
      sc.hotSpots = (szoba.hotspots || [])
        .filter((h) => h && h.cel_id && scenes[h.cel_id])
        .map((h) => ({
          pitch: h.pitch || -10,
          yaw: h.yaw || 0,
          type: "scene",
          text: h.szoveg,
          sceneId: h.cel_id,
        }));
    });
  });

  const sceneKeys = Object.keys(scenes);
  const elsoSzobaId = elsoMegjelenithetoSzobaId(tourData);

  // 2. Pannellum – WebGL-hez a képszerveren legyen CORS (pl. media.hazbazis.hu: Access-Control-Allow-Origin)
  if (sceneKeys.length > 0) {
    try {
      viewer = pannellum.viewer("panorama", {
        default: {
          firstScene: sceneKeys[0],
          sceneFadeDuration: 1000,
          compass: false,
          crossOrigin: "anonymous",
        },
        scenes: scenes,
      });
      viewer.on("scenechange", (ujSzobaId) => {
        frissitsdAHelyszint(ujSzobaId);
      });
    } catch (err) {
      console.error("[VT] Pannellum indítás hiba:", err);
      viewer = null;
    }
  } else {
    console.warn("[VT] Nincs egyetlen érvényes panoráma jelenet sem.");
  }

  if (!elsoSzobaId) {
    alert(
      "Nincs megjeleníthető panoráma: minden szobánál adj meg érvényes panorama_url-t (https://…)."
    );
  }

  loadRoom(elsoSzobaId);
  renderSzintValaszto();
}

// --- OKOS VEZÉRLŐ FÜGGVÉNY ---
function loadRoom(szobaId) {
  if (szobaId == null || szobaId === "") return;

  // Megkeressük a szoba adatait
  aktualisSzobaIdGlob = szobaId;
  let talaltSzoba = null;
  for (const szint of currentTourData.szintek) {
    const s = (szint.szobak || []).find((r) => r.id === szobaId);
    if (s) {
      talaltSzoba = s;
      break;
    }
  }

  if (!talaltSzoba) return;

  const tipus = talaltSzoba.tipus || "pano";
  const panoDiv = document.getElementById("panorama");
  const flatDiv = document.getElementById("flat-image-viewer");
  const flatImg = document.getElementById("flat-image-display");

  if (tipus === "pano") {
    // Ha 360-as: Pannellum mutatása, sima kép elrejtése
    panoDiv.classList.remove("hidden");
    flatDiv.classList.add("hidden");
    if (viewer && panoramaUrlErvenyes(talaltSzoba)) {
      try {
        viewer.loadScene(szobaId);
      } catch (e) {
        console.error("[VT] loadScene:", e);
      }
    }
  } else if (tipus === "sima") {
    // Ha sima fotó: Pannellum elrejtése, sima kép mutatása
    panoDiv.classList.add("hidden");
    flatDiv.classList.remove("hidden");
    flatImg.src = talaltSzoba.panorama_url; // Itt a normál fotó URL-je kell legyen

    // Mivel a Pannellum most "alszik", kézzel kell frissítenünk a feliratokat és a piros pöttyöt
    frissitsdAHelyszint(szobaId);
  }
}

// FŐ LOGIKA: Hol vagyunk most?
function frissitsdAHelyszint(szobaId) {
  // Megkeressük, melyik szinten van ez a szoba
  let talaltSzint = null;
  let talaltSzoba = null;

  for (const szint of currentTourData.szintek) {
    const s = (szint.szobak || []).find((r) => r.id === szobaId);
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
    // --- ITT A VÁLTOZÁS ---

    // 1. Frissítjük a FENTI lebegő sáv kiírását (ha létezik)
    const topLabel = document.getElementById("aktualis-szoba");
    if (topLabel) {
      topLabel.innerText = `Helyiség: ${talaltSzint.nev} - ${talaltSzoba.nev}`;
    }

    // 2. Frissítjük az OLDALSÁV kiírását (az új ID alapján)
    const sideLabel = document.getElementById("aktualis-szoba-sidebar");
    if (sideLabel) {
      // Ide elég csak a szoba neve, mert a szintet a gombok mutatják
      sideLabel.innerText = talaltSzoba.nev;
    }

    // Piros pötty animálása
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
      const elso = (szint.szobak || [])[0];
      if (viewer && elso) viewer.loadScene(elso.id);
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
  if (!szint) return;

  // 1. Alaprajz kép csere
  const alapImg = document.getElementById("alaprajz-img");
  if (alapImg) alapImg.src = szint.alaprajz_url || "";

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
  renderPins(szint.szobak || []);
}

function renderPins(szobak) {
  const container = document.getElementById("alaprajz-pins");
  container.innerHTML = "";

  szobak.forEach((szoba) => {
    const btn = document.createElement("button");
    btn.style.left = `${szoba.x}%`;
    btn.style.top = `${szoba.y}%`;

    const iconClass = szoba.tipus === "sima" ? "fa-camera" : "fa-eye";

    btn.className =
      "absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white bg-[#3D4A16] shadow-lg hover:scale-125 transition-all z-20 cursor-pointer flex items-center justify-center";
    btn.innerHTML = '<i class="fa-solid fa-eye text-[10px] text-white"></i>';
    btn.dataset.id = szoba.id;

    btn.onclick = () => {
      loadRoom(szoba.id);
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

// ÚJ: Lapozó funkció a sima képekhez
window.lapozas = function (irany) {
  // 1. Megkeressük az aktuális szintet
  const szint = currentTourData.szintek.find((s) => s.id === aktualisSzintId);
  if (!szint) return;

  // 2. Kiszűrjük CSAK a "sima" típusú szobákat/képeket ezen a szinten
  const simaSzobak = (szint.szobak || []).filter((sz) => sz.tipus === "sima");
  if (simaSzobak.length === 0) return;

  // 3. Megkeressük, hányadik képet nézzük éppen a listából
  const currentIndex = simaSzobak.findIndex(
    (sz) => sz.id === aktualisSzobaIdGlob
  );
  if (currentIndex === -1) return;

  // 4. Kiszámoljuk a következő indexet (ha a végére ér, körbefordul az elejére)
  let nextIndex = currentIndex + irany;
  if (nextIndex >= simaSzobak.length) nextIndex = 0; // Utolsó után az első
  if (nextIndex < 0) nextIndex = simaSzobak.length - 1; // Első előtt az utolsó

  // 5. A Varázslat: Betöltjük az új szobát. A loadRoom() automatikusan intézi a térkép frissítését!
  const nextSzobaId = simaSzobak[nextIndex].id;
  loadRoom(nextSzobaId);
};
