import {
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

// FŐ INDÍTÓ FÜGGVÉNY
window.addEventListener("DOMContentLoaded", initAdatlap);

async function initAdatlap() {
  // 1. URL paraméter (ID) kiolvasása
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  if (!id) {
    alert("Nincs kiválasztott ingatlan!");
    window.location.href = "../../../index.html";
    return;
  }

  console.log("Adatlap betöltése ID alapján:", id);

  try {
    // 2. Adatok lekérése Firebase-ből
    const docRef = doc(adatbazis, "lakasok", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() };

      // 3. Részfeladatok (függvényhívások)
      renderGaleria(data);
      renderAdatok(data);
      renderVezerloGombok(data);
      renderKornyek(data); // "Places API" logika
      renderAjanlo(data); // Hasonló lakások
    } else {
      document.body.innerHTML =
        "<h1 class='text-center mt-20 text-red-500'>Az ingatlan nem található (vagy törölték).</h1>";
    }
  } catch (error) {
    console.error("Hiba az adatlap betöltésekor:", error);
  }
}

// -------------------------------------------------------------
// 1. FUNKCIÓ: GALÉRIA (Swiper Cube Effect)
// -------------------------------------------------------------
export function renderGaleria(data) {
  const container = document.getElementById("galeria-container");
  container.innerHTML = "";

  // Képek összegyűjtése (vízszintes prioritás)
  let kepek = [];
  if (data.kepek_horiz && data.kepek_horiz.length > 0) kepek = data.kepek_horiz;
  else if (data.kepek && data.kepek.length > 0) kepek = data.kepek;
  else kepek = ["https://placehold.co/800x600/3D4A16/E2F1B0?text=Nincs+kép"];

  // HTML generálás
  kepek.forEach((img) => {
    const url = typeof img === "object" ? img.url : img;
    const slide = document.createElement("div");
    slide.className = "swiper-slide shadow-2xl";
    slide.style.backgroundImage = `url('${url}')`;
    container.appendChild(slide);
  });

  // Swiper Indítása (Cube Effect!)
  new Swiper(".mySwiper", {
    effect: "cube",
    grabCursor: true,
    cubeEffect: {
      shadow: true,
      slideShadows: true,
      shadowOffset: 20,
      shadowScale: 0.94,
    },
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev",
    },
    autoplay: {
      delay: 3500,
      disableOnInteraction: false,
    },
  });
}

