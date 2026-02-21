// src/js/elado/feladas.js

// 1. IMPORTÁLÁS (A javított importokkal)
import { adatbazis, auth } from "../util/firebase-config.js";

import {
  doc,
  setDoc,
  updateDoc,
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

// --- ÚJ FUNKCIÓ: BKK JÁRATOK LEKÉRDEZÉSE (OKOS SZŰRŐVEL) ---
async function bkkJaratokLekerdezese(lat, lng) {
  const BKK_API_KEY = "e34bb19f-331e-4bed-89a4-fd9ee86280d0";
  const radius = 300;
  const url = `https://futar.bkk.hu/api/query/v1/ws/otp/api/where/stops-for-location.json?lat=${lat}&lon=${lng}&radius=${radius}&key=${BKK_API_KEY}`;

  try {
    const valasz = await fetch(url);
    const adat = await valasz.json();

    if (adat.code !== 200 || !adat.data || !adat.data.list) return [];

    const megallok = adat.data.list;
    const jarat_szotar = adat.data.references.routes;
    const egyedi_jarat_idk = new Set();

    megallok.forEach((megallo) => {
      if (megallo.routeIds) {
        megallo.routeIds.forEach((routeId) => egyedi_jarat_idk.add(routeId));
      }
    });

    let vegleges_jaratok = [];

    egyedi_jarat_idk.forEach((routeId) => {
      const jaratAdat = jarat_szotar[routeId];
      if (jaratAdat) {
        // 1. SZŰRÉS: Éjszakai járatok (900-999) kihagyása
        const szamErtek = parseInt(jaratAdat.shortName, 10);
        const isEjszakai = szamErtek >= 900 && szamErtek <= 999;

        if (!isEjszakai) {
          vegleges_jaratok.push({
            szam: jaratAdat.shortName,
            tipus: jaratAdat.type,
            szin: jaratAdat.color,
            szoveg_szin: jaratAdat.textColor,
          });
        }
      }
    });

    // 2. RENDEZÉS PRIORITÁS SZERINT (Metró > Villamos > Troli > Busz)
    const tipusSuly = {
      SUBWAY: 1,
      TRAM: 2,
      TROLLEYBUS: 3,
      BUS: 4,
    };

    vegleges_jaratok.sort((a, b) => {
      // Ha különböző a típusuk, a súly dönt
      if (tipusSuly[a.tipus] !== tipusSuly[b.tipus]) {
        return tipusSuly[a.tipus] - tipusSuly[b.tipus];
      }
      // Ha azonos típusúak (pl. mindkettő busz), akkor járatszám szerint rendezzük (pl. 5, 7, 8E)
      return a.szam.localeCompare(b.szam, undefined, { numeric: true });
    });

    // 3. LIMITÁLÁS: Csak a Top 10 legfontosabb járatot tartjuk meg
    return vegleges_jaratok.slice(0, 10);
  } catch (hiba) {
    console.error("BKK API Hiba:", hiba);
    return [];
  }
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
    adatok.bkk_jaratok = []; // Alapértelmezett üres tömb a BKK járatoknak

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

          // 3. METRO LOGIKA
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

          // 3/B. ÚJ: BKK JÁRATOK LEKÉRDEZÉSE (ha megvan a koordináta)
          try {
            console.log("BKK járatok lekérdezése folyamatban...");
            adatok.bkk_jaratok = await bkkJaratokLekerdezese(
              adatok.lat,
              adatok.lng
            );
            console.log("✅ BKK adatok rogzitve:", adatok.bkk_jaratok);
          } catch (bkk_error) {
            console.warn("⚠️ BKK szamitas hiba:", bkk_error);
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
      adatok.email = currentUser.email;
      adatok.letrehozva = new Date().toISOString();

      if (szerkesztendoId) {
        const docRef = doc(adatbazis, "lakasok", szerkesztendoId);
        await updateDoc(docRef, adatok);
        alert("Sikeres modositas!");
      } else {
        adatok.azon = adatok.azon || generalHirdetesAzonosito();
        adatok.statusz = "Jóváhagyásra vár";

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

// --- ŰRLAP ÜRÍTÉSE ---
window.urlapUrites = function () {
  if (confirm("Biztosan törlöd az adatokat?")) {
    document.getElementById("hirdetes-urlap")?.reset();
  }
};
