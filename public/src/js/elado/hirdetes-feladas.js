// Fájl: src/js/elado/hirdetes-feladas.js

import {
  getDocs,
  collection,
  query,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Ellenőrizd: ha a hirdetes-feladas.js az 'elado' mappában van, akkor a 'util' egy szinttel feljebb van (../)
import { adatbazis } from "../util/firebase-config.js";

export async function initGyorsKitolto() {
  console.log("🚀 Gyors kitöltő modul elindult!");

  const input = document.getElementById("gyors-input");
  const elemzesBtn = document.getElementById("elemzes-gomb");
  const torlesBtn = document.getElementById("torles-gomb");
  const talalatokDiv = document.getElementById("sablon-talalatok");

  // Ha nincs meg a doboz a HTML-ben, kilépünk (ne legyen hiba)
  if (!input || !elemzesBtn) {
    console.warn("⚠️ Nem találom a gyors-kitöltő elemeit a HTML-ben.");
    return;
  }

  // 1. TÖRLÉS (Kuka) Gomb
  if (torlesBtn) {
    torlesBtn.addEventListener("click", (e) => {
      e.preventDefault();
      input.value = ""; // Mező ürítése
      talalatokDiv.classList.add("hidden"); // Doboz elrejtése
      console.log("🗑 Mező törölve.");
    });
  }

  // 2. KERESÉS INDÍTÁSA
  elemzesBtn.addEventListener("click", (e) => {
    e.preventDefault(); // Hogy ne frissüljön az oldal gombnyomásra
    futtasKereses();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Enterre se küldje el az űrlapot
      futtasKereses();
    }
  });

  // --- KERESÉS LOGIKA ---
  async function futtasKereses() {
    const szoveg = input.value.trim().toLowerCase();
    if (szoveg.length < 3) {
      alert("Írj be legalább 3 karaktert!");
      return;
    }

    // Töltésjelző
    talalatokDiv.innerHTML =
      '<div class="p-4 text-white/50 text-center animate-pulse">Keresés az adatbázisban...</div>';
    talalatokDiv.classList.remove("hidden");

    try {
      // Lekérünk 20 ingatlant a 'lakasok' gyűjteményből
      const q = query(collection(adatbazis, "lakasok"), limit(20));
      const snapshot = await getDocs(q);

      const talalatok = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Összerakjuk a kereshető szöveget (város + utca + típus)
        const keresesiSzoveg =
          `${data.varos} ${data.utca} ${data.tipus}`.toLowerCase();

        // Ha benne van a keresett szó
        if (keresesiSzoveg.includes(szoveg)) {
          talalatok.push(data);
        }
      });

      megjelenitTalalatok(talalatok);
    } catch (error) {
      console.error("Hiba:", error);
      talalatokDiv.innerHTML =
        '<div class="p-4 text-red-400 text-center">Hiba történt.</div>';
    }
  }

  // --- LISTA MEGJELENÍTÉSE ---
  function megjelenitTalalatok(lista) {
    talalatokDiv.innerHTML = "";

    if (lista.length === 0) {
      talalatokDiv.innerHTML =
        '<div class="p-4 text-white/50 text-center">Nincs ilyen ingatlan a rendszerben.</div>';
      return;
    }

    // Címke
    const info = document.createElement("div");
    info.className =
      "p-2 bg-black/20 text-xs text-lime-400 font-bold uppercase border-b border-white/10";
    info.innerText = "Kattints a sablonra a betöltéshez:";
    talalatokDiv.appendChild(info);

    lista.forEach((ingatlan) => {
      const sor = document.createElement("div");
      sor.className =
        "p-4 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-colors group";

      // "undefined" elkerülése (ha nincs adat, üres legyen)
      const varos = ingatlan.varos || "";
      const utca = ingatlan.utca || "";
      const ar = ingatlan.ar
        ? parseInt(ingatlan.ar).toLocaleString() + " Ft"
        : "";
      const szoba = ingatlan.szobaszam ? ingatlan.szobaszam + " szoba" : "";

      sor.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <div class="font-bold text-white group-hover:text-lime-400">${varos}, ${utca}</div>
                        <div class="text-xs text-white/60">${ar} | ${szoba}</div>
                    </div>
                    <div class="text-lime-400 opacity-0 group-hover:opacity-100 text-sm font-bold">Betöltés →</div>
                </div>
            `;

      // KATTINTÁS -> KITÖLTÉS
      sor.addEventListener("click", () => {
        kitoltUrlap(ingatlan);
        talalatokDiv.classList.add("hidden"); // Eltüntetjük a listát
        input.value = `SABLON: ${varos}, ${utca}`;
      });

      talalatokDiv.appendChild(sor);
    });
  }

  // --- ŰRLAP MEZŐK KITÖLTÉSE ---
  function kitoltUrlap(adatok) {
    // Itt nagyon figyelj az ID-kra! Ezeknek kell lenniük a HTML-ben lejjebb
    if (document.getElementById("varos"))
      document.getElementById("varos").value = adatok.varos || "";
    if (document.getElementById("utca"))
      document.getElementById("utca").value = adatok.utca || "";
    if (document.getElementById("iranyitoszam"))
      document.getElementById("iranyitoszam").value = adatok.iranyitoszam || "";
    if (document.getElementById("ar"))
      document.getElementById("ar").value = adatok.ar || "";
    if (document.getElementById("alapterulet"))
      document.getElementById("alapterulet").value = adatok.alapterulet || "";
    if (document.getElementById("szobaszam"))
      document.getElementById("szobaszam").value = adatok.szobaszam || "";

    console.log("✅ Adatok bemásolva!");
  }
}

// Automatikus indítás, amikor az oldal betöltött
document.addEventListener("DOMContentLoaded", initGyorsKitolto);
