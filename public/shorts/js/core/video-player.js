// public/shorts/js/core/video-player.js

export const VideoPlayer = {
  video_elem: null,
  lista: [],
  aktualis_index: 0,

  init: function (elem_id) {
    this.video_elem = document.getElementById(elem_id);
    if (!this.video_elem) {
      console.error("❌ A megadott video elem nem talalhato:", elem_id);
    }
  },

  // A SEBESSÉG KULCSA: Előtöltés a háttérben (Cache használat)
  elotoltes: function (index) {
    const kovetkezo = index + 1;
    if (this.lista[kovetkezo] && this.lista[kovetkezo].video_url) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "video";
      link.href = this.lista[kovetkezo].video_url;
      document.head.appendChild(link);
      console.log("⚡ Hatterben elotoltve:", this.lista[kovetkezo].azon);
    }
  },

  // TELJES LEJÁTSZÁS FÜGGVÉNY: Cseréli a forrást és indítja a preload-ot
  lejatszas: async function (index, szurt_lista) {
    if (!szurt_lista || !szurt_lista[index]) return;

    this.lista = szurt_lista;
    this.aktualis_index = index;
    const adat = this.lista[index];

    // Forrás beállítása
    if (this.video_elem.src !== adat.video_url) {
      this.video_elem.src = adat.video_url;
      this.video_elem.load();
    }

    try {
      await this.video_elem.play();
      console.log("▶️ Lejatszas inditva:", adat.azon);

      // Amint elindult, azonnal készítjük a következőt
      this.elotoltes(index);
    } catch (hiba) {
      console.warn("⚠️ Automatikus lejatszas blokkolva, user interakcio kell.");
    }
  },
};

// Globális elérhetőség (opcionális, de hasznos a konzolhoz)
window.VideoPlayer = VideoPlayer;
