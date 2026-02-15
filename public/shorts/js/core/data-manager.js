import { adatbazis } from "../../../src/js/util/firebase-config.js"; // ⚠️ ÚTVONAL ELLENŐRZÉS: Lehet, hogy ../../../src/js/util/firebase-config.js kell neked!
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
        id: item.azon || item.id, // Biztosítjuk, hogy legyen ID
        video_url: item.videoUrl,
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

      // 👇👇👇 ITT A JAVÍTÁS (A KAPUŐR) 👇👇👇

      // Megnézzük, van-e playlist a sessionben
      const playlistStr = sessionStorage.getItem("shorts_playlist");

      if (playlistStr) {
        try {
          const allowedIds = JSON.parse(playlistStr);
          console.log("🎯 [DataManager] Playlist aktív:", allowedIds);

          // Kiszűrjük azokat, amik nincsenek a listán
          // Figyelem: A rawData-ban lévő ID-t (item.id) vetjük össze a listával
          const filteredData = this._rawData.filter((item) =>
            allowedIds.includes(item.id)
          );

          if (filteredData.length > 0) {
            this._rawData = filteredData;
            console.log(
              `✅ [DataManager] Szűrés sikeres! Csak a kért ${filteredData.length} videót töltjük be.`
            );
          } else {
            console.warn(
              "⚠️ [DataManager] A szűrés 0 találatot adott (rossz ID-k?), ezért marad az összes videó."
            );
          }
        } catch (e) {
          console.error("Hiba a playlist feldolgozásakor:", e);
        }
      } else {
        console.log("🌍 [DataManager] Nincs playlist, összes videó betöltése.");
      }

      // 👆👆👆 JAVÍTÁS VÉGE 👆👆👆

      window.lakasok = this._rawData;
      this._currentFeed = [...this._rawData];

      console.log(
        `✅ [DataManager] Kész! ${this._rawData.length} db videó átadva a lejátszónak.`
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
