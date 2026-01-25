// src/js/vevo/mentes-manager.js
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

// Ez a változó tárolja majd a "Szakács" (chat-engine) felé a kéréseket
let onUpdateCallback = null;

// Inicializálás: átvesszük a callback függvényt, amit akkor hívunk, ha változik a lista
export function initMentesManager(updateCallback) {
  onUpdateCallback = updateCallback;
  renderSavedSearchesList(); // Betöltéskor azonnal kirajzoljuk a listát
}

// 1. MENTÉS FUNKCIÓ (Cardepo logika alapján)
export function saveCurrentSearch(filterObj) {
  if (!filterObj || Object.keys(filterObj).length === 0) {
    alert("Nincs mit elmenteni, üres a szűrő!");
    return;
  }

  const nameInput = document.getElementById("uj-mentes-nev");
  let searchName = nameInput.value.trim();

  // Ha nem adott nevet, generálunk egyet (pl. "XIV. kerület, 50M alatt")
  if (!searchName) {
    searchName = generateAutoName(filterObj);
  }

  // --- LOCALSTORAGE LOGIKA (Később ez lesz a Firebase rész) ---
  let savedSearches = getLocalSearches();

  // Limit kezelése (max 10)
  if (savedSearches.length >= 10) {
    if (!confirm("Betelt a 10 hely. A legrégebbi mentés törlődik. Mehet?"))
      return;
    savedSearches.shift();
  }

  // Duplikáció kezelése (ha már van ilyen név, felülírjuk/előre hozzuk)
  savedSearches = savedSearches.filter((s) => s.name !== searchName);

  // Mentés összeállítása
  const newSave = {
    name: searchName,
    filters: filterObj, // Ez a standardFeltetelek JSON
    timestamp: new Date().toISOString(),
  };

  savedSearches.unshift(newSave); // Lista elejére
  localStorage.setItem(
    "hazbazis_saved_searches",
    JSON.stringify(savedSearches)
  );

  alert(`Sikeresen mentve: "${searchName}"`);
  nameInput.value = "";

  renderSavedSearchesList(); // Lista frissítése a felületen
}

// 2. LISTA MEGJELENÍTÉSE (Checkboxokkal!)
export function renderSavedSearchesList() {
  const container = document.getElementById("mentett-lista");
  if (!container) return;

  const searches = getLocalSearches();
  container.innerHTML = "";

  if (searches.length === 0) {
    container.innerHTML = `<div class="text-xs text-white/40 italic text-center p-2">Még nincs mentett keresésed.</div>`;
    return;
  }

  searches.forEach((search, index) => {
    const row = document.createElement("div");
    row.className =
      "flex items-center justify-between group p-2 hover:bg-white/5 rounded-lg transition-colors";

    // Checkbox és Név
    row.innerHTML = `
            <label class="flex items-center gap-3 cursor-pointer flex-grow overflow-hidden">
                <input type="checkbox" data-index="${index}" class="saved-search-checkbox w-4 h-4 rounded border-white/20 bg-white/10 text-[#E2F1B0] focus:ring-[#E2F1B0]">
                <span class="text-sm text-white/80 truncate select-none group-hover:text-white transition-colors" title="${search.name}">
                    ${search.name}
                </span>
            </label>
            <button class="delete-btn text-white/20 hover:text-red-400 p-1 transition-colors" data-name="${search.name}">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;

    container.appendChild(row);
  });

  // Eseményfigyelők hozzáadása (Cardepo modularitás)
  attachEventListeners();
}

// 3. ESEMÉNYFIGYELŐK (A logika szíve)
function attachEventListeners() {
  // A) Checkbox változás figyelése (A Multi-lista logika)
  document.querySelectorAll(".saved-search-checkbox").forEach((cb) => {
    cb.addEventListener("change", () => {
      handleMultiFilterSelection();
    });
  });

  // B) Törlés gomb
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      deleteSavedSearch(e.currentTarget.dataset.name);
    });
  });
}

// 4. A NAGY ÖSSZEFÉSÜLŐ LOGIKA (Hab a tortán)
async function handleMultiFilterSelection() {
  const checkboxes = document.querySelectorAll(
    ".saved-search-checkbox:checked"
  );
  const searches = getLocalSearches();

  // Összegyűjtjük a bepipált filtereket
  let activeFiltersList = [];
  checkboxes.forEach((cb) => {
    const index = cb.dataset.index;
    activeFiltersList.push(searches[index].filters);
  });

  // Ha nincs semmi bepipálva -> Reset (vagy jelezzük a chat engine-nek hogy üres)
  if (activeFiltersList.length === 0) {
    if (onUpdateCallback) onUpdateCallback([], "clear"); // Üres lista küldése
    return;
  }

  // Itt hívjuk meg a chat-engine-t, hogy "Hahó, itt van 2-3 db filter, fésüld össze őket!"
  if (onUpdateCallback) {
    await onUpdateCallback(activeFiltersList, "merge");
  }
}

// 5. TÖRLÉS
function deleteSavedSearch(name) {
  if (!confirm(`Törlöd ezt a mentést: "${name}"?`)) return;

  let searches = getLocalSearches();
  searches = searches.filter((s) => s.name !== name);
  localStorage.setItem("hazbazis_saved_searches", JSON.stringify(searches));

  renderSavedSearchesList();
}

// --- SEGÉDFÜGGVÉNYEK ---

function getLocalSearches() {
  const data = localStorage.getItem("hazbazis_saved_searches");
  return data ? JSON.parse(data) : [];
}

function generateAutoName(f) {
  // Okos névgenerálás a paraméterekből
  let parts = [];
  if (f.telepules) parts.push(f.telepules);
  if (f.kerulet) parts.push(f.kerulet);
  if (f.maxAr) parts.push(`${f.maxAr / 1000000}M alatt`);
  if (f.tipus) parts.push(f.tipus);

  return parts.length > 0 ? parts.join(", ") : "Mentett keresés";
}
