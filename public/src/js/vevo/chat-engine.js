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
    const feltetelek = await window.ertelmezdAkeresest(uzenet);
    if (!feltetelek || Object.keys(feltetelek).length === 0) return;

    if (belsoFlat.length === 0) {
      hozzaadBuborekot("Pillanat, átnézem a kínálatot...", "ai");
      await elsoLekeresFirebasebol(feltetelek);
    } else {
      hozzaadBuborekot("Szűröm a listát az új szempontok alapján...", "ai");
      szuresMemoriaban(feltetelek); // Itt történik a második szűrés
    }

    // FONTOS: Minden szűrés után újra ki kell rajzolni a kártyákat!
    megjelenitTalalatokat();
  } catch (error) {
    console.error("Hiba:", error);
    hozzaadBuborekot("Sajnos hiba történt a művelet közben.", "ai");
  }
}

// src/js/vevo/chat-engine.js
// Importok maradnak a régiek...

// src/js/vevo/chat-engine.js

async function elsoLekeresFirebasebol(f) {
  console.log("Bejövő AI adatok:", f);

  // 1. Paraméterek összerendezése
  const keresettFeltetelek = {
    maxAr: f.max_ar || f.vételár || f.price || null,
    minSzoba: f.min_szoba || f.szobák || null,
    minTerulet: f.min_terulet || f.alapterület || null,
    kerulet: f.kerulet || null,
    telepules: f.telepules || null,
    tipus: f.tipus || null,
    allapot: f.allapot || null,
    // Újak:
    kellErkely: f.van_erkely || false,
    minEmelet: f.min_emelet !== undefined ? f.min_emelet : null,
    kellLift: f.kell_lift || false,
  };

  try {
    let q = collection(adatbazis, "lakasok");

    // Firebase "Durva szűrés" (Indexelt mezőkre)
    if (keresettFeltetelek.telepules) {
      q = query(q, where("telepules", "==", keresettFeltetelek.telepules));
    }
    if (keresettFeltetelek.kerulet) {
      q = query(q, where("kerulet", "==", keresettFeltetelek.kerulet));
    }

    const snap = await getDocs(q);
    let eredmenyek = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // 2. "Finomhangolás" memóriában (Itt történik a varázslat!)
    eredmenyek = eredmenyek.filter((ing) => {
      let ok = true;

      // --- Ár szűrés ---
      if (
        keresettFeltetelek.maxAr &&
        Number(ing.vételár) > Number(keresettFeltetelek.maxAr)
      )
        ok = false;

      // --- Szoba szűrés ---
      if (
        keresettFeltetelek.minSzoba &&
        Number(ing.szobák) < Number(keresettFeltetelek.minSzoba)
      )
        ok = false;

      // --- Terület szűrés ---
      if (
        keresettFeltetelek.minTerulet &&
        Number(ing.alapterület) < Number(keresettFeltetelek.minTerulet)
      )
        ok = false;

      // --- ERKÉLY OKOS SZŰRÉS ---
      // Az adatbázisban: "8" (string) vagy "" (üres)
      if (keresettFeltetelek.kellErkely) {
        // A parseFloat("8") -> 8. A parseFloat("") -> NaN.
        const erkelyMeret = parseFloat(ing.erkély_terasz) || 0;
        if (erkelyMeret <= 0) ok = false;
      }

      // --- EMELET OKOS SZŰRÉS ---
      if (keresettFeltetelek.minEmelet !== null) {
        let ingEmelet = -1; // Alapértelmezett, ha ismeretlen

        if (ing.emelet) {
          const szoveg = ing.emelet.toString().toLowerCase();
          if (szoveg.includes("földszint")) {
            ingEmelet = 0;
          } else {
            // "1. emelet" vagy "3" -> kinyeri a számot
            ingEmelet = parseInt(szoveg) || 0;
          }
        }

        // Ha a kért emelet (pl. 1) nagyobb, mint az ingatlané (pl. 0), akkor kuka
        if (ingEmelet < keresettFeltetelek.minEmelet) ok = false;
      }

      // --- LIFT SZŰRÉS ---
      if (keresettFeltetelek.kellLift) {
        const liftInfo = ing.lift ? ing.lift.toLowerCase() : "";
        if (!liftInfo.includes("van")) ok = false;
      }

      return ok;
    });

    belsoFlat = eredmenyek;
    megjelenitTalalatokat();

    if (belsoFlat.length === 0) {
      hozzaadBuborekot(
        "Sajnos a részletes szűrés alapján nincs találat.",
        "ai"
      );
    } else {
      hozzaadBuborekot(
        `Találtam ${belsoFlat.length} ingatlant az igényeid alapján!`,
        "ai"
      );
    }
  } catch (error) {
    console.error("Hiba:", error);
    hozzaadBuborekot("Hiba történt a keresés közben.", "ai");
  }
}

