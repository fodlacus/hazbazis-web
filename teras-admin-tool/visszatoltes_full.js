const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Inicializálás
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function restoreAllFromArchive() {
    console.log("⏳ Az összes archivált elem lekérése...");

    try {
        // NINCS LIMIT - Mindent lekérünk
        const snapshot = await db.collection("hb-archiv").get();

        if (snapshot.empty) {
            console.log("Üres az archívum. Nincs mit visszatölteni.");
            return;
        }

        console.log(`Találat: ${snapshot.size} db elem. Visszaállítás indítása...`);

        // Firestore Batch limit: 500 művelet / batch. 
        // Ha több van, több batch kell. Ez a kód kezeli a többit is.
        let batch = db.batch();
        let operationCounter = 0;
        let batchCount = 0;

        // Jövőbeli dátum generálása (Ma + 90 nap, hogy ne járjon le egyhamar)
        const jovoDatum = new Date();
        jovoDatum.setDate(jovoDatum.getDate() + 90);

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const id = doc.id;

            // Felesleges mező törlése
            delete data.archivalas_ideje;

            // Adatok frissítése
            const frissitettAdat = {
                ...data,
                statusz: "Aktív",
                lejarat_datum: jovoDatum.toISOString()
            };

            // 1. Vissza a lakasokba
            const lakasRef = db.collection("lakasok").doc(id);
            batch.set(lakasRef, frissitettAdat);

            // 2. Törlés az archivból
            const archivRef = db.collection("hb-archiv").doc(id);
            batch.delete(archivRef);

            operationCounter++;

            // Ha elértük a 400 műveletet (biztonsági ráhagyással 500 helyett), küldjük be
            if (operationCounter >= 400) {
                await batch.commit();
                console.log(`📦 Batch ${++batchCount} elküldve...`);
                batch = db.batch(); // Új batch indítása
                operationCounter = 0;
            }
        }

        // Maradék beküldése
        if (operationCounter > 0) {
            await batch.commit();
        }

        console.log(`\n✅ KÉSZ! Összesen ${snapshot.size} db elem visszakerült.`);
        console.log("Most már folytathatjuk a loader.js fejlesztését a videókkal!");

    } catch (error) {
        console.error("Hiba történt:", error);
    }
}

restoreAllFromArchive();