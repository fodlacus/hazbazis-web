import { adatbazis } from "../../src/js/util/firebase-config.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const DataManager = {
  _rawData: [],
  _currentFeed: [],

  async init() {
    try {
      // 1. Várakozási fázis (max 3 másodperc)
      let attempts = 0;
      while (!window.lakasok && attempts < 15) {
        console.log(`[DataManager] Várakozás az adatokra (${attempts + 1})...`);
        await new Promise((resolve) => setTimeout(resolve, 200));
        attempts++;
      }

      const raw = window.lakasok || [];

      if (raw.length === 0) {
        console.warn("[DataManager] Az adatok megérkeztek, de a lista üres.");
        return [];
      }

      // 2. Normalizálási fázis
      this._rawData = raw.map((item) => ({
        id: item.lakas_azon || item.azon,
        video_url: item.videoUrl || item.shorts_video,
        title: `${item.telepules}${item.kerulet ? ", " + item.kerulet : ""}`,
        address: `${item.utca || ""} utca`,
        price: item.vételár
          ? (item.vételár / 1000000).toFixed(1) + " M Ft"
          : "Ár nélkül",
        ar_szam: item.vételár || 0,
        // Biztonsági mentés, ha véletlenül hiányozna egy mező
        size: `${item.alapterület || 0} m²`,
        rooms: `${item.szobák || 0} szoba`,
        city: item.telepules || "",
        district: item.kerulet || "",
        description: item.leírás || "",
        coords: item.lat && item.lng ? [item.lat, item.lng] : null,
      }));

      this._currentFeed = [...this._rawData];
      console.log(
        "DataManager kész, adatok normalizálva:",
        this._rawData.length
      );
      return this._currentFeed;
    } catch (error) {
      console.error("Kritikus hiba a DataManager inicializálásakor:", error);
      return [];
    }
  },

  setFilteredData(newList) {
    this._currentFeed = newList;
    window.dispatchEvent(new CustomEvent("feedUpdated", { detail: newList }));
  },

  getRawData() {
    return [...this._rawData];
  },
};
