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

    if (["vételár", "alapterület", "szobák"].includes(id)) {
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
      // 1. Ellenőrzés
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Nincs bejelentkezett felhasználó!");
      }

      // 2. USER PROFIL LEKÉRDEZÉSE
      const userDocRef = doc(adatbazis, "felhasznalok", currentUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        throw new Error("A felhasználói profil nem található!");
      }

      const userData = userSnap.data();
      const hirdetoEgyediAzonosito = userData.azon; // A 'hb-...' azonosító

      // 3. Adatok begyűjtése
      const adatok = adatokOsszegyujtese();

      // 4. Kiegészítés
      adatok.hirdeto_azon = hirdetoEgyediAzonosito;
      adatok.hirdeto_uid = currentUser.uid;
      adatok.letrehozva = new Date().toISOString();
      adatok.statusz = "Feldolgozás alatt";

      if (!szerkesztendoId) {
        // Most már 6 jegyű lesz!
        adatok.azon = generalHirdetesAzonosito();
        adatok.lakas_azon = adatok.azon;
      }

      // GPS
      adatok.lat = window.aktualisLat || null;
      adatok.lng = window.aktualisLng || null;

      // 5. Mentés
      if (szerkesztendoId) {
        const docRef = doc(adatbazis, "lakasok", szerkesztendoId);
        await updateDoc(docRef, adatok);
        alert("Sikeres módosítás!");
      } else {
        // Új létrehozása a 6 jegyű ID-val
        const docRef = doc(adatbazis, "lakasok", adatok.azon);
        await setDoc(docRef, adatok);

        alert(`Hirdetés sikeresen feladva!\nAzonosító: ${adatok.azon}`);
      }

      // 6. Frissítés
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

window.urlapUrites = function () {
  if (confirm("Biztosan törlöd az adatokat?")) {
    document.getElementById("hirdetes-urlap")?.reset();
  }
};
