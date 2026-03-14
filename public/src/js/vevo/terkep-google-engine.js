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

const KLASZTER_KUSZOB = 5;
const TERKEP_STATE_KEY = "hazbazis_terkep_kijeloles";
const RESTORE_RETRY_MAX = 15;
let restoreRetryCount = 0;
let lastSzurtIngatlanok = [];
let aktualisCsoportId = "default";

// Csoportok a marker színezéshez (mező, felirat, értékek, színek)
const CSOPORT_DEFINICIOK = {
  default: { label: "Alapértelmezett (földrajzi)", ertekek: [], szinek: {} },
  tipus: {
    label: "Típus",
    field: "tipus",
    ertekek: ["Lakás", "Családi ház", "Ikerház", "Sorház", "Telek", "Garázs"],
    szinek: {
      Lakás: "#3D4A16",
      "Családi ház": "#6B8E23",
      Ikerház: "#8bc34a",
      Sorház: "#009688",
      Telek: "#2196F3",
      Garázs: "#795548",
    },
  },
  vetelar: {
    label: "Vételár",
    field: "vételár",
    ertekek: ["max 70 millió Ft", "70–150 millió között", "150 millió fölött"],
    szinek: {
      "max 70 millió Ft": "#2E7D32",
      "70–150 millió között": "#F9A825",
      "150 millió fölött": "#C62828",
    },
  },
  akcio: {
    label: "Akció",
    field: "akcios_ar",
    ertekek: ["Akciós", "Nem akciós"],
    szinek: { Akciós: "#D84315", "Nem akciós": "#5C6BC0" },
  },
  allapot: {
    label: "Állapot",
    field: "allapot",
    ertekek: [
      "Új építésű",
      "Újszerű",
      "Felújított",
      "Jó állapotú",
      "Lakható",
      "Felújítandó",
    ],
    szinek: {
      "Új építésű": "#00695C",
      Újszerű: "#00838F",
      Felújított: "#8bc34a",
      "Jó állapotú": "#7CB342",
      Lakható: "#F9A825",
      Felújítandó: "#EF6C00",
    },
  },
  kategoria: {
    label: "Kategória",
    field: "kategoria",
    ertekek: ["Eladó", "Kiadó"],
    szinek: { Eladó: "#3D4A16", Kiadó: "#1565C0" },
  },
};

function getCsoportErtek(ingatlan, csoportId) {
  const def = CSOPORT_DEFINICIOK[csoportId];
  if (!def || csoportId === "default" || !def.field) return null;
  if (def.field === "vételár") {
    const ar = Number(ingatlan.vételár) || 0;
    if (ar <= 70_000_000) return "max 70 millió Ft";
    if (ar <= 150_000_000) return "70–150 millió között";
    return "150 millió fölött";
  }
  if (def.field === "akcios_ar") {
    const v = ingatlan.akcios_ar;
    return v && String(v).trim() !== "" ? "Akciós" : "Nem akciós";
  }
  const raw = ingatlan[def.field];
  const s = raw != null ? String(raw).trim() : "";
  if (!s) return null;
  const match = def.ertekek.find((e) => e.toLowerCase() === s.toLowerCase());
  return match || s;
}

function getMarkerColor(ingatlan, csoportId) {
  if (!csoportId || csoportId === "default") return "#C62828";
  const def = CSOPORT_DEFINICIOK[csoportId];
  if (!def || !def.szinek) return "#C62828";
  const ertek = getCsoportErtek(ingatlan, csoportId);
  return def.szinek[ertek] || "#757575";
}

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
  await loadIngatlanok();
  initDeleteButton();
  if (fo_terkep) {
    restoreKijelolesAllapot();
  }
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
      lastSzurtIngatlanok = [];
      terkep_markerek_frissitese([]);
      try {
        sessionStorage.removeItem(TERKEP_STATE_KEY);
      } catch (e) {}
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
    const gpsVel = allIngatlanok.filter(
      (i) => i.lat != null && i.lng != null
    ).length;
    console.log(
      `Sikeresen betöltve ${allIngatlanok.length} db ingatlan. Ebből GPS koordinátával: ${gpsVel} db (a térképen csak ezek jelennek meg).`
    );
    if (gpsVel < allIngatlanok.length) {
      console.warn(
        `${
          allIngatlanok.length - gpsVel
        } rekordnak hiányzik a lat/lng, ezért nem látszik a térképen.`
      );
    }
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
    zoom: 11,
    minZoom: 9,
    maxZoom: 16,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
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
    async function (esemeny) {
      rajzolo_eszkoz.setDrawingMode(null);

      if (utolso_rajz) {
        utolso_rajz.setMap(null);
      }
      utolso_rajz = esemeny.overlay;

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

      await terkep_markerek_frissitese(szurt_ingatlanok);
      mentesKijelolesAllapot(esemeny.overlay, szurt_ingatlanok);
    }
  );

  initCsoportPanel();
  setTimeout(() => restoreKijelolesAllapot(), 100);
}

function frissitJelmagyarazat(csoportId) {
  const el = document.getElementById("csoport-jelmagyarazat");
  if (!el) return;
  const def = CSOPORT_DEFINICIOK[csoportId];
  if (
    !def ||
    csoportId === "default" ||
    !def.ertekek ||
    def.ertekek.length === 0
  ) {
    el.innerHTML = '<span class="text-white/50">Földrajzi klaszterezés</span>';
    return;
  }
  el.innerHTML = def.ertekek
    .map(
      (ertek) =>
        `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;">
          <span style="width:12px;height:12px;border-radius:50%;border:1px solid rgba(255,255,255,0.3);background-color:${
            def.szinek[ertek] || "#757575"
          };flex-shrink:0"></span>
          <span>${ertek}</span>
        </div>`
    )
    .join("");
}

