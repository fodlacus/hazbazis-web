// src/js/elado/feladas.js

// 1. IMPORTÁLÁS (A javított importokkal)
import { adatbazis, auth } from "../util/firebase-config.js";

import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { szerkesztendoId } from "./szerkesztes.js";
import { budapestAdatok } from "../util/helyszin-adatok.js";

// 2. AUTOMATIKUS INDÍTÁS
window.addEventListener("DOMContentLoaded", () => {
  helyszinFigyelo();
  const urlParams = new URLSearchParams(window.location.search);
  const isEditMode = urlParams.get("mode") === "edit";
  const mentesGomb = document.getElementById("hirdetes-bekuldes");

  if (isEditMode && mentesGomb) {
    mentesGomb.disabled = false;
    mentesGomb.innerText = "Módosítások mentése";
  }
});

// Helyszín figyelő
export function helyszinFigyelo() {
  const keruletSelect = document.getElementById("kerulet");
  const varosreszSelect = document.getElementById("varosresz");

  if (keruletSelect && varosreszSelect) {
    keruletSelect.addEventListener("change", () => {
      const valasztott = keruletSelect.value;
      const reszek = budapestAdatok[valasztott] || [];
      varosreszSelect.innerHTML =
        reszek.length > 0
          ? reszek.map((r) => `<option value="${r}">${r}</option>`).join("")
          : '<option value="">Válassz kerületet!</option>';
    });
  }
}

// --- VISSZAÁLLÍTVA 6 SZÁMJEGYRE ---
function generalHirdetesAzonosito() {
  // Generál egy véletlen számot 100000 és 999999 között (pontosan 6 jegy)
  const hatjegyuSzam = Math.floor(100000 + Math.random() * 900000);
  return `HB-${hatjegyuSzam}`;
}

// Űrlap adatok begyűjtése
function adatokOsszegyujtese() {
  const adatok = {};
  const mezok = document.querySelectorAll(
    "#hirdetes-urlap input, #hirdetes-urlap select, #hirdetes-urlap textarea"
  );

  mezok.forEach((mezo) => {
    const id = mezo.id;
    if (!id) return;

    let ertek = mezo.value;

    if (["vételár", "alapterület", "szobák", "akcios_ar"].includes(id)) {
      ertek = Number(String(ertek).replace(/[^0-9]/g, "")) || 0;
    }
    if (mezo.type === "checkbox") {
      ertek = mezo.checked;
    }
    if (ertek !== undefined && ertek !== "") {
      adatok[id] = ertek;
    }
  });

  return adatok;
}

// --- FŐ BEKÜLDÉSI FOLYAMAT ---
const urlap = document.getElementById("hirdetes-urlap");

if (urlap) {
  urlap.onsubmit = async (e) => {
    e.preventDefault();
    const mentesGomb = document.getElementById("hirdetes-bekuldes");

    if (mentesGomb) {
      mentesGomb.disabled = true;
      mentesGomb.innerText = "Mentés folyamatban...";
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Nincs bejelentkezett felhasználó!");

      const userDocRef = doc(adatbazis, "felhasznalok", currentUser.uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) throw new Error("A profil nem található!");

      const userData = userSnap.data();

      // 1. Adatok begyűjtése
      const adatok = adatokOsszegyujtese();

      // 2. Alapadatok és GPS
      adatok.hirdeto_azon = userData.azon;
      adatok.hirdeto_uid = currentUser.uid;
      adatok.letrehozva = new Date().toISOString();
      adatok.statusz = "Feldolgozás alatt";

      const lat = window.aktualisLat || null;
      const lng = window.aktualisLng || null;

      // GPS adatok kezelése (csak ha van koordináta)
      if (lat && lng) {
        adatok.lat = lat;
        adatok.lng = lng;
      } else if (!szerkesztendoId) {
        adatok.lat = null;
        adatok.lng = null;
      }

      // 3. METRÓ LOGIKA (Helyes útvonallal a feladási oldalhoz)
      adatok.metro_kozelseg = [];
      if (adatok.lat && adatok.lng) {
        try {
          // Importáljuk a logikát
          const module = await import(
            "../../../public/shorts/js/strategies/metro-logic.js"
          );
          const MetroLogic = module.MetroLogic;

          // MEGOLDÁS: Itt adjuk meg a JSON pontos útvonalát a feladási oldalhoz képest
          const jsonUtvonal =
            "../../../public/shorts/js/strategies/metro_megallok.json";

          // Egy kis módosítás az init-en, hogy elfogadja az útvonalat
          if (typeof MetroLogic.initWithPath === "function") {
            await MetroLogic.initWithPath(jsonUtvonal);
          } else {
            await MetroLogic.init(); // Tartalék, ha még a régi van
          }

          adatok.metro_kozelseg = MetroLogic.getNearbyStopIds(
            [adatok.lat, adatok.lng],
            800
          );
          console.log("🚇 Metró adatok kiszámolva:", adatok.metro_kozelseg);
        } catch (mErr) {
          console.warn("⚠️ Metró hiba (valószínűleg útvonal):", mErr);
        }
      }

      // 4. EGYETLEN MENTÉSI PONT
      if (szerkesztendoId) {
        const docRef = doc(adatbazis, "lakasok", szerkesztendoId);
        // Szerkesztésnél ne töröljük a régi GPS-t, ha most nincs megadva
        if (!lat || !lng) {
          delete adatok.lat;
          delete adatok.lng;
        }
        await updateDoc(docRef, adatok);
        alert("Sikeres módosítás!");
      } else {
        if (!adatok.azon) adatok.azon = generalHirdetesAzonosito();
        const docRef = doc(adatbazis, "lakasok", adatok.azon);
        await setDoc(docRef, adatok);
        alert(`Hirdetés feladva! Azonosító: ${adatok.azon}`);
      }

      window.location.href = window.location.pathname;
    } catch (error) {
      console.error("Hiba:", error);
      alert("Hiba történt: " + error.message);
    } finally {
      if (mentesGomb) {
        mentesGomb.disabled = false;
        mentesGomb.innerText = "Hirdetés beküldése";
      }
    }
  };
}
// --- FŐ BEKÜLDÉSI FOLYAMAT JAVÍTVA ---
window.urlapUrites = function () {
  if (confirm("Biztosan törlöd az adatokat?")) {
    document.getElementById("hirdetes-urlap")?.reset();
  }
};
