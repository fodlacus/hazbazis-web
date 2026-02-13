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
// INICIALIZÁLÁS (Amikor az oldal betöltődik)
// ============================================================
window.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Házbázis Chat Engine indul...");

  // 1. URL PARAMÉTEREK ÉS ELŐZMÉNYEK KEZELÉSE
  const urlParams = new URLSearchParams(window.location.search);
  const kezdőKérdés = urlParams.get("query");

  if (kezdőKérdés) {
    const input = document.getElementById("chat-input");
    if (input) input.value = kezdőKérdés;
    inditsChatKeresest();
  } else {
    const elozmeny = sessionStorage.getItem("hazbazis_utolso_kereses");
    if (elozmeny) {
      const mentettFeltetelek = JSON.parse(elozmeny);
      setTimeout(() => {
        if (typeof window.alkalmazSzuroket === "function") {
          window.alkalmazSzuroket(mentettFeltetelek);
          hozzaadBuborekot(
            "Üdv újra! Visszatöltöttem az előző keresésedet.",
            "ai"
          );
        }
      }, 500);
    }
  }

  // 2. MENTÉS MANAGER INDÍTÁSA
  initMentesManager(async (filterList, mode) => {
    if (mode === "clear") {
      belsoFlat = [];
      hozzaadBuborekot("Minden mentett szűrőt kikapcsoltál.", "ai");
      megjelenitTalalatokat();
      return;
    }
    if (mode === "merge") {
      await multiLekeresEsMerge(filterList);
    }
  });

  // 3. ESEMÉNYKEZELŐK BEKÖTÉSE (Navigáció és Gombok)
  document.getElementById("btn-home")?.addEventListener("click", () => {
    window.location.href = "../../../index.html";
  });

  document.getElementById("btn-trash")?.addEventListener("click", () => {
    if (confirm("Biztosan törlöd a beszélgetést és új keresést kezdesz?")) {
      resetChatEngine();
    }
  });

  document
    .getElementById("send-btn")
    ?.addEventListener("click", inditsChatKeresest);

  document.getElementById("chat-input")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") inditsChatKeresest();
  });

  document
    .getElementById("rendezes-select")
    ?.addEventListener("change", (e) => {
      listaRendezese(e.target.value);
    });

  document.getElementById("btn-save-filter")?.addEventListener("click", () => {
    saveCurrentSearch(aktualisSzuroFeltetelek);
  });
});

// Ez a függvény is kell a gomb működéséhez:
function resetChatEngine() {
  belsoFlat = [];
  aktualisSzuroFeltetelek = {};
  uncheckAllFilters();
  const folyam = document.getElementById("chat-folyam");
  if (folyam) folyam.innerHTML = "";
  const szamlalo = document.getElementById("talalat-szam");
  if (szamlalo) szamlalo.innerText = "0 találat";
  const panel = document.getElementById("eredmenyek-panel");
  if (panel) panel.innerHTML = "";

  const url = new URL(window.location);
  url.searchParams.delete("query");
  window.history.pushState({}, "", url);
  hozzaadBuborekot("Tiszta lap! Miben segíthetek?", "ai");
}

// És az indító függvény:
async function inditsChatKeresest() {
  const input = document.getElementById("chat-input");
  const uzenet = input.value.trim();
  if (!uzenet) return;

  hozzaadBuborekot(uzenet, "user");
  input.value = "";

  try {
    const aiValasz = await window.ertelmezdAkeresest(uzenet);
    if (!aiValasz || Object.keys(aiValasz).length === 0) {
      hozzaadBuborekot(
        "Nem értettem pontosan a kérést, próbáld máshogy!",
        "ai"
      );
      return;
    }

    const standardFeltetelek = normalizaldAFelteteleket(aiValasz);
    aktualisSzuroFeltetelek = standardFeltetelek;
    sessionStorage.setItem(
      "hazbazis_utolso_kereses",
      JSON.stringify(standardFeltetelek)
    );

    if (belsoFlat.length === 0) {
      hozzaadBuborekot("Pillanat, átnézem a kínálatot...", "ai");
      await elsoLekeresFirebasebol(standardFeltetelek);
    } else {
      hozzaadBuborekot("Szűröm a listát az új szempontok alapján...", "ai");
      szuresMemoriaban(standardFeltetelek);
    }
    megjelenitTalalatokat();
  } catch (error) {
    console.error("Hiba:", error);
  }
}

