import { adatbazis, auth } from "../../../src/js/util/firebase-config.js";
import {
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const KedvencekManager = {
  // KEDVENC HOZZÁADÁSA VAGY TÖRLÉSE (Toggle)
  async kedvenc_modositasa(hirdetes_adat) {
    const user = auth.currentUser;
    if (!user) {
      alert("A kedvencekhez jelentkezz be!");
      return;
    }

    const hirdetes_id = hirdetes_adat.azon;
    // Egyedi kulcs: user_hirdetes (megakadályozza a duplikációt)
    const kedvenc_id = `${user.uid}_${hirdetes_id}`;
    const doc_ref = doc(adatbazis, "kedvencek", kedvenc_id);

    try {
      // Itt egy egyszerű logikát alkalmazunk: ha már ott van, töröljük, ha nincs, hozzáadjuk
      // De a duplikáció elkerülése végett a setDoc a biztos
      await setDoc(doc_ref, {
        felhasznalo_uid: user.uid,
        hirdetes_azon: hirdetes_id,
        mentve: new Date().toISOString(),
        // Elmentjük az alap adatokat is, hogy ne kelljen újra lekérdezni a listázáshoz
        ingatlan_adatok: hirdetes_adat,
      });
      return true;
    } catch (hiba) {
      console.error("Kedvenc mentesi hiba:", hiba);
      return false;
    }
  },

  async kedvenc_torlese(hirdetes_id) {
    const user = auth.currentUser;
    if (!user) return;
    const kedvenc_id = `${user.uid}_${hirdetes_id}`;
    await deleteDoc(doc(adatbazis, "kedvencek", kedvenc_id));
  },

  // ÖSSZES KEDVENC LEKÉRÉSE (Ez biztosítja a szinkront az eszközök között)
  async kedvencek_lekerese() {
    const user = auth.currentUser;
    if (!user) return [];

    const kedvenc_lista = [];
    const q = query(
      collection(adatbazis, "kedvencek"),
      where("felhasznalo_uid", "==", user.uid)
    );

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      kedvenc_lista.push(doc.data().hirdetes_azon);
    });
    return kedvenc_lista;
  },
};
