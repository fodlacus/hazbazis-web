const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Inicializálás
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// ENNYI ELEMET HOZUNK VISSZA (Írd át, ha több/kevesebb kell)
const DARABSZAM = 5;

async function restoreFromArchive() {
  console.log(`⏳ ${DARABSZAM} db ingatlan visszaállítása az archívumból...`);

  try {
    // 1. Lekérünk N darab elemet az archívumból
    const snapshot = await db.collection("hb-archiv").limit(DARABSZAM).get();

    if (snapshot.empty) {
      console.log("Nincs semmi az archívumban ('hb-archiv').");
      return;
    }

    const batch = db.batch(); // Kötegelt művelet a biztonságért
    let count = 0;

    // Jövőbeli dátum generálása (Ma + 60 nap)
    const jovoDatum = new Date();
    jovoDatum.setDate(jovoDatum.getDate() + 60);

    snapshot.forEach((doc) => {
      const data = doc.data();
      const id = doc.id;

      // Töröljük a felesleges "archivalas_ideje" mezőt
      delete data.archivalas_ideje;

      // Frissítjük az adatokat, hogy aktív legyen
      const frissitettAdat = {
        ...data,
        statusz: "Aktív",
        lejarat_datum: jovoDatum.toISOString(),
      };

      // 1. Lépés: Létrehozás a 'lakasok'-ban
      const lakasRef = db.collection("lakasok").doc(id);
      batch.set(lakasRef, frissitettAdat);

      // 2. Lépés: Törlés a 'hb-archiv'-ból
      const archivRef = db.collection("hb-archiv").doc(id);
      batch.delete(archivRef);

      console.log(`előkészítve: ${id}`);
      count++;
    });

    // Végrehajtás
    await batch.commit();

    console.log(
      `\n✅ SIKER! ${count} db ingatlan visszakerült az aktívak közé.`
    );
    console.log(
      `Új lejárati dátumuk: ${jovoDatum.toISOString().split("T")[0]}`
    );
  } catch (error) {
    console.error("Hiba történt:", error);
  }
}

restoreFromArchive();
