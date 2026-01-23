import { lakasok_gyujtemeny, getDocs, auth } from "../util/firebase-config.js";
import {
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 1. Biztonsági ellenőrzés és E-mail kiírás
onAuthStateChanged(auth, (felhasznalo) => {
  if (felhasznalo) {
    console.log("Admin bejelentkezve:", felhasznalo.email);

    // E-mail cím kiírása a fejlécbe (ha létezik az elem)
    const emailKijelzo = document.getElementById("bejelentkezett-email");
    if (emailKijelzo) emailKijelzo.innerText = felhasznalo.email;

    // Csak ha be van lépve, akkor töltjük le az adatokat
    ingatlanok_listazasa();
  } else {
    // Ha nincs belépve, visszazavarjuk a login oldalra
    window.location.href = "../belepese.html";
  }
});

// 2. Ingatlanok listázása
async function ingatlanok_listazasa() {
  const tabla = document.getElementById("admin-ingatlan-lista");
  const stat_osszes = document.getElementById("statisztika-osszes");

  if (!tabla) return; // Biztonsági ellenőrzés, ha nincs a HTML-ben a táblázat

  try {
    const adatok = await getDocs(lakasok_gyujtemeny);
    tabla.innerHTML = "";

    stat_osszes.innerText = adatok.size;

    if (adatok.empty) {
      tabla.innerHTML =
        "<tr><td colspan='5' class='p-10 text-center opacity-50 italic'>Még nincs feltöltött ingatlan.</td></tr>";
      return;
    }

    adatok.forEach((dok) => {
      const lakas = dok.data();
      const sor = document.createElement("tr");
      sor.className =
        "border-b border-white/5 hover:bg-white/5 transition-colors";

      // 1. Ár intelligens kezelése (vételár vagy ar kulcs)
      const nyersAr = lakas.vételár || lakas.ar;
      const arMegjelenites = nyersAr
        ? Number(nyersAr).toLocaleString() + " Ft"
        : "Nincs megadva";

      // 2. Lokáció összefűzése (Város, Kerület Városrész)
      // Csak akkor tesszük be a vesszőt vagy kötőjelet, ha van adat
      const lokacioReszek = [];
      if (lakas.telepules || lakas.helyszin)
        lokacioReszek.push(lakas.telepules || lakas.helyszin);
      if (lakas.kerulet && lakas.kerulet !== "-")
        lokacioReszek.push(lakas.kerulet);
      if (lakas.varosresz) lokacioReszek.push(lakas.varosresz);

      const teljesHelyszin =
        lokacioReszek.length > 0 ? lokacioReszek.join(", ") : "Ismeretlen";

      sor.innerHTML = `
          <td class="p-4 font-medium">
              <div class="flex flex-col">
                  <span>${lakas.nev || "Név nélkül"}</span>
                  <span class="text-[10px] opacity-40 uppercase tracking-widest">${
                    lakas.tipus || ""
                  }</span>
              </div>
          </td>
          <td class="p-4 opacity-70 text-sm">${teljesHelyszin}</td>
          <td class="p-4 font-mono text-sm">${arMegjelenites}</td>
          <td class="p-4">
              <span class="${
                lakas.statusz === "Aktív"
                  ? "bg-lime-500/20 text-lime-400"
                  : "bg-blue-500/20 text-blue-300"
              } text-[10px] px-2 py-0.5 rounded-full uppercase">
                  ${lakas.statusz || "Feldolgozás alatt"}
              </span>
          </td>
          <td class="p-4 text-right">
              <button class="text-xs text-lime-400 hover:underline">Szerkesztés</button>
          </td>
      `;
      tabla.appendChild(sor);
    });
  } catch (error) {
    console.error("Admin hiba:", error);
    tabla.innerHTML =
      "<tr><td colspan='5' class='p-10 text-center text-red-400'>Hiba az adatok lekérésekor.</td></tr>";
  }
}

// 3. Kijelentkezés globálissá tétele a HTML gombnak
window.kijelentkezes = function () {
  signOut(auth)
    .then(() => {
      window.location.href = "../../../index.html";
    })
    .catch((hiba) => {
      console.error("Hiba a kijelentkezéskor:", hiba);
    });
};
