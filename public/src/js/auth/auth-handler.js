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
  onAuthStateChanged(auth, async (user) => {
    const loginBtn = document.getElementById("nav-login-btn");

    // MENÜ KONTÉNEREK
    const desktopMenu = document.getElementById("desktop-user-menu");
    const mobilMenu = document.getElementById("mobil-user-menu");

    // EMAIL MEZŐK
    const desktopEmail = document.getElementById("desktop-user-email");
    const mobilEmail = document.getElementById("mobil-user-email");

    // GOMBOK
    const desktopHirdetesBtn = document.getElementById("nav-hirdetes");
    const mobilHirdetesBtn = document.getElementById("mobil-nav-hirdetes");

    if (user) {
      // --- BE VAN JELENTKEZVE ---
      if (loginBtn) loginBtn.classList.add("hidden");

      // Menük megjelenítése
      if (desktopMenu) desktopMenu.classList.remove("hidden");
      if (mobilMenu) mobilMenu.classList.remove("hidden");

      // Email beírása
      if (desktopEmail) desktopEmail.innerText = user.email;
      if (mobilEmail) mobilEmail.innerText = user.email;

      // Szerepkör ellenőrzés
      const userDoc = await getDoc(doc(adatbazis, "felhasznalok", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const roles = userData.szerepkor;

        // Ha Eladó, akkor megjelenítjük a gombokat
        if (roles && roles.elado === true) {
          if (desktopHirdetesBtn) desktopHirdetesBtn.classList.remove("hidden");
          if (mobilHirdetesBtn) mobilHirdetesBtn.classList.remove("hidden");
        }
      }
    } else {
      // --- KI VAN JELENTKEZVE ---
      if (loginBtn) loginBtn.classList.remove("hidden");

      if (desktopMenu) desktopMenu.classList.add("hidden");
      if (mobilMenu) mobilMenu.classList.add("hidden");

      // Biztonság kedvéért visszarejtjük a gombokat
      if (desktopHirdetesBtn) desktopHirdetesBtn.classList.add("hidden");
      if (mobilHirdetesBtn) mobilHirdetesBtn.classList.add("hidden");
    }
  });
}
