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

// --- FŐ BEKÜLDÉSI FOLYAMAT JAVÍTVA ---
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
      if (!userSnap.exists())
        throw new Error("A felhasználói profil nem található!");

      const userData = userSnap.data();

      // 1. Adatok begyűjtése
      const adatok = adatokOsszegyujtese();

      // 2. Alapinformációk kiegészítése
      adatok.hirdeto_azon = userData.azon;
      adatok.hirdeto_uid = currentUser.uid;
      adatok.letrehozva = new Date().toISOString();
      adatok.statusz = "Feldolgozás alatt";

      // GPS adatok fixálása
      const lat = window.aktualisLat || null;
      const lng = window.aktualisLng || null;

      // Csak akkor írjuk felül, ha van új koordináta, vagy ha új hirdetés
      if (lat && lng) {
        adatok.lat = lat;
        adatok.lng = lng;
      } else if (!szerkesztendoId) {
        adatok.lat = null;
        adatok.lng = null;
      }

      // 3. Metró logika (Előszámítás mentés előtt)
      adatok.metro_kozelseg = []; // Alapértelmezett üres tömb
      if (adatok.lat && adatok.lng) {
        console.log("Metró távolságok számítása...");
        try {
          const module = await import(
            "../../../public/shorts/js/strategies/metro-logic.js"
          );
          const MetroLogic = module.MetroLogic;
          await MetroLogic.init();
          adatok.metro_kozelseg = MetroLogic.getNearbyStopIds(
            [adatok.lat, adatok.lng],
            800
          );
          console.log("Talált megállók:", adatok.metro_kozelseg);
        } catch (mErr) {
          console.warn("Metró hiba:", mErr);
        }
      }

      // 4. EGYETLEN MENTÉSI PONT
      if (szerkesztendoId) {
        // MÓDOSÍTÁS
        const docRef = doc(adatbazis, "lakasok", szerkesztendoId);
        // Ha szerkesztés van és nem kaptunk új GPS-t, ne töröljük a régit
        if (!lat || !lng) {
          delete adatok.lat;
          delete adatok.lng;
        }
        await updateDoc(docRef, adatok);
        alert("Sikeres módosítás!");
      } else {
        // ÚJ HIRDETÉS
        if (!adatok.azon) adatok.azon = generalHirdetesAzonosito();
        const docRef = doc(adatbazis, "lakasok", adatok.azon);
        await setDoc(docRef, adatok);
        alert(`Hirdetés feladva! Azonosító: ${adatok.azon}`);
      }

      // 5. SIKERES LEZÁRÁS
      window.location.href = window.location.pathname;
    } catch (error) {
      console.error("Hiba történt:", error);
      alert("Hiba: " + error.message);
    } finally {
      if (mentesGomb) {
        mentesGomb.disabled = false;
        mentesGomb.innerText = "Hirdetés beküldése";
      }
    }
  };
}

window.urlapUrites = function () {
  if (confirm("Biztosan törlöd az adatokat?")) {
    document.getElementById("hirdetes-urlap")?.reset();
  }
};
