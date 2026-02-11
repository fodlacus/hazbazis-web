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

// src/js/elado/feladas.js

if (urlap) {
  urlap.onsubmit = async (e) => {
    e.preventDefault();
    const mentesGomb = document.getElementById("hirdetes-bekuldes");

    if (mentesGomb) {
      mentesGomb.disabled = true;
      mentesGomb.innerText = "Mentés folyamatban...";
    }

    // Alap adatok az objektumhoz
    let adatok = adatokOsszegyujtese();
    adatok.hibakod = "OK"; // Alapértelmezett állapot
    adatok.leiras_hiba = "";
    adatok.metro_kozelseg = [];

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Nincs bejelentkezett felhasználó!");

      // --- GEOLOKÁCIÓ ÉS METRÓ SZÁMÍTÁS ---
      const irsz = adatok.iranyitoszam;
      const varos = adatok.telepules;
      const utca = adatok.utca;
      const hazszam = adatok.hazszam || "";
      const teljesCim = `${irsz} ${varos}, ${utca} ${hazszam}`;

      try {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            teljesCim
          )}&countrycodes=hu`
        );
        const geoAdatok = await geoResponse.json();

        if (geoAdatok && geoAdatok.length > 0) {
          // SIKERES BEAZONOSÍTÁS
          const lat = parseFloat(geoAdatok[0].lat);
          const lng = parseFloat(geoAdatok[0].lon);
          adatok.lat = lat;
          adatok.lng = lng;

          // Metró logika futtatása
          const modul = await import(
            "../../../shorts/js/strategies/metro-logic.js"
          );
          const MetroLogika = modul.MetroLogika;
          const jsonUtvonal =
            "../../../shorts/js/strategies/metro_megallok.json";

          await MetroLogika.inditas_utvonal(jsonUtvonal);
          adatok.metro_kozelseg = MetroLogika.kozelben_levo_megallok(
            [lat, lng],
            800
          );
        } else {
          // NEM TALÁLHATÓ CÍM - DE MENTÜNK TOVÁBB!
          adatok.lat = null;
          adatok.lng = null;
          adatok.hibakod = "GEO_HIBA";
          adatok.leiras_hiba =
            "A címet nem sikerült koordinátává alakítani. A metró szűrő nem fog működni.";
          console.warn("⚠️ Cím nem található, hibakód rögzítve.");
        }
      } catch (err) {
        adatok.hibakod = "RENDSZER_HIBA";
        adatok.leiras_hiba = "A geolokalizációs szolgáltatás nem elérhető.";
      }

      // --- FIREBASE MENTÉS ---
      adatok.hirdeto_uid = currentUser.uid;
      adatok.letrehozva = new Date().toISOString();
      adatok.statusz = "Feldolgozás alatt";

      if (szerkesztendoId) {
        const docRef = doc(adatbazis, "lakasok", szerkesztendoId);
        await updateDoc(docRef, adatok);
        alert("Sikeres módosítás!");
      } else {
        adatok.azon = adatok.azon || generalHirdetesAzonosito();
        const docRef = doc(adatbazis, "lakasok", adatok.azon);
        await setDoc(docRef, adatok);

        if (adatok.hibakod !== "OK") {
          alert(
            `Figyelem! A hirdetés mentve (Azonosító: ${adatok.azon}), de a címet nem sikerült beazonosítani. Kérjük, később ellenőrizd a címet a szerkesztés menüben!`
          );
        } else {
          alert(`Hirdetés sikeresen feladva!\nAzonosító: ${adatok.azon}`);
        }
      }

      window.location.href = window.location.pathname;
    } catch (hiba) {
      console.error("Mentési hiba:", hiba);
      alert("Hiba történt: " + hiba.message);
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
