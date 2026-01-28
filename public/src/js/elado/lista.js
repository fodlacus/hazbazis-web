import {
  query,
  where,
  orderBy, // <--- ÚJ: Ezt importálni kell a rendezéshez!
  getDocs,
  collection,
  doc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { adatbazis, auth } from "../util/firebase-config.js";

// --- GLOBÁLIS FUNKCIÓK ---

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

// --- LISTÁZÓ MODUL ---

export async function hirdeteseimListazasa() {
  const listaKontener = document.getElementById("sajat-lista");
  if (!listaKontener) return;

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const lakasokRef = collection(adatbazis, "lakasok");

        // ITT A LÉNYEG: Szűrés a felhasználóra + Rendezés dátum szerint (csökkenő)
        const q = query(
          lakasokRef,
          where("hirdeto_uid", "==", user.uid),
          orderBy("letrehozva", "desc") // <--- Legújabb elöl
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          listaKontener.innerHTML =
            '<p class="text-xs opacity-40 italic p-4">Még nincsenek rögzített hirdetéseid.</p>';
          return;
        }

        listaKontener.innerHTML = "";

        querySnapshot.forEach((documentum) => {
          const hirdetes = documentum.data();
          const id = documentum.id;

          const kartya = document.createElement("div");
          kartya.className =
            "bg-white/5 p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-lime-400/30 transition-all mb-4";

          kartya.innerHTML = `
            <div class="flex-1 space-y-1">
               <p class="font-bold text-white text-xs tracking-widest bg-white/10 inline-block px-2 py-1 rounded">
                    ${hirdetes.azon || id}
               </p>

                <h4 class="font-bold text-lime-400 text-lg">
                  ${hirdetes.nev || "Név nélkül"}
                </h4>
                
                <p class="text-xs opacity-70">
                  ${hirdetes.telepules || ""} ${
            hirdetes.varosresz ? "- " + hirdetes.varosresz : ""
          }
                </p>
                
                <p class="text-sm font-semibold text-white">
                  ${Number(hirdetes.vételár || 0).toLocaleString()} Ft
                </p>
            </div>
            
            <div class="flex flex-col gap-2 min-w-[150px]">
                <button onclick="window.location.href='?id=${id}&mode=view'" 
                        class="bg-lime-400/10 border border-lime-400/50 text-lime-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-lime-400 hover:text-black transition-all">
                    Megtekintés
                </button>
        
                <button onclick="window.location.href='?id=${id}&mode=edit'" 
                        class="bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/20 transition-all">
                    Szerkesztés
                </button>
        
                <button onclick="hirdetesTorlese('${id}')" 
                        class="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-600 hover:text-white transition-all">
                    Törlés
                </button>
            </div>
        `;

          listaKontener.appendChild(kartya);
        });
      } catch (error) {
        console.error("Hiba a listázásnál:", error);

        // FONTOS: Ha indexelési hiba van (mert hozzáadtuk az orderBy-t)
        if (error.message.includes("index")) {
          console.warn(
            "KATTINTS A LINKRE A KONZOLBAN AZ INDEX LÉTREHOZÁSÁHOZ!"
          );
        }

        listaKontener.innerHTML =
          '<p class="text-xs text-red-400 p-4">Hiba történt a betöltéskor. (Lásd a konzolt)</p>';
      }
    } else {
      listaKontener.innerHTML =
        '<p class="text-xs text-yellow-400 p-4">Jelentkezz be a hirdetéseidhez!</p>';
    }
  });
}
