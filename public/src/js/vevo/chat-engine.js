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
    aktualisSzuroFeltetelek = standardFeltetelek;
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
    tipus: f.tipus || null,
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
  // Ha használsz statusz szűrést:
  // q = query(q, where("statusz", "==", "aktiv")); // Opcionális

  const snap = await getDocs(q);
  const nyersLista = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Itt hívjuk meg a közös "Bírót" (megfelelAzIngatlan), amit már megírtunk
  // Ez végzi az ár, erkély, emelet, stb. finomhangolást
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

function megjelenitTalalatokat() {
  const panel = document.getElementById("eredmenyek-panel");
  const szamlalo = document.getElementById("talalat-szam");
  szamlalo.innerText = `${belsoFlat.length} talált`;

  if (belsoFlat.length === 0) {
    panel.innerHTML = `<p class="text-center opacity-40 mt-10">Nincs a feltételeknek megfelelő ingatlan.</p>`;
    return;
  }

  panel.innerHTML = belsoFlat
    .map((ing) => {
      const ar = Number(ing.vételár);
      const formatalAr = !isNaN(ar)
        ? ar.toLocaleString() + " Ft"
        : "Ár kérésre";
      const kepUrl =
        ing.kepek_horiz && ing.kepek_horiz[0] ? ing.kepek_horiz[0] : "";
      const kepPlaceholder = kepUrl
        ? `<img src="${kepUrl}" class="w-full h-full object-cover">`
        : `<div class="flex items-center justify-center h-full text-[10px] opacity-30">Nincs fotó</div>`;

      return `
        <div class="bg-white/5 border border-white/10 p-4 rounded-3xl flex gap-4 hover:bg-white/10 transition-all cursor-pointer group mb-4">
            <div class="w-24 h-24 rounded-2xl bg-black/40 overflow-hidden flex-shrink-0 flex items-center justify-center border border-white/5">${kepPlaceholder}</div>
            <div class="flex flex-col justify-center overflow-hidden">
                <h3 class="font-bold text-sm group-hover:text-[#E2F1B0] transition-colors truncate">${
                  ing.nev || "Ingatlan"
                }</h3>
                <p class="text-[#E2F1B0] font-black mt-1">${formatalAr}</p>
                <p class="text-[10px] opacity-40 uppercase mt-1">${
                  ing.kerulet || "Bp"
                } • ${ing.alapterület || "?"} m² • ${
        ing.erkély_terasz || 0
      } m² erkély</p>
            </div>
        </div>`;
    })
    .join("");
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
