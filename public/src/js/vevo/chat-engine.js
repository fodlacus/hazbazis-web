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
let belsoFlat = []; // Ez a "flat" állomány a memóriában

// Globális változó a szűrők tárolására (Fontos, hogy itt legyen legfelül!)
let aktualisSzuroFeltetelek = {};

// ============================================================
// INICIALIZÁLÁS (Amikor az oldal betöltődik)
// ============================================================
window.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Házbázis Chat Engine indul...");

  // 1. URL PARAMÉTEREK KEZELÉSE (Ha a főoldalról jön kérdés)
  const urlParams = new URLSearchParams(window.location.search);
  const kezdőKérdés = urlParams.get("query");

  if (kezdőKérdés) {
    console.log("📩 Bejövő kérdés:", kezdőKérdés);
    const input = document.getElementById("chat-input");
    if (input) input.value = kezdőKérdés;
    inditsChatKeresest();
  } else {
    // HA NINCS ÚJ KÉRDÉS -> NÉZZÜK MEG, VAN-E KORÁBBI (Vissza gombbal jöttünk)
    const elozmeny = sessionStorage.getItem("hazbazis_utolso_kereses");
    if (elozmeny) {
      console.log("🔄 Korábbi keresés visszaállítása...");
      const mentettFeltetelek = JSON.parse(elozmeny);

      // Visszatöltjük a feltételeket és lefuttatjuk a keresést
      // Kis késleltetés, hogy az oldal biztosan betöltődjön
      setTimeout(() => {
        if (typeof window.alkalmazSzuroket === "function") {
          window.alkalmazSzuroket(mentettFeltetelek);
          // Opcionális: kiírhatjuk a chatbe, hogy "Visszatértél"
          hozzaadBuborekot(
            "Üdv újra! Visszatöltöttem az előző keresésedet.",
            "ai"
          );
        }
      }, 500);
    }
  }

  // 2. MENTÉS MANAGER INDÍTÁSA
  // Ez kezeli a checkboxok pipálgatását (Multi-lista logika)
  initMentesManager(async (filterList, mode) => {
    if (mode === "clear") {
      belsoFlat = [];
      hozzaadBuborekot(
        "Minden mentett szűrőt kikapcsoltál. A lista üres.",
        "ai"
      );
      megjelenitTalalatokat();
      return;
    }

    if (mode === "merge") {
      hozzaadBuborekot(
        `Összefésülöm a ${filterList.length} kiválasztott listát...`,
        "ai"
      );
      await multiLekeresEsMerge(filterList);
    }
  });

  // 3. GOMBOK BEKÖTÉSE (Debug logokkal!)

  // A) Mentés gomb
  const saveBtn = document.getElementById("btn-save-filter");
  if (saveBtn) {
    console.log("✅ Mentés gomb (btn-save-filter) megtalálva.");
    saveBtn.addEventListener("click", () => {
      console.log(
        "🖱️ Mentés gomb megnyomva. Mentendő:",
        aktualisSzuroFeltetelek
      );
      saveCurrentSearch(aktualisSzuroFeltetelek);
    });
  } else {
    console.error(
      "❌ HIBA: Nem találom a 'btn-save-filter' gombot a HTML-ben!"
    );
  }

  // B) Haza gomb
  const homeBtn = document.getElementById("btn-home");
  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      window.location.href = "../../../index.html";
    });
  }

  // C) Kuka / Reset gomb
  const trashBtn = document.getElementById("btn-trash");
  if (trashBtn) {
    trashBtn.addEventListener("click", () => {
      if (confirm("Biztosan törlöd a beszélgetést és új keresést kezdesz?")) {
        resetChatEngine();
      }
    });
  }

  // D) Küldés gomb (Chat)
  const sendBtn = document.getElementById("send-btn");
  if (sendBtn) {
    sendBtn.addEventListener("click", inditsChatKeresest);
  }

  const sortSelect = document.getElementById("rendezes-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      const szempont = e.target.value;
      listaRendezese(szempont);
    });
  }
});

