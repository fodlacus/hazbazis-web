// src/js/elado/lista.js

import {
  query,
  where,
  getDocs,
  collection,
  doc,
  deleteDoc,
  orderBy,
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

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const lakasokRef = collection(adatbazis, "lakasok");

        // Szűrés a saját hirdetésekre
        const q = query(lakasokRef, where("hirdeto_uid", "==", user.uid));

        const querySnapshot = await getDocs(q);

        listaKontener.innerHTML = "";

        if (querySnapshot.empty) {
          listaKontener.innerHTML =
            '<p class="text-white/50 italic p-4">Nincs rögzített hirdetésed.</p>';
          return;
        }

        querySnapshot.forEach((documentum) => {
          const hirdetes = documentum.data();
          const id = documentum.id;

          // --- FOTÓ JAVÍTÁS (OKOS VERZIÓ) ---
          let kepUrl =
            "https://placehold.co/150x150/3D4A16/E2F1B0?text=Nincs+kép";

          // Ugyanaz a sorrend, mint a térképnél
          if (hirdetes.kepek_horiz && hirdetes.kepek_horiz.length > 0) {
            kepUrl = hirdetes.kepek_horiz[0].url || hirdetes.kepek_horiz[0];
          } else if (hirdetes.kepek_vert && hirdetes.kepek_vert.length > 0) {
            kepUrl = hirdetes.kepek_vert[0].url || hirdetes.kepek_vert[0];
          } else if (hirdetes.kepek && hirdetes.kepek.length > 0) {
            kepUrl = hirdetes.kepek[0].url || hirdetes.kepek[0];
          }

          const kartya = document.createElement("div");

          // Flexbox elrendezés: Kép balra, szöveg középen, gombok jobbra
          kartya.className =
            "bg-white/5 p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row gap-4 items-center hover:border-lime-400/30 transition-all mb-4";

          kartya.innerHTML = `
            <div class="w-full sm:w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-black/20 border border-white/5">
                <img src="${kepUrl}" alt="Ingatlan kép" class="w-full h-full object-cover">
            </div>

            <div class="flex-1 w-full text-center sm:text-left space-y-1">
               <span class="bg-lime-400/20 text-lime-400 text-[10px] px-2 py-1 rounded uppercase tracking-wider font-bold">
                    ${hirdetes.azon || id}
               </span>

                <h4 class="font-bold text-white text-base truncate">
                  ${hirdetes.nev || "Név nélküli ingatlan"}
                </h4>
                
                <p class="text-xs text-gray-400">
                  ${hirdetes.telepules || ""} ${
            hirdetes.varosresz ? "- " + hirdetes.varosresz : ""
          }
                </p>
                
                <p class="text-lime-400 font-mono text-lg font-bold">
                  ${Number(hirdetes.vételár || 0).toLocaleString()} Ft
                </p>
            </div>
            
            <div class="flex flex-row sm:flex-col gap-2 w-full sm:w-auto justify-center">
                <button onclick="window.location.href='../../vevo/adatlap.html?id=${id}'" 
                        class="bg-lime-400/10 text-lime-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-lime-400 hover:text-black transition-all border border-lime-400/20">
                    Megtekintés
                </button>
        
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
        listaKontener.innerHTML = `<p class="text-red-400 p-4">Hiba történt: ${error.message}</p>`;
      }
    } else {
      listaKontener.innerHTML =
        '<p class="text-yellow-400 p-4">Jelentkezz be a hirdetéseid megtekintéséhez!</p>';
    }
  });
}
