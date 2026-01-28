// src/js/elado/feladas.js

// 1. IMPORTÁLÁS - A JAVÍTOTT VERZIÓ (Külön importálva a parancsok)
import { adatbazis, auth } from "../util/firebase-config.js";

import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  collection,
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

// --- VISSZAÁLLÍTVA A RÉGI FORMÁTUMRA ---
// Hirdetés azonosító generálása (Most újra HB- lesz az eleje!)
function generalHirdetesAzonosito() {
  const timestamp = Date.now().toString().slice(-4);
  const random = Math.floor(1000 + Math.random() * 9000);
  // Visszatettem a "HB-" prefixet, hogy illeszkedjen a listádhoz
  return `HB-${timestamp}${random}`;
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

      // 2. USER PROFIL LEKÉRDEZÉSE (hogy meglegyen a 'hb-...' user ID)
      const userDocRef = doc(adatbazis, "felhasznalok", currentUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        throw new Error("A felhasználói profil nem található!");
      }

      const userData = userSnap.data();
      const hirdetoEgyediAzonosito = userData.azon; // Ez a user 'hb-...' azonosítója

      // 3. Adatok begyűjtése
      const adatok = adatokOsszegyujtese();

      // 4. Kiegészítés
      adatok.hirdeto_azon = hirdetoEgyediAzonosito; // Ez a "Ki hirdeti?"
      adatok.hirdeto_uid = currentUser.uid;
      adatok.letrehozva = new Date().toISOString();
      adatok.statusz = "Feldolgozás alatt";

      // --- ITT A JAVÍTÁS: HB-s azonosító generálása ---
      if (!szerkesztendoId) {
        // A dokumentum ID-ja újra HB- kezdetű lesz
        adatok.azon = generalHirdetesAzonosito();
        // Ha a régi rendszerben az 'azon' mezőt használtad, akkor ez így jó.
        // A képen láttam 'lakas_azon'-t is, ha egységesíteni akarod, használd ezt is:
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
        // Új létrehozása: A dokumentum neve = adatok.azon (ami most már HB-...)
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
