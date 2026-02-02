const fs = require("fs");
const path = require("path");

// --- BEÁLLÍTÁSOK ---

// A kimeneti fájl neve
const OUTPUT_FILE = "TELJES_KOD_ALLOMANY.txt";

// HONNAN INDULJON?
// '..' = egy szinttel feljebbről (hogy lássa a public-ot és a src-t is)
// Ha a gyökérben van a script, akkor írd át '.' -ra
const START_DIR = path.join(__dirname, "..");

// Ezeket a mappákat TELJESEN kihagyjuk (név alapján)
const IGNORE_DIRS = [
  "node_modules",
  ".git",
  ".firebase",
  ".vscode",
  "letoltott_drive_anyag",
  "feltoltesre",
  "kepek_horiz",
  "kepek_vert",
  "virtual_tour", // A generált túra fájljai nem kellenek
  "dist",
  "build",
];

// Ezeket a fájlkiterjesztéseket keressük
const ALLOWED_EXTS = [".js", ".html", ".css", ".json"];

// Ezeket a fájlokat név szerint kihagyjuk
const IGNORE_FILES = [
  "package-lock.json",
  "yarn.lock",
  OUTPUT_FILE,
  "projekt_osszegzo.js", // Saját magát se rakja bele
  ".DS_Store",
];

// --- FŐ LOGIKA ---

function getAllFiles(dirPath, arrayOfFiles) {
  let files;
  try {
    files = fs.readdirSync(dirPath);
  } catch (err) {
    // Ha valamiért nem olvasható egy mappa (pl. jogosultság), kihagyjuk
    return arrayOfFiles || [];
  }

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function (file) {
    const fullPath = path.join(dirPath, file);

    // Ellenőrizzük, hogy mappa-e vagy fájl
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      return;
    } // Ha törött link, kihagyjuk

    if (stat.isDirectory()) {
      // Ha mappa, és nincs a tiltólistán
      if (!IGNORE_DIRS.includes(file)) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      // Ha fájl
      const ext = path.extname(file).toLowerCase();

      // Kiterjesztés és név ellenőrzés
      if (ALLOWED_EXTS.includes(ext) && !IGNORE_FILES.includes(file)) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

// --- FUTTATÁS ---
try {
  console.log(`📂 Projekt fájlok összegyűjtése innen: ${START_DIR}`);

  const files = getAllFiles(START_DIR);

  if (files.length === 0) {
    console.warn(
      "⚠️  Nem találtam fájlokat! Lehet, hogy rossz helyen keresem?"
    );
  } else {
    console.log(`✅ ${files.length} db fájl találva.`);
  }

  let outputContent = `GENERÁLVA: ${new Date().toLocaleString()}\n`;
  outputContent += `FORRÁS KÖNYVTÁR: ${START_DIR}\n`;
  outputContent += `ÖSSZES FÁJL SZÁMA: ${files.length}\n`;
  outputContent += `==========================================\n\n`;

  files.forEach((file) => {
    // Relatív útvonal a PROJEKT GYÖKERÉTŐL nézve
    const relativePath = path.relative(START_DIR, file);

    console.log(` -> ${relativePath}`);

    const content = fs.readFileSync(file, "utf8");

    // Jól látható elválasztó
    outputContent += `\n\n`;
    outputContent += `##################################################\n`;
    outputContent += `### FILE: ${relativePath}\n`;
    outputContent += `##################################################\n`;
    outputContent += content;
  });

  // A script mellé mentjük a kimenetet, hogy megtaláld
  const finalPath = path.join(__dirname, OUTPUT_FILE);
  fs.writeFileSync(finalPath, outputContent);

  console.log(`\n🎉 KÉSZ! A fájl itt van: ${finalPath}`);
  console.log(`👉 Ezt töltsd fel a Chatbe!`);
} catch (err) {
  console.error("❌ Hiba történt:", err);
}
