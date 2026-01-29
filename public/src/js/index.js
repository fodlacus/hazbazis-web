// src/js/index.js
import { adatbazis } from "./util/firebase-config.js";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. KERESÉS INDÍTÁSA (Globális függvény)
window.inditsKeresest = function () {
  const mezo = document.getElementById("fooldali-ai-kereso");
  if (!mezo) return;

  const kulcsszo = mezo.value.trim();

  // Átirányítás a kereső oldalra a keresési paraméterrel
  // Ellenőrizd: Ha a kereső oldalad neve más, írd át itt is!
  window.location.href = `src/html/vevo/kereses.html?kereses=${encodeURIComponent(
    kulcsszo
  )}`;
};

// Enter gomb figyelése a keresőmezőben
document.addEventListener("DOMContentLoaded", () => {
  const mezo = document.getElementById("fooldali-ai-kereso");
  if (mezo) {
    mezo.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        window.inditsKeresest();
      }
    });
  }

  // Kiemelt ajánlatok betöltése
  kiemeltAjanlatokBetoltese();
});

// 2. KIEMELT AJÁNLATOK (A főoldal alján)
async function kiemeltAjanlatokBetoltese() {
  const kontener = document.getElementById("kiemelt-lista");
  if (!kontener) return;

  try {
    const q = query(
      collection(adatbazis, "lakasok"),
      orderBy("letrehozva", "desc"), // Legfrissebbek elöl
      limit(4) // Csak 4 db
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      kontener.innerHTML =
        '<p class="text-white/50 col-span-4 text-center">Jelenleg nincs kiemelt ajánlat.</p>';
      return;
    }

    kontener.innerHTML = ""; // Loader törlése

    snapshot.forEach((doc) => {
      const adat = doc.data();

      // FOTÓ KEZELÉS: Ha nincs kép, placeholder-t teszünk be
      // Fontos: Az adatbázisban a 'kepek' tömböt keressük!
      const boritokep =
        adat.kepek && adat.kepek.length > 0
          ? adat.kepek[0]
          : "https://placehold.co/600x400/3D4A16/E2F1B0?text=Nincs+kép";

      const kartya = document.createElement("div");
      kartya.className =
        "bg-white/5 rounded-3xl overflow-hidden border border-white/10 hover:border-lime-400/50 transition-all group";

      kartya.innerHTML = `
                <div class="h-48 overflow-hidden relative">
                    <img src="${boritokep}" alt="${
        adat.nev
      }" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                    <div class="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs font-bold text-lime-400">
                        ${
                          adat.ar
                            ? Number(adat.ar).toLocaleString() + " Ft"
                            : "Ár nélkül"
                        }
                    </div>
                </div>
                <div class="p-5">
                    <h4 class="font-bold text-white text-lg mb-1 truncate">${
                      adat.nev || "Ingatlan"
                    }</h4>
                    <p class="text-xs text-gray-400 mb-3">${
                      adat.telepules || ""
                    } ${adat.varosresz ? "- " + adat.varosresz : ""}</p>
                    <a href="src/html/vevo/adatlap.html?id=${
                      doc.id
                    }" class="block w-full text-center bg-white/10 hover:bg-lime-400 hover:text-black py-2 rounded-xl text-sm font-bold transition-all">
                        Megtekintés
                    </a>
                </div>
            `;
      kontener.appendChild(kartya);
    });
  } catch (error) {
    console.error("Hiba a kiemelt ajánlatoknál:", error);
  }
}
