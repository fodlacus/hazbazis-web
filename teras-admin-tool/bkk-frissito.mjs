// bkk-frissito.mjs

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";

// --- 1. FIREBASE BEÁLLÍTÁSOK ---
// IDE MÁSOLD BE A SAJÁT firebaseConfig ADATAIDAT a firebase-config.js fájlodból!

const firebaseConfig = {
  apiKey: "AIzaSyCohNOyA4S3XEayQTSqdshNkPxisNdoc90",
  authDomain: "hazbazis.firebaseapp.com",
  projectId: "hazbazis",
  storageBucket: "hazbazis.firebasestorage.app",
  messagingSenderId: "228035570741",
  appId: "1:228035570741:web:58827ab31ede50f1f6157c",
};

// Inicializálás Node.js alatt
const app = initializeApp(firebaseConfig);
const adatbazis = getFirestore(app);

// --- 2. BKK FÜGGVÉNY (300m, limit 10, okos szűrő) ---
async function bkkJaratokLekerdezese(lat, lng) {
  const BKK_API_KEY = "e34bb19f-331e-4bed-89a4-fd9ee86280d0";
  const radius = 300;
  const url = `https://futar.bkk.hu/api/query/v1/ws/otp/api/where/stops-for-location.json?lat=${lat}&lon=${lng}&radius=${radius}&key=${BKK_API_KEY}`;

  try {
    const valasz = await fetch(url);
    const adat = await valasz.json();

    if (adat.code !== 200 || !adat.data || !adat.data.list) return [];

    const megallok = adat.data.list;
    const jarat_szotar = adat.data.references.routes;
    const egyedi_jarat_idk = new Set();

    megallok.forEach((megallo) => {
      if (megallo.routeIds) {
        megallo.routeIds.forEach((routeId) => egyedi_jarat_idk.add(routeId));
      }
    });

    let vegleges_jaratok = [];

    egyedi_jarat_idk.forEach((routeId) => {
      const jaratAdat = jarat_szotar[routeId];
      if (jaratAdat) {
        const szamErtek = parseInt(jaratAdat.shortName, 10);
        const isEjszakai = szamErtek >= 900 && szamErtek <= 999;

        if (!isEjszakai) {
          vegleges_jaratok.push({
            szam: jaratAdat.shortName,
            tipus: jaratAdat.type,
            szin: jaratAdat.color,
            szoveg_szin: jaratAdat.textColor,
          });
        }
      }
    });

    const tipusSuly = { SUBWAY: 1, TRAM: 2, TROLLEYBUS: 3, BUS: 4 };

    vegleges_jaratok.sort((a, b) => {
      if (tipusSuly[a.tipus] !== tipusSuly[b.tipus]) {
        return tipusSuly[a.tipus] - tipusSuly[b.tipus];
      }
      return a.szam.localeCompare(b.szam, undefined, { numeric: true });
    });

    return vegleges_jaratok.slice(0, 10);
  } catch (hiba) {
    console.error("BKK API Hiba:", hiba);
    return [];
  }
}

// --- 3. FŐ FRISSÍTŐ FOLYAMAT ---
async function bkkAdatokVisszamenolegesFrissitese() {
  console.log("🚀 BKK visszamenőleges frissítés indul Node.js alatt...");
  let sikeres = 0;
  let hibas = 0;

  try {
    const lakasokRef = collection(adatbazis, "lakasok");
    const snapshot = await getDocs(lakasokRef);
    const osszesLakas = snapshot.docs;

    console.log(
      `Összesen ${osszesLakas.length} db lakás vizsgálata következik a Firebase-ből.`
    );

    for (let i = 0; i < osszesLakas.length; i++) {
      const dokumentum = osszesLakas[i];
      const adat = dokumentum.data();
      const docRef = doc(adatbazis, "lakasok", dokumentum.id);

      // Csak akkor kérjük le, ha van koordináta
      if (adat.lat && adat.lng) {
        console.log(
          `⏳ [${i + 1}/${osszesLakas.length}] ${
            adat.azon || dokumentum.id
          } frissítése...`
        );

        try {
          const jaratok = await bkkJaratokLekerdezese(adat.lat, adat.lng);

          await updateDoc(docRef, { bkk_jaratok: jaratok });

          console.log(
            `✅ ${adat.azon || dokumentum.id} KÉSZ! (${jaratok.length} járat)`
          );
          sikeres++;
        } catch (bkkHiba) {
          console.error(
            `❌ Hiba a ${adat.azon || dokumentum.id} lekérésekor:`,
            bkkHiba
          );
          hibas++;
        }

        // 300 ms szünet a rate limit elkerülésére
        await new Promise((resolve) => setTimeout(resolve, 300));
      } else {
        console.log(
          `⏭️ [${i + 1}/${osszesLakas.length}] ${
            adat.azon || dokumentum.id
          } kihagyva (nincsenek koordináták).`
        );
      }
    }

    console.log(
      `\n🎉 FOLYAMAT VÉGET ÉRT! Sikeresen frissítve: ${sikeres} db, Hibás: ${hibas} db.`
    );
    process.exit(0); // Kilépünk a programból
  } catch (error) {
    console.error("Kritikus hiba a folyamat során:", error);
    process.exit(1);
  }
}

// Indítás
bkkAdatokVisszamenolegesFrissitese();
