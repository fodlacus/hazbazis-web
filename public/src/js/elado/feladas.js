// src/js/elado/feladas.js

// 1. EGYSÉGES IMPORT: Mindent a configból (vagy ha onnan nem exportáltuk, akkor a CDN-ről, de következetesen)
import {
  adatbazis,
  auth,
  collection,
  addDoc,
  doc,
  updateDoc, // Ezeket exportáltuk a configból? Ha igen, használd onnan. Ha nem, akkor a lenti CDN sor kell.
} from "../util/firebase-config.js";

// Ha a configból nem exportáltad az updateDoc-ot, akkor ez kell, DE az 'adatbazis' példányt mindenképp a configból használd!
// (Feltételezem a configban exportáltad a metódusokat is, ahogy tegnap beszéltük)

import { szerkesztendoId } from "./szerkesztes.js";
import { budapestAdatok } from "../util/helyszin-adatok.js";

// Helyszínfigyelő (Automatikusan fusson le, ha az oldal betöltött)
window.addEventListener("DOMContentLoaded", () => {
  helyszinFigyelo();
});

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

function adatokOsszegyujtese() {
  const adatok = {};
  const generalAzonosito = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `teras-${timestamp}`;
  };

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
      // Üres stringet ne mentsünk feleslegesen
      adatok[id] = ertek;
    }
  });

  // JAVÍTÁS: Ellenőrizzük, hogy van-e auth.currentUser
  if (!auth.currentUser) {
    alert("Hiba: Nem vagy bejelentkezve!");
    throw new Error("Nincs bejelentkezett felhasználó");
  }

  adatok.hirdeto_uid = auth.currentUser.uid;
  adatok.letrehozva = new Date().toISOString();
  adatok.statusz = "Feldolgozás alatt";
  adatok.azon = generalAzonosito();

  // GPS (Ha az ai-bridge.js beállította)
  adatok.lat = window.aktualisLat || null;
  adatok.lng = window.aktualisLng || null;

  return adatok;
}

// Eseménykezelő felcsatolása (Csak ha létezik az űrlap)
const urlap = document.getElementById("hirdetes-urlap");
if (urlap) {
  urlap.onsubmit = async (e) => {
    e.preventDefault();
    const mentesGomb = document.getElementById("hirdetes-bekuldes");
    if (mentesGomb) {
      mentesGomb.disabled = true;
      mentesGomb.innerText = "Mentés...";
    }

    try {
      const adatok = adatokOsszegyujtese();

      if (szerkesztendoId) {
        const docRef = doc(adatbazis, "lakasok", szerkesztendoId);
        await updateDoc(docRef, adatok);
        alert("Módosítások mentve!");
      } else {
        await addDoc(collection(adatbazis, "lakasok"), adatok);
        alert("Új hirdetés sikeresen rögzítve!");
      }

      window.location.href = window.location.pathname;
    } catch (error) {
      console.error("Hiba a mentés során:", error);
      alert("Hiba történt a mentéskor: " + error.message);
    } finally {
      if (mentesGomb) {
        mentesGomb.disabled = false;
        mentesGomb.innerText = "Hirdetés beküldése";
      }
    }
  };
}

window.urlapUrites = function () {
  if (confirm("Biztosan törlöd az összes beírt adatot?")) {
    const urlap = document.getElementById("hirdetes-urlap");
    if (urlap) {
      urlap.reset();
      document
        .querySelectorAll(".bevitel")
        .forEach((el) => (el.style.backgroundColor = ""));
    }
  }
};
