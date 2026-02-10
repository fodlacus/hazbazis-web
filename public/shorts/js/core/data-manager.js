import { adatbazis } from "../../../src/js/util/firebase-config.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const DataManager = {
  _rawData: [],
  _currentFeed: [],

  async init() {
    try {
      console.log("🔥 [DataManager] Firebase lekérdezés indítása...");
      const querySnapshot = await getDocs(collection(adatbazis, "lakasok"));
      const raw = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        // SZŰRÉS: Csak azokat engedjük át, ahol a "videoUrl" létezik és nem üres
        if (
          data.videoUrl &&
          typeof data.videoUrl === "string" &&
          data.videoUrl.trim() !== ""
        ) {
          raw.push({ id: doc.id, ...data });
        }
      });

      // Normalizálás: a motornak már csak a tiszta, ellenőrzött adatot adjuk át
      this._rawData = raw.map((item) => ({
        id: item.lakas_azon || item.azon || item.id,
        video_url: item.videoUrl, // Most már fixen a jó mezőnév
        title: item.telepules || "Budapest",
        address: `${item.utca || ""} utca`,
        price: item.vételár
          ? (item.vételár / 1000000).toFixed(1) + " M Ft"
          : "Ár alatt",
        ar_szam: item.vételár || 0,
        size: `${item.alapterület || 0} m²`,
        rooms: `${item.szobák || 0} szoba`,
        city: item.telepules || "",
        district: item.kerulet || "",
        coords: item.lat && item.lng ? [item.lat, item.lng] : null,
      }));

      window.lakasok = this._rawData; // A Registry miatt maradjon meg a globális elérés
      this._currentFeed = [...this._rawData];

      console.log(
        `✅ [DataManager] Kész! ${this._rawData.length} videós ingatlan betöltve.`
      );
      return this._currentFeed;
    } catch (error) {
      console.error("❌ Hiba az adatok lekérésekor:", error);
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
