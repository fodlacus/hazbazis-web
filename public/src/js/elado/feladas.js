// src/js/elado/feladas.js

// 1. IMPORTÁLÁS
// FONTOS: A setDoc-ot is importálni kell a konkrét ID megadásához!
import {
  adatbazis,
  auth,
  collection,
  doc, // Ez már itt volt
  setDoc, // <--- EZT ADTAM HOZZÁ (addDoc helyett ezt használjuk)
} from "../util/firebase-config.js";

// Ha az updateDoc/setDoc nincs a configban exportálva, behúzzuk CDN-ről:
import { updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { szerkesztendoId } from "./szerkesztes.js";
import { budapestAdatok } from "../util/helyszin-adatok.js";

// 2. AUTOMATIKUS INDÍTÁS
window.addEventListener("DOMContentLoaded", () => {
  helyszinFigyelo();
});

// Helyszín figyelő (Kerület -> Városrész kapcsolat)
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

// Adatok összegyűjtése
function adatokOsszegyujtese() {
  const adatok = {};

  // --- MÓDOSÍTÁS 1: "teras" helyett "HB" ---
  const generalAzonosito = () => `HB-${Date.now().toString().slice(-6)}`;

  const mezok = document.querySelectorAll(
    "#hirdetes-urlap input, #hirdetes-urlap select, #hirdetes-urlap textarea"
  );

  mezok.forEach((mezo) => {
    const id = mezo.id;
    if (!id) return;

    let ertek = mezo.value;

    // Számok tisztítása
    if (["vételár", "alapterület", "szobák"].includes(id)) {
      ertek = Number(String(ertek).replace(/[^0-9]/g, "")) || 0;
    }

    // Checkbox
    if (mezo.type === "checkbox") {
      ertek = mezo.checked;
    }

    if (ertek !== undefined && ertek !== "") {
      adatok[id] = ertek;
    }
  });

  // Ellenőrzés: Be van-e lépve?
  if (!auth.currentUser) {
    alert("Hiba: A munkamenet lejárt vagy nem vagy bejelentkezve!");
    throw new Error("Nincs bejelentkezett felhasználó");
  }

  // Kötelező rendszeradatok
  adatok.hirdeto_uid = auth.currentUser.uid;
  adatok.letrehozva = new Date().toISOString();
  adatok.statusz = "Feldolgozás alatt";

  // Ha még nincs azonosító (új felvétel), generálunk egy HB-sat
  if (!szerkesztendoId) {
    adatok.azon = generalAzonosito();
  }

  // GPS (Ha az ai-bridge.js beállította)
  adatok.lat = window.aktualisLat || null;
  adatok.lng = window.aktualisLng || null;

  return adatok;
}

// Űrlap beküldése
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
      const adatok = adatokOsszegyujtese();

      if (szerkesztendoId) {
        // --- MÓDOSÍTÁS ---
        // Meglévő rekord frissítése (itt marad a régi logika)
        const docRef = doc(adatbazis, "lakasok", szerkesztendoId);
        await updateDoc(docRef, adatok);
        alert("Sikeres módosítás!");
      } else {
        // --- MÓDOSÍTÁS 2: ÚJ REKORD LÉTREHOZÁSA FIX ID-VAL ---
        // addDoc helyett setDoc-ot használunk, hogy mi mondjuk meg a nevet!
        // Így a dokumentum neve (ID) ugyanaz lesz, mint az adatok.azon (pl. HB-123456)

        const docRef = doc(adatbazis, "lakasok", adatok.azon);
        await setDoc(docRef, adatok);

        alert(`Hirdetés sikeresen feladva! Azonosító: ${adatok.azon}`);
      }

      // Frissítés (hogy tiszta legyen az űrlap)
      window.location.href = window.location.pathname;
    } catch (error) {
      console.error("Hiba:", error);
      alert("Nem sikerült a mentés: " + error.message);
    } finally {
      if (mentesGomb) {
        mentesGomb.disabled = false;
        mentesGomb.innerText = "Hirdetés beküldése";
      }
    }
  };
}

// Űrlap ürítése gombhoz
window.urlapUrites = function () {
  if (confirm("Biztosan törlöd az adatokat?")) {
    document.getElementById("hirdetes-urlap")?.reset();
  }
};
