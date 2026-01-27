const admin = require("firebase-admin");
const fs = require("fs");

// Inicializálás
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// A mappád neve (az ID)
const ID = "teras-764967";

const lakasAdatok = {
  azon: ID,
  nev: "Teszt Ingatlan Zuglóban",
  telepules: "Budapest",
  kerulet: "XIV.",
  varosresz: "Zugló",
  utca: "Angol utca",
  iranyitoszam: "1149",

  // FONTOS: Ezek kellenek a térképhez!
  lat: 47.5168,
  lng: 19.1133,

  vételár: 79900000,
  alapterület: 68,
  szobák: 3,

  statusz: "aktiv",
  tipus: "Lakás",
  allapot: "Felújított",

  hirdeto_uid: "ADMIN_IMPORT", // Csak jelöljük, hogy importált
  letrehozva: new Date().toISOString(),
};

async function letrehozas() {
  try {
    await db.collection("lakasok").doc(ID).set(lakasAdatok);
    console.log(`✅ SIKER! A ${ID} ingatlan létrejött az alap adatokkal.`);
    console.log("👉 Most futtasd a processor.js-t a képekhez!");
  } catch (error) {
    console.error("Hiba:", error);
  }
}

letrehozas();
