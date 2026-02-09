import { DataManager } from "../core/data-manager.js";

export const ShortsEngine = {
  container: null,
  observer: null,
  currentIndex: 0,

  /**
   * Motor inicializálása
   * @param {string} containerId - A HTML elem ID-ja, ahová a videók kerülnek
   */
  async init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    // 1. Observer beállítása (figyeli melyik videó aktív)
    this.setupObserver();

    // 2. Adatok betöltése
    const initialData = await DataManager.init();

    // 3. Első adag renderelése
    this.renderFeed(initialData);

    // 4. Figyeljük a szűrők változásait
    window.addEventListener("feedUpdated", (e) => {
      this.renderFeed(e.detail);
    });
  },

  /**
   * Megjeleníti a videókat a DOM-ban
   */
  renderFeed(data) {
    this.container.innerHTML = ""; // Régi videók ürítése

    if (data.length === 0) {
      this.container.innerHTML = this.getEmptyStateHTML();
      return;
    }

    data.forEach((item, index) => {
      const videoCard = this.createVideoCard(item, index);
      this.container.appendChild(videoCard);
    });

    // Visszaugrás az elejére szűrés után
    this.container.scrollTo(0, 0);
  },

  /**
   * Egyetlen videó kártya (HTML struktúra) létrehozása
   */
  createVideoCard(item, index) {
    const wrapper = document.createElement("div");
    wrapper.className = "video-container";
    wrapper.dataset.index = index;

    wrapper.innerHTML = `
    <video 
        src="${item.video_url}" 
        loop 
        playsinline 
        preload="metadata"
        poster="${item.cover_image || ""}">
    </video>
    
    <div class="video-overlay">
        <div class="video-info">
            <span class="brand-badge">${item.id}</span> 
            <h3>${item.title}</h3>
            <p class="specs">${item.price} • ${item.size} • ${item.rooms}</p>
            <p style="font-size: 0.75rem; color: rgba(255,255,255,0.7); margin-top: 4px;">
                ${item.address}
            </p>
        </div>
    </div>

    <div class="controls">
        <button class="control-btn" title="Kedvenc" onclick="event.stopPropagation(); window.toggleFavorite('${
          item.id
        }')">
            ❤️
        </button>
        <button class="control-btn" title="Részletek" onclick="event.stopPropagation(); window.openDetails('${
          item.id
        }')">
            ℹ️
        </button>
        <button class="control-btn" title="Felfedezés" onclick="event.stopPropagation(); window.UI.openDiscovery()">
            🌍
        </button>
    </div>
`;

    // Kattintásra Play/Pause funkció
    wrapper.addEventListener("click", () =>
      this.togglePlay(wrapper.querySelector("video"))
    );

    return wrapper;
  },

  /**
   * Intelligens lejátszásvezérlés
   */
  setupObserver() {
    const options = {
      threshold: 0.6, // Akkor vált, ha a videó 60%-a látszik
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target.querySelector("video");
        if (entry.isIntersecting) {
          video.play().catch(() => {}); // Böngésző korlátozás kezelése
          entry.target.classList.add("active");
        } else {
          video.pause();
          entry.target.classList.remove("active");
        }
      });
    }, options);
  },

  togglePlay(video) {
    if (video.paused) video.play();
    else video.pause();
  },

  getEmptyStateHTML() {
    return `
            <div class="flex flex-col items-center justify-center h-full text-center p-10">
                <div class="text-6-xl mb-4 text-gray-500">🏙️</div>
                <h3 class="text-xl font-bold">Nincs találat</h3>
                <p class="text-gray-400">Próbálj meg más szűrőt választani!</p>
            </div>
        `;
  },
};
