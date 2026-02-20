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
let allIngatlanok = [];
let utolso_rajz = null; // Megjegyezzük a rajzot, hogy le tudjuk törölni

// Segédfüggvény az URL kinyeréséhez (string vagy objektum esetén is működik)
const getUrl = (item) => {
  if (!item) return null;
  return typeof item === "object" ? item.url : item;
};

// --- 3. INDÍTÁS AMIKOR AZ OLDAL BETÖLTÖTT ---
window.addEventListener("DOMContentLoaded", async () => {
  // Először letöltjük az adatokat
  await loadIngatlanok();
  // Inicializáljuk a törlés gombot
  initDeleteButton();
});

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
window.terkep_alap_inditasa = function () {
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
};

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

function terkep_markerek_frissitese(ingatlan_tomb) {
  for (let i = 0; i < aktiv_markerek.length; i++) {
    aktiv_markerek[i].setMap(null);
  }
  aktiv_markerek = [];

  for (let j = 0; j < ingatlan_tomb.length; j++) {
    const adat = ingatlan_tomb[j];

    if (adat.lat && adat.lng) {
      // JAVÍTOTT KÉPKERESÉSI LOGIKA (Prioritási sorrend)
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

      if (foundKep) {
        borito_kep = foundKep;
      }

      const jitterLat = adat.lat + (Math.random() - 0.5) * 0.0005;
      const jitterLng = adat.lng + (Math.random() - 0.5) * 0.0005;
      const pozicio = { lat: jitterLat, lng: jitterLng };

      const azonosito = adat.azon || adat.id.substring(0, 5);
      const arMillio = Math.round(adat.vételár / 1000000);
      const pontos_cim = `${adat.telepules}, ${adat.utca || ""} ${
        adat.hazszam || ""
      }`;

      const uj_marker = new google.maps.Marker({
        position: pozicio,
        map: fo_terkep,
        title: `${pontos_cim}`,
      });

      const tartalom_html = `
              <div style="padding: 5px; max-width: 200px; font-family: sans-serif;">
                  <img src="${borito_kep}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; margin-bottom: 8px; background-color: #eee;">
                  <h3 style="margin: 0 0 5px 0; font-size: 16px; color: #333;">${arMillio} Millió Ft</h3>
                  <p style="margin: 0 0 10px 0; font-size: 13px; color: #666;">${pontos_cim}</p>
                  <a href="../../html/vevo/adatlap.html?id=${adat.id}" style="background-color: #8bc34a; color: #3D4A16; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-weight: bold; display: block; text-align: center;">Részletek</a>
              </div>
          `;

      const info_ablak = new google.maps.InfoWindow({
        content: tartalom_html,
      });

      uj_marker.addListener("click", () => {
        info_ablak.open({
          anchor: uj_marker,
          map: fo_terkep,
        });
      });

      aktiv_markerek.push(uj_marker);
    }
  }
}
