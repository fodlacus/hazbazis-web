import {
  adatbazis,
  collection,
  addDoc,
  auth,
} from "../util/firebase-config.js";
import {
  updateDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { szerkesztendoId } from "./szerkesztes.js"; // 1. Logika a dinamikus városrész-választóhoz
import { budapestAdatok } from "../util/helyszin-adatok.js";

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
    const timestamp = Date.now().toString().slice(-6); // Az időbélyeg utolsó 6 számjegye
    return `teras-${timestamp}`;
  };

  // CSAK a valódi beviteli mezőket keressük ki (input, select, textarea)
  const mezok = document.querySelectorAll(
    "#hirdetes-urlap input, #hirdetes-urlap select, #hirdetes-urlap textarea"
  );

  mezok.forEach((mezo) => {
    const id = mezo.id;
    if (!id) return; // Ha nincs ID-ja a mezőnek, hagyjuk ki

    let ertek = mezo.value;

    // Szám típusú mezők kezelése
    if (["vételár", "alapterület", "szobák"].includes(id)) {
      ertek = Number(String(ertek).replace(/[^0-9]/g, "")) || 0;
    }

    // Checkbox kezelése
    if (mezo.type === "checkbox") {
      ertek = mezo.checked;
    }

    // CSAK akkor adjuk hozzá, ha az érték nem undefined
    if (ertek !== undefined) {
      adatok[id] = ertek;
    }
  });

  // Kötelező metaadatok (ezek mindig kellenek)
  adatok.hirdeto_uid = auth.currentUser?.uid || "ismeretlen";
  adatok.letrehozva = new Date().toISOString();
  adatok.statusz = "Feldolgozás alatt";
  adatok.azon = generalAzonosito();

  // ÚJ MEZŐK: GPS koordináták átvétele a globális ablakból
  adatok.lat = window.aktualisLat || null;
  adatok.lng = window.aktualisLng || null;

  return adatok;
}

document.getElementById("hirdetes-urlap").onsubmit = async (e) => {
  e.preventDefault();
  const mentesGomb = document.getElementById("hirdetes-bekuldes");
  if (mentesGomb) mentesGomb.disabled = true;

  try {
    const adatok = adatokOsszegyujtese();

    if (szerkesztendoId) {
      // 1. ESET: MÓDOSÍTÁS (ha van ID az URL-ben)
      const docRef = doc(adatbazis, "lakasok", szerkesztendoId);
      await updateDoc(docRef, adatok);
      alert("Módosítások mentve!");
    } else {
      // 2. ESET: ÚJ RÖGZÍTÉS (ha nincs ID, vagy gyors-kitöltést használtunk)
      await addDoc(collection(adatbazis, "lakasok"), adatok);
      alert("Új hirdetés sikeresen rögzítve!");
    }

    // MINDEN ESETBEN: Visszaállunk az alapállapotba (paraméterek nélküli URL)
    // Ez üríti ki az űrlapot és állítja vissza "Új rögzítés" módba a rendszert.
    window.location.href = window.location.pathname;
  } catch (error) {
    console.error("Hiba a mentés során:", error);
    alert("Hiba történt a mentéskor: " + error.message);
  } finally {
    gomb.disabled = false;
  }
};

window.urlapUrites = function () {
  if (confirm("Biztosan törlöd az összes beírt adatot?")) {
    const urlap = document.getElementById("hirdetes-urlap");
    if (urlap) {
      urlap.reset();
      // A sárga/zöld háttérszíneket is leszedjük, ha maradtak
      document
        .querySelectorAll(".bevitel")
        .forEach((el) => (el.style.backgroundColor = ""));
      console.log("Űrlap alaphelyzetbe állítva.");
    }
  }
};
