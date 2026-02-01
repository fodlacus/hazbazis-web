// teras-admin-tool/process_tour.js

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// --- ARGUMENTUM KEZELÉS (ÚJ RÉSZ) ---
const args = process.argv.slice(2); // Levágjuk a "node" és "scriptnev" részeket

if (args.length === 0) {
  console.error("❌ HIBA: Nem adtál meg Ingatlan ID-t!");
  console.error("👉 Használat: node process_tour.js HB-XXXXXX");
  process.exit(1);
}

const INGATLAN_ID = args[0]; // Az első paraméter lesz az ID
console.log(`⚙️  Kiválasztott ingatlan: ${INGATLAN_ID}`);
// Útvonalak
const SOURCE_ROOT = path.join(__dirname, "letoltott_drive_anyag");
const DEST_ROOT = path.join(__dirname, "feltoltesre");
const MEDIA_BASE_URL = `https://media.hazbazis.hu/${INGATLAN_ID}/virtual_tour`;

// --- FIREBASE INIT ---
const serviceAccountPath = "./serviceAccountKey.json";
if (fs.existsSync(serviceAccountPath)) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
} else {
  console.error("❌ HIBA: Nincs serviceAccountKey.json!");
  process.exit(1);
}
const db = admin.firestore();

// --- MÁSOLÓ FÜGGVÉNY ---
function copyFile(fileName, sourceFolder, destFolder) {
  const srcPath = path.join(sourceFolder, fileName);
  const destPath = path.join(destFolder, fileName);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`✅ Átmásolva: ${fileName}`);
    return true;
  } else {
    console.error(`⚠️ HIBA: Hiányzó fájl: ${fileName}`);
    return false;
  }
}

async function run() {
  console.log(`🚀 Többszintes Túra feldolgozása: ${INGATLAN_ID}`);

  const sourceFolder = path.join(SOURCE_ROOT, INGATLAN_ID, "virtual_tour");
  const destFolder = path.join(DEST_ROOT, INGATLAN_ID, "virtual_tour");

  if (!fs.existsSync(path.join(sourceFolder, "tour_config.json"))) {
    console.error(`❌ Hiba: Nincs tour_config.json itt: ${sourceFolder}`);
    process.exit(1);
  }

  if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });

  const config = JSON.parse(
    fs.readFileSync(path.join(sourceFolder, "tour_config.json"), "utf8")
  );

  // ÚJ ADATSTRUKTÚRA
  const finalData = {
    virtual_tour: {
      tobb_szintes: true, // Jelezzük, hogy ez az új típus
      szintek: [],
    },
  };

  try {
    // Végigmegyünk a szinteken
    for (const szint of config.szintek) {
      console.log(`🔹 Szint feldolgozása: ${szint.nev}`);

      const ujSzint = {
        id: szint.id,
        nev: szint.nev,
        alaprajz_url: "",
        szobak: [],
      };

      // 1. Alaprajz másolása
      if (copyFile(szint.alaprajz_file, sourceFolder, destFolder)) {
        ujSzint.alaprajz_url = `${MEDIA_BASE_URL}/${szint.alaprajz_file}`;
      }

      // 2. Szobák feldolgozása
      for (const szoba of szint.szobak) {
        if (copyFile(szoba.file, sourceFolder, destFolder)) {
          ujSzint.szobak.push({
            id: szoba.id,
            nev: szoba.nev,
            panorama_url: `${MEDIA_BASE_URL}/${szoba.file}`,
            x: szoba.x,
            y: szoba.y,
            kezdo_irany: szoba.kezdo_irany || 0,
            hotspots: szoba.hotspots || [], // Átvisszük a hotspotokat is
          });
        }
      }
      finalData.virtual_tour.szintek.push(ujSzint);
    }

    // Firebase Mentés
    console.log("💾 Adatok mentése Firebase-be...");
    await db.collection("lakasok").doc(INGATLAN_ID).update(finalData);

    console.log("✅ KÉSZ! Mehet az R2 feltöltés.");
    process.exit(0);
  } catch (e) {
    console.error("❌ Végzetes hiba:", e);
    process.exit(1);
  }
}

run();
