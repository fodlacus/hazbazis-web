// public/shorts/js/core/ui-manager.js

import { FilterRegistry } from "./filter-registry.js";

// --- 1. ÁLTALÁNOS UI KEZELŐ ---
export const UIManager = {
  categories: [
    {
      id: "budapest",
      title: "Budapest",
      icon: "🏙️",
      hint: "Kerületek szerint",
    },
    {
      id: "videk",
      title: "Vidéki Élet",
      icon: "🌳",
      hint: "Városok és falvak",
    },
    { id: "lakopark", title: "Lakópark", icon: "🏢", hint: "Városválasztó" },
    { id: "alberlet", title: "Albérlet", icon: "🔑", hint: "Város + Kerület" },
    { id: "garazs", title: "Garázs", icon: "🚗", hint: "Helyszín szerint" },
    { id: "olcso", title: "50M alatt", icon: "💰", hint: "Településenként" },
    { id: "luxus", title: "Luxus", icon: "💎", hint: "Városok szerint" },
    { id: "hb_id", title: "HB Kereső", icon: "🔍", hint: "Egyedi azonosító" },
    { id: "KEDVENCEK", title: "Kedvencek", icon: "❤️", hint: "Saját listád" },
    {
      id: "metro",
      title: "Metró közelben",
      icon: "🚇",
      hint: "Válassz megállót",
    },
  ],

  init: function () {
    this.renderTiles();
    this.setupEventListeners();
  },

  renderTiles: function () {
    const grid = document.getElementById("modal-content-grid");
    if (!grid) return;

    grid.innerHTML = this.categories
      .map(function (cat) {
        // Ha metró, akkor a MetroUI-t hívjuk meg, egyébként a sima szűrőt
        const clickAction =
          cat.id === "metro"
            ? "window.MetroUI.openMetroPicker()"
            : `window.executeFilter('${cat.id}')`;

        return `
                <div onclick="${clickAction}" 
                     class="tile-item group relative overflow-hidden bg-[#222811] border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-between hover:bg-[#E2F1B0] transition-all duration-300 active:scale-95 shadow-xl">
                    <div class="text-3xl mb-2 group-hover:scale-110 transition-transform">${cat.icon}</div>
                    <div class="flex flex-col items-center">
                        <span class="text-sm font-bold text-white group-hover:text-[#3D4A16] uppercase tracking-wider">${cat.title}</span>
                        <span class="text-[10px] text-[#E2F1B0] group-hover:text-[#3D4A16]/70 mt-1 bg-black/30 group-hover:bg-transparent px-2 py-0.5 rounded-full">${cat.hint}</span>
                    </div>
                </div>
            `;
      })
      .join("");
  },

  openDiscovery: function () {
    const modal = document.getElementById("filter-modal");
    const container = document.getElementById("modal-content-grid");
    const title = document.getElementById("modal-title");

    if (modal) {
      modal.classList.remove("hidden");

      // VISSZAÁLLÍTÁS: Ha a metró korábban átállította, itt visszatesszük
      if (container) {
        container.classList.replace("grid-cols-1", "grid-cols-2");
      }
      if (title) {
        title.innerText = "Keresési segédlet 🌍";
      }

      this.renderTiles();
    }
  },

  closeModal: function () {
    const modal = document.getElementById("filter-modal");
    if (modal) modal.classList.add("hidden");
  },

  setupEventListeners: function () {
    const resetBtn = document.getElementById("reset-filter-btn");
    if (resetBtn) {
      resetBtn.onclick = () => window.executeFilter("all");
    }
  },
};

// --- 2. SPECIFIKUS METRÓ UI KEZELŐ ---

