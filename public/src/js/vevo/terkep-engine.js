// src/js/vevo/terkep-engine.js

import {
  collection,
  getDocs,
  query,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

let map;
let allIngatlanok = [];
let currentMarkers = [];

window.addEventListener("DOMContentLoaded", async () => {
  initMap();
  await loadIngatlanok();
  initFilters();
});

// 1. TÉRKÉP BASE
function initMap() {
  // Budapest központ
  map = L.map("map", { zoomControl: false }).setView([47.5079, 19.0993], 12);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap, &copy; CARTO",
    maxZoom: 20,
  }).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);
}

// 2. ADATOK BETÖLTÉSE
async function loadIngatlanok() {
  const infoDiv = document.getElementById("talalat-info");
  try {
    const q = query(collection(adatbazis, "lakasok"));
    const snap = await getDocs(q);

    allIngatlanok = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Kezdeti kirajzolás (Mindenkit)
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

  // Egyedi értékek (Set)
  const telepulesek = [
    ...new Set(allIngatlanok.map((i) => i.telepules).filter(Boolean)),
  ].sort();
  const keruletek = [
    ...new Set(allIngatlanok.map((i) => i.kerulet).filter(Boolean)),
  ].sort();
  const varosreszek = [
    ...new Set(allIngatlanok.map((i) => i.varosresz).filter(Boolean)),
  ].sort();

  // Reset
  selTelepules.innerHTML = '<option value="">Összes település</option>';
  selKerulet.innerHTML = '<option value="">Összes kerület</option>';
  selVarosresz.innerHTML = '<option value="">Összes városrész</option>';

  // Feltöltés
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

    // Kerület szűrő megjelenítése csak Budapestnél
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

// 5. KIRAJZOLÁS
function renderMapAndList(list) {
  const listaDiv = document.getElementById("ingatlan-lista");
  const infoDiv = document.getElementById("talalat-info");

  listaDiv.innerHTML = "";
  currentMarkers.forEach((m) => map.removeLayer(m));
  currentMarkers = [];

  if (infoDiv) infoDiv.innerText = `${list.length} találat`;

  if (list.length === 0) return;

  const bounds = L.latLngBounds();

  list.forEach((ing) => {
    // Koordináta ellenőrzés
    let lat = ing.lat;
    let lng = ing.lng;

    if (!lat || !lng) return; // Ha nincs koordináta, kihagyjuk

    // Jitter (Adatvédelem) - Kicsi eltolás
    lat = lat + (Math.random() - 0.5) * 0.002;
    lng = lng + (Math.random() - 0.5) * 0.002;

    addPrivacyMarker(lat, lng, ing);
    const kartya = createCard(ing, lat, lng);
    listaDiv.appendChild(kartya);

    bounds.extend([lat, lng]);
  });

  map.fitBounds(bounds, { padding: [50, 50] });
}

function addPrivacyMarker(lat, lng, ing) {
  // Kör
  const circle = L.circle([lat, lng], {
    color: "#E2F1B0",
    fillColor: "#E2F1B0",
    fillOpacity: 0.2,
    radius: 250,
    weight: 1,
  }).addTo(map);
  currentMarkers.push(circle);

  // Árcédula Marker
  const arMillio = Math.round(ing.vételár / 1000000);
  const iconHtml = `<div class="bg-[#E2F1B0] text-[#3D4A16] font-bold text-xs px-2 py-1 rounded-lg shadow-lg border-2 border-[#3D4A16] whitespace-nowrap hover:scale-110 transition cursor-pointer">${arMillio} M Ft</div>`;

  const customIcon = L.divIcon({
    html: iconHtml,
    className: "",
    iconSize: [60, 30],
    iconAnchor: [30, 15],
  });
  const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
  currentMarkers.push(marker);

  marker.on("click", () => {
    map.flyTo([lat, lng], 16, { duration: 1.5 });
  });
}

//  KÁRTYA GENERÁLÓ

function createCard(ing, lat, lng) {
  const div = document.createElement("div");
  div.className =
    "bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/5 hover:border-[#E2F1B0] transition cursor-pointer group";

  // --- ÚJ KÉP KIVÁLASZTÁSI LOGIKA (Objektum támogatással) ---
  let boritoKep = "https://via.placeholder.com/300x200?text=Nincs+kép";

  // Segédfüggvény: URL kinyerése akár string, akár objektum
  const getUrl = (item) => {
    if (!item) return null;
    return typeof item === "object" ? item.url : item;
  };

  // 1. Prioritás: Vízszintes kép
  if (ing.kepek_horiz && ing.kepek_horiz.length > 0) {
    boritoKep = getUrl(ing.kepek_horiz[0]);
  }
  // 2. Prioritás: Vertikális kép
  else if (ing.kepek_vert && ing.kepek_vert.length > 0) {
    boritoKep = getUrl(ing.kepek_vert[0]);
  }
  // 3. Fallback: Régi rendszer
  else if (ing.kepek && ing.kepek.length > 0) {
    boritoKep = getUrl(ing.kepek[0]);
  }

  div.innerHTML = `
      <div class="flex gap-3">
          <img src="${boritoKep}" class="w-20 h-20 object-cover rounded-lg bg-black/30">
          <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start">
                  <div class="text-[#E2F1B0] font-bold text-sm truncate">${Number(
                    ing.vételár
                  ).toLocaleString()} Ft</div>
                  <span class="text-[9px] text-white/30 font-mono bg-black/20 px-1 rounded">${
                    ing.azon || "ID?"
                  }</span>
              </div>
              
              <div class="text-white text-xs font-bold truncate mt-1">
                  ${ing.telepules}, ${ing.varosresz || ing.kerulet || ""}
              </div>
              
              <div class="text-white/60 text-[10px] mt-1">
                  ${ing.alapterület} m² • ${
    ing["szobák"] || ing.szobak || "?"
  } szoba
              </div>
          </div>
      </div>
  `;

  div.addEventListener("click", () => {
    map.flyTo([lat, lng], 16, { animate: true, duration: 1.5 });
  });

  return div;
}
