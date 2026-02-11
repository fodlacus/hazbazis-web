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

// src/js/elado/feladas.js -> urlap.onsubmit resz

// --- FŐ BEKÜLDÉSI FOLYAMAT JAVÍTVA ---
if (urlap) {
  urlap.onsubmit = async (e) => {
    e.preventDefault();
    const mentesGomb = document.getElementById("hirdetes-bekuldes");

    // 1. Mentés gomb azonnali blokkolása
    if (mentesGomb) {
      mentesGomb.disabled = true;
      mentesGomb.innerText = "Mentes folyamatban...";
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Nincs bejelentkezett felhasznalo!");

      const adatok = adatokOsszegyujtese();

      // 2. KOORDINÁTÁK FIXÁLÁSA (Ezt előrébb hoztuk és fixre vesszük)
      const lat = window.aktualisLat || null;
      const lng = window.aktualisLng || null;

      // Mindig mentsük el a koordinátákat az adatok közé, ha léteznek!
      if (lat && lng) {
        adatok.lat = lat;
        adatok.lng = lng;
      }

      // 3. METRÓ KALKULÁCIÓ
      adatok.metro_kozelseg = [];
      if (lat && lng) {
        try {
          const modul = await import(
            "../../../public/shorts/js/strategies/metro-logic.js"
          );
          const MetroLogika = modul.MetroLogika;

          const json_utvonal =
            "../../../public/shorts/js/strategies/metro_megallok.json";
          await MetroLogika.inditas_utvonal(json_utvonal);

          adatok.metro_kozelseg = MetroLogika.kozelben_levo_megallok(
            [lat, lng],
            800
          );
          console.log("✅ Metro adatok rogzitve:", adatok.metro_kozelseg);
        } catch (metro_hiba) {
          console.error("Hiba a metro szamitasnal:", metro_hiba);
          // Hiba esetén marad az üres tömb, de a mentés mehet tovább
        }
      } else {
        console.warn(
          "⚠️ Nincs koordinata! A metro szures nem fog mukodni ezen az ingatlanon."
        );
      }

      // 4. MENTÉS A FIREBASE-BE
      if (szerkesztendoId) {
        const docRef = doc(adatbazis, "lakasok", szerkesztendoId);
        // Szerkesztésnél: ha nincs új koordináta, ne írjuk felül a régit null-al
        if (!lat || !lng) {
          delete adatok.lat;
          delete adatok.lng;
        }
        await updateDoc(docRef, adatok);
        alert("Sikeres modositas!");
      } else {
        // Új hirdetés
        adatok.azon = adatok.azon || generalHirdetesAzonosito();
        const docRef = doc(adatbazis, "lakasok", adatok.azon);
        await setDoc(docRef, adatok);
        alert(`Hirdetes sikeresen feladva!\nAzonosító: ${adatok.azon}`);
      }

      window.location.href = window.location.pathname;
    } catch (hiba) {
      console.error("Mentesi hiba:", hiba);
      alert("Hiba tortent: " + hiba.message);
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