function szuresMemoriaban(f) {
  console.log("Finomhangolás a memóriában:", f);

  belsoFlat = belsoFlat.filter((ing) => {
    let megfelel = true;

    // Alapterület szűrés (pl. "52 m2 alatt")
    if (f.alapterület && Number(ing.alapterület) > Number(f.alapterület))
      megfelel = false;

    // Ár szűrés (ha a második körben is van árkorlát)
    if (f.vételár && Number(ing.vételár) > Number(f.vételár)) megfelel = false;

    // Szobaszám szűrés
    if (f.szobák && Number(ing.szobák) < Number(f.szobák)) megfelel = false;

    return megfelel;
  });
}

function hozzaadBuborekot(msg, tipus) {
  const folyam = document.getElementById("chat-folyam");
  const div = document.createElement("div");
  div.className =
    tipus === "user" ? "flex justify-end mb-4" : "flex gap-3 mb-4";

  div.innerHTML =
    tipus === "user"
      ? `<div class="bg-[#E2F1B0] text-[#3D4A16] p-4 rounded-2xl rounded-tr-none text-sm max-w-[85%] shadow-lg">${msg}</div>`
      : `<img src="../../../AI-no.png" class="w-10 h-10 rounded-full object-cover shadow-md">
           <div class="bg-white/10 p-4 rounded-2xl rounded-tl-none text-sm max-w-[85%] border border-white/5">${msg}</div>`;

  folyam.appendChild(div);
  folyam.scrollTop = folyam.scrollHeight;
}

function megjelenitTalalatokat() {
  const panel = document.getElementById("eredmenyek-panel");
  const szamlalo = document.getElementById("talalat-szam");

  // Frissítjük a számlálót a fejlécben
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

      // Képkezelés: ha még nincs fotó, egy stabil sötét hátteret mutatunk vibrálás helyett
      const kepUrl =
        ing.kepek_horiz && ing.kepek_horiz[0] ? ing.kepek_horiz[0] : "";
      const kepPlaceholder = kepUrl
        ? `<img src="${kepUrl}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=text-[10px]>Feltöltés alatt</div>'">`
        : `<div class="flex items-center justify-center h-full text-[10px] opacity-30 text-center p-2">Hamarosan fotóval</div>`;

      return `
        <div class="bg-white/5 border border-white/10 p-4 rounded-3xl flex gap-4 hover:bg-white/10 transition-all cursor-pointer group mb-4">
            <div class="w-24 h-24 rounded-2xl bg-black/40 overflow-hidden flex-shrink-0 flex items-center justify-center border border-white/5">
                ${kepPlaceholder}
            </div>
            <div class="flex flex-col justify-center overflow-hidden">
                <h3 class="font-bold text-sm group-hover:text-[#E2F1B0] transition-colors truncate">${
                  ing.nev || "Ingatlan"
                }</h3>
                <p class="text-[#E2F1B0] font-black mt-1">${formatalAr}</p>
                <p class="text-[10px] opacity-40 uppercase mt-1">
                    ${ing.kerulet || "Budapest"} • ${ing.alapterület || "?"} m²
                </p>
            </div>
        </div>
      `;
    })
    .join("");
}