export const MetroUI = {
  selectedLine: null,
  tempSelectedStops: [],

  async openMetroPicker() {
    // 1. Dinamikus import
    const module = await import("../strategies/metro-logic.js");
    const MetroLogika = module.MetroLogika; // Itt figyeltem a nevedre (Logika)

    // 2. Ellenőrzés és inicializálás az ÚJ neveken
    if (
      !MetroLogika.megallok_adatai ||
      Object.keys(MetroLogika.megallok_adatai).length === 0
    ) {
      await MetroLogika.inditas(); // init helyett inditas()
    }

    const container = document.getElementById("modal-content-grid");
    const title = document.getElementById("modal-title");

    if (title) title.innerText = "Válassz metróvonalat 🚇";
    if (container) {
      container.classList.replace("grid-cols-2", "grid-cols-1");
      container.innerHTML = `
          <div class="flex justify-between gap-2 mb-6 p-1 bg-white/5 rounded-2xl">
              <button onclick="window.MetroUI.renderLine('M1')" class="metro-btn m1">M1</button>
              <button onclick="window.MetroUI.renderLine('M2')" class="metro-btn m2">M2</button>
              <button onclick="window.MetroUI.renderLine('M3')" class="metro-btn m3">M3</button>
              <button onclick="window.MetroUI.renderLine('M4')" class="metro-btn m4">M4</button>
          </div>
          <div id="stop-list" class="space-y-2 overflow-y-auto max-h-[40vh] pr-2 custom-scrollbar">
              <p class="text-center text-white/30 py-10">Kattints egy vonalra a megállókhoz!</p>
          </div>
          <div class="mt-6 flex flex-col gap-2">
                <div class="flex gap-2">
                    <button onclick="window.UI.openDiscovery()" class="flex-1 py-4 rounded-xl bg-white/10 font-bold text-white">Vissza</button>
                    <button onclick="window.MetroUI.clearSelections()" class="flex-1 py-4 rounded-xl bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                        TÖRLÉS
                    </button>
                </div>
                <button onclick="window.MetroUI.applyFilter()" class="w-full py-4 rounded-xl bg-lime-400 text-black font-black shadow-lg shadow-lime-400/20">
                      MEGÁLLÓK SZŰRÉSE
                </button>
           </div>     
     `;
    }
  },

  renderLine(lineId) {
    this.selectedLine = lineId;
    import("../strategies/metro-logic.js").then((module) => {
      const MetroLogika = module.MetroLogika;
      // Itt is: megallok helyett megallok_adatai
      const stops = MetroLogika.megallok_adatai[lineId] || [];
      const listContainer = document.getElementById("stop-list");

      document
        .querySelectorAll(".metro-btn")
        .forEach((btn) => btn.classList.remove("active"));
      const activeBtn = document.querySelector(
        `.metro-btn.${lineId.toLowerCase()}`
      );
      if (activeBtn) activeBtn.classList.add("active");

      listContainer.innerHTML = stops
        .map(
          (stop) => `
              <label class="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group">
                  <input type="checkbox" value="${stop.id}" 
                      ${
                        this.tempSelectedStops.includes(stop.id)
                          ? "checked"
                          : ""
                      }
                      onchange="window.MetroUI.toggleStop('${stop.id}')"
                      class="w-6 h-6 rounded border-white/20 accent-lime-400">
                  <span class="flex-1 font-medium group-hover:text-lime-400 transition">${
                    stop.nev
                  }</span>
              </label>
          `
        )
        .join("");
    });
  },

  toggleStop(stopId) {
    const index = this.tempSelectedStops.indexOf(stopId);
    if (index > -1) this.tempSelectedStops.splice(index, 1);
    else this.tempSelectedStops.push(stopId);
  },

  async applyFilter() {
    if (this.tempSelectedStops.length === 0) {
      alert("Válassz legalább egy megállót!");
      return;
    }
    if (typeof window.executeFilter === "function") {
      window.executeFilter("METRO_SZURO", this.tempSelectedStops);
    }
    window.UI.closeModal();
  },

  clearSelections() {
    // 1. Üresre állítjuk a kiválasztott megállók tömbjét
    this.tempSelectedStops = [];

    // 2. Ha éppen nyitva van egy vonal, frissítjük a listát, hogy eltűnjenek a pipák
    if (this.selectedLine) {
      this.renderLine(this.selectedLine);
    } else {
      // Ha nincs vonal kiválasztva, csak egy alap üzenetet teszünk vissza
      const listContainer = document.getElementById("stop-list");
      if (listContainer) {
        listContainer.innerHTML =
          '<p class="text-center text-white/30 py-10">Kijelölések törölve.</p>';
      }
    }
    console.log("Empty: Kijelölések kiürítve.");
  },
};

// --- GLOBÁLIS REGISZTRÁCIÓ ---
window.UI = UIManager;
window.MetroUI = MetroUI;
