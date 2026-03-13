// --- 1. FIREBASE IMPORTÁLÁSOK ---
import {
  collection,
  getDocs,
  query,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

// --- 2. GLOBÁLIS VÁLTOZÓK ---
let fo_terkep;
let rajzolo_eszkoz;
let aktiv_markerek = [];
let aktualis_clusterer = null; // MarkerClusterer példány, ha van
let allIngatlanok = [];
let utolso_rajz = null;

const KLASZTER_KUSZOB = 15; // Ennél több marker esetén klaszterezünk

// Árkategória (M Ft), m2 sávok a csoportosításhoz
function getArKategoria(ar) {
  const m = (ar || 0) / 1_000_000;
  if (m < 50) return "0–50 M Ft";
  if (m < 80) return "50–80 M Ft";
  if (m < 120) return "80–120 M Ft";
  return "120+ M Ft";
}
function getM2Sav(m2) {
  const v = Number(m2) || 0;
  if (v < 60) return "60 m² alatt";
  if (v < 80) return "60–80 m²";
  if (v < 100) return "80–100 m²";
  if (v < 150) return "100–150 m²";
  return "150+ m²";
}

// Segédfüggvény az URL kinyeréséhez
const getUrl = (item) => {
  if (!item) return null;
  return typeof item === "object" ? item.url : item;
};

// --- 3. INDÍTÁS AMIKOR AZ OLDAL BETÖLTÖTT ---
async function initTerkepOldal() {
  // Először letöltjük az adatokat
  await loadIngatlanok();
  // Inicializáljuk a törlés gombot
  initDeleteButton();
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initTerkepOldal);
} else {
  initTerkepOldal();
}

// ÚJ: Törlés gomb működése
function initDeleteButton() {
  const deleteBtn = document.getElementById("torles-gomb");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      // 1. Ha van rajz, letöröljük a térképről
      if (utolso_rajz) {
        utolso_rajz.setMap(null);
        utolso_rajz = null;
      }
      // 2. Letöröljük a markereket is (üres listát küldünk a frissítőnek)
      terkep_markerek_frissitese([]);
      console.log("Keresés törölve.");
    });
  }
}

// --- 4. FIREBASE ADATOK LETÖLTÉSE ---
async function loadIngatlanok() {
  try {
    console.log("Firebase adatok letöltése indul...");
    const q = query(collection(adatbazis, "lakasok"));
    const snap = await getDocs(q);
    allIngatlanok = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    console.log(`Sikeresen betöltve ${allIngatlanok.length} db ingatlan.`);
  } catch (err) {
    console.error("Hiba az adatok betöltésekor:", err);
  }
}

// --- 5. GOOGLE MAPS INDÍTÁSA ---
export function terkep_alap_inditasa() {
  console.log("Google Maps betöltése indul...");
  const budapest_kozeppont = { lat: 47.4979, lng: 19.0402 };
  fo_terkep = new google.maps.Map(document.getElementById("terkep_tarolo"), {
    center: budapest_kozeppont,
    zoom: 12,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false, // Kikapcsoljuk, hogy ne zavarja a saját gombunkat
  });

  rajzolo_eszkoz = new google.maps.drawing.DrawingManager({
    drawingMode: null,
    drawingControl: true,
    drawingControlOptions: {
      position: google.maps.ControlPosition.TOP_CENTER,
      drawingModes: [
        google.maps.drawing.OverlayType.POLYGON,
        google.maps.drawing.OverlayType.CIRCLE,
      ],
    },
    polygonOptions: {
      fillColor: "#8bc34a",
      fillOpacity: 0.4,
      strokeWeight: 2,
      clickable: false,
      editable: true,
      zIndex: 1,
    },
  });

  rajzolo_eszkoz.setMap(fo_terkep);

  google.maps.event.addListener(
    rajzolo_eszkoz,
    "overlaycomplete",
    function (esemeny) {
      rajzolo_eszkoz.setDrawingMode(null);

      // Automatikus törlés: Ha volt előző rajz, eltüntetjük
      if (utolso_rajz) {
        utolso_rajz.setMap(null);
      }
      utolso_rajz = esemeny.overlay; // Megjegyezzük az újat

      let szurt_ingatlanok = [];

      if (allIngatlanok.length === 0) return;

      if (esemeny.type === google.maps.drawing.OverlayType.POLYGON) {
        szurt_ingatlanok = ingatlanok_szurese_poligonnal(
          esemeny.overlay,
          allIngatlanok
        );
        console.log("Poligon szűrés:", szurt_ingatlanok.length, "db");
      } else if (esemeny.type === google.maps.drawing.OverlayType.CIRCLE) {
        const kor = esemeny.overlay;
        szurt_ingatlanok = ingatlanok_szurese_korrel(
          kor.getCenter(),
          kor.getRadius(),
          allIngatlanok
        );
        console.log("Kör szűrés:", szurt_ingatlanok.length, "db");
      }

      terkep_markerek_frissitese(szurt_ingatlanok);
    }
  );
}