// Ezt se felejtsd el, mert a normalizálás hivatkozik rá:
function normalizaldAFelteteleket(f) {
  return {
    maxAr: f.max_ar || f.vételár || f.maxAr || null,
    minSzoba: f.min_szoba || f.szobák || f.minSzoba || null,
    minTerulet: f.min_terulet || f.alapterület || f.minTerulet || null,
    maxTerulet: f.max_terulet || f.maxTerulet || null,
    kerulet: f.kerulet || null,
    telepules: f.telepules || null,
    kategoria: f.kategoria || null,
    tipus: f.tipus || null,
    kellErkely: f.van_erkely === true || f.kellErkely === true,
  };
}

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
  let ok = true;

  // 1. ÁR SZŰRÉS (vételár - adatszerkezeted szerint)
  if (f.maxAr || f.max_ar) {
    const limit = Number(f.maxAr || f.max_ar);
    if (Number(ing.vételár) > limit) ok = false;
  }

  // 2. SZOBA SZŰRÉS (szobák - adatszerkezeted szerint)
  if (ok && (f.minSzoba || f.min_szoba)) {
    const limit = Number(f.minSzoba || f.min_szoba);
    if (Number(ing.szobák) < limit) ok = false;
  }

  // 3. ALAPTERÜLET SZŰRÉS (alapterület - adatszerkezeted szerint)
  if (ok) {
    const ingMeret = Number(ing.alapterület || 0);
    if (f.minTerulet && ingMeret < Number(f.minTerulet)) ok = false;
    if (ok && f.maxTerulet && ingMeret > Number(f.maxTerulet)) ok = false;
  }

  // 4. EXTRA: KLÍMA (hűtés mező vizsgálata)
  if (ok && f.kell_klima) {
    const hutes = (ing.hűtés || "").toLowerCase();
    // Ha "Nincs" vagy üres, akkor kiesik
    if (hutes === "" || hutes.includes("nincs") || hutes === "-") ok = false;
  }

  // 5. EXTRA: PARKOLÁS (parkolas mező vizsgálata)
  if (ok && f.parkolas_kulcsszo) {
    const parkolas = (ing.parkolas || "").toLowerCase();
    const keresett = f.parkolas_kulcsszo.toLowerCase();
    if (!parkolas.includes(keresett)) ok = false;
  }

  // 6. EXTRA: FŰTÉS (fűtés mező vizsgálata - házközponti tesztedhez)
  if (ok && f.futes_tipus) {
    const futes = (ing.fűtés || "").toLowerCase();
    if (!futes.includes(f.futes_tipus.toLowerCase())) ok = false;
  }

  // 7. EXTRA: ÉPÍTÉSI ÉV (epites_eve stringként van nálad, konvertáljuk)
  if (ok && f.min_epites_eve) {
    const ev = parseInt(ing.epites_eve || 0);
    if (ev < Number(f.min_epites_eve)) ok = false;
  }

  // 8. EXTRA: EMELET (emelet nálad szöveg: "Földszint" vagy "3")
  if (ok && f.min_emelet !== null && f.min_emelet !== undefined) {
    let ingEmelet = 0;
    const nyersEmelet = (ing.emelet || "").toString().toLowerCase();
    if (!nyersEmelet.includes("földszint")) {
      ingEmelet = parseInt(nyersEmelet) || 0;
    }
    if (ingEmelet < Number(f.min_emelet)) ok = false;
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