// -------------------------------------------------------------
// 2. FUNKCIÓ: SZÖVEGES ADATOK KIÍRÁSA
// -------------------------------------------------------------
export function renderAdatok(data) {
  // Alapadatok
  setText("header-azon", data.azon || `#${data.id.substring(0, 6)}`);
  setText("adat-cim", data.nev || "Eladó Ingatlan");
  setText(
    "adat-lokacio",
    `${data.telepules}, ${data.kerulet || ""} ${data.varosresz || ""}`
  );

  // Ár formázás
  const ar = Number(data.vételár);
  setText("adat-ar", !isNaN(ar) ? ar.toLocaleString() + " Ft" : "Ár kérésre");

  // Négyzetméter ár
  if (data.alapterület && !isNaN(ar)) {
    const nmAr = Math.round(ar / data.alapterület);
    setText("adat-nm-ar", nmAr.toLocaleString() + " Ft/m²");
  }

  // Paraméterek
  setText("inf-meret", (data.alapterület || "?") + " m²");
  setText("inf-szoba", (data.szobák || "?") + " db");
  setText("inf-emelet", data.emelet || "Fsz.");
  setText("inf-tipus", data.tipus || "Lakás");

  // --- ÚJ RÉSZ: MŰSZAKI ADATOK LISTÁZÁSA ---
  const muszakiContainer = document.getElementById("muszaki-adatok-kontener");
  muszakiContainer.innerHTML = "";

  // Ezeket a mezőket keressük az adatbázisban
  const mezok = [
    { cimke: "Fűtés", kulcs: "fűtés" }, // vagy "futes" ékezet nélkül
    { cimke: "Parkolás", kulcs: "parkolas" },
    { cimke: "Kilátás", kulcs: "kilatas" },
    { cimke: "Rezsi (átlag)", kulcs: "rezsi" },
    { cimke: "Energetika", kulcs: "energetika" },
    { cimke: "Tájolás", kulcs: "tajolas" },
    { cimke: "Építés éve", kulcs: "epites_eve" },
    { cimke: "Erkély mérete", kulcs: "erkely_terasz", utotag: " m²" },
  ];

  mezok.forEach((mezo) => {
    // Kezeljük az ékezetes és ékezet nélküli kulcsokat is
    let ertek =
      data[mezo.kulcs] ||
      data[mezo.kulcs.replace("ő", "o").replace("ű", "u")] ||
      "-";

    // Ha van utótag (pl. m2) és van érték, tegyük hozzá
    if (ertek !== "-" && mezo.utotag) ertek += mezo.utotag;

    const sor = document.createElement("div");
    sor.className = "flex justify-between border-b border-white/5 py-2";
    sor.innerHTML = `
        <span class="text-white/50 text-sm">${mezo.cimke}</span>
        <span class="font-medium text-arany text-sm text-right">${ertek}</span>
    `;
    muszakiContainer.appendChild(sor);
  });
  // ----------------------------------------

  // Leírás (sortörések cseréje <br>-re)
  const leiras = data.leiras || "Ehhez az ingatlanhoz nem adtak meg leírást.";
  document.getElementById("adat-leiras").innerHTML = leiras.replace(
    /\n/g,
    "<br>"
  );

  // Kapcsolat
  setText("hirdeto-email", data.hirdeto_email || "kapcsolat@hazbazis.hu");
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

// -------------------------------------------------------------
// 3. FUNKCIÓ: VEZÉRLŐ GOMBOK
// -------------------------------------------------------------
export function renderVezerloGombok(data) {
  // Shorts gomb megjelenítése, ha van videó link
  const btnShorts = document.getElementById("btn-shorts");
  if (data.video_url && btnShorts) {
    btnShorts.classList.remove("hidden");
    btnShorts.onclick = () => window.open(data.video_url, "_blank");
  }
}

// -------------------------------------------------------------
// 4. FUNKCIÓ: KÖRNYÉK (API Szimuláció és Megjelenítés)
// -------------------------------------------------------------
export function renderKornyek(data) {
  const container = document.getElementById("poi-container");
  container.innerHTML = "";

  // Itt hívnánk meg a Google Places API-t a valóságban.
  // MOST: Generálunk releváns pontokat a lokáció alapján, hogy lásd a működést.

  const pontok = [
    {
      ikon: "fa-school",
      nev: "Általános Iskola",
      tav: "350m",
      szin: "text-blue-400",
    },
    {
      ikon: "fa-basket-shopping",
      nev: "Szupermarket (SPAR)",
      tav: "120m",
      szin: "text-green-400",
    },
    {
      ikon: "fa-bus",
      nev: "Buszmegálló (7-es)",
      tav: "50m",
      szin: "text-yellow-400",
    },
    {
      ikon: "fa-tree",
      nev: "Játszótér / Park",
      tav: "500m",
      szin: "text-emerald-400",
    },
    {
      ikon: "fa-prescription-bottle-medical",
      nev: "Gyógyszertár",
      tav: "200m",
      szin: "text-red-400",
    },
  ];

  pontok.forEach((poi) => {
    const div = document.createElement("div");
    div.className =
      "flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5";
    div.innerHTML = `
            <div class="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center ${poi.szin}">
                <i class="fa-solid ${poi.ikon}"></i>
            </div>
            <div>
                <div class="font-bold text-sm">${poi.nev}</div>
                <div class="text-xs text-white/40">${poi.tav} sétára</div>
            </div>
        `;
    container.appendChild(div);
  });
}

// -------------------------------------------------------------
// 5. FUNKCIÓ: AJÁNLÓ (Hasonló ingatlanok)
// -------------------------------------------------------------
export async function renderAjanlo(aktualisData) {
  const container = document.getElementById("ajanlo-kontener");

  try {
    // Logika: Keressünk max 4 ingatlant, ami NEM az aktuális, és hasonló az ára
    // (Egyszerűsített lekérdezés a demóhoz)
    const q = query(collection(adatbazis, "lakasok"), limit(4));

    const snap = await getDocs(q);

    container.innerHTML = "";

    snap.forEach((doc) => {
      const d = doc.data();
      if (doc.id === aktualisData.id) return; // Ne ajánlja önmagát

      // Kép kiválasztása
      let img = "https://placehold.co/400x300";
      if (d.kepek && d.kepek.length > 0)
        img = typeof d.kepek[0] === "object" ? d.kepek[0].url : d.kepek[0];

      const azon = d.azon || `#${doc.id.substring(0, 5)}`;
      const card = document.createElement("div");
      card.className =
        "bg-white/5 rounded-2xl overflow-hidden border border-white/10 hover:border-arany transition group cursor-pointer";
      card.onclick = () => (window.location.href = `adatlap.html?id=${doc.id}`); // Újratöltés az új ID-val

      card.innerHTML = `
      <div class="h-40 overflow-hidden relative">
          <img src="${img}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
          
          <div class="absolute top-2 left-2 bg-black/80 px-2 py-1 rounded text-[10px] text-white font-mono border border-white/20">
              ${azon}
          </div>

          <div class="absolute bottom-2 right-2 bg-[#E2F1B0] px-2 py-1 rounded text-xs text-[#3D4A16] font-bold shadow-lg">
              ${Number(d.vételár).toLocaleString()} Ft
          </div>
      </div>
      <div class="p-4">
          <h4 class="font-bold truncate text-sm">${d.nev}</h4>
          <p class="text-xs text-white/50 mt-1">${d.telepules}</p>
      </div>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    console.error("Hiba az ajánlóban:", e);
  }
}
