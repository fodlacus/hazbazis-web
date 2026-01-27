const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// --- BEÁLLÍTÁSOK ---
const MEDIA_BASE_URL = "https://media.hazbazis.hu";
const SOURCE_ROOT = "./letoltott_drive_anyag";

// Firebase ellenőrzés és indítás
if (fs.existsSync("./serviceAccountKey.json")) {
  admin.initializeApp({
    credential: admin.credential.cert(require("./serviceAccountKey.json")),
  });
} else {
  console.error("❌ HIBA: Nem találom a serviceAccountKey.json fájlt!");
  process.exit(1);
}
const db = admin.firestore();

async function runProcessor(ingatlanId) {
  console.log(`🚀 Feldolgozás indítása: ${ingatlanId}`);

  const sourceBase = path.join(__dirname, SOURCE_ROOT, ingatlanId);
  const targetBase = path.join(__dirname, "feltoltesre", ingatlanId);

  // 1. Forrás mappa ellenőrzése
  if (!fs.existsSync(sourceBase)) {
    console.error(`❌ Hiba: A forrás mappa nem található: ${sourceBase}`);
    return;
  }

  // 2. Adatstruktúra előkészítése
  // A képeket tömbben tároljuk, az alaprajzot és videót stringben
  let updateData = {
    kepek_horiz: [],
    kepek_vert: [],
    kepek_pano: [],
    floor_plan: "",
    shorts_video: "",
    updatedAt: new Date().toISOString(),
  };

  // 3. KÉP KATEGÓRIÁK FELDOLGOZÁSA
  // Fontos: A 'dir' a mappák nevei a fotóid alapján!
  const categories = [
    { dir: "kepek_horiz", prefix: "h_", field: "kepek_horiz" },
    { dir: "kepek_vert", prefix: "v_", field: "kepek_vert" },
    { dir: "kepek_pano", prefix: "p_", field: "kepek_pano" },
  ];

  for (let cat of categories) {
    const sourcePath = path.join(sourceBase, cat.dir);
    const targetPath = path.join(targetBase, cat.dir);

    if (fs.existsSync(sourcePath)) {
      // Csak a fájlokat listázzuk (rejtett fájlok és mappák nélkül)
      const files = fs
        .readdirSync(sourcePath)
        .filter(
          (f) =>
            !f.startsWith(".") &&
            fs.lstatSync(path.join(sourcePath, f)).isFile()
        );

      if (files.length > 0) {
        if (!fs.existsSync(targetPath))
          fs.mkdirSync(targetPath, { recursive: true });

        // Név szerinti rendezés, hogy a sorrend fix legyen
        files.sort().forEach((file, index) => {
          // Kiterjesztés automatikus felismerése (.jpg, .png, .jpeg)
          const ext = path.extname(file).toLowerCase();

          // Eredeti név kiterjesztés nélkül (pl. "nappali", "konyha") -> EZT MENTJÜK EL NÉVKÉNT!
          const originalName = path.basename(file, ext);

          // Új, rendszer-barát fájlnév (pl. h_1.jpg)
          const newName = `${cat.prefix}${index + 1}${ext}`;

          // Fájl másolása a feltöltési mappába
          fs.copyFileSync(
            path.join(sourcePath, file),
            path.join(targetPath, newName)
          );

          // URL generálása
          const url = `${MEDIA_BASE_URL}/${ingatlanId}/${cat.dir}/${newName}`;

          // --- ÚJ STRUKTÚRA: OBJEKTUMOKAT MENTÜNK ---
          // Ez azért kell, hogy később tudjuk, melyik kép melyik szoba!
          updateData[cat.field].push({
            url: url,
            nev: originalName, // pl: "Nappali"
            file: newName, // pl: "p_1.jpg"
          });
        });
        console.log(`✅ ${cat.dir}: ${files.length} db kép feldolgozva.`);
      }
    }
  }

  // 4. ALAPRAJZ KERESÉSE (A gyökérben)
  // Megkeressük az első fájlt, aminek a nevében benne van a "floor_plan"
  const allFiles = fs.readdirSync(sourceBase);
  const fpFile = allFiles.find(
    (f) => f.toLowerCase().includes("floor_plan") && !f.startsWith(".")
  );

  if (fpFile) {
    const targetDir = path.join(targetBase, "floor_plan");
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const ext = path.extname(fpFile).toLowerCase(); // pl. .png

    // Átnevezzük egységesen 'alaprajz'-ra, de megtartjuk a kiterjesztést
    fs.copyFileSync(
      path.join(sourceBase, fpFile),
      path.join(targetDir, `alaprajz${ext}`)
    );

    // Ez STRING, nem tömb!
    updateData.floor_plan = `${MEDIA_BASE_URL}/${ingatlanId}/floor_plan/alaprajz${ext}`;
    console.log(`✅ Alaprajz feldolgozva (${ext}).`);
  } else {
    console.log("⚠️  Nincs alaprajz a mappában (floor_plan nevű fájl).");
  }

  // 5. VIDEÓ KERESÉSE (A gyökérben)
  const videoFile = allFiles.find((f) => f.endsWith(".mp4"));
  if (videoFile) {
    const targetDir = path.join(targetBase, "shorts_video");
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    fs.copyFileSync(
      path.join(sourceBase, videoFile),
      path.join(targetDir, "video.mp4")
    );

    updateData.shorts_video = `${MEDIA_BASE_URL}/${ingatlanId}/shorts_video/video.mp4`;
    console.log(`✅ Videó feldolgozva.`);
  }

  // 6. FIREBASE FRISSÍTÉS
  try {
    await db
      .collection("lakasok")
      .doc(ingatlanId)
      .set(updateData, { merge: true });
    console.log(`\n🎉 SIKER! Firebase frissítve: ${ingatlanId}`);
    console.log(
      `   Képek száma: ${
        updateData.kepek_horiz.length +
        updateData.kepek_vert.length +
        updateData.kepek_pano.length
      }`
    );
    if (updateData.floor_plan) console.log(`   + Alaprajz`);
    if (updateData.shorts_video) console.log(`   + Videó`);
  } catch (err) {
    console.error("❌ Firebase hiba:", err.message);
  }

  console.log(`\n📁 Fájlok előkészítve: ${targetBase}`);
  console.log(`👉 Most húzd be a mappát az R2 bucket-be!`);
}

// Argumentum kezelés
const id = process.argv[2];
if (!id) {
  console.error(
    "Hiba: Adj meg egy ID-t! (Példa: node processor.js teras-764967)"
  );
} else {
  runProcessor(id);
}
