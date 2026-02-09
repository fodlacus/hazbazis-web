import { DataManager } from "./data-manager.js";

/**
 * FilterRegistry - A csempék és a logika közötti összekötő kapocs
 */
export const FilterRegistry = {
  // 1. BUDAPEST SZŰRŐ
  budapest: async () => {
    const data = DataManager.getRawData();
    return data.filter(
      (item) => item.city === "Budapest" || item.telepules === "Budapest"
    );
  },

  // 2. LUXUS SZŰRŐ (Például 150M Ft felett)
  luxus: async () => {
    const data = DataManager.getRawData();
    // Feltételezzük, hogy az ár számként is megvan az adatban
    return data.filter((item) => parseInt(item.ar_szam) > 150000000);
  },

  // 3. OLCSÓ (50M alatt)
  olcso: async () => {
    const data = DataManager.getRawData();
    return data.filter((item) => parseInt(item.ar_szam) < 50000000);
  },

  // 4. KEDVENCEK (Dinamikus betöltéssel a strategies mappából)
  KEDVENCEK: async () => {
    const { FavLogic } = await import("../strategies/fav-logic.js");
    return FavLogic.filterFavorites(DataManager.getRawData());
  },

  // 5. METRÓ KÖZELBEN (Dinamikus betöltéssel)
  metro: async (params) => {
    const { MetroLogic } = await import("../strategies/metro-logic.js");
    // A params tartalmazza a kiválasztott koordinátákat
    return MetroLogic.filterByStation(DataManager.getRawData(), params.coords);
  },

  // 6. MINDEN VIDEÓ (Reset)
  all: async () => {
    return DataManager.getRawData();
  },
};

/**
 * Globális hívókezelő, amit a UI használ
 */
window.executeFilter = async (tileId, params = null) => {
  console.log(`Szűrés indítása: ${tileId}`);

  if (FilterRegistry[tileId]) {
    const filteredData = await FilterRegistry[tileId](params);
    DataManager.setFilteredData(filteredData);

    // Modal bezárása a szűrés után
    if (window.UI) window.UI.closeModal();
  } else {
    console.warn(`Nincs regisztrált logika a következőhöz: ${tileId}`);
  }
};
