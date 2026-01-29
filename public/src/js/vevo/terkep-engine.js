// src/js/vevo/terkep-engine.js

import {
  collection,
  getDocs,
  query,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

let map;
let allIngatlanok = [];

// Két külön rétegcsoportot használunk:
let markersGroup; // Ez a CLUSTER (csoportosító) réteg a gombostűknek
let circlesGroup; // Ez a sima réteg a halvány köröknek (ezeket nem vonjuk össze)

window.addEventListener("DOMContentLoaded", async () => {
  initMap();
  await loadIngatlanok();
  initFilters();
});

// 1. TÉRKÉP BASE ÉS CSOPORTOSÍTÓ BEÁLLÍTÁSA
function initMap() {
  // Budapest központ
  map = L.map("map", { zoomControl: false }).setView([47.5079, 19.0993], 12);

  // VILÁGOS TÉRKÉP (Light)
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }
  ).addTo(map);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  // --- CSOPORTOSÍTÓ (CLUSTER) KONFIGURÁCIÓ ---
  markersGroup = L.markerClusterGroup({
    showCoverageOnHover: false, // Kikapcsolja a zavaró kék/sárga terület-kört
    zoomToBoundsOnClick: true, // Rákattintva közelít
    spiderfyOnMaxZoom: true, // Ha már nem tud közelebb menni, szétugrasztja (Pókháló)
    removeOutsideVisibleBounds: true,
    animate: true,

    // Egyedi ikon a csoportoknak (Sötét gomb fehér számmal)
    iconCreateFunction: function (cluster) {
      const count = cluster.getChildCount();
      return L.divIcon({
        html: `<div class="bg-gray-800 text-white font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-lg border-2 border-white text-sm">${count}</div>`,
        className: "marker-cluster-custom", // Üres class, hogy ne legyen alap stílus
        iconSize: L.point(30, 30),
      });
    },
  });

  // A köröknek sima LayerGroup (nem cluster)
  circlesGroup = L.layerGroup();

  // Hozzáadjuk őket a térképhez
  map.addLayer(circlesGroup); // Először a körök (hogy alul legyenek)
  map.addLayer(markersGroup); // Rá a markerek
}

// 2. ADATOK BETÖLTÉSE
async function loadIngatlanok() {
  const infoDiv = document.getElementById("talalat-info");
  try {
    const q = query(collection(adatbazis, "lakasok"));
    const snap = await getDocs(q);

    allIngatlanok = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Kezdeti kirajzolás
    renderMapAndList(allIngatlanok);

    // Szűrő listák feltöltése
    populateDropdowns();
  } catch (err) {
    console.error("Hiba:", err);
    if (infoDiv) infoDiv.innerText = "Hiba!";
  }
}

// 3. SZŰRŐK FELTÖLTÉSE
function populateDropdowns() {
  const selTelepules = document.getElementById("filter-telepules");
  const selKerulet = document.getElementById("filter-kerulet");
  const selVarosresz = document.getElementById("filter-varosresz");

  const telepulesek = [
    ...new Set(allIngatlanok.map((i) => i.telepules).filter(Boolean)),
  ].sort();
  const keruletek = [
    ...new Set(allIngatlanok.map((i) => i.kerulet).filter(Boolean)),
  ].sort();
  const varosreszek = [
    ...new Set(allIngatlanok.map((i) => i.varosresz).filter(Boolean)),
  ].sort();

  selTelepules.innerHTML = '<option value="">Összes település</option>';
  selKerulet.innerHTML = '<option value="">Összes kerület</option>';
  selVarosresz.innerHTML = '<option value="">Összes városrész</option>';

  telepulesek.forEach((t) => selTelepules.add(new Option(t, t)));
  keruletek.forEach((k) => selKerulet.add(new Option(k, k)));
  varosreszek.forEach((v) => selVarosresz.add(new Option(v, v)));
}

// 4. SZŰRÉSI LOGIKA
function initFilters() {
  const selTelepules = document.getElementById("filter-telepules");
  const selKerulet = document.getElementById("filter-kerulet");
  const selVarosresz = document.getElementById("filter-varosresz");

  const runFilter = () => {
    const valTelepules = selTelepules.value;
    const valKerulet = selKerulet.value;
    const valVarosresz = selVarosresz.value;

    if (valTelepules === "Budapest") {
      selKerulet.classList.remove("hidden");
    } else {
      selKerulet.classList.add("hidden");
      selKerulet.value = "";
    }

    const filtered = allIngatlanok.filter((ing) => {
      if (valTelepules && ing.telepules !== valTelepules) return false;
      if (
        valTelepules === "Budapest" &&
        valKerulet &&
        ing.kerulet !== valKerulet
      )
        return false;
      if (valVarosresz && ing.varosresz !== valVarosresz) return false;
      return true;
    });

    renderMapAndList(filtered);
  };

  selTelepules.addEventListener("change", runFilter);
  selKerulet.addEventListener("change", runFilter);
  selVarosresz.addEventListener("change", runFilter);
}

