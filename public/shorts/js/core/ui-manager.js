import { FilterRegistry } from "./filter-registry.js";

export const UIManager = {
  // A te kategória listád alapján bővítve
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

    // A régi stílusú gombok generálása (ikon fentre, alulra a felirat és a hint)
    grid.innerHTML = this.categories
      .map(function (cat) {
        return `
                <div onclick="window.executeFilter('${cat.id}')" 
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
    if (modal) modal.classList.remove("hidden");
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

window.UI = UIManager;
