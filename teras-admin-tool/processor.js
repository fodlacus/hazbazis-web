const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// --- BEÁLLÍTÁSOK ---
const GUMLET_BASE = "https://media.hazbazis.hu";
const SOURCE_ROOT = "./letoltott_drive_anyag"; // A Mac-eden lévő mappa

// Firebase inicializálás
if (fs.existsSync("./serviceAccountKey.json")) {
  admin.initializeApp({
    credential: admin.credential.cert(require("./serviceAccountKey.json")),
  });
}
const db = admin.apps.length ? admin.firestore() : null;

async function runProcessor(ingatlanId) {
  // ITT SZÚRJUK BE: Ez határozza meg, melyik lakás mappájába lépünk be
  const sourceBase = path.join(__dirname, SOURCE_ROOT, ingatlanId);
  const targetBase = path.join(__dirname, "feltoltesre", ingatlanId);

  // Ellenőrizzük, hogy létezik-e a forrás mappa
  if (!fs.existsSync(sourceBase)) {
    console.error(`❌ Hiba: A forrás mappa nem található: ${sourceBase}`);
    return;
  }

  let updateData = {
    id: ingatlanId,
    kepek_horiz: [],
    kepek_vert: [],
    kepek_pano: [],
    shorts_video: "",
    statusz: "aktiv",
    updatedAt: new Date().toISOString(),
  };

  // Kategóriák az új, egyszerű nevekkel
  const categories = [
    { dir: "horiz", prefix: "h_", field: "kepek_horiz" },
    { dir: "vert", prefix: "v_", field: "kepek_vert" },
    { dir: "pano", prefix: "p_", field: "kepek_pano" },
  ];

  for (let cat of categories) {
    const sourcePath = path.join(sourceBase, cat.dir);
    const targetPath = path.join(targetBase, cat.dir);

    if (fs.existsSync(sourcePath)) {
      const files = fs
        .readdirSync(sourcePath)
        .filter((f) => !f.startsWith("."));

      if (!fs.existsSync(targetPath))
        fs.mkdirSync(targetPath, { recursive: true });

      files.sort().forEach((file, index) => {
        const ext = path.extname(file).toLowerCase();
        const newName = `${cat.prefix}${index + 1}${ext}`;

        // Másolás az új néven a feltöltésre szánt mappába
        fs.copyFileSync(
          path.join(sourcePath, file),
          path.join(targetPath, newName)
        );

        // Algoritmizált URL generálása
        const url = `${GUMLET_BASE}/${ingatlanId}/${cat.dir}/${newName}`;
        updateData[cat.field].push(url);
      });
      console.log(`✅ ${cat.dir}: ${files.length} fájl feldolgozva.`);
    }
  }

  // Videó keresése az ingatlan fő mappájában
  const videoFile = fs.readdirSync(sourceBase).find((f) => f.endsWith(".mp4"));
  if (videoFile) {
    const videoTarget = path.join(targetBase, "video");
    if (!fs.existsSync(videoTarget))
      fs.mkdirSync(videoTarget, { recursive: true });
    fs.copyFileSync(
      path.join(sourceBase, videoFile),
      path.join(videoTarget, "shorts.mp4")
    );
    updateData.shorts_video = `${GUMLET_BASE}/${ingatlanId}/video/shorts.mp4`;
    console.log(`✅ Videó rendszerezve.`);
  }

  // FIREBASE ÍRÁS
  if (db) {
    try {
      await db
        .collection("lakasok")
        .doc(ingatlanId)
        .set(updateData, { merge: true });
      console.log(`🚀 Firebase sikeresen frissítve az URL címekkel!`);
    } catch (err) {
      console.error("❌ Firebase hiba:", err.message);
    }
  }

  console.log(`\n--- KÉSZ ---`);
  console.log(`A fájlok itt várnak az R2 feltöltésre: ${targetBase}`);
}

const id = process.argv[2];
if (!id) {
  console.error(
    "Hiba: Adj meg egy ID-t! (Példa: node processor.js teras-903754)"
  );
} else {
  runProcessor(id);
}
