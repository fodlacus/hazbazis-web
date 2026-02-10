import { DataManager } from "../core/data-manager.js";
import { FavLogic } from "../strategies/fav-logic.js";

export const ShortsEngine = {
  container: null,
  observer: null,
  currentIndex: 0,
  isGlobalMuted: false,

  /**
   * Motor inicializálása
   */
  init: async function (containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    // 1. Observer beállítása
    this.setupObserver();

    // 2. Kedvencek szinkronizálása a felhővel (Firebase)
    // Feltételezzük, hogy a window.currentUser-ben ott a bejelentkezett user
    const userAzon = window.currentUser?.azon;
    if (userAzon) {
      await FavLogic.init(userAzon);
    }

    // 3. Adatok betöltése
    const initialData = await DataManager.init();

    // 4. Első adag renderelése
    this.renderFeed(initialData);

    // 5. Figyeljük a szűrők változásait
    window.addEventListener("feedUpdated", (e) => {
      this.renderFeed(e.detail);
    });

    window.ShortsEngine = this;
  },

  /**
   * Megjeleníti a videókat a DOM-ban
   */
  renderFeed: function (data) {
    this.container.innerHTML = "";

    if (data.length === 0) {
      this.container.innerHTML = this.getEmptyStateHTML();
      return;
    }

    data.forEach((item, index) => {
      const videoCard = this.createVideoCard(item, index);
      this.container.appendChild(videoCard);
      this.observer.observe(videoCard);
    });

    this.container.scrollTo(0, 0);
  },

  /**
   * Egyetlen videó kártya létrehozása
   */
  createVideoCard: function (item, index) {
    const wrapper = document.createElement("div");
    wrapper.className = "video-container";
    wrapper.dataset.index = index;

    // Ellenőrizzük, hogy kedvenc-e az ingatlan (szűréstől függetlenül)
    const isFav = FavLogic.isFavorite(item.id);
    const heartColor = isFav ? "#ff4b4b" : "currentColor";

    wrapper.innerHTML = `
        <video 
            src="${item.video_url}" 
            loop 
            playsinline 
            class="main-video"
            ${this.isGlobalMuted ? "muted" : ""}
            preload="metadata">
        </video>
        
        <div class="video-overlay">
            <div class="video-info">
                <span class="brand-badge">${item.id}</span>
                <h3>${item.title}</h3>
                <p class="specs">${item.price} • ${item.size} • ${
      item.rooms
    }</p>
                <p class="text-white/70 text-xs mt-1">${item.address}</p>
            </div>
        </div>

        <div class="controls">
            <button class="control-btn" onclick="event.stopPropagation(); location.href='../../index.html'">🏠</button>
            <button class="control-btn" onclick="event.stopPropagation(); window.UI.openDiscovery()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
            </button>
            <button class="control-btn" onclick="event.stopPropagation(); window.executeFilter('metro')">🚇</button>
            
            <button class="control-btn heart-btn" onclick="event.stopPropagation(); window.handleToggleFav('${
              item.id
            }', this)">
                <svg viewBox="0 0 24 24" fill="${heartColor}" class="w-5 h-5">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            </button>

            <button class="control-btn mute-btn" onclick="event.stopPropagation(); window.ShortsEngine.toggleMute(this)">
                ${this.isGlobalMuted ? "🔇" : "🔊"}
            </button>
            <button class="control-btn" onclick="event.stopPropagation(); window.openDetails('${
              item.id
            }')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            </button>
        </div>
    `;

    wrapper.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      const video = wrapper.querySelector("video");
      this.togglePlay(video);
    });

    return wrapper;
  },

  /**
   * Hang kezelése
   */
  toggleMute: function (button) {
    this.isGlobalMuted = !this.isGlobalMuted;
    const videos = document.querySelectorAll("video");
    videos.forEach((v) => (v.muted = this.isGlobalMuted));

    document.querySelectorAll(".mute-btn").forEach((btn) => {
      btn.innerText = this.isGlobalMuted ? "🔇" : "🔊";
    });
  },

  /**
   * Observer beállítása
   */
  setupObserver: function () {
    const options = { threshold: 0.6 };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target.querySelector("video");
        if (entry.isIntersecting) {
          video.muted = this.isGlobalMuted;
          video.play().catch(() => {});
          entry.target.classList.add("active");
        } else {
          video.pause();
          entry.target.classList.remove("active");
        }
      });
    }, options);
  },

  togglePlay: function (video) {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  },

  getEmptyStateHTML: function () {
    return `
      <div class="flex flex-col items-center justify-center h-full text-center p-10">
          <div class="text-6xl mb-4 text-gray-500">🏙️</div>
          <h3 class="text-xl font-bold">Nincs találat</h3>
          <p class="text-gray-400">Próbálj meg más szűrőt választani!</p>
      </div>
    `;
  },
};