window.__terkep_alap_inditasa = terkep_alap_inditasa;

// --- 6. SZŰRŐ ÉS FRISSÍTŐ FÜGGVÉNYEK ---
function ingatlanok_szurese_poligonnal(sokszog_objektum, osszes_ingatlan_tomb) {
  const szurt_lista = [];
  for (let i = 0; i < osszes_ingatlan_tomb.length; i++) {
    const adat = osszes_ingatlan_tomb[i];
    if (adat.lat && adat.lng) {
      const pont = new google.maps.LatLng(adat.lat, adat.lng);
      if (google.maps.geometry.poly.containsLocation(pont, sokszog_objektum)) {
        szurt_lista.push(adat);
      }
    }
  }
  return szurt_lista;
}

function ingatlanok_szurese_korrel(
  kor_kozeppont,
  kor_sugar,
  osszes_ingatlan_tomb
) {
  const szurt_lista = [];
  for (let i = 0; i < osszes_ingatlan_tomb.length; i++) {
    const adat = osszes_ingatlan_tomb[i];
    if (adat.lat && adat.lng) {
      const pont = new google.maps.LatLng(adat.lat, adat.lng);
      const tav = google.maps.geometry.spherical.computeDistanceBetween(
        kor_kozeppont,
        pont
      );
      if (tav <= kor_sugar) szurt_lista.push(adat);
    }
  }
  return szurt_lista;
}

function egy_ingatlan_info_html(adat) {
  let borito_kep = "https://placehold.co/300x200?text=Nincs+kép";
  const foundKep =
    getUrl(adat.boritokep) ||
    (adat.kepek_horiz && adat.kepek_horiz.length > 0
      ? getUrl(adat.kepek_horiz[0])
      : null) ||
    (adat.kepek_vert && adat.kepek_vert.length > 0
      ? getUrl(adat.kepek_vert[0])
      : null) ||
    (adat.kepek && adat.kepek.length > 0 ? getUrl(adat.kepek[0]) : null);
  if (foundKep) borito_kep = foundKep;
  const arMillio = Math.round((adat.vételár || 0) / 1_000_000);
  const pontos_cim = `${adat.telepules || ""}, ${adat.utca || ""} ${
    adat.hazszam || ""
  }`.trim();
  return `
    <div style="padding: 5px; max-width: 200px; font-family: sans-serif;">
      <img src="${borito_kep}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; margin-bottom: 8px; background-color: #eee;">
      <h3 style="margin: 0 0 5px 0; font-size: 16px; color: #333;">${arMillio} Millió Ft</h3>
      <p style="margin: 0 0 10px 0; font-size: 13px; color: #666;">${pontos_cim}</p>
      <a href="../../html/vevo/adatlap.html?id=${adat.id}" style="background-color: #8bc34a; color: #3D4A16; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-weight: bold; display: block; text-align: center;">Részletek</a>
    </div>`;
}

