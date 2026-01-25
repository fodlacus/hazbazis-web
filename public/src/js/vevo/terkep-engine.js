import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

let map;
let markers = []; // Itt tároljuk a térképi jelölőket

// Indulás
window.addEventListener("DOMContentLoaded", async () => {
  initMap();
  await loadIngatlanok();
});

// 1. TÉRKÉP INICIALIZÁLÁSA
function initMap() {
  // Budapest központ
  map = L.map("map", { zoomControl: false }).setView([47.5079, 19.0993], 13);

  // Ingyenes sötét térkép réteg (CartoDB Dark Matter)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 20,
  }).addTo(map);

  // Zoom gomb áthelyezése jobb alulra
  L.control.zoom({ position: "bottomright" }).addTo(map);
}

// 2. ADATOK BETÖLTÉSE
async function loadIngatlanok() {
  const listaDiv = document.getElementById("ingatlan-lista");
  const infoDiv = document.getElementById("talalat-info");

  try {
    const q = query(collection(adatbazis, "lakasok")); // Itt lehetne szűrni is
    const snap = await getDocs(q);

    const ingatlanok = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    infoDiv.innerText = `${ingatlanok.length} ingatlan a térképen`;

    // Végigmegyünk és kirakjuk őket
    ingatlanok.forEach((ing) => {
      // --- KOORDINÁTA TRÜKK (Mivel még nincs az adatbázisban) ---
      // Ha lesz adatbázisban, akkor: const lat = ing.lat; const lng = ing.lng;
      // Most generálunk random koordinátát Zugló környékére
      const lat = 47.5 + Math.random() * 0.05;
      const lng = 19.05 + Math.random() * 0.1;

      // 1. TÉRKÉP MARKER (KÖR ALAKÚ - ADATVÉDELEM MIATT)
      addPrivacyMarker(lat, lng, ing);

      // 2. LISTA ELEM (KÁRTYA)
      const kartya = createCard(ing, lat, lng);
      listaDiv.appendChild(kartya);
    });
  } catch (err) {
    console.error("Hiba:", err);
    infoDiv.innerText = "Hiba az adatok betöltésekor.";
  }
}

// 3. A "TITKOS" MARKER LÉTREHOZÁSA (KÖR + LABEL)
function addPrivacyMarker(lat, lng, ing) {
  // A) Egy áttetsző kör (kb 300-500m sugarú területet jelez)
  const circle = L.circle([lat, lng], {
    color: "#E2F1B0", // Keret színe
    fillColor: "#E2F1B0", // Kitöltés
    fillOpacity: 0.2, // Áttetszőség
    radius: 300, // Sugár méterben (ez a trükk!)
    weight: 1,
  }).addTo(map);

  // B) Egy kis pont a közepére (vagy eltolva), ami kattintható
  // Egyedi HTML ikon (Árral a közepén)
  const arMillio = Math.round(ing.vételár / 1000000);

  const iconHtml = `
        <div class="bg-[#E2F1B0] text-[#3D4A16] font-bold text-xs px-2 py-1 rounded-lg shadow-lg border-2 border-[#3D4A16] whitespace-nowrap transform transition hover:scale-110">
            ${arMillio} M Ft
        </div>
    `;

  const customIcon = L.divIcon({
    html: iconHtml,
    className: "", // Üres, hogy ne legyen alap négyzet
    iconSize: [60, 30],
    iconAnchor: [30, 15], // Középre igazítás
  });

  const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

  // Ha rákattint a markerre -> Kiemeli a kártyát
  marker.on("click", () => {
    // Térkép odarepül (FlyTo animáció)
    map.flyTo([lat, lng], 15, { duration: 1.5 });

    // Itt majd megkeressük a kártyát a listában és odagörgetünk (opcionális)
  });
}

// 4. KÁRTYA LÉTREHOZÁSA
function createCard(ing, lat, lng) {
  const div = document.createElement("div");
  div.className =
    "bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/5 hover:border-[#E2F1B0] transition cursor-pointer group";

  // Kép (Placeholder ha nincs)
  const imgUrl =
    ing.kepek && ing.kepek.length > 0
      ? ing.kepek[0]
      : "https://via.placeholder.com/300x200?text=Nincs+kép";

  div.innerHTML = `
        <div class="flex gap-3">
            <img src="${imgUrl}" class="w-20 h-20 object-cover rounded-lg bg-black/30">
            <div class="flex-1 min-w-0">
                <div class="text-[#E2F1B0] font-bold text-sm truncate">${Number(
                  ing.vételár
                ).toLocaleString()} Ft</div>
                <div class="text-white text-xs font-bold truncate mt-1">${
                  ing.telepules
                }, ${ing.kerulet || ""}</div>
                <div class="text-white/60 text-[10px] mt-1">
                    ${ing.alapterület} m² • ${ing.szobaszam} szoba
                </div>
            </div>
        </div>
    `;

  // Ha a kártyára kattint -> Térkép odarepül
  div.addEventListener("click", () => {
    map.flyTo([lat, lng], 16, {
      animate: true,
      duration: 1.5, // Lassú, szép repülés
    });
  });

  return div;
}
