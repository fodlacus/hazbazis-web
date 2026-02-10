import { adatbazis } from "../../../src/js/util/firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const FavLogic = {
  _userFavs: [], // Ebben tartjuk a HB azonosítókat a memóriában

  // 1. Kedvencek letöltése a felhőből (indításkor egyszer)
  async init(userAzon) {
    if (!userAzon) return;
    try {
      const q = query(
        collection(adatbazis, "kedvencek"),
        where("felh_azon", "==", userAzon)
      );
      const snapshot = await getDocs(q);
      this._userFavs = snapshot.docs.map((doc) => doc.data().hb_azon);
      console.log("☁️ Kedvencek szinkronizálva:", this._userFavs);
    } catch (e) {
      console.error("Hiba a szinkronizációkor:", e);
    }
  },

  // 2. Ellenőrzés: Kedvenc-e az adott lakás? (Ez kell a szív ikon színéhez)
  isFavorite(hbAzon) {
    return this._userFavs.includes(hbAzon);
  },

  // 3. Ki-be kapcsolás a Firebase-ben
  async toggleFavorite(hbAzon, userAzon) {
    if (!userAzon) {
      alert("A mentéshez be kell jelentkezned!");
      return false;
    }

    try {
      if (this.isFavorite(hbAzon)) {
        // TÖRLÉS
        const q = query(
          collection(adatbazis, "kedvencek"),
          where("felh_azon", "==", userAzon),
          where("hb_azon", "==", hbAzon)
        );
        const snapshot = await getDocs(q);
        snapshot.forEach(
          async (d) => await deleteDoc(doc(adatbazis, "kedvencek", d.id))
        );

        this._userFavs = this._userFavs.filter((id) => id !== hbAzon);
        return false;
      } else {
        // HOZZÁADÁS
        await addDoc(collection(adatbazis, "kedvencek"), {
          felh_azon: userAzon,
          hb_azon: hbAzon,
          datum: new Date(),
        });
        this._userFavs.push(hbAzon);
        return true;
      }
    } catch (e) {
      console.error("Hiba a mentés során:", e);
      return this.isFavorite(hbAzon);
    }
  },
};
