// src/js/index.js
import { adatbazis } from "./util/firebase-config.js";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. KERESÉS INDÍTÁSA (Globális függvény)
window.inditsKeresest = function () {
  const mezo = document.getElementById("fooldali-ai-kereso");
  if (!mezo) return;

  const kulcsszo = mezo.value.trim();

  // JAVÍTVA: Most már az ai-filter.html-re visz!
  window.location.href = `src/html/vevo/ai-filter.html?kereses=${encodeURIComponent(
    kulcsszo
  )}`;
};

// Enter gomb figyelése
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

// HB KÓD ALAPJÚ KERESÉS
window.inditsHBKeresest = async function () {
  const input = document.getElementById("hb-kereso-input");
  let kod = input.value.trim();
  if (!kod) return;

  // Ha a user nem írta be, hogy "HB-", de csak számot írt, akkor kezeljük rugalmasan
  // De mivel az adatbázisban "HB-123456" formátumban lehet, vagy csak simán "123456"?
  // Feltételezem, hogy a teljes kódot tároljuk az 'azon' mezőben (pl. "HB-407050").

  // Ha a user csak számot írt, tegyük elé a HB-t
  if (!kod.toLowerCase().startsWith("hb-")) {
    kod = "HB-" + kod;
  }

  // Átirányítás az adatlapra (de előbb lekérhetnénk az ID-t, vagy az adatlap keresse meg?)
  // A legegyszerűbb, ha az adatlapot felokosítjuk, hogy kezelje a ?azon=HB-123 paramétert is!
  // DE, mivel az adatlap most ID-t vár, csináljunk itt egy gyors lekérdezést:

  try {
    const q = query(collection(adatbazis, "lakasok"), where("azon", "==", kod));
    const snap = await getDocs(q);

    if (!snap.empty) {
      // Megvan! Irány az adatlap a dokumentum ID-val
      const docId = snap.docs[0].id;
      window.location.href = `src/html/vevo/adatlap.html?id=${docId}`;
    } else {
      alert("Nem található ingatlan ezzel az azonosítóval: " + kod);
    }
  } catch (e) {
    console.error("Hiba a keresésben:", e);
  }
};

// 2. KIEMELT AJÁNLATOK
async function kiemeltAjanlatokBetoltese() {
  const kontener = document.getElementById("kiemelt-lista");
  if (!kontener) return;

  try {
    const q = query(
      collection(adatbazis, "lakasok"),
      orderBy("letrehozva", "desc"),
      limit(4)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      kontener.innerHTML =
        '<p class="text-white/50 col-span-4 text-center">Jelenleg nincs kiemelt ajánlat.</p>';
      return;
    }

    kontener.innerHTML = "";

    snapshot.forEach((doc) => {
      const adat = doc.data();

      // Ha nincs kép, placeholder-t használunk
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
