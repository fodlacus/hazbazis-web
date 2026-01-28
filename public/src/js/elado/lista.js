// src/js/elado/lista.js

import {
  query,
  where, // <--- ENNEK ITT KELL LENNIE
  getDocs,
  collection,
  doc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { adatbazis, auth } from "../util/firebase-config.js";

// Törlés funkció
window.hirdetesTorlese = async function (id) {
  if (confirm("Biztosan véglegesen törlöd ezt a hirdetést?")) {
    try {
      await deleteDoc(doc(adatbazis, "lakasok", id));
      alert("Hirdetés sikeresen törölve!");
      location.reload();
    } catch (error) {
      console.error("Törlési hiba:", error);
      alert("Hiba történt a törlés során.");
    }
  }
};

// Listázás funkció
export async function hirdeteseimListazasa() {
  const listaKontener = document.getElementById("sajat-lista");
  if (!listaKontener) return;

  // Figyeljük a belépést
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      console.log("--- SZŰRÉS INDÍTÁSA ---");
      console.log("Jelenlegi felhasználó:", user.uid);

      try {
        const lakasokRef = collection(adatbazis, "lakasok");

        // --- ITT A LÉNYEG: HA EZ HIÁNYZIK, MINDEN LEJÖN ---
        const q = query(lakasokRef, where("hirdeto_uid", "==", user.uid));
        // --------------------------------------------------

        const querySnapshot = await getDocs(q);
        console.log("Találatok száma szűrés után:", querySnapshot.size);

        listaKontener.innerHTML = "";

        if (querySnapshot.empty) {
          listaKontener.innerHTML =
            '<p class="text-white/50 italic p-4">Nincs megjeleníthető saját hirdetésed.</p>';
          return;
        }

        querySnapshot.forEach((documentum) => {
          const hirdetes = documentum.data();
          const id = documentum.id;

          // Kártya összeállítása
          const kartya = document.createElement("div");
          kartya.className =
            "bg-white/5 p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-lime-400/30 transition-all mb-4";

          kartya.innerHTML = `
            <div class="flex-1 space-y-1">
               <span class="bg-lime-400/20 text-lime-400 text-[10px] px-2 py-1 rounded uppercase tracking-wider font-bold">
                    ${hirdetes.azon || id}
               </span>
                <h4 class="font-bold text-white text-lg">${
                  hirdetes.nev || "Név nélkül"
                }</h4>
                <p class="text-xs text-gray-400">${hirdetes.telepules || ""}</p>
                <p class="text-lime-400 font-mono text-lg font-bold">
                  ${Number(hirdetes.vételár || 0).toLocaleString()} Ft
                </p>
            </div>
            
            <div class="flex flex-col gap-2 min-w-[140px]">
                <button onclick="window.location.href='?id=${id}&mode=edit'" 
                        class="bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/20 transition-all border border-white/10">
                    Szerkesztés
                </button>
                <button onclick="hirdetesTorlese('${id}')" 
                        class="bg-red-500/10 text-red-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-all border border-red-500/20">
                    Törlés
                </button>
            </div>
        `;
          listaKontener.appendChild(kartya);
        });
      } catch (error) {
        console.error("Hiba:", error);
        listaKontener.innerHTML = `<p class="text-red-400 p-4">Hiba: ${error.message}</p>`;
      }
    } else {
      listaKontener.innerHTML =
        '<p class="text-yellow-400 p-4">Jelentkezz be!</p>';
    }
  });
}
