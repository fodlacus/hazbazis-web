/* chat-engine.js - Megtartott eredeti struktúra, javított AI logikával */

import {
  query,
  where,
  getDocs,
  collection,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";
import {
  initMentesManager,
  saveCurrentSearch,
  uncheckAllFilters,
} from "./mentes-manager.js";

// EREDETI változónevek megtartása a kompatibilitás miatt
let belsoFlat = [];
let aktualisSzuroFeltetelek = {};

// ============================================================
// EREDETI FÜGGVÉNYEK - Semmi nem tűnik el, amit más fájl hívhat!
// ============================================================

window.alkalmazSzuroket = async function (mentettSzurok) {
  console.log("🔄 Külső hívás: alkalmazSzuroket", mentettSzurok);
  aktualisSzuroFeltetelek = mentettSzurok;
  // Elmentjük a sessionbe, ahogy eredetileg is volt
  sessionStorage.setItem(
    "hazbazis_utolso_kereses",
    JSON.stringify(mentettSzurok)
  );
  await elsoLekeresFirebasebol(mentettSzurok);
};

// Ezt a MentesManager hívja, maradnia kell!
async function multiLekeresEsMerge(filterList) {
  console.log("🔄 Összefésülés indítása...");
  try {
    let mergedMap = new Map();
    for (const filter of filterList) {
      // Meghívjuk a motort minden szűrőre
      const list = await fetchListFromFirebase(filter);
      list.forEach((item) => {
        if (!mergedMap.has(item.id)) mergedMap.set(item.id, item);
      });
    }
    belsoFlat = Array.from(mergedMap.values());
    hozzaadBuborekot(
      `Sikeres egyesítés! ${belsoFlat.length} ingatlant találtam.`,
      "ai"
    );
    megjelenitTalalatokat();
  } catch (error) {
    console.error("Hiba az egyesítésnél:", error);
  }
}

// ============================================================
// A KERESŐ MOTOR (Ami az okosítást végzi, de nem tör össze semmit)
// ============================================================

async function fetchListFromFirebase(f) {
  let q = collection(adatbazis, "lakasok");

  // Alap szűrések (Firebase szinten)
  if (f.telepules) q = query(q, where("telepules", "==", f.telepules));
  if (f.kategoria) q = query(q, where("kategoria", "==", f.kategoria));
  if (f.kerulet) q = query(q, where("kerulet", "==", f.kerulet));

  const snap = await getDocs(q);
  const nyersLista = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Itt dől el a találat: a megfelelAzIngatlan végzi a finomhangolást
  return nyersLista.filter((ing) => megfelelAzIngatlan(ing, f));
}

function megfelelAzIngatlan(ing, f) {
  // BIZTONSÁG: Itt maradnak az ékezetes mezőnevek (vételár, szobák, stb.)
  // mert az adatbázisodban így szerepelnek!

  let ok = true;

  // Ár szűrés
  if (f.maxAr || f.max_ar) {
    const limit = f.maxAr || f.max_ar;
    if (Number(ing.vételár) > Number(limit)) ok = false;
  }

  // Szoba szűrés
  if (ok && (f.minSzoba || f.min_szoba)) {
    const limit = f.minSzoba || f.min_szoba;
    if (Number(ing.szobák) < Number(limit)) ok = false;
  }

  // Alapterület
  if (ok && (f.minTerulet || f.min_terulet)) {
    const limit = f.minTerulet || f.min_terulet;
    if (Number(ing.alapterület) < Number(limit)) ok = false;
  }

  // Erkély (Szigorú)
  if (ok && f.kellErkely) {
    const erkelyMeret = parseFloat(ing.erkély_terasz || 0);
    if (erkelyMeret <= 0) ok = false;
  }

  return ok;
}

// ============================================================
// CHAT ÉS UI FUNKCIÓK (Változatlanul, ahogy megszoktad)
// ============================================================

async function elsoLekeresFirebasebol(f) {
  try {
    belsoFlat = await fetchListFromFirebase(f);
    if (belsoFlat.length === 0) {
      hozzaadBuborekot(
        "Sajnos ilyen paraméterekkel most nincs ingatlanunk.",
        "ai"
      );
    } else {
      hozzaadBuborekot(`Találtam ${belsoFlat.length} ingatlant!`, "ai");
    }
    megjelenitTalalatokat();
  } catch (error) {
    console.error("Hiba:", error);
    hozzaadBuborekot("Hiba történt az adatbázis elérésekor.", "ai");
  }
}

// ============================================================
// 3. MULTI KERESÉS (ÚJ) - Ezt hívja a MentesManager
// ============================================================
async function multiLekeresEsMerge(filterList) {
  try {
    let mergedMap = new Map(); // Map-et használunk, hogy ne legyenek duplikációk (azonos ID)

    // Végig megyünk az összes bepipált szűrőn (pl. Zugló + XI. kerület)
    for (const filter of filterList) {
      // Minden körben meghívjuk a "motort"
      const list = await fetchListFromFirebase(filter);

      // Hozzáadjuk a közös kalaphoz
      list.forEach((item) => {
        if (!mergedMap.has(item.id)) {
          mergedMap.set(item.id, item);
        }
      });
    }

    // A Map értékeit visszaalakítjuk tömbbé -> ez lesz az új belsoFlat
    belsoFlat = Array.from(mergedMap.values());

    // Eredmény kiírása
    if (belsoFlat.length === 0) {
      hozzaadBuborekot(
        "A kiválasztott szűrők alapján sajnos nincs találat.",
        "ai"
      );
    } else {
      hozzaadBuborekot(
        `Sikeres egyesítés! Összesen ${belsoFlat.length} ingatlant találtam a mentett kereséseid alapján.`,
        "ai"
      );
    }

    megjelenitTalalatokat();
  } catch (error) {
    console.error("Hiba az egyesítésnél:", error);
    hozzaadBuborekot("Hiba történt a listák összefésülésekor.", "ai");
  }
}

function szuresMemoriaban(f) {
  // Most már ez is a "megfelelAzIngatlan"-t használja, tehát érti a bonyolult logikát!
  const regiSzam = belsoFlat.length;

  belsoFlat = belsoFlat.filter((ing) => megfelelAzIngatlan(ing, f));

  const kulonbseg = regiSzam - belsoFlat.length;
  if (kulonbseg > 0) {
    hozzaadBuborekot(
      `Tovább szűkítettem a listát, ${kulonbseg} ingatlan kiesett.`,
      "ai"
    );
  } else {
    hozzaadBuborekot(
      "Ezek a feltételek nem szűkítették tovább a találatokat.",
      "ai"
    );
  }
}

// ... hozzaadBuborekot és megjelenitTalalatokat maradhat a régi ...
function hozzaadBuborekot(msg, tipus) {
  const folyam = document.getElementById("chat-folyam");
  const div = document.createElement("div");
  div.className =
    tipus === "user" ? "flex justify-end mb-4" : "flex gap-3 mb-4";
  div.innerHTML =
    tipus === "user"
      ? `<div class="bg-[#E2F1B0] text-[#3D4A16] p-4 rounded-2xl rounded-tr-none text-sm max-w-[85%] shadow-lg">${msg}</div>`
      : `<img src="../../../AI-no.png" class="w-10 h-10 rounded-full object-cover shadow-md"><div class="bg-white/10 p-4 rounded-2xl rounded-tl-none text-sm max-w-[85%] border border-white/5">${msg}</div>`;
  folyam.appendChild(div);
  folyam.scrollTop = folyam.scrollHeight;
}

// src/js/vevo/chat-engine.js része

function megjelenitTalalatokat() {
  const panel = document.getElementById("eredmenyek-panel");
  const szamlalo = document.getElementById("talalat-szam");

  if (szamlalo) szamlalo.innerText = `${belsoFlat.length} talált`;

  if (belsoFlat.length === 0) {
    if (panel)
      panel.innerHTML = `<p class="text-center opacity-40 mt-10">Nincs a feltételeknek megfelelő ingatlan.</p>`;
    return;
  }

  if (panel) {
    panel.innerHTML = belsoFlat
      .map((ing) => {
        const ar = Number(ing.vételár);
        const formatalAr = !isNaN(ar)
          ? ar.toLocaleString() + " Ft"
          : "Ár kérésre";

        // Okos képkeresés
        let kepUrl =
          "https://placehold.co/300x200/3D4A16/E2F1B0?text=Nincs+kép";
        if (ing.kepek_horiz && ing.kepek_horiz.length > 0) {
          kepUrl = ing.kepek_horiz[0].url || ing.kepek_horiz[0];
        } else if (ing.kepek_vert && ing.kepek_vert.length > 0) {
          kepUrl = ing.kepek_vert[0].url || ing.kepek_vert[0];
        } else if (ing.kepek && ing.kepek.length > 0) {
          kepUrl = ing.kepek[0].url || ing.kepek[0];
        }

        // AZONOSÍTÓ KEZELÉS: Ha nincs 'azon', egy rövidített ID-t mutatunk
        const azonosito = ing.azon || `#${ing.id.substring(0, 5)}`;

        return `
        <div class="bg-white/5 border border-white/10 p-4 rounded-3xl flex gap-4 hover:bg-white/10 transition-all cursor-pointer group mb-4 items-start" onclick="window.location.href='adatlap.html?id=${
          ing.id
        }'">
            <div class="w-24 h-24 rounded-2xl bg-black/40 overflow-hidden flex-shrink-0 flex items-center justify-center border border-white/5">
                <img src="${kepUrl}" class="w-full h-full object-cover">
            </div>
            
            <div class="flex flex-col justify-center overflow-hidden space-y-1">
                <span class="bg-lime-400/20 text-lime-400 text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold self-start">
                    ${azonosito}
                </span>
                
                <h3 class="font-bold text-sm group-hover:text-[#E2F1B0] transition-colors truncate">${
                  ing.nev || "Ingatlan"
                }</h3>
                <p class="text-[#E2F1B0] font-black">${formatalAr}</p>
                <p class="text-[10px] opacity-40 uppercase">${
                  ing.kerulet || "Bp"
                } • ${ing.alapterület || "?"} m² • ${
          ing.erkély_terasz || 0
        } m² erkély</p>
            </div>
        </div>`;
      })
      .join("");
  }
}

function listaRendezese(szempont) {
  if (belsoFlat.length === 0) return;

  // Másolatot készítünk, hogy ne rontsuk el az eredeti sorrendet végleg
  // (Bár itt nyugodtan rendezhetjük az eredetit is)

  if (szempont === "ar_nov") {
    belsoFlat.sort((a, b) => Number(a.vételár) - Number(b.vételár));
  } else if (szempont === "ar_csokk") {
    belsoFlat.sort((a, b) => Number(b.vételár) - Number(a.vételár));
  } else if (szempont === "meret_csokk") {
    // Figyeljünk, hogy az alapterület néha string lehet az adatbázisban!
    belsoFlat.sort((a, b) => Number(b.alapterület) - Number(a.alapterület));
  } else if (szempont === "meret_nov") {
    belsoFlat.sort((a, b) => Number(a.alapterület) - Number(b.alapterület));
  }

  // Újrarajzoljuk a kártyákat a rendezett listából
  megjelenitTalalatokat();
}
window.alkalmazSzuroket = async function (mentettSzurok) {
  console.log("🔄 Mentett keresés betöltése...", mentettSzurok);

  // 1. Frissítjük a globális változót
  window.aktualisSzuroFeltetelek = mentettSzurok;
  sessionStorage.setItem(
    "hazbazis_utolso_kereses",
    JSON.stringify(mentettSzurok)
  );

  // 2. Chat ablak takarítása
  const folyam = document.getElementById("chat-folyam");
  if (folyam) folyam.innerHTML = "";

  // 3. Visszajelzés
  hozzaadBuborekot(
    `Betöltöttem a mentett keresést: "${mentettSzurok.telepules || "Bárhol"}"`,
    "ai"
  );

  // 4. KERESÉS LEFUTTATÁSA
  try {
    const eredmenyekPanel = document.getElementById("eredmenyek-panel");
    const talalatSzamlalo = document.getElementById("talalat-szam");

    if (eredmenyekPanel)
      eredmenyekPanel.innerHTML =
        '<div class="text-white p-4 animate-pulse">Keresés az adatbázisban...</div>';

    let q = query(collection(adatbazis, "lakasok"));
    const f = mentettSzurok;

    // Alapvető szűrők alkalmazása a mentésből
    if (f.telepules) q = query(q, where("telepules", "==", f.telepules));
    if (f.kerulet) q = query(q, where("kerulet", "==", f.kerulet));
    if (f.maxAr) q = query(q, where("vételár", "<=", Number(f.maxAr)));
    if (f.minSzoba) q = query(q, where("szobák", ">=", Number(f.minSzoba)));

    const snapshot = await getDocs(q);
    const talalatok = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log("🔍 Találatok száma:", talalatok.length);

    // FONTOS: Frissítjük a belső listát is, hogy a rendezés működjön!
    belsoFlat = talalatok;

    // MEGJELENÍTÉS (Most már a javított megjelenitTalalatokat hívjuk!)
    megjelenitTalalatokat();
  } catch (err) {
    console.error("Hiba a mentett keresés betöltésekor:", err);
    hozzaadBuborekot("Hiba történt az adatbázis elérésekor.", "ai");
  }
};


