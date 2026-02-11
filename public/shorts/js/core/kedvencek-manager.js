// public/shorts/js/core/kedvencek-manager.js

import { adatbazis, auth } from "../../../src/js/util/firebase-config.js";
import {
  doc,
  setDoc,
  deleteDoc,
  getDoc, // <--- Ez kell az ellenőrzéshez!
  getDocs,
  collection,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const KedvencekManager = {
  // IGAZI TOGGLE FUNKCIÓ (Hozzáadás/Törlés váltó)
  async kedvenc_valtoztatasa(hirdetes_adat) {
    const user = auth.currentUser;
    if (!user) {
      alert("A kedvencekhez jelentkezz be!");
      return null;
    }

    const hirdetes_id = hirdetes_adat.azon;
    const kedvenc_id = `${user.uid}_${hirdetes_id}`;
    const doc_ref = doc(adatbazis, "kedvencek", kedvenc_id);

    try {
      // 1. Megnézzük, bent van-e már (Felhő alapú ellenőrzés a szinkron miatt)
      const doc_snap = await getDoc(doc_ref);

      if (doc_snap.exists()) {
        // HA LÉTEZIK -> TÖRÖLJÜK
        await deleteDoc(doc_ref);
        console.log("🗑️ Kedvenc törölve a felhőből:", hirdetes_id);
        return "torolve";
      } else {
        // HA NEM LÉTEZIK -> MENTJÜK
        await setDoc(doc_ref, {
          felhasznalo_uid: user.uid,
          hirdetes_azon: hirdetes_id,
          mentve: new Date().toISOString(),
          ingatlan_adatok: hirdetes_adat,
        });
        console.log("❤️ Kedvenc mentve a felhőbe:", hirdetes_id);
        return "mentve";
      }
    } catch (hiba) {
      console.error("Kedvenc hiba:", hiba);
      return false;
    }
  },

  // ÖSSZES KEDVENC LEKÉRÉSE (A szinkron záloga)
  async kedvencek_lekerese() {
    const user = auth.currentUser;
    if (!user) return [];

    try {
      const kedvenc_lista = [];
      const q = query(
        collection(adatbazis, "kedvencek"),
        where("felhasznalo_uid", "==", user.uid)
      );

      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        // Csak a hirdetés azonosítóját adjuk vissza a szűréshez
        kedvenc_lista.push(doc.data().hirdetes_azon);
      });
      return kedvenc_lista;
    } catch (hiba) {
      console.error("Lekeresi hiba:", hiba);
      return [];
    }
  },
};