// Innentől jöhetnek a függvények: inditsChatKeresest, stb.)

function resetChatEngine() {
  // 1. Memória ürítése
  belsoFlat = [];
  aktualisSzuroFeltetelek = {}; // Ezt is nullázzuk!

  // CHECKBOXOK TÖRLÉSE
  uncheckAllFilters();

  // 2. Chat felület takarítása
  const folyam = document.getElementById("chat-folyam");
  if (folyam) folyam.innerHTML = "";

  // 3. Eredmények panel alaphelyzetbe állítása
  const panel = document.getElementById("eredmenyek-panel");
  const szamlalo = document.getElementById("talalat-szam");
  if (panel) panel.innerHTML = ""; // Vagy visszatehetsz placeholder kártyákat
  if (szamlalo) szamlalo.innerText = "0 találat";

  // 4. URL tisztítása (hogy frissítéskor ne hozza vissza a query-t)
  const url = new URL(window.location);
  url.searchParams.delete("query");
  window.history.pushState({}, "", url);

  // 5. Kezdő üzenet visszaírása
  hozzaadBuborekot("Tiszta lap! Miben segíthetek?", "ai");
}

async function inditsChatKeresest() {
  const input = document.getElementById("chat-input");
  const uzenet = input.value.trim();
  if (!uzenet) return;

  hozzaadBuborekot(uzenet, "user");
  input.value = "";

  try {
    const aiValasz = await window.ertelmezdAkeresest(uzenet);

    // Konzol log, hogy lássuk mit küldött az AI
    console.log("🤖 AI Eredeti Válasz:", aiValasz);

    if (!aiValasz || Object.keys(aiValasz).length === 0) {
      hozzaadBuborekot(
        "Nem értettem pontosan a kérést, próbáld máshogy!",
        "ai"
      );
      return;
    }

    // A feltételek egységesítése
    const standardFeltetelek = normalizaldAFelteteleket(aiValasz);
    window.aktualisSzuroFeltetelek = standardFeltetelek;
    sessionStorage.setItem(
      "hazbazis_utolso_kereses",
      JSON.stringify(standardFeltetelek)
    );
    console.log("✅ Standardizált szűrők:", standardFeltetelek);

    if (belsoFlat.length === 0) {
      hozzaadBuborekot("Pillanat, átnézem a kínálatot...", "ai");
      await elsoLekeresFirebasebol(standardFeltetelek);
    } else {
      hozzaadBuborekot("Szűröm a listát az új szempontok alapján...", "ai");
      szuresMemoriaban(standardFeltetelek);
    }

    megjelenitTalalatokat();
  } catch (error) {
    console.error("Kritikus Hiba:", error);
    hozzaadBuborekot("Sajnos hiba történt a rendszerben.", "ai");
  }
}

// --- SEGÉDFÜGGVÉNY: Az AI válaszának egységesítése ---
function normalizaldAFelteteleket(f) {
  return {
    maxAr: f.max_ar || f.vételár || f.price || null,
    minSzoba: f.min_szoba || f.szobák || null,

    // Itt kezeljük a min és max területet is:
    minTerulet: f.min_terulet || f.alapterület || null,
    maxTerulet: f.max_terulet || null, // <--- EZT ADD HOZZÁ!

    kerulet: f.kerulet || null,
    telepules: f.telepules || null,

    kategoria: f.kategoria || null, // elado / kiado
    tipus: f.tipus || null, // Lakás / Ház / Garázs
    lakoparkE: f.lakopark_e || null,
    lakoparkNev: f.lakopark_nev || null,

    allapot: f.allapot || null,
    kellErkely: f.van_erkely === true,
    minEmelet: f.min_emelet !== undefined ? Number(f.min_emelet) : null,
    kellLift: f.kell_lift === true,
    parkolasKereses: f.parkolas_kulcsszo || null, // Pl. "garázs"
    futesKereses: f.futes_tipus || null, // Pl. "cirkó"
    kellKlima: f.kell_klima === true,
    minEv: f.min_epites_eve || null,
  };
}

