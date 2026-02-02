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
    // --- 1. ELEMEK BEAZONOSÍTÁSA (A Te HTML ID-jaid alapján) ---

    // Vendég menük (amiket el kell rejteni belépéskor)
    const desktopVendeg = document.getElementById("desktop-vendeg-menu");
    const mobilVendeg = document.getElementById("mobil-vendeg-menu");

    // Felhasználó menük (amiket meg kell mutatni belépéskor)
    const desktopUser = document.getElementById("desktop-user-menu");
    const mobilUser = document.getElementById("mobil-user-menu");

    // Email kiírók
    const desktopEmail = document.getElementById("desktop-user-email");
    const mobilEmail = document.getElementById("mobil-user-email");

    // Hirdetés gombok (csak eladónak)
    const desktopHirdetesBtn = document.getElementById("nav-hirdetes");
    const mobilHirdetesBtn = document.getElementById("mobil-nav-hirdetes");

    // --- 2. LOGIKA ---

    if (user) {
      // >>> BE VAN JELENTKEZVE <<<

      // Vendég gombok elrejtése (Belépés gomb eltűnik)
      if (desktopVendeg) desktopVendeg.classList.add("hidden");
      if (mobilVendeg) mobilVendeg.classList.add("hidden");

      // User menük megjelenítése
      if (desktopUser) desktopUser.classList.remove("hidden");
      if (mobilUser) mobilUser.classList.remove("hidden");

      // Email beírása
      if (desktopEmail) desktopEmail.innerText = user.email;
      if (mobilEmail) mobilEmail.innerText = user.email;

      // Szerepkör ellenőrzés (Hirdetés gomb)
      const userDoc = await getDoc(doc(adatbazis, "felhasznalok", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const roles = userData.szerepkor;

        // Ha Eladó, akkor megjelenítjük a Hirdetés gombokat
        if (roles && roles.elado === true) {
          if (desktopHirdetesBtn) desktopHirdetesBtn.classList.remove("hidden");
          if (mobilHirdetesBtn) mobilHirdetesBtn.classList.remove("hidden");
        }
      }
    } else {
      // >>> KI VAN JELENTKEZVE <<<

      // Vendég gombok visszajönnek
      if (desktopVendeg) desktopVendeg.classList.remove("hidden");
      if (mobilVendeg) mobilVendeg.classList.remove("hidden");

      // User menük eltűnnek
      if (desktopUser) desktopUser.classList.add("hidden");
      if (mobilUser) mobilUser.classList.add("hidden");

      // Biztonság kedvéért a hirdetés gombokat is elrejtjük
      if (desktopHirdetesBtn) desktopHirdetesBtn.classList.add("hidden");
      if (mobilHirdetesBtn) mobilHirdetesBtn.classList.add("hidden");
    }
  });
}
