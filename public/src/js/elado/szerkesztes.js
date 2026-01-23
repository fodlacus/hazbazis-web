import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

const urlParams = new URLSearchParams(window.location.search);
export const szerkesztendoId = urlParams.get("id");
const mod = urlParams.get("mode"); // 'view' vagy 'edit'

export async function adatokBetolteseSzerkeszteshez() {
  if (!szerkesztendoId) return;

  try {
    const docRef = doc(adatbazis, "lakasok", szerkesztendoId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const adat = docSnap.data();

      // Mezők feltöltése az ID-k alapján
      Object.keys(adat).forEach((kulcs) => {
        const mezo = document.getElementById(kulcs);
        if (mezo) {
          if (mezo.type === "checkbox") mezo.checked = adat[kulcs];
          else mezo.value = adat[kulcs];
        }
      });

      // Speciális eset: Kerület/Városrész szinkronizálása
      const keruletMezo = document.getElementById("kerulet");
      if (keruletMezo) {
        keruletMezo.dispatchEvent(new Event("change"));
        setTimeout(() => {
          const vResz = document.getElementById("varosresz");
          if (vResz) vResz.value = adat.varosresz;
        }, 100);
      }

      // --- LEKÉRDEZÉS MÓD KEZELÉSE ---
      if (mod === "view") {
        // Cím módosítása
        const cim = document.getElementById("urlap-cim");
        if (cim)
          cim.innerHTML =
            'Ingatlan <span style="color: #E2F1B0;">megtekintése</span>';

        // Mentés gomb elrejtése
        const mentesGomb = document.getElementById("bekuldo-gomb");
        if (mentesGomb) mentesGomb.style.display = "none";

        // Minden beviteli mező letiltása
        const mezok = document.querySelectorAll(
          "#hirdetes-urlap input, #hirdetes-urlap select, #hirdetes-urlap textarea"
        );
        mezok.forEach((mezo) => {
          mezo.disabled = true;
          mezo.style.opacity = "0.8"; // Hogy olvasható maradjon, de jelezze a zárolást
        });
      } else {
        // SZERKESZTÉS MÓD (feliratok átírása)
        const cim = document.getElementById("urlap-cim");
        if (cim)
          cim.innerHTML =
            'Ingatlan <span style="color: #E2F1B0;">módosítása</span>';

        const mentesGomb = document.getElementById("bekuldo-gomb");
        if (mentesGomb) mentesGomb.innerText = "Módosítások mentése";
      }
    }
  } catch (error) {
    console.error("Hiba az adatok betöltésekor:", error);
  }
}