// --- FŐ LOGIKA: EGYETLEN helyen döntjük el, mi felel meg ---
function megfelelAzIngatlan(ing, f) {
  // Debug: lássuk mi történik a "Zugló lak"-kal
  const isDebugTarget = ing.vételár == 36500000; // A problémás ingatlan ára
  if (isDebugTarget) console.group(`🔍 Vizsgálat: ${ing.nev || ing.id}`);

  let ok = true;
  let kizarasOka = "";

  // --- KATEGÓRIA (Albérlet vs Eladó) ---
  if (f.kategoria && ing.kategoria !== f.kategoria) {
    //    ok = false;
    //    kizarasOka = "Rossz kategória (eladó/kiadó)";
    return false;
  }

  // --- TÍPUS (Garázs szűrés) ---
  if (ok && f.tipus && ing.tipus !== f.tipus) {
    //    ok = false;
    //    kizarasOka = "Rossz ingatlantípus";
    return false;
  }

  // --- LAKÓPARK SZŰRÉS ---
  if (ok && f.lakoparkE === "Igen" && ing.lakopark_e !== "Igen") {
    //   ok = false;
    //   kizarasOka = "Nem lakóparki";
    return false;
  }

  if (ok && f.lakoparkNev) {
    const ingNev = (ing.lakopark_nev || "").toLowerCase();
    const keresett = f.lakoparkNev.toLowerCase();
    if (!ingNev.includes(keresett)) {
      //      ok = false;
      //      kizarasOka = "Más lakópark név";
      return false;
    }
  }

  // 1. ÁR SZŰRÉS
  if (f.maxAr) {
    const ingAr = Number(ing.vételár);
    if (isNaN(ingAr) || ingAr > Number(f.maxAr)) {
      ok = false;
      kizarasOka = `Túl drága (${ingAr} > ${f.maxAr})`;
    }
  }

  // 2. SZOBA SZŰRÉS
  if (ok && f.minSzoba) {
    const ingSzoba = Number(ing.szobák);
    if (ingSzoba < Number(f.minSzoba)) {
      ok = false;
      kizarasOka = `Kevés szoba (${ingSzoba} < ${f.minSzoba})`;
    }
  }

  // 3. TERÜLET SZŰRÉS

  if (ok) {
    const ingTerulet = Number(ing.alapterület); // Biztos ami biztos

    // Minimum vizsgálat
    if (f.minTerulet && ingTerulet < Number(f.minTerulet)) {
      ok = false;
      kizarasOka = `Kicsi (${ingTerulet} < ${f.minTerulet})`;
    }

    // Maximum vizsgálat (ÚJ RÉSZ)
    if (ok && f.maxTerulet && ingTerulet > Number(f.maxTerulet)) {
      ok = false;
      kizarasOka = `Túl nagy (${ingTerulet} > ${f.maxTerulet})`;
    }
  }

  // 4. ERKÉLY (Szigorú)
  if (ok && f.kellErkely) {
    // Kezeljük az ékezetes és ékezet nélküli mezőneveket is
    const nyersErkely = ing.erkély_terasz || ing.erkely_terasz || "0";
    const erkelyMeret = parseFloat(nyersErkely) || 0;

    if (erkelyMeret <= 0) {
      ok = false;
      kizarasOka = `Nincs erkély (Adat: "${nyersErkely}")`;
    }
  }

  // --- PARKOLÁS SZŰRÉS (Szöveges keresés) ---
  if (ok && f.parkolasKereses) {
    // Adatbázis mező: "parkolas" (ékezet nélkül láttam a json-ben)
    const ingParkolas = (ing.parkolas || "").toLowerCase();
    const keresett = f.parkolasKereses.toLowerCase();

    // Ha a vevő "garázs"-t keres, de az adatban "udvari beálló" van -> KIESIK
    // Ha a vevő "beálló"-t keres, az adat "udvari beálló" -> MARAD
    if (!ingParkolas.includes(keresett)) {
      ok = false; // kizarasOka = `Nincs ilyen parkolás (${ingParkolas} vs ${keresett})`;
    }
  }

  // --- FŰTÉS SZŰRÉS ---
  if (ok && f.futesKereses) {
    // Adatbázis mező: "fűtés" (ékezetes!)
    const ingFutes = (ing.fűtés || ing.futes || "").toLowerCase();
    const keresett = f.futesKereses.toLowerCase();

    if (!ingFutes.includes(keresett)) {
      ok = false; // kizarasOka = `Más fűtés (${ingFutes} vs ${keresett})`;
    }
  }

  // --- KLÍMA SZŰRÉS ---
  if (ok && f.kellKlima) {
    // Adatbázis mező: "hűtés" ("Van (1 beltéri)")
    const ingHutes = (ing.hűtés || ing.hutes || "").toLowerCase();

    // Akkor jó, ha van benne valami szöveg, és nem az, hogy "nincs"
    if (ingHutes === "" || ingHutes.includes("nincs") || ingHutes === "-") {
      ok = false;
    }
  }

  // --- ÉPÍTÉSI ÉV ---
  if (ok && f.minEv) {
    // Adatbázis mező: "epites_eve" (string "2016")
    const ingEv = parseInt(ing.epites_eve);

    if (isNaN(ingEv) || ingEv < f.minEv) {
      ok = false; // Túl régi
    }
  }

  // 5. EMELET (Földszint kizárás)
  if (ok && f.minEmelet !== null) {
    let ingEmelet = -99; // Ismeretlen
    const nyersEmelet = (ing.emelet || "").toString().toLowerCase();

    if (nyersEmelet.includes("földszint") || nyersEmelet === "0") {
      ingEmelet = 0;
    } else {
      ingEmelet = parseInt(nyersEmelet);
      if (isNaN(ingEmelet)) ingEmelet = 0; // Ha nem tudjuk eldönteni, kezeljük földszintként (vagy hagyjuk békén)
    }

    if (ingEmelet < f.minEmelet) {
      ok = false;
      kizarasOka = `Alacsony emelet (${ingEmelet} < ${f.minEmelet})`;
    }
  }

  if (isDebugTarget) {
    console.log(`Eredmény: ${ok ? "✅ MARAD" : "❌ KIESIK"} -> ${kizarasOka}`);
    console.groupEnd();
  }

  return ok;
}