// 5. KIRAJZOLÁS (Itt használjuk az új csoportokat)
function renderMapAndList(list) {
  const listaDiv = document.getElementById("ingatlan-lista");
  const infoDiv = document.getElementById("talalat-info");

  listaDiv.innerHTML = "";

  // TÖRLÉS: A csoportokból törlünk, nem a mapról egyesével
  markersGroup.clearLayers();
  circlesGroup.clearLayers();

  if (infoDiv) infoDiv.innerText = `${list.length} találat`;

  if (list.length === 0) return;

  const bounds = L.latLngBounds();

  list.forEach((ing) => {
    let lat = ing.lat;
    let lng = ing.lng;

    if (!lat || !lng) return;

    // Jitter (Kicsi eltolás, hogy ne teljesen fedjék egymást, de a cluster úgyis megoldja)
    lat = lat + (Math.random() - 0.5) * 0.0005; // Kicsit visszavettem a mértékéből
    lng = lng + (Math.random() - 0.5) * 0.0005;

    // Külön adjuk hozzá a kört és a markert a megfelelő csoporthoz
    addPrivacyMarkerToGroups(lat, lng, ing);

    const kartya = createCard(ing, lat, lng);
    listaDiv.appendChild(kartya);

    bounds.extend([lat, lng]);
  });

  // Ha van találat, igazítsuk a térképet
  if (list.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

function addPrivacyMarkerToGroups(lat, lng, ing) {
  // 1. KÖR -> circlesGroup
  const circle = L.circle([lat, lng], {
    color: "#E2F1B0",
    fillColor: "#E2F1B0",
    fillOpacity: 0.2,
    radius: 250,
    weight: 1,
  });
  circlesGroup.addLayer(circle);

  // 2. MARKER -> markersGroup
  const arMillio = Math.round(ing.vételár / 1000000);
  // Ha nincs HB szám, az ID elejét használjuk
  const azonosito = ing.azon || ing.id.substring(0, 5);

  // HTML: Egy "emeletes" gombostűt csinálunk.
  // Felül: Fekete címke a HB számmal
  // Alul: Zöld címke az árral
  const iconHtml = `
    <div class="flex flex-col items-center group">
        <div class="bg-gray-900 text-white text-[9px] px-1.5 py-0.5 rounded-t border-x border-t border-white/30 -mb-1 z-0 shadow-sm font-mono tracking-wider">
            ${azonosito}
        </div>
        
        <div class="bg-[#E2F1B0] text-[#3D4A16] font-bold text-xs px-2 py-1 rounded-lg shadow-lg border-2 border-[#3D4A16] whitespace-nowrap z-10 relative group-hover:scale-110 transition-transform">
            ${arMillio} M Ft
        </div>
    </div>
  `;

  const customIcon = L.divIcon({
    html: iconHtml,
    className: "", // Üres class
    iconSize: [60, 45], // Kicsit magasabb lett a befoglaló méret
    iconAnchor: [30, 22],
  });

  const marker = L.marker([lat, lng], { icon: customIcon });

  marker.on("click", () => {
    map.flyTo([lat, lng], 16, { duration: 1.5 });
  });

  markersGroup.addLayer(marker);
}

//  KÁRTYA GENERÁLÓ (Változatlan)
// src/js/vevo/terkep-engine.js -> createCard cseréje

function createCard(ing, lat, lng) {
  const div = document.createElement("div");

  div.className =
    "bg-gray-900/90 backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-lg hover:border-[#E2F1B0] hover:scale-[1.02] transition-all duration-200 cursor-pointer group mb-2";

  let boritoKep = "https://via.placeholder.com/300x200?text=Nincs+kép";
  const getUrl = (item) => {
    if (!item) return null;
    return typeof item === "object" ? item.url : item;
  };

  if (ing.kepek_horiz && ing.kepek_horiz.length > 0) {
    boritoKep = getUrl(ing.kepek_horiz[0]);
  } else if (ing.kepek_vert && ing.kepek_vert.length > 0) {
    boritoKep = getUrl(ing.kepek_vert[0]);
  } else if (ing.kepek && ing.kepek.length > 0) {
    boritoKep = getUrl(ing.kepek[0]);
  }

  // Azonosító
  const azonosito = ing.azon || `#${ing.id.substring(0, 5)}`;

  div.innerHTML = `
      <div class="flex gap-3">
          <img src="${boritoKep}" class="w-24 h-20 object-cover rounded-lg border border-white/10 bg-black">
          
          <div class="flex-1 min-w-0 flex flex-col justify-center">
              <div class="flex justify-between items-start">
                  <div class="text-[#E2F1B0] font-bold text-sm truncate text-lg">
                    ${Number(ing.vételár).toLocaleString()} Ft
                  </div>
              </div>
              
              <div class="text-white font-medium text-xs truncate mt-1">
                  ${ing.telepules}, ${ing.varosresz || ing.kerulet || ""}
              </div>
              
              <div class="flex items-center gap-2 mt-2">
                  <span class="text-gray-300 text-[11px] bg-white/10 px-1.5 py-0.5 rounded border border-white/5">
                    ${ing.alapterület} m²
                  </span>
                  <span class="text-gray-300 text-[11px] bg-white/10 px-1.5 py-0.5 rounded border border-white/5">
                    ${ing["szobák"] || ing.szobak || "?"} szoba
                  </span>
                  
                  <span class="ml-auto text-lime-400 font-bold text-[10px] font-mono tracking-wider border border-lime-400/30 px-1 rounded">
                    ${azonosito}
                  </span>
              </div>
          </div>
      </div>
  `;

  div.addEventListener("click", () => {
    map.flyTo([lat, lng], 16, { animate: true, duration: 1.5 });
  });

  return div;
}
