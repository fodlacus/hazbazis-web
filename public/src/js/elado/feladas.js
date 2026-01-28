// src/js/elado/feladas.js

// 1. IMPORTÁLÁS
import {
  adatbazis,
  auth,
  doc,
  setDoc, // Új létrehozásához
  updateDoc, // Meglévő frissítéséhez
  getDoc, // <--- EZ KELL A USER PROFIL OLVASÁSÁHOZ
} from "../util/firebase-config.js";

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

// Lakás egyedi azonosító generálása (Pl. LAKAS-1234)
// Ez a DOKUMENTUM NEVE lesz, nem keverendő össze a felhasználó "hb-" azonosítójával
function generalLakasAzonosito() {
  const timestamp = Date.now().toString().slice(-4);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `LAKAS-${timestamp}${random}`;
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
      // 1. Ellenőrzés: Be van lépve?
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Nincs bejelentkezett felhasználó!");
      }

      // 2. USER PROFIL LEKÉRDEZÉSE (Itt szerezzük meg a hb-... azonosítót)
      // Feltételezzük, hogy a 'felhasznalok' kollekcióban a dokumentum neve = auth.uid
      const userDocRef = doc(adatbazis, "felhasznalok", currentUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        throw new Error("A felhasználói profil nem található az adatbázisban!");
      }

      const userData = userSnap.data();
      // Itt vesszük ki a 'hb-...' azonosítót a user profiljából
      const hirdetoEgyediAzonosito = userData.azon;

      if (!hirdetoEgyediAzonosito) {
        console.warn(
          "A felhasználónak nincs 'azon' mezője, generálás szükséges lenne?"
        );
        // Ha nagyon szigorúak vagyunk, itt hibát is dobhatunk
      }

      // 3. Űrlap adatok begyűjtése
      const adatok = adatokOsszegyujtese();

      // --- 4. ADATOK KIEGÉSZÍTÉSE ---

      // Elmentjük a User "hb-..." azonosítóját a lakásba!
      // Fontos: 'hirdeto_azon' nevet adtam neki, hogy tiszta legyen
      adatok.hirdeto_azon = hirdetoEgyediAzonosito;

      // Elmentjük a technikai UID-t is (biztonsági okokból jó, ha megvan)
      adatok.hirdeto_uid = currentUser.uid;

      adatok.letrehozva = new Date().toISOString();
      adatok.statusz = "Feldolgozás alatt";

      // Ha új lakás, kell neki saját azonosító (ami a doksi neve lesz)
      if (!szerkesztendoId) {
        adatok.lakas_azon = generalLakasAzonosito();
      }

      // GPS (ha van)
      adatok.lat = window.aktualisLat || null;
      adatok.lng = window.aktualisLng || null;

      // 5. MENTÉS AZ ADATBÁZISBA
      if (szerkesztendoId) {
        // Frissítés
        const docRef = doc(adatbazis, "lakasok", szerkesztendoId);
        await updateDoc(docRef, adatok);
        alert("Sikeres módosítás!");
      } else {
        // Új létrehozása
        // A dokumentum neve a lakás saját azonosítója lesz
        const docRef = doc(adatbazis, "lakasok", adatok.lakas_azon);
        await setDoc(docRef, adatok);
        alert(
          `Hirdetés sikeresen feladva!\nHirdető kódja: ${hirdetoEgyediAzonosito}`
        );
      }

      // 6. TISZTÍTÁS
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
