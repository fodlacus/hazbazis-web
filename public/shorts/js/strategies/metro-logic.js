// public/shorts/js/strategies/metro-logic.js

export const MetroLogic = {
  megallok: {}, // Ide kerülnek be a JSON-ből betöltött adatok

  /**
   * Inicializálás: Betölti a metró megállók koordináta táblázatát
   */
  async init() {
    try {
      // Fontos: Az útvonal a public/shorts/ mappához képest relatív!
      const response = await fetch("./js/strategies/metro_megallok.json");
      if (!response.ok) throw new Error("A JSON fájl nem található!");
      this.megallok = await response.json();
      console.log("🚇 [MetroLogic] Adatok sikeresen betöltve.");
    } catch (error) {
      console.error("❌ [MetroLogic] Hiba a JSON betöltésekor:", error);
    }
  },

  /**
   * Távolság számítása két pont között (Haversine formula)
   * @param {number} lat1, lon1 - Első pont koordinátái
   * @param {number} lat2, lon2 - Második pont koordinátái
   * @returns {number} Távolság méterben
   */
  getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Föld sugara méterben
    const f1 = (lat1 * Math.PI) / 180;
    const f2 = (lat2 * Math.PI) / 180;
    const df = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(df / 2) * Math.sin(df / 2) +
      Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  },

  /**
   * Kiszámolja, mely megállók vannak az ingatlan közelében (pl. mentéskor)
   * @param {Array} coords - [lat, lng] formátumban
   * @param {number} maxDist - Maximális távolság méterben (alapértelmezett 800m)
   * @returns {Array} A közeli megállók ID-jei
   */
  getNearbyStopIds(coords, maxDist = 800) {
    if (!coords || coords.length < 2) return [];
    const [lat, lng] = coords;
    const foundIds = [];

    // Végigmegyünk az összes vonalon (M1, M2, M3, M4)
    Object.keys(this.megallok).forEach((line) => {
      this.megallok[line].forEach((stop) => {
        const dist = this.getDistance(lat, lng, stop.lat, stop.lng);
        if (dist <= maxDist) {
          foundIds.push(stop.id);
        }
      });
    });

    return foundIds;
  },
};
