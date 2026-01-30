// src/js/index.js

import { adatbazis } from "./util/firebase-config.js";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where, // Ez kellett, és most már itt van!
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==============================================
// 1. ÁLTALÁNOS AI KERESÉS (Nagy mező)
// ==============================================
window.inditsKeresest = function () {
  const mezo = document.getElementById("fooldali-ai-kereso");
  if (!mezo) return;

  const kulcsszo = mezo.value.trim();

  // Átirányítás az AI szűrő oldalra
  window.location.href = `src/html/vevo/ai-filter.html?kereses=${encodeURIComponent(
    kulcsszo
  )}`;
};

// Enter figyelése a nagy mezőn
document.addEventListener("DOMContentLoaded", () => {
  const mezo = document.getElementById("fooldali-ai-kereso");
  if (mezo) {
    mezo.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        window.inditsKeresest();
      }
    });
  }

  // Kiemelt ajánlatok betöltése indításkor
  kiemeltAjanlatokBetoltese();
});

// ==============================================
// 2. HB KÓD KERESÉS (Kis mező a menüben/hero-ban)
// ==============================================
window.inditsHBKeresest = async function () {
  const input = document.getElementById("hb-kereso-input");
  if (!input) return;

  let kod = input.value.trim();
  if (!kod) {
    alert("Kérlek adj meg egy azonosítót!");
    return;
  }

  // Ha a felhasználó csak a számot írta be (pl. "407050"), tegyük elé a "HB-"-t
  // A toUpperCase() segít, ha valaki kisbetűvel írja (pl. "hb-123")
  if (!kod.toUpperCase().startsWith("HB-")) {
    kod = "HB-" + kod;
  }

  console.log("🔍 HB Keresés indítása erre:", kod);

  try {
    const lakasokRef = collection(adatbazis, "lakasok");
    // Itt használjuk a 'where'-t, amit importáltunk
    const q = query(lakasokRef, where("azon", "==", kod));

    const snap = await getDocs(q);

    if (!snap.empty) {
      // Megvan az ingatlan! Lekérjük az ID-ját (pl. LAKAS-1234...)
      const docId = snap.docs[0].id;
      console.log("✅ Találat! Átirányítás az adatlapra:", docId);

      // Átirányítás az adatlapra
      window.location.href = `src/html/vevo/adatlap.html?id=${docId}`;
    } else {
      alert(`Nem található ingatlan ezzel az azonosítóval: ${kod}`);
    }
  } catch (error) {
    console.error("Hiba a HB keresésben:", error);
    alert("Hiba történt a keresés során. Lásd a konzolt.");
  }
};

// ==============================================
// 3. KIEMELT AJÁNLATOK BETÖLTÉSE
// ==============================================
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

      // Kép kezelés (okos keresés)
      let boritokep =
        "https://placehold.co/600x400/3D4A16/E2F1B0?text=Nincs+kép";

      const getUrl = (item) => (typeof item === "object" ? item.url : item);

      if (adat.kepek_horiz && adat.kepek_horiz.length > 0) {
        boritokep = getUrl(adat.kepek_horiz[0]);
      } else if (adat.kepek && adat.kepek.length > 0) {
        boritokep = getUrl(adat.kepek[0]);
      }

      const kartya = document.createElement("div");
      kartya.className =
        "bg-white/5 rounded-3xl overflow-hidden border border-white/10 hover:border-lime-400/50 transition-all group cursor-pointer";

      // Kattintásra vigyen az adatlapra
      kartya.onclick = () => {
        window.location.href = `src/html/vevo/adatlap.html?id=${doc.id}`;
      };

      kartya.innerHTML = `
                <div class="h-48 overflow-hidden relative">
                    <img src="${boritokep}" alt="${
        adat.nev
      }" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                    <div class="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs font-bold text-lime-400">
                        ${
                          adat.vételár
                            ? Number(adat.vételár).toLocaleString() + " Ft"
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
                    <div class="block w-full text-center bg-white/10 hover:bg-lime-400 hover:text-black py-2 rounded-xl text-sm font-bold transition-all">
                        Megtekintés
                    </div>
                </div>
            `;
      kontener.appendChild(kartya);
    });
  } catch (error) {
    console.error("Hiba a kiemelt ajánlatoknál:", error);
  }
}
