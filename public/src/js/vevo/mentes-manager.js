// src/js/vevo/mentes-manager.js

import { auth, adatbazis } from "../util/firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Segédfüggvény: Belépett felhasználó
const getUser = () => auth.currentUser;

// 1. INICIALIZÁLÁS
export async function initMentesManager() {
  const listaDiv = document.getElementById("mentett-lista");
  if (!listaDiv) return;

  // Figyeljük a változást: ha belép/kilép, újratöltjük a listát
  auth.onAuthStateChanged(async (user) => {
    await renderMentettKeresesek();
  });

  // Gomb eseménykezelő (Mentés +)
  const saveBtn = document.getElementById("btn-save-filter");
  if (saveBtn) {
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);

    newBtn.addEventListener("click", async () => {
      const nevInput = document.getElementById("uj-mentes-nev");
      const nev = nevInput.value.trim();

      if (!nev) {
        alert("Adj nevet a mentésnek!");
        return;
      }

      // A globális szűrő változó (amit a chat-engine.js tölt fel)
      const szurok = window.aktualisSzuroFeltetelek || {};

      if (Object.keys(szurok).length === 0) {
        alert("Nincs aktív szűrő, amit elmenthetnék! (Keress valamire előbb)");
        return;
      }

      // JAVÍTÁS: Itt hívjuk meg az exportált függvényt
      await saveCurrentSearch(nev, szurok);
      nevInput.value = "";
    });
  }
}

// 2. MENTÉS (EXPORTÁLVA ÉS ÁTNEVEZVE!)
export async function saveCurrentSearch(nev, szurok) {
  const user = getUser();

  try {
    if (user) {
      // --- FIREBASE MENTÉS (Belépve) ---
      const subColRef = collection(
        adatbazis,
        "felhasznalok",
        user.uid,
        "mentett_keresesek"
      );
      await addDoc(subColRef, {
        elnevezes: nev,
        kriteriumok: szurok,
        letrehozva: new Date().toISOString(),
      });
      console.log("Mentés felhőbe sikerült.");
    } else {
      // --- LOCALSTORAGE MENTÉS (Vendég) ---
      const mentesek = JSON.parse(
        localStorage.getItem("hazbazis_mentesek") || "[]"
      );
      mentesek.push({
        id: "local-" + Date.now(),
        elnevezes: nev,
        kriteriumok: szurok,
      });
      localStorage.setItem("hazbazis_mentesek", JSON.stringify(mentesek));
      console.log("Mentés helyben sikerült.");
    }

    await renderMentettKeresesek();
  } catch (error) {
    console.error("Hiba mentéskor:", error);
    alert("Nem sikerült menteni a keresést.");
  }
}

// 3. TÖRLÉS
async function deleteSearch(id) {
  const user = getUser();

  if (confirm("Biztosan törlöd ezt a mentést?")) {
    if (user && !id.startsWith("local-")) {
      await deleteDoc(
        doc(adatbazis, "felhasznalok", user.uid, "mentett_keresesek", id)
      );
    } else {
      const mentesek = JSON.parse(
        localStorage.getItem("hazbazis_mentesek") || "[]"
      );
      const ujLista = mentesek.filter((m) => m.id !== id);
      localStorage.setItem("hazbazis_mentesek", JSON.stringify(ujLista));
    }
    await renderMentettKeresesek();
  }
}

// 4. MEGJELENÍTÉS
async function renderMentettKeresesek() {
  const container = document.getElementById("mentett-lista");
  if (!container) return;

  container.innerHTML =
    '<div class="text-white/50 text-xs p-2">Betöltés...</div>';

  let mentesek = [];
  const user = getUser();

  if (user) {
    const subColRef = collection(
      adatbazis,
      "felhasznalok",
      user.uid,
      "mentett_keresesek"
    );
    const snapshot = await getDocs(subColRef);
    mentesek = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } else {
    mentesek = JSON.parse(localStorage.getItem("hazbazis_mentesek") || "[]");
  }

  container.innerHTML = "";
  if (mentesek.length === 0) {
    container.innerHTML =
      '<div class="text-white/30 text-xs p-2 italic">Nincs mentett keresés.</div>';
    return;
  }

  mentesek.forEach((mentes) => {
    const div = document.createElement("div");
    div.className =
      "flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-2 group hover:bg-white/10 transition-colors cursor-pointer";

    // Klikk a névre -> Betöltés
    div.innerHTML = `
            <div class="flex items-center gap-2 overflow-hidden" onclick="window.betoltMentes('${encodeURIComponent(
              JSON.stringify(mentes.kriteriumok)
            )}')">
                <div class="w-2 h-2 rounded-full bg-[#E2F1B0]"></div>
                <span class="text-xs font-bold text-white truncate">${
                  mentes.elnevezes
                }</span>
            </div>
        `;

    const deleteBtn = document.createElement("button");
    deleteBtn.className =
      "text-white/20 hover:text-red-400 p-1 transition-colors";
    deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteSearch(mentes.id);
    };

    div.appendChild(deleteBtn);
    container.appendChild(div);
  });
}

// Globális betöltő (fontos!)
window.betoltMentes = function (jsonKriteriumok) {
  const kriteriumok = JSON.parse(decodeURIComponent(jsonKriteriumok));
  console.log("Mentés betöltése:", kriteriumok);

  // Átadjuk a chat-engine-nek
  if (window.alkalmazSzuroket) {
    window.alkalmazSzuroket(kriteriumok);
  } else {
    console.error(
      "Nincs definiálva az alkalmazSzuroket függvény a chat-engine-ben!"
    );
  }
};

// Üres függvény a kompatibilitás miatt
export function uncheckAllFilters() {}