function klaszter_tartalom_html(markerek) {
  const ingatlanok = markerek.map((m) => m.ingatlanData).filter(Boolean);
  if (ingatlanok.length === 0) return "<p>Nincs adat.</p>";

  const szobaCsoport = {};
  const arCsoport = {};
  const m2Csoport = {};
  ingatlanok.forEach((ing) => {
    const sz = String(ing.szobák ?? ing.szobak ?? "?");
    szobaCsoport[sz] = (szobaCsoport[sz] || 0) + 1;
    const arK = getArKategoria(ing.vételár);
    arCsoport[arK] = (arCsoport[arK] || 0) + 1;
    const m2k = getM2Sav(ing.alapterület ?? ing.alapterulet);
    m2Csoport[m2k] = (m2Csoport[m2k] || 0) + 1;
  });

  let blokk = `
    <div style="font-family: sans-serif; padding: 8px; max-width: 320px; max-height: 400px; overflow-y: auto;">
      <p style="margin: 0 0 8px 0; font-weight: bold; color: #333;">Összesen: ${
        ingatlanok.length
      } ingatlan</p>
      <p style="margin: 0 0 6px 0; font-size: 12px; color: #555;"><b>Szobaszám:</b> ${Object.entries(
        szobaCsoport
      )
        .map(([k, v]) => `${k} szoba: ${v} db`)
        .join(", ")}</p>
      <p style="margin: 0 0 6px 0; font-size: 12px; color: #555;"><b>Árkategória:</b> ${Object.entries(
        arCsoport
      )
        .map(([k, v]) => `${k}: ${v} db`)
        .join(", ")}</p>
      <p style="margin: 0 0 10px 0; font-size: 12px; color: #555;"><b>Alapterület:</b> ${Object.entries(
        m2Csoport
      )
        .map(([k, v]) => `${k}: ${v} db`)
        .join(", ")}</p>
      <hr style="margin: 8px 0;">
      <p style="margin: 0 0 4px 0; font-size: 11px; color: #666;">Kattints egy egyedi markerre a részletekért, vagy:</p>
      <ul style="margin: 0; padding-left: 18px; font-size: 12px;">`;

  ingatlanok.slice(0, 12).forEach((ing) => {
    const ar = Math.round((ing.vételár || 0) / 1_000_000);
    const cim = `${ing.telepules || ""} ${ing.utca || ""} ${
      ing.hazszam || ""
    }`.trim();
    blokk += `<li><a href="../../html/vevo/adatlap.html?id=${
      ing.id
    }" target="_blank">${ar} M Ft – ${cim || ing.id}</a></li>`;
  });
  if (ingatlanok.length > 12) {
    blokk += `<li style="color:#666;">… és még ${
      ingatlanok.length - 12
    } db</li>`;
  }
  blokk += "</ul></div>";
  return blokk;
}

function terkep_markerek_frissitese(ingatlan_tomb) {
  if (aktualis_clusterer) {
    aktualis_clusterer.clearMarkers();
    aktualis_clusterer.setMap(null);
    aktualis_clusterer = null;
  }
  for (let i = 0; i < aktiv_markerek.length; i++) {
    aktiv_markerek[i].setMap(null);
  }
  aktiv_markerek = [];

  const markerek = [];
  for (let j = 0; j < ingatlan_tomb.length; j++) {
    const adat = ingatlan_tomb[j];
    if (!adat.lat || !adat.lng) continue;

    const jitterLat = adat.lat + (Math.random() - 0.5) * 0.0005;
    const jitterLng = adat.lng + (Math.random() - 0.5) * 0.0005;
    const pozicio = { lat: jitterLat, lng: jitterLng };
    const pontos_cim = `${adat.telepules}, ${adat.utca || ""} ${
      adat.hazszam || ""
    }`.trim();

    const uj_marker = new google.maps.Marker({
      position: pozicio,
      map: null,
      title: pontos_cim,
    });
    uj_marker.ingatlanData = adat;
    markerek.push(uj_marker);
  }

  const MarkerClustererClass =
    (typeof window !== "undefined" &&
      window.markerClusterer?.MarkerClusterer) ||
    (typeof window !== "undefined" && window.MarkerClusterer);
  const useClusterer =
    markerek.length > KLASZTER_KUSZOB && MarkerClustererClass;

  if (useClusterer) {
    const Renderer = {
      render: (cluster, stats, map) => {
        const markersArr = Array.from(cluster.markers || []);
        const count = cluster.count ?? markersArr.length;
        const marker = new google.maps.Marker({
          position: cluster.position,
          map,
          label: {
            text: String(count),
            color: "white",
            fontSize: "14px",
            fontWeight: "bold",
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 28,
            fillColor: "#3D4A16",
            fillOpacity: 0.9,
            strokeColor: "#E2F1B0",
            strokeWeight: 2,
          },
          zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
        });
        marker.addListener("click", () => {
          const iw = new google.maps.InfoWindow({
            content: klaszter_tartalom_html(markersArr),
          });
          iw.open({ anchor: marker, map: fo_terkep });
        });
        return marker;
      },
    };
    aktualis_clusterer = new MarkerClustererClass({
      map: fo_terkep,
      markers: markerek,
      renderer: Renderer,
    });
  } else {
    for (let k = 0; k < markerek.length; k++) {
      const uj_marker = markerek[k];
      const adat = uj_marker.ingatlanData;
      uj_marker.setMap(fo_terkep);
      const info_ablak = new google.maps.InfoWindow({
        content: egy_ingatlan_info_html(adat),
      });
      uj_marker.addListener("click", () => {
        info_ablak.open({ anchor: uj_marker, map: fo_terkep });
      });
      aktiv_markerek.push(uj_marker);
    }
  }
}
