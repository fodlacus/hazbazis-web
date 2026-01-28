const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// --- BEÁLLÍTÁSOK ---
const MEDIA_BASE_URL = "https://media.hazbazis.hu";
const SOURCE_ROOT = "./letoltott_drive_anyag";

// Firebase indítása
if (fs.existsSync("./serviceAccountKey.json")) {
  admin.initializeApp({
    credential: admin.credential.cert(require("./serviceAccountKey.json")),
  });
} else {
  console.error("❌ HIBA: Nincs serviceAccountKey.json!");
  process.exit(1);
}
const db = admin.firestore();

async function runProcessor(ingatlanId) {
  // ITT A VÁLTOZÁS: Nincs átnevezés!
  // A mappa neve (ingatlanId) EGYENLŐ az adatbázis ID-val.
  console.log(`🚀 Feldolgozás indítása: ${ingatlanId}`);

  const sourceBase = path.join(__dirname, SOURCE_ROOT, ingatlanId);
  const targetBase = path.join(__dirname, "feltoltesre", ingatlanId);

  // Ellenőrizzük, hogy létezik-e a mappa a gépeden
  if (!fs.existsSync(sourceBase)) {
    console.error(`❌ Hiba: A forrás mappa nem található: ${sourceBase}`);
    console.log(
      `   (Győződj meg róla, hogy a mappa neve tényleg '${ingatlanId}')`
    );
    return;
  }

  // Adatstruktúra
  let updateData = {
    azon: ingatlanId, // Pl: HB-176340
    kepek_horiz: [],
    kepek_vert: [],
    kepek_pano: [],
    floor_plan: "",
    shorts_video: "",
    updatedAt: new Date().toISOString(),
  };

  const categories = [
    { dir: "kepek_horiz", prefix: "h_", field: "kepek_horiz" },
    { dir: "kepek_vert", prefix: "v_", field: "kepek_vert" },
    { dir: "kepek_pano", prefix: "p_", field: "kepek_pano" },
  ];

  for (let cat of categories) {
    const sourcePath = path.join(sourceBase, cat.dir);
    const targetPath = path.join(targetBase, cat.dir);

    if (fs.existsSync(sourcePath)) {
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

        files.sort().forEach((file, index) => {
          const ext = path.extname(file).toLowerCase();
          const originalName = path.basename(file, ext);
          const newName = `${cat.prefix}${index + 1}${ext}`;

          fs.copyFileSync(
            path.join(sourcePath, file),
            path.join(targetPath, newName)
          );

          // URL generálás
          const url = `${MEDIA_BASE_URL}/${ingatlanId}/${cat.dir}/${newName}`;

          updateData[cat.field].push({
            url: url,
            nev: originalName,
            file: newName,
          });
        });
        console.log(`✅ ${cat.dir}: ${files.length} db kép feldolgozva.`);
      }
    }
  }

  // Alaprajz
  const allFiles = fs.readdirSync(sourceBase);
  const fpFile = allFiles.find(
    (f) => f.toLowerCase().includes("floor_plan") && !f.startsWith(".")
  );
  if (fpFile) {
    const targetDir = path.join(targetBase, "floor_plan");
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    const ext = path.extname(fpFile).toLowerCase();

    fs.copyFileSync(
      path.join(sourceBase, fpFile),
      path.join(targetDir, `alaprajz${ext}`)
    );
    updateData.floor_plan = `${MEDIA_BASE_URL}/${ingatlanId}/floor_plan/alaprajz${ext}`;
    console.log(`✅ Alaprajz feldolgozva.`);
  }

  // Videó
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

  // MENTÉS
  try {
    await db
      .collection("lakasok")
      .doc(ingatlanId)
      .set(updateData, { merge: true });
    console.log(`\n🎉 SIKER! Firebase ID frissítve: ${ingatlanId}`);
  } catch (err) {
    console.error("❌ Firebase hiba:", err.message);
  }
}

const id = process.argv[2];
if (!id) {
  console.error("Hiba: Adj meg egy ID-t! (Pl: node processor.js HB-176340)");
} else {
  runProcessor(id);
}
