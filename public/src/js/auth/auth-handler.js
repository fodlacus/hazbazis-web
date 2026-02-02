import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { auth, adatbazis } from "../util/firebase-config.js";

// ==========================================
// 1. REGISZTRÁCIÓ (Bővített adatokkal)
// ==========================================

export async function registerUser(email, password, nev, telefon, roles) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    const egyediAzonosito = `hb-${Date.now()}`;

    // JAVÍTÁS: 'db' helyett 'adatbazis'-t használunk, mert így nevezted el a configban
    await setDoc(doc(adatbazis, "felhasznalok", user.uid), {
      email: email,
      nev: nev,
      telefon: telefon,
      azon: egyediAzonosito,
      letrehozva: new Date().toISOString(),
      active: true,
      szerepkor: {
        admin: false,
        elado: roles.elado || false,
        vevo: roles.vevo || false,
      },
    });

    alert("Sikeres regisztráció!");
    window.location.href = "../../../index.html";
  } catch (error) {
    console.error("Regisztrációs hiba:", error);
    alert("Hiba: " + error.message);
  }
}

// ==========================================
// 2. BEJELENTKEZÉS ÉS IRÁNYÍTÁS
// ==========================================
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Szerepkör lekérése az irányításhoz
    const userDoc = await getDoc(doc(adatbazis, "felhasznalok", user.uid));

    if (userDoc.exists()) {
      const data = userDoc.data();

      // IRÁNYÍTÁSI LOGIKA
      if (data.szerepkor.admin) {
        window.location.href = "../admin/admin-hub.html"; // Admin -> Dashboard
      } else {
        window.location.href = "../../../index.html"; // Mindenki más -> Főoldal
      }
    } else {
      // Ha nincs Firestore adat (ritka hiba)
      window.location.href = "../../../index.html";
    }
  } catch (error) {
    console.error("Belépési hiba:", error);
    alert("Hibás email vagy jelszó!");
  }
}

// ==========================================
// 3. MENÜ ÉS JOGOSULTSÁG KEZELŐ (Ezt hívjuk minden oldalon)
// ==========================================

export function initAuthMonitor() {
  console.log("🕵️‍♂️ Auth Monitor elindult..."); // 1. Életjel

  onAuthStateChanged(auth, async (user) => {
    // Elemek keresése és ellenőrzése
    const desktopBtn = document.getElementById("nav-hirdetes");
    const mobilBtn = document.getElementById("mobil-nav-hirdetes");
    const desktopMenu = document.getElementById("desktop-user-menu");

    // Debug infók kiírása
    console.log("🔍 Gomb keresés eredménye:");
    console.log(
      "   - Desktop Gomb:",
      desktopBtn ? "✅ MEGVAN" : "❌ NINCS (HIBA: Rossz ID vagy HTML)"
    );
    console.log("   - Mobil Gomb:", mobilBtn ? "✅ MEGVAN" : "❌ NINCS");

    if (user) {
      console.log(`👤 Bejelentkezve: ${user.email} (UID: ${user.uid})`);

      // Menü megjelenítése
      if (desktopMenu) desktopMenu.classList.remove("hidden");

      // Adatbázis lekérése
      try {
        const userDoc = await getDoc(doc(adatbazis, "felhasznalok", user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const roles = userData.szerepkor;

          console.log("📂 Adatbázis adatok:", userData);
          console.log("🔑 Szerepkörök:", roles);
          console.log(
            `⚖️ Jogosultság vizsgálat: roles.elado === ${roles?.elado}`
          );

          if (roles && roles.elado === true) {
            console.log("✅ JOGOSULT! Gombok megjelenítése...");
            if (desktopBtn) {
              desktopBtn.classList.remove("hidden");
              console.log("   -> Desktop gomb: hidden levéve.");
            }
            if (mobilBtn) mobilBtn.classList.remove("hidden");
          } else {
            console.warn("⛔ NEM JOGOSULT (Nem eladó)");
          }
        } else {
          console.error(
            "❌ HIBA: A felhasználónak nincs profilja az adatbázisban!"
          );
        }
      } catch (err) {
        console.error("❌ Súlyos hiba az adatbázis olvasásakor:", err);
      }

      // Email kiírása...
      const emailElem = document.getElementById("desktop-user-email");
      if (emailElem) emailElem.innerText = user.email;
    } else {
      console.log("👋 Kijelentkezve.");
      if (desktopBtn) desktopBtn.classList.add("hidden");
    }
  });
}
