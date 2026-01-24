import {
  query,
  where,
  getDocs,
  collection,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

let belsoFlat = []; // Ez a "flat" állomány a memóriában

// 1. Betöltéskor ellenőrizzük, jött-e kérdés a főoldalról
window.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const kezdőKérdés = urlParams.get("query");

  if (kezdőKérdés) {
    document.getElementById("chat-input").value = kezdőKérdés;
    inditsChatKeresest();
  }
});

// Küldés gomb figyelése
document
  .getElementById("send-btn")
  .addEventListener("click", inditsChatKeresest);

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
    minTerulet: f.min_terulet || f.alapterület || f.area || null,
    kerulet: f.kerulet || null,
    telepules: f.telepules || null,
    tipus: f.tipus || null,
    allapot: f.allapot || null,
    // Bool & Extra mezők
    kellErkely: f.van_erkely === true, // Csak ha explicit true
    minEmelet: f.min_emelet !== undefined ? Number(f.min_emelet) : null,
    kellLift: f.kell_lift === true,
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
  if (ok && f.minTerulet) {
    const ingTerulet = Number(ing.alapterület);
    if (ingTerulet < Number(f.minTerulet)) {
      ok = false;
      kizarasOka = `Kicsi (${ingTerulet} < ${f.minTerulet})`;
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

async function elsoLekeresFirebasebol(f) {
  try {
    let q = collection(adatbazis, "lakasok");

    // Firebase "Indexelt" szűrés (Csak ami biztosan gyorsítja a lekérést)
    if (f.telepules) q = query(q, where("telepules", "==", f.telepules));
    if (f.kerulet) q = query(q, where("kerulet", "==", f.kerulet));

    const snap = await getDocs(q);
    let nyersLista = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Minden más logikát a közös függvény végez
    belsoFlat = nyersLista.filter((ing) => megfelelAzIngatlan(ing, f));

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
  } catch (error) {
    console.error("Hiba a részletes keresésben:", error);
    hozzaadBuborekot("Sajnos hiba történt az adatbázis elérésekor.", "ai");
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
