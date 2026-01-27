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
        window.location.href = "../admin/dashboard.html"; // Admin -> Dashboard
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
    const userMenu = document.getElementById("nav-user-menu"); // Új konténer a menüben
    const hirdetesBtn = document.getElementById("nav-hirdetes");

    if (user) {
      // --- BE VAN JELENTKEZVE ---
      if (loginBtn) loginBtn.classList.add("hidden"); // Belépés gomb eltűnik

      // Adatok lekérése a szerepkörhöz
      const userDoc = await getDoc(doc(adatbazis, "felhasznalok", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const roles = userData.szerepkor;

        // 1. Felhasználó email kiírása + Kilépés gomb
        if (userMenu) {
          userMenu.innerHTML = `
                          <div class="flex items-center gap-4">
                              <span class="text-xs text-white/60">${userData.email}</span>
                              <button id="btn-logout" class="text-xs border border-white/20 px-3 py-1 rounded-full hover:bg-red-500/20 hover:text-red-200 transition">Kilépés</button>
                          </div>
                      `;
          // Kilépés esemény
          document
            .getElementById("btn-logout")
            .addEventListener("click", () => {
              signOut(auth).then(() => window.location.reload());
            });
        }

        // 2. "Hirdetés" menüpont kezelése (Csak Eladó vagy Admin láthatja)
        if (hirdetesBtn) {
          if (roles.elado || roles.admin) {
            hirdetesBtn.classList.remove("hidden");
          } else {
            hirdetesBtn.classList.add("hidden");
          }
        }
      }
    } else {
      // --- KI VAN JELENTKEZVE ---
      if (loginBtn) loginBtn.classList.remove("hidden");
      if (userMenu) userMenu.innerHTML = "";
      if (hirdetesBtn) hirdetesBtn.classList.add("hidden"); // Vendég ne hirdessen
    }
  });
}
