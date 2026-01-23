import {
  query,
  where,
  getDocs,
  collection,
  doc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { adatbazis, auth } from "../util/firebase-config.js";

// --- GLOBÁLIS FUNKCIÓK (hogy a HTML gombok elérjék) ---

window.hirdetesTorlese = async function (id) {
  if (confirm("Biztosan véglegesen törlöd ezt a hirdetést?")) {
    try {
      await deleteDoc(doc(adatbazis, "lakasok", id));
      alert("Hirdetés sikeresen törölve!");
      location.reload(); // Frissítjük a listát
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

  // Megvárjuk, amíg az Auth rendszer azonosítja a felhasználót
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const lakasokRef = collection(adatbazis, "lakasok");
        const q = query(lakasokRef, where("hirdeto_uid", "==", user.uid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          listaKontener.innerHTML =
            '<p class="text-xs opacity-40 italic p-4">Még nincsenek rögzített hirdetéseid.</p>';
          return;
        }

        listaKontener.innerHTML = ""; // Betöltő üzenet eltávolítása

        querySnapshot.forEach((documentum) => {
          const hirdetes = documentum.data();
          const id = documentum.id;

          const kartya = document.createElement("div");
          kartya.className =
            "bg-white/5 p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-lime-400/30 transition-all mb-4";

          kartya.innerHTML = `
            <div class="flex-1 space-y-1">
               <p class="font-bold text-white text-xs">${
                    hirdetes.azon || "azon nélkül"
               }</p>

                <h4 class="font-bold text-lime-400 text-lg">${
                  hirdetes.nev || "Név nélkül"
                }</h4>
                <p class="text-xs opacity-70">${hirdetes.telepules || ""} - ${
            hirdetes.varosresz || ""
          }</p>
                <p class="text-sm font-semibold">${Number(
                  hirdetes.vételár || 0
                ).toLocaleString()} Ft</p>
            </div>
            
            <div class="flex flex-col gap-2 min-w-[150px]">
                <button onclick="window.location.href='?id=${id}&mode=view'" 
                        class="bg-lime-400 text-black px-4 py-2 rounded-xl text-xs font-bold hover:bg-lime-500 transition-all">
                    Lekérdezés
                </button>
        
                <button onclick="window.location.href='?id=${id}&mode=edit'" 
                        class="bg-lime-400 text-black px-4 py-2 rounded-xl text-xs font-bold hover:bg-lime-500 transition-all">
                    Szerkesztés
                </button>
        
                <button onclick="hirdetesTorlese('${id}')" 
                        class="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 transition-all">
                    Törlés
                </button>
            </div>
        `;

          listaKontener.appendChild(kartya);
        });
      } catch (error) {
        console.error("Hiba a listázásnál:", error);
        listaKontener.innerHTML =
          '<p class="text-xs text-red-400 p-4">Hiba történt a hirdetések betöltésekor.</p>';
      }
    } else {
      listaKontener.innerHTML =
        '<p class="text-xs text-yellow-400 p-4">Kérlek, jelentkezz be a hirdetéseid megtekintéséhez!</p>';
    }
  });
}
