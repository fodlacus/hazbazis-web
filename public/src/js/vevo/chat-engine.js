import {
  query,
  where,
  getDocs,
  collection,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

let belsoFlat = []; // Ez a "flat" állomány a memóriában

// 1. Betöltéskor ellenőrizzük, jött-e kérdés a főoldalról
window.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const kezdőKérdés = urlParams.get("query");

  if (kezdőKérdés) {
    document.getElementById("chat-input").value = kezdőKérdés;
    inditsChatKeresest();
  }
});

// Küldés gomb figyelése
document
  .getElementById("send-btn")
  .addEventListener("click", inditsChatKeresest);

async function inditsChatKeresest() {
  const input = document.getElementById("chat-input");
  const uzenet = input.value.trim();
  if (!uzenet) return;

  hozzaadBuborekot(uzenet, "user");
  input.value = "";

  try {
    // AI értelmezés hívása (Cloudflare proxy-n keresztül)
    // Ellenőrizzük, hogy az ai-bridge.js be van-e töltve!
    if (typeof window.ertelmezdAkeresest !== "function") {
      throw new Error("Az AI modul nem töltődött be.");
    }

    const feltetelek = await window.ertelmezdAkeresest(uzenet);

    if (belsoFlat.length === 0) {
      hozzaadBuborekot("Pillanat, átnézem a kínálatot...", "ai");
      await elsoLekeresFirebasebol(feltetelek);
    } else {
      hozzaadBuborekot("Szűröm a listát az új szempontok alapján...", "ai");
      szuresMemoriaban(feltetelek);
    }

    megjelenitTalalatokat();
  } catch (error) {
    console.error("Hiba:", error);
    hozzaadBuborekot(
      "Sajnos hiba történt a kapcsolódáskor. Próbáld újra!",
      "ai"
    );
  }
}

async function elsoLekeresFirebasebol(f) {
  // 1. Kinyerjük az összes lehetséges technikai feltételt az AI válaszából
  const technikaiFeltetelek = {
    allapot: f.allapot || null,
    anyag: f.anyag || null,
    tipus: f.tipus || null,
    lift: f.lift || null,
    futes: f.fűtés || null,
    epites_eve: f.epites_eve || null,
  };

  const szamszeruFeltetelek = {
    maxAr: f.maximum || f.maxAr || f.vételár || null,
    minSzoba: f.szobák || f.szobaszam || null,
    minTerulet: f.alapterület || null,
  };

  try {
    let q = collection(adatbazis, "lakasok");

    // FÖLDRAJZI SZŰRÉS (Firebase szinten)
    if (f.telepules) q = query(q, where("telepules", "==", f.telepules));
    if (f.kerulet) q = query(q, where("kerulet", "==", f.kerulet));

    const snap = await getDocs(q);
    let eredmenyek = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // DINAMIKUS MEMÓRIA SZŰRÉS (A "belso-flat" finomhangolása)
    // Ez a rész bármilyen mezőt lekezel, amit az AI felismert
    eredmenyek = eredmenyek.filter((ing) => {
      let ok = true;

      // Szöveges egyezések (pl. állapot: "Felújított")
      if (
        technikaiFeltetelek.allapot &&
        ing.allapot !== technikaiFeltetelek.allapot
      )
        ok = false;
      if (technikaiFeltetelek.anyag && ing.anyag !== technikaiFeltetelek.anyag)
        ok = false;

      // Számszaki szűrések
      if (
        szamszeruFeltetelek.maxAr &&
        Number(ing.vételár) > Number(szamszeruFeltetelek.maxAr)
      )
        ok = false;
      if (
        szamszeruFeltetelek.minSzoba &&
        Number(ing.szobák) < Number(szamszeruFeltetelek.minSzoba)
      )
        ok = false;

      // Építési év (pl. "2010 utáni")
      if (
        technikaiFeltetelek.epites_eve &&
        Number(ing.epites_eve) < Number(technikaiFeltetelek.epites_eve)
      )
        ok = false;

      return ok;
    });

    belsoFlat = eredmenyek;
    valaszoljAfelhasznalonak(belsoFlat);
  } catch (error) {
    console.error("Hiba a részletes keresésben:", error);
    hozzaadBuborekot("Sajnos hiba történt a technikai szűrés során.", "ai");
  }
}

function szuresMemoriaban(f) {
  // További szűrés már csak a memóriában lévő belsoFlat-en
  belsoFlat = belsoFlat.filter((ing) => {
    if (f.maxAr && ing.vételár > f.maxAr) return false;
    if (f.szobak && ing.szobák < f.szobak) return false;
    return true;
  });
}

function hozzaadBuborekot(msg, tipus) {
  const folyam = document.getElementById("chat-folyam");
  const div = document.createElement("div");
  div.className =
    tipus === "user" ? "flex justify-end mb-4" : "flex gap-3 mb-4";

  div.innerHTML =
    tipus === "user"
      ? `<div class="bg-[#E2F1B0] text-[#3D4A16] p-4 rounded-2xl rounded-tr-none text-sm max-w-[85%] shadow-lg">${msg}</div>`
      : `<img src="../../../AI-no.png" class="w-10 h-10 rounded-full object-cover shadow-md">
           <div class="bg-white/10 p-4 rounded-2xl rounded-tl-none text-sm max-w-[85%] border border-white/5">${msg}</div>`;

  folyam.appendChild(div);
  folyam.scrollTop = folyam.scrollHeight;
}

function megjelenitTalalatokat() {
  const panel = document.getElementById("eredmenyek-panel");
  const szamlalo = document.getElementById("talalat-szam");

  szamlalo.innerText = `${belsoFlat.length} talált`;
  panel.innerHTML = belsoFlat
    .map(
      (ing) => `
        <div class="bg-white/5 border border-white/10 p-4 rounded-3xl flex gap-4 hover:bg-white/10 transition-all cursor-pointer group">
            <img src="${
              ing.kepek_horiz?.[0] || ""
            }" class="w-24 h-24 rounded-2xl object-cover">
            <div class="flex flex-col justify-center">
                <h3 class="font-bold text-sm group-hover:text-[#E2F1B0] transition-colors">${
                  ing.nev
                }</h3>
                <p class="text-[#E2F1B0] font-black mt-1">${Number(
                  ing.vételár
                ).toLocaleString()} Ft</p>
                <p class="text-[10px] opacity-40 uppercase mt-1">${
                  ing.kerulet
                } kerület • ${ing.alapterület} m²</p>
            </div>
        </div>
    `
    )
    .join("");
}
