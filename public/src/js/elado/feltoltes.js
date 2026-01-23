import { lakasok_gyujtemeny, addDoc, auth } from "../util/firebase-config.js";
import { ingatlanStruktura } from "../util/ingatlan-szotar.js";
import { budapestAdatok } from "../util/helyszin-adatok.js";

export function helyszinFigyelo() {
  const keruletSelect = document.getElementById("kerulet");
  const varosreszSelect = document.getElementById("varosresz");

  if (keruletSelect && varosreszSelect) {
    keruletSelect.addEventListener("change", () => {
      const valasztottKerulet = keruletSelect.value;
      const reszek = budapestAdatok[valasztottKerulet] || [];

      // Lista ürítése és újratöltése
      varosreszSelect.innerHTML = reszek
        .map((r) => `<option value="${r}">${r}</option>`)
        .join("");

      if (reszek.length === 0) {
        varosreszSelect.innerHTML = '<option value="">Nincs adat</option>';
      }
    });
  }
}

// 1. Dinamikus adatgyűjtő függvény
function adatokOsszegyujtese() {
  const adatok = {};

  // Végigmegyünk a szótár minden kategóriáján és mezőjén
  Object.keys(ingatlanStruktura).forEach((szekcioKulcs) => {
    const szekcio = ingatlanStruktura[szekcioKulcs];

    szekcio.mezok.forEach((mezo) => {
      const elem = document.getElementById(mezo.id);
      if (elem) {
        // Típustól függő értékmentés
        if (mezo.type === "number") {
          adatok[mezo.id] = Number(elem.value) || 0;
        } else if (mezo.type === "checkbox") {
          adatok[mezo.id] = elem.checked;
        } else {
          adatok[mezo.id] = elem.value;
        }
      }
    });
  });

  return adatok;
}

// 2. Az űrlap mentési eseménye
const urlap = document.getElementById("hirdetes-urlap");

if (urlap) {
  urlap.onsubmit = async (e) => {
    e.preventDefault(); // Megállítjuk az oldal újratöltését

    const gomb = e.target.querySelector('button[type="submit"]');
    gomb.disabled = true;
    gomb.innerText = "Mentés folyamatban...";

    // Adatok összeszedése a dinamikus mezőkből
    const ingatlanAdatok = adatokOsszegyujtese();

    // Rendszeradatok hozzáadása
    const veglegesAdat = {
      ...ingatlanAdatok,
      hirdeto_uid: auth.currentUser ? auth.currentUser.uid : "vendeg_user",
      hirdeto_email: auth.currentUser
        ? auth.currentUser.email
        : "nincs_bejelentkezve",
      letrehozva: new Date().toISOString(),
      statusz: "Aktív",
    };

    try {
      // Mentés a Firebase-be (a lakasok gyűjteménybe)
      await addDoc(lakasok_gyujtemeny, veglegesAdat);

      alert("Sikeresen mentettük az ingatlant!");
      // Visszairányítás az admin felületre
      window.location.href = "../admin/dashboard.html";
    } catch (hiba) {
      console.error("Firebase mentési hiba:", hiba);
      alert("Hiba történt: " + hiba.message);
    } finally {
      gomb.disabled = false;
      gomb.innerText = "Hirdetés véglegesítése";
    }
  };
}
