// src/js/elado/lista.js

import {
  query,
  where,
  getDocs,
  collection,
  doc,
  deleteDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis, auth } from "../util/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- TÖRLÉS FUNKCIÓ (CSAK VÁRÓLISTÁSHOZ!) ---
window.hirdetesTorlese = async function (id) {
  if (!confirm("Biztosan törlöd ezt a kérelmet?")) return;
  try {
    const varolistaRef = doc(adatbazis, "hirdetesek_varolista", id);
    await deleteDoc(varolistaRef);
    alert("Kérelem törölve.");
    hirdeteseimListazasa();
  } catch (error) {
    console.error(error);
    alert("Hiba: Csak a függőben lévő hirdetéseket törölheted.");
  }
};

// --- LISTÁZÁS ---
export async function hirdeteseimListazasa() {
  const listaKontener = document.getElementById("sajat-lista");
  if (!listaKontener) return;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      listaKontener.innerHTML =
        '<p class="text-white/50 p-4 animate-pulse">Betöltés...</p>';

      try {
        // 1. AKTÍV HIRDETÉSEK (READ ONLY)
        const aktivSnapshot = await getDocs(
          query(
            collection(adatbazis, "lakasok"),
            where("hirdeto_uid", "==", user.uid)
          )
        );

        // 2. VÁRÓLISTA (EDITABLE)
        const varolistaSnapshot = await getDocs(
          query(
            collection(adatbazis, "hirdetesek_varolista"),
            where("hirdeto_uid", "==", user.uid)
          )
        );

        listaKontener.innerHTML = "";

        if (aktivSnapshot.empty && varolistaSnapshot.empty) {
          listaKontener.innerHTML =
            '<p class="text-white/50 italic p-4">Nincs hirdetésed.</p>';
          return;
        }

        // --- KÁRTYA GENERÁLÓ ---
        const kartyaKeszito = (docSnap, isPending) => {
          const hirdetes = docSnap.data();
          const id = docSnap.id;

          // Kép kezelés
          let kepUrl =
            "https://placehold.co/150x150/3D4A16/E2F1B0?text=Nincs+kép";
          if (hirdetes.kepek_horiz?.[0])
            kepUrl = hirdetes.kepek_horiz[0].url || hirdetes.kepek_horiz[0];
          else if (hirdetes.kepek?.[0])
            kepUrl = hirdetes.kepek[0].url || hirdetes.kepek[0];

          // Adatok
          const ar = hirdetes.vételár || hirdetes.ar || 0;
          const statuszSzoveg = isPending
            ? "⏳ Jóváhagyásra vár"
            : "✅ Aktív (Nem módosítható)";
          const statuszSzin = isPending
            ? "text-yellow-400 bg-yellow-400/10"
            : "text-lime-400 bg-lime-400/10";
          const keretSzin = isPending
            ? "border-yellow-500/30"
            : "border-lime-500/30";

          // Lejárat kijelzése (ha aktív)
          let lejaratInfo = "";
          if (!isPending && hirdetes.lejarat_datum) {
            const hatralevoNap = Math.ceil(
              (new Date(hirdetes.lejarat_datum) - new Date()) /
                (1000 * 60 * 60 * 24)
            );
            lejaratInfo = `<span class="text-xs text-gray-400 ml-2">(${hatralevoNap} nap van hátra)</span>`;
          }

          const kartya = document.createElement("div");
          kartya.className = `bg-white/5 p-4 rounded-2xl border ${keretSzin} flex flex-col sm:flex-row gap-4 items-center mb-4 relative overflow-hidden`;

          // GOMBOK LOGIKÁJA (EZ A LÉNYEG!)
          let gombokHTML = "";

          if (isPending) {
            // VÁRÓLISTA: Minden gomb elérhető
            gombokHTML = `
                    <button disabled class="bg-white/5 text-gray-500 px-4 py-2 rounded-xl text-xs font-bold border border-white/5 cursor-not-allowed">
                        Még nem publikus
                    </button>
                    <button onclick="window.location.href='?id=${id}&mode=edit'" class="bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/20 border border-white/10">
                        Szerkesztés
                    </button>
                    <button onclick="hirdetesTorlese('${id}')" class="bg-red-500/10 text-red-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-500/20 border border-red-500/20">
                        Törlés
                    </button>
                `;
          } else {
            // AKTÍV: CSAK NÉZÉS, NINCS SZERKESZTÉS/TÖRLÉS
            gombokHTML = `
                    <button onclick="window.location.href='../vevo/adatlap.html?id=${id}'" class="bg-lime-400/10 text-lime-400 px-6 py-2 rounded-xl text-sm font-bold hover:bg-lime-400 hover:text-black border border-lime-400/20 w-full sm:w-auto">
                        Megtekintés
                    </button>
                    <div class="text-[10px] text-gray-500 text-center mt-2 sm:mt-0 max-w-[120px]">
                        Módosításhoz vedd fel a kapcsolatot az ügyfélszolgálattal.
                    </div>
                `;
          }

          kartya.innerHTML = `
                <div class="w-full sm:w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-black/20 relative">
                    <img src="${kepUrl}" class="w-full h-full object-cover">
                </div>

                <div class="flex-1 w-full text-center sm:text-left">
                    <div class="flex flex-wrap gap-2 justify-center sm:justify-start mb-1">
                        <span class="${statuszSzin} text-[10px] px-2 py-1 rounded uppercase font-bold">${statuszSzoveg}</span>
                        ${lejaratInfo}
                    </div>
                    <h4 class="font-bold text-white truncate">${
                      hirdetes.telepules
                    }, ${hirdetes.utca || ""}</h4>
                    <p class="text-lime-400 font-mono text-lg font-bold">${Number(
                      ar
                    ).toLocaleString()} Ft</p>
                </div>
                
                <div class="flex flex-col gap-2 w-full sm:w-auto items-center justify-center">
                    ${gombokHTML}
                </div>
            `;
          listaKontener.appendChild(kartya);
        };

        varolistaSnapshot.forEach((doc) => kartyaKeszito(doc, true));
        aktivSnapshot.forEach((doc) => kartyaKeszito(doc, false));
      } catch (error) {
        console.error(error);
      }
    }
  });
}
