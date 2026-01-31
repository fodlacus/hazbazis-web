// teras-admin-tool/upload_tour.js

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// --- KONFIGURÁCIÓ ---
const serviceAccountPath = "./serviceAccountKey.json";

if (fs.existsSync(serviceAccountPath)) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
  console.log("✅ Firebase Admin SDK sikeresen inicializálva.");
} else {
  console.error("❌ HIBA: Nem található a serviceAccountKey.json!");
  console.error("Győződj meg róla, hogy a 'teras-admin-tool' mappában vagy!");
  process.exit(1);
}

const db = admin.firestore();

// --- ADATOK ---
const INGATLAN_ID = "HB-316129"; // A Győri Ingatlan

const virtualTourData = {
  virtual_tour: {
    // Ez a link már az R2-re mutat a struktúrád alapján
    alaprajz_url: "https://media.hazbazis.hu/HB-316129/floor_plan/alaprajz.png",

    szobak: [
      {
        id: "nappali",
        nev: "Nappali",
        // IDEIGLENES teszt kép (Pannellum minta), később cseréljük a sajátodra
        panorama_url: "https://pannellum.org/images/alma.jpg",
        x: 45,
        y: 60,
        kezdo_irany: 0,
      },
      {
        id: "konyha",
        nev: "Konyha",
        panorama_url: "https://pannellum.org/images/bma.jpg",
        x: 75,
        y: 30,
        kezdo_irany: -100,
      },
      {
        id: "halo",
        nev: "Hálószoba",
        panorama_url: "https://pannellum.org/images/cerro-toco-0.jpg",
        x: 25,
        y: 40,
        kezdo_irany: 0,
      },
    ],
  },
};

// --- FUTTATÁS ---
async function run() {
  console.log(`🚀 Adatok feltöltése folyamatban: ${INGATLAN_ID}...`);

  try {
    // JAVÍTÁS: .document() helyett .doc() kell!
    const docRef = db.collection("lakasok").doc(INGATLAN_ID);

    // update() -et használunk, hogy a többi adat megmaradjon!
    await docRef.update(virtualTourData);

    console.log("✅ SIKER! A virtual_tour adat létrejött/frissült.");
    console.log("Most frissítsd az adatlapot a böngészőben!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Hiba történt a feltöltéskor:", error);
    process.exit(1);
  }
}

run();
