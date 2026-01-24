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
  // 1. Megpróbáljuk kinyerni a kerületet bármilyen formátumban
  let talaltKerulet =
    f.kerulet || f.szo || f.XIV || f["XIV."] || f.kerulet_neve || "";

  // 2. Ha az AI egy összetett mezőbe tette (pl. 'Zugló sorház'), abból is kiszedjük
  if (!talaltKerulet && f.ingatlan_neve) {
    if (f.ingatlan_neve.includes("Zugló")) talaltKerulet = "Zugló";
    if (f.ingatlan_neve.includes("XIV")) talaltKerulet = "XIV. kerület";
  }

  // 3. Végső ellenőrzés: ha még mindig nincs meg, megkérdezzük a felhasználót
  if (!talaltKerulet || talaltKerulet === "undefined") {
    hozzaadBuborekot(
      "Segíts nekem: melyik kerületben keressek pontosan?",
      "ai"
    );
    return;
  }

  // Normalizálás az adatbázisodhoz (pl. XIV. kerület vagy Zugló)
  const keresettErtek = talaltKerulet.toString().trim();

  console.log("🔥 Firebase szűrés indítása ezzel:", keresettErtek);

  try {
    const q = query(
      collection(adatbazis, "lakasok"),
      where("kerulet", "==", keresettErtek)
    );

    const snap = await getDocs(q);
    belsoFlat = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (belsoFlat.length === 0) {
      hozzaadBuborekot(
        `Sajnos a(z) ${keresettErtek} részen jelenleg nincs eladó ingatlanunk.`,
        "ai"
      );
    } else {
      hozzaadBuborekot(
        `Szuper! Találtam ${belsoFlat.length} ingatlant. Nézd meg őket a jobb oldalon!`,
        "ai"
      );
    }
  } catch (error) {
    console.error("Firebase hiba:", error);
    hozzaadBuborekot(
      "Hiba történt az adatok lekérésekor. Próbáljuk meg másképp!",
      "ai"
    );
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
