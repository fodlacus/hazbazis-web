// public/shorts/js/strategies/metro-logic.js

export const MetroLogika = {
  megallok_adatai: {},

  // Dinamikus betoltes az utvonal alapjan
  async inditas_utvonal(utvonal) {
    try {
      const valasz = await fetch(utvonal);
      if (!valasz.ok) throw new Error("JSON nem talalhato");
      this.megallok_adatai = await valasz.json();
      console.log("🚇 Metro adatok sikeresen betoltve:", utvonal);
      return true;
    } catch (hiba) {
      console.error("❌ Metro betoltesi hiba:", hiba);
      return false;
    }
  },

  // Alapertelemezett inditas a Shorts oldalhoz
  async inditas() {
    return await this.inditas_utvonal("./js/strategies/metro_megallok.json");
  },

  tavolsag_szamitas(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Fold sugara meterben
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

  kozelben_levo_megallok(koordinatak, max_tavolsag = 800) {
    if (!koordinatak || koordinatak.length < 2) return [];
    const [lat, lng] = koordinatak;
    const talalt_idk = [];

    Object.keys(this.megallok_adatai).forEach((vonal) => {
      this.megallok_adatai[vonal].forEach((megallo) => {
        const tav = this.tavolsag_szamitas(lat, lng, megallo.lat, megallo.lng);
        if (tav <= max_tavolsag) {
          talalt_idk.push(megallo.id);
        }
      });
    });

    return talalt_idk;
  },
};
