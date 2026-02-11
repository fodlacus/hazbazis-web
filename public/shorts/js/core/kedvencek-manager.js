// public/shorts/js/core/kedvencek-manager.js

import { adatbazis, auth } from "../../../src/js/util/firebase-config.js";
import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot, // <--- EZT PÓTOLD AZ IMPORTHOZ!
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const KedvencekManager = {
  aktualis_kedvencek: [],

  // FIGYELŐ INDÍTÁSA
  figyelo_inditasa(callback_fuggveny) {
    const user = auth.currentUser;
    if (!user) {
      console.warn("Nincs bejelentkezett felhasznalo a figyelohoz.");
      return null;
    }

    const q = query(
      collection(adatbazis, "kedvencek"),
      where("felhasznalo_uid", "==", user.uid)
    );

    // Az onSnapshot kapcsolatot tart a Firebase-szel
    return onSnapshot(q, (snapshot) => {
      // Itt ürítjük és újratöltjük az aktuális listát
      const uj_lista = [];
      snapshot.forEach((doc) => {
        uj_lista.push(doc.data().hirdetes_azon);
      });

      this.aktualis_kedvencek = uj_lista;

      console.log("🔄 Kedvencek eloben frissitve:", this.aktualis_kedvencek);

      if (callback_fuggveny) callback_fuggveny(this.aktualis_kedvencek);
    });
  },

  // KEDVENC VÁLTOZTATÁSA (A kódod többi része jó volt, marad a toggle)
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
      const doc_snap = await getDoc(doc_ref);
      if (doc_snap.exists()) {
        await deleteDoc(doc_ref);
        return "torolve";
      } else {
        await setDoc(doc_ref, {
          felhasznalo_uid: user.uid,
          hirdetes_azon: hirdetes_id,
          mentve: new Date().toISOString(),
          ingatlan_adatok: hirdetes_adat,
        });
        return "mentve";
      }
    } catch (hiba) {
      console.error("Kedvenc hiba:", hiba);
      return false;
    }
  },

  // LEGEGYSZERŰBB LEKÉRÉS
  // Mivel az onSnapshot folyamatosan frissíti az 'aktualis_kedvencek' tömböt,
  // itt már nem kell Firebase lekérés, csak visszaadjuk a memóriában lévőt.
  async kedvencek_lekerese() {
    return this.aktualis_kedvencek;
  },
};
// public/shorts/js/core/kedvencek-manager.js legvége
window.KedvencekManager = KedvencekManager;
