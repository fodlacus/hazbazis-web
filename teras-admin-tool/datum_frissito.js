const admin = require("firebase-admin");

// Itt töltjük be a kulcsot, ami ott van a mappádban
const serviceAccount = require("./serviceAccountKey.json");

// Inicializálás Admin jogokkal
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function setAllExpired() {
  console.log("⏳ Csatlakozás az adatbázishoz (Admin módban)...");

  try {
    // 1. Lekérjük az összes lakást
    const querySnapshot = await db.collection("lakasok").get();

    if (querySnapshot.empty) {
      console.log("Nincs találat a 'lakasok' gyűjteményben.");
      return;
    }

    console.log(
      `Találat: ${querySnapshot.size} db ingatlan. Frissítés kezdése...`
    );

    // 2. Dátum generálása (Tegnap dél)
    const tegnap = new Date();
    tegnap.setDate(tegnap.getDate() - 1);
    tegnap.setHours(12, 0, 0, 0);
    const tegnapISO = tegnap.toISOString();

    // 3. Batch (kötegelt) frissítés a hatékonyságért
    // A Firestore Batch limitje 500 művelet, ezért ha több van, darabolni kell.
    // Itt most egyszerűsítve csináljuk (Promise.all), ami pár száz elemnél tökéletes.

    const updatePromises = [];

    querySnapshot.forEach((doc) => {
      const p = db
        .collection("lakasok")
        .doc(doc.id)
        .update({
          lejarat_datum: tegnapISO,
          // statusz: "Aktív" // Ezt kiveheted a kommentből, ha azt is vissza akarod állítani
        })
        .then(() => console.log(`✔ ${doc.id} -> ${tegnapISO}`))
        .catch((err) => console.error(`❌ Hiba (${doc.id}):`, err.message));

      updatePromises.push(p);
    });

    await Promise.all(updatePromises);

    console.log("\n✅ SIKER! Az Admin SDK minden szabályt felülírt.");
  } catch (error) {
    console.error("Végzetes hiba:", error);
  }
}

setAllExpired();
