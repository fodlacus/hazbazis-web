import {
  query,
  where,
  getDocs,
  collection,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

console.log("Gyors-kitöltő motor 2.0 (Pro + Törlés) aktív...");

/**
 * FŐ FUNKCIÓ: A keresés indítása és a Firestore szűrése
 */

// gyors-kitoltes.js - Keresési szakasz javítása

window.gyorsKitoltesInditasa = async function (szoveg) {
  const talalatPanel = document.getElementById("kereso-talalatok");
  if (!talalatPanel || szoveg.trim().length < 3) return;

  talalatPanel.innerHTML = `<div class="p-4 text-xs italic opacity-50 text-white">Keresés...</div>`;
  talalatPanel.classList.remove("hidden");

  try {
    const feltetelek = await window.ertelmezdAkeresest(szoveg);

    // Ha az AI hiba miatt null-t vagy üreset adna vissza, álljunk meg
    if (!feltetelek || Object.keys(feltetelek).length === 0) {
      jelezzHibat("Az AI nem tudta értelmezni a kérést. Próbáld másképp!");
      return;
    }

    // FONTOS: Csak az alapvető mezőkre szűrünk
    let q = collection(adatbazis, "lakasok");
    let szurok = [];

    // 1. Kerület szűrés
    if (feltetelek.kerulet) {
      szurok.push(where("kerulet", "==", feltetelek.kerulet));
    }

    // 2. MAXIMUM ÁR (alatt/ig) kezelése
    if (feltetelek.maxAr) {
      szurok.push(where("vételár", "<=", Number(feltetelek.maxAr)));
    }

    // 3. MINIMUM ÁR (felett/legalább) kezelése - EZ HIÁNYZOTT!
    if (feltetelek.minAr) {
      szurok.push(where("vételár", ">=", Number(feltetelek.minAr)));
    }

    // 4. Szobaszám szűrés (ha az AI kinyerte)
    if (feltetelek.szobak) {
      szurok.push(where("szobák", "==", Number(feltetelek.szobak)));
    }

    // Egyszerűsített lekérdezés az összeomlás elkerülésére
    const queryFinal = query(q, ...szurok);
    const snap = await getDocs(queryFinal);

    if (snap.empty) {
      jelezzHibat("Nincs találat a megadott feltételekkel.");
      return;
    }

    const talalatok = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    eredmenyekMegjelenitese(talalatok);
  } catch (hiba) {
    console.error("Firebase hiba részletei:", hiba);
    // Ez a sor fogja kiírni a pontos hibaüzenetet a konzolra!
    jelezzHibat("Hiba történt. Ellenőrizd a böngésző konzolját (F12)!");
  }
};

/**
 * Találati lista megjelenítése
 */
function eredmenyekMegjelenitese(lista) {
  const panel = document.getElementById("kereso-talalatok");
  panel.innerHTML = `<div class="p-2 text-[10px] uppercase tracking-widest opacity-40 border-b border-white/10 text-white">Válassz sablont:</div>`;

  lista.forEach((ingatlan) => {
    const elem = document.createElement("div");
    elem.className =
      "p-3 hover:bg-lime-400/20 cursor-pointer border-b border-white/5 transition-all group text-white";
    elem.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="font-bold text-sm text-lime-400 group-hover:text-white">${
                  ingatlan.nev || "Névtelen"
                }</div>
                <div class="text-[9px] bg-white/10 px-2 py-0.5 rounded text-white/50">${
                  ingatlan.azon || ""
                }</div>
            </div>
            <div class="text-[11px] opacity-60 mt-1">
                ${ingatlan.kerulet} ker. | ${Number(
      ingatlan.vételár
    ).toLocaleString()} Ft | ${ingatlan.szobák} szobás
            </div>
        `;
    elem.onclick = () => {
      beillesztesUrlapba(ingatlan);
      panel.classList.add("hidden");
    };
    panel.appendChild(elem);
  });
}

/**
 * Adatok beillesztése és ürítés funkció
 */

/**
 * Adatok beillesztése az űrlapba sablonból vagy AI-ból
 */
function beillesztesUrlapba(adat) {
  Object.keys(adat).forEach((id) => {
    // Ékezetmentesítés az ID egyeztetéshez (pl. "típus" -> "tipus")
    const fixId = id.replace("í", "i").replace("é", "e").replace("ű", "u");
    const mezo = document.getElementById(fixId) || document.getElementById(id);

    if (mezo && id !== "azon") {
      mezo.value = adat[id];
      mezo.style.backgroundColor = "rgba(163, 230, 53, 0.15)";

      // Select és Input események kiváltása, hogy az automata ellenőrzés észlelje a változást
      mezo.dispatchEvent(new Event("change", { bubbles: true }));
      mezo.dispatchEvent(new Event("input", { bubbles: true }));

      setTimeout(() => {
        if (mezo) mezo.style.backgroundColor = "";
      }, 2000);
    }
  });

  // A beillesztés végén kényszerítjük a címellenőrzést
  if (window.automataCimEllenorzes) {
    window.automataCimEllenorzes();
  }
}

// --- ÚJ: ŰRLAP ÜRÍTÉSE FUNKCIÓ ---
window.urlapUrites = function () {
  if (confirm("Biztosan törlöd az összes mezőt?")) {
    const form = document.getElementById("hirdetes-urlap");
    if (form) form.reset();

    const aiInput = document.getElementById("ai-azonosito");
    if (aiInput) aiInput.value = "";

    document.getElementById("kereso-talalatok").classList.add("hidden");
    document
      .querySelectorAll(".bevitel")
      .forEach((el) => (el.style.backgroundColor = ""));
    console.log("Űrlap kiürítve.");
  }
};

function jelezzHibat(uzenet) {
  const panel = document.getElementById("kereso-talalatok");
  panel.innerHTML = `<div class="p-4 text-xs text-red-400 font-bold">⚠️ ${uzenet}</div>`;
  setTimeout(() => {
    panel.classList.add("hidden");
  }, 4000);
}