function initCsoportPanel() {
  const select = document.getElementById("csoport-select");
  if (!select) return;
  frissitJelmagyarazat(aktualisCsoportId);
  select.addEventListener("change", () => {
    aktualisCsoportId = select.value || "default";
    frissitJelmagyarazat(aktualisCsoportId);
    if (lastSzurtIngatlanok.length > 0) {
      terkep_markerek_frissitese(lastSzurtIngatlanok);
    }
  });
}

function mentesKijelolesAllapot(overlay, szurt_ingatlanok) {
  try {
    let state = { ingatlanIds: (szurt_ingatlanok || []).map((i) => i.id) };
    if (overlay instanceof google.maps.Polygon) {
      const path = overlay.getPath().getArray();
      state.type = "polygon";
      state.path = path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
    } else if (overlay instanceof google.maps.Circle) {
      const c = overlay.getCenter();
      state.type = "circle";
      state.center = { lat: c.lat(), lng: c.lng() };
      state.radius = overlay.getRadius();
    }
    sessionStorage.setItem(TERKEP_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Kijelölés mentése sikertelen:", e);
  }
}

async function restoreKijelolesAllapot() {
  if (!fo_terkep) return;
  let state;
  try {
    const raw = sessionStorage.getItem(TERKEP_STATE_KEY);
    if (!raw) return;
    state = JSON.parse(raw);
    if (!state.ingatlanIds || !state.ingatlanIds.length) return;
  } catch (e) {
    return;
  }
  if (!allIngatlanok.length) {
    if (restoreRetryCount < RESTORE_RETRY_MAX) {
      restoreRetryCount++;
      setTimeout(restoreKijelolesAllapot, 400);
    }
    return;
  }
  restoreRetryCount = 0;
  const idSet = new Set(state.ingatlanIds);
  const szurt_ingatlanok = allIngatlanok.filter((i) => idSet.has(i.id));
  if (!szurt_ingatlanok.length) return;

  if (utolso_rajz) {
    utolso_rajz.setMap(null);
    utolso_rajz = null;
  }

  if (state.type === "polygon" && state.path && state.path.length > 0) {
    utolso_rajz = new google.maps.Polygon({
      paths: state.path,
      map: fo_terkep,
      fillColor: "#8bc34a",
      fillOpacity: 0.4,
      strokeWeight: 2,
      clickable: false,
      editable: true,
      zIndex: 1,
    });
  } else if (state.type === "circle" && state.center && state.radius) {
    utolso_rajz = new google.maps.Circle({
      center: state.center,
      radius: state.radius,
      map: fo_terkep,
      fillColor: "#8bc34a",
      fillOpacity: 0.4,
      strokeWeight: 2,
      clickable: false,
      editable: true,
      zIndex: 1,
    });
  }

  if (utolso_rajz) {
    await terkep_markerek_frissitese(szurt_ingatlanok);
  }
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

async function terkep_markerek_frissitese(ingatlan_tomb) {
  lastSzurtIngatlanok = Array.isArray(ingatlan_tomb) ? [...ingatlan_tomb] : [];
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

    const szin = getMarkerColor(adat, aktualisCsoportId);
    const uj_marker = new google.maps.Marker({
      position: pozicio,
      map: null,
      title: pontos_cim,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: szin,
        fillOpacity: 0.95,
        strokeColor: "#ffffff",
        strokeWeight: 1.5,
      },
    });
    uj_marker.ingatlanData = adat;
    const info_ablak = new google.maps.InfoWindow({
      content: egy_ingatlan_info_html(adat),
    });
    uj_marker.addListener("click", () => {
      info_ablak.open({ anchor: uj_marker, map: fo_terkep });
    });
    markerek.push(uj_marker);
  }

  let MarkerClustererClass =
    (typeof window !== "undefined" &&
      window.markerClusterer?.MarkerClusterer) ||
    (typeof window !== "undefined" && window.markerClusterer?.default) ||
    (typeof window !== "undefined" && window.MarkerClusterer);
  if (!MarkerClustererClass && markerek.length > KLASZTER_KUSZOB) {
    try {
      const mod = await import(
        "https://cdn.jsdelivr.net/npm/@googlemaps/markerclusterer@2.6.2/+esm"
      );
      MarkerClustererClass = mod.MarkerClusterer;
    } catch (e) {
      console.warn("MarkerClusterer betöltése sikertelen:", e);
    }
  }
  const useClusterer =
    markerek.length > KLASZTER_KUSZOB && MarkerClustererClass;
  if (useClusterer) {
    console.log(
      "Klaszterezés aktív:",
      markerek.length,
      "marker, küszöb:",
      KLASZTER_KUSZOB
    );
    const Renderer = {
      render: (cluster, stats, map) => {
        const count = cluster.count ?? (cluster.markers || []).length;
        return new google.maps.Marker({
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
      },
    };
    aktualis_clusterer = new MarkerClustererClass({
      map: fo_terkep,
      markers: markerek,
      renderer: Renderer,
      onClusterClick: (event, cluster, map) => {
        const currentZoom = map.getZoom() || 11;
        const targetZoom = Math.min(currentZoom + 2, 18);
        const center =
          cluster.position || (cluster.getCenter && cluster.getCenter());
        if (center) {
          map.panTo(center);
        }
        map.setZoom(targetZoom);
      },
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
