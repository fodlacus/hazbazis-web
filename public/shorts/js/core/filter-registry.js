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

  KEDVENCEK_LISTA: (lista, kedvenc_id_lista) => {
    if (!kedvenc_id_lista || kedvenc_id_lista.length === 0) return [];

    // Csak azokat a hirdetéseket tartjuk meg, amiknek az azonosítója
    // szerepel a Firebase-ből lekért listában
    return lista.filter((hirdetes) => kedvenc_id_lista.includes(hirdetes.azon));
  },

  // METRÓ SZŰRŐJE
  METRO_SZURO: (lista, kivalasztott_megallok) => {
    if (!kivalasztott_megallok || kivalasztott_megallok.length === 0)
      return lista;

    return lista.filter((hirdetes) => {
      if (!hirdetes.metro_kozelseg) return false;
      // Megnézzük, van-e átfedés a hirdetés metrói és a választott megállók között
      return hirdetes.metro_kozelseg.some((id) =>
        kivalasztott_megallok.includes(id)
      );
    });
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
