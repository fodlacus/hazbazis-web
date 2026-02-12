import { adatbazis } from "../../util/firebase-config.js"; // Figyelj az útvonalra!
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. LISTÁZÁS (A Várólistából)
export async function fuggoHirdetesekBetoltese() {
  const kontener = document.getElementById("fuggo-hirdetesek-lista");
  if (!kontener) return;

  kontener.innerHTML = '<p class="text-white">Betöltés...</p>';

  try {
    const varolistaRef = collection(adatbazis, "hirdetesek_varolista");
    const snapshot = await getDocs(varolistaRef);

    kontener.innerHTML = ""; // Ürítés

    if (snapshot.empty) {
      kontener.innerHTML =
        '<p class="text-gray-400">Nincs jóváhagyásra váró hirdetés.</p>';
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Kártya generálás
      const kartya = document.createElement("div");
      kartya.className =
        "bg-white/5 p-4 rounded-xl border border-white/10 mb-4 flex justify-between items-center";

      kartya.innerHTML = `
                <div>
                    <h4 class="text-lime-400 font-bold text-lg">${
                      data.azon
                    }</h4>
                    <p class="text-white">${data.telepules}, ${
        data.utca
      } - <span class="font-bold">${Number(
        data.ar
      ).toLocaleString()} Ft</span></p>
                    <p class="text-sm text-gray-400">Feladó: ${
                      data.hirdeto_uid
                    } | Dátum: ${new Date(
        data.letrehozva
      ).toLocaleDateString()}</p>
                </div>
                <div class="flex gap-2">
                    <button class="approve-btn bg-lime-500 hover:bg-lime-600 text-black font-bold py-2 px-4 rounded transition">
                        ✅ Publikálás
                    </button>
                    <button class="reject-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition">
                        ❌ Törlés
                    </button>
                </div>
            `;

      // Eseménykezelők (Hogy ne kelljen window.függvény)
      kartya.querySelector(".approve-btn").onclick = () =>
        hirdetesJovahagyasa(docSnap.id);
      kartya.querySelector(".reject-btn").onclick = () =>
        hirdetesElutasitasa(docSnap.id);

      kontener.appendChild(kartya);
    });
  } catch (err) {
    console.error("Hiba a listázáskor:", err);
    kontener.innerHTML = `<p class="text-red-400">Hiba: ${err.message}</p>`;
  }
}

// 2. JÓVÁHAGYÁS (A "Zsilip" nyitása)
async function hirdetesJovahagyasa(id) {
  if (!confirm(`Biztosan publikálod a(z) ${id} hirdetést?`)) return;

  try {
    // A. Olvasás a várólistából
    const forrasRef = doc(adatbazis, "hirdetesek_varolista", id);
    const forrasSnap = await getDoc(forrasRef);

    if (!forrasSnap.exists()) {
      alert("Hiba: A hirdetés már nem található (lehet, hogy törölték).");
      return;
    }

    const adatok = forrasSnap.data();

    // B. Átmozgatás a 'lakasok' kollekcióba (Ugyanazzal az ID-vel!)
    const celRef = doc(adatbazis, "lakasok", id);

    // Frissítjük a státuszt és az aktiválás idejét
    const veglegesAdatok = {
      ...adatok,
      statusz: "Aktiv",
      aktivalas_ideje: new Date().toISOString(),
    };

    await setDoc(celRef, veglegesAdatok);

    // C. Törlés a várólistából (hogy ne legyen duplikáció)
    await deleteDoc(forrasRef);

    alert("Sikeres publikálás! A hirdetés mostantól látható a rendszerben.");
    fuggoHirdetesekBetoltese(); // Lista frissítése
  } catch (err) {
    console.error("Publikálási hiba:", err);
    alert("Hiba történt: " + err.message);
  }
}

// 3. ELUTASÍTÁS (Végleges törlés)
async function hirdetesElutasitasa(id) {
  if (
    !confirm("Biztosan TÖRLÖD ezt a hirdetést? A művelet nem vonható vissza!")
  )
    return;

  try {
    await deleteDoc(doc(adatbazis, "hirdetesek_varolista", id));
    alert("Hirdetés törölve.");
    fuggoHirdetesekBetoltese();
  } catch (err) {
    console.error(err);
    alert("Hiba törléskor.");
  }
}
