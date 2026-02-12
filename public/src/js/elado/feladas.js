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
      mentesGomb.innerText = "Mentes folyamatban...";
    }

    // 1. Alapadatok begyujtese
    let adatok = adatokOsszegyujtese();
    adatok.hibakod = "OK";
    adatok.leiras_hiba = "";
    adatok.metro_kozelseg = [];

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Nincs bejelentkezett felhasznalo!");

      // 2. GEOLOKALIZACIO (Koordinatak lekerese)
      const teljesCim = `${adatok.iranyitoszam} ${adatok.telepules}, ${
        adatok.utca
      } ${adatok.hazszam || ""}`;

      try {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            teljesCim
          )}&countrycodes=hu`
        );
        const geoAdatok = await geoResponse.json();

        if (geoAdatok && geoAdatok.length > 0) {
          adatok.lat = parseFloat(geoAdatok[0].lat);
          adatok.lng = parseFloat(geoAdatok[0].lon);

          // 3. METRO LOGIKA (Csak ha van koordinata es a jo utvonalon)
          try {
            const modul = await import(
              "../../../shorts/js/strategies/metro-logic.js"
            );
            const MetroLogika = modul.MetroLogika;
            const json_utvonal =
              "../../../shorts/js/strategies/metro_megallok.json";

            await MetroLogika.inditas_utvonal(json_utvonal);
            adatok.metro_kozelseg = MetroLogika.kozelben_levo_megallok(
              [adatok.lat, adatok.lng],
              800
            );
            console.log("✅ Metro adatok rogzitve:", adatok.metro_kozelseg);
          } catch (metro_error) {
            console.warn("⚠️ Metro szamitas hiba:", metro_error);
            adatok.hibakod = "METRO_HIBA";
          }
        } else {
          adatok.lat = null;
          adatok.lng = null;
          adatok.hibakod = "GEO_HIBA";
          adatok.leiras_hiba = "A cimet nem sikerult beazonositani.";
        }
      } catch (geo_error) {
        adatok.hibakod = "HALOZATI_HIBA";
        console.error("Geokodolasi hiba:", geo_error);
      }

      // 4. MENTES (Firebase)
      adatok.hirdeto_uid = currentUser.uid;
      adatok.letrehozva = new Date().toISOString();
      //      adatok.statusz = "Feldolgozas alatt";

      if (szerkesztendoId) {
        const docRef = doc(adatbazis, "lakasok", szerkesztendoId);
        await updateDoc(docRef, adatok);
        alert("Sikeres modositas!");
      } else {
        // HA ÚJ HIRDETÉS: A "hirdetesek_varolista" kollekcióba megy!
        adatok.azon = adatok.azon || generalHirdetesAzonosito();
        adatok.statusz = "Jóváhagyásra vár"; // Státusz beállítása

        // ITT A VÁLTOZÁS: Nem 'lakasok', hanem 'hirdetesek_varolista'
        const docRef = doc(adatbazis, "hirdetesek_varolista", adatok.azon);
        await setDoc(docRef, adatok);

        alert(
          `Hirdetés beküldve! Azonosító: ${adatok.azon}\n\nA hirdetés a jóváhagyás/díjrendezés után válik láthatóvá a rendszerben.`
        );
      }

      window.location.href = window.location.pathname;
    } catch (hiba) {
      console.error("Folyami hiba:", hiba);
      alert("Hiba tortent: " + hiba.message);
    } finally {
      if (mentesGomb) {
        mentesGomb.disabled = false;
        mentesGomb.innerText = "Hirdetes bekuldese";
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