// ============================================================
// 1. A MOTOR (ÚJ) - Ez végzi a tényleges munkát
// ============================================================
async function fetchListFromFirebase(f) {
  // Ez ugyanaz a logika, ami eddig az elsoLekeresFirebasebol-ban volt,
  // DE nem írja felül a belsoFlat-et, hanem VISSZAADJA (return) a listát.

  let q = collection(adatbazis, "lakasok");

  // Firebase "Indexelt" szűrés
  if (f.telepules) q = query(q, where("telepules", "==", f.telepules));
  if (f.kerulet) q = query(q, where("kerulet", "==", f.kerulet));
  if (f.kategoria) q = query(q, where("kategoria", "==", f.kategoria));

  const snap = await getDocs(q);
  const nyersLista = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return nyersLista.filter((ing) => megfelelAzIngatlan(ing, f));
}

// ============================================================
// 2. SIMA KERESÉS (ÁTÍRVA) - Ezt hívja az AI
// ============================================================
async function elsoLekeresFirebasebol(f) {
  try {
    // Mostantól csak meghívjuk a "motort"
    belsoFlat = await fetchListFromFirebase(f);

    if (belsoFlat.length === 0) {
      hozzaadBuborekot(
        "Sajnos ilyen paraméterekkel most nincs ingatlanunk.",
        "ai"
      );
    } else {
      hozzaadBuborekot(
        `Találtam ${belsoFlat.length} ingatlant, ami megfelel a szempontjaidnak!`,
        "ai"
      );
    }

    // Frissítjük a képernyőt
    megjelenitTalalatokat();
  } catch (error) {
    console.error("Hiba a keresésben:", error);
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
