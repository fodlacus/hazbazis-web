import { auth, adatbazis, doc, setDoc, getDoc } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const urlap = document.getElementById("belepese-urlap");
const emailMezo = document.getElementById("email");
const jelszoMezo = document.getElementById("jelszo");
const foGomb = document.getElementById("gomb-belep");
const valtoGomb = document.getElementById("valtas-regisztraciora");

let regisztracioMod = false;

// 1. Felhasználói állapot figyelése és E-mail kiírása
onAuthStateChanged(auth, async (felhasznalo) => {
  if (felhasznalo) {
    console.log("Bejelentkezett felhasználó:", felhasznalo.email);
    // Ha van a fejlécben egy elem az emailnek, itt töltheted ki:
    // document.getElementById('user-email-display').innerText = felhasznalo.email;
  }
  const nevKijelzo = document.getElementById("felhasznalo-nev");
  if (nevKijelzo) nevKijelzo.innerText = felhasznalo.email;
});

// 2. Váltás Belépés/Regisztráció között
if (valtoGomb) {
  valtoGomb.onclick = () => {
    regisztracioMod = !regisztracioMod;
    foGomb.innerText = regisztracioMod ? "Fiók létrehozása" : "Bejelentkezés";
    valtoGomb.innerText = regisztracioMod
      ? "Inkább bejelentkezem"
      : "Nincs fiókom, regisztrálok";
  };
}

// 3. Űrlap beküldése
if (urlap) {
  urlap.onsubmit = async (e) => {
    e.preventDefault();
    const email = emailMezo.value;
    const jelszo = jelszoMezo.value;

    try {
      if (regisztracioMod) {
        // REGISZTRÁCIÓ
        const eredmeny = await createUserWithEmailAndPassword(
          auth,
          email,
          jelszo
        );
        const felhasznalo = eredmeny.user;

        // Alapértelmezett adatok mentése a Firestore-ba
        await setDoc(doc(adatbazis, "felhasznalok", felhasznalo.uid), {
          email: email,
          szerepkor: "elado", // Alapértelmezett szerepkör
          letrehozva: new Date().toISOString(),
        });

        alert("Sikeres regisztráció!");
        window.location.href = "./elado/hirdetes-feladas.html";
      } else {
        // BEJELENTKEZÉS
        const eredmeny = await signInWithEmailAndPassword(auth, email, jelszo);
        const felhasznalo = eredmeny.user;

        // Szerepkör lekérése a döntéshez
        const dok = await getDoc(
          doc(adatbazis, "felhasznalok", felhasznalo.uid)
        );

        if (dok.exists() && dok.data().szerepkor === "admin") {
          window.location.href = "./admin/dashboard.html";
        } else {
          window.location.href = "./elado/hirdetes-feladas.html";
        }
      }
    } catch (hiba) {
      console.error("Auth hiba:", hiba);
      alert("Hiba: " + hiba.message);
    }
  };
}

// 4. Kijelentkezés funkció (ha szükség van rá)
window.kijelentkezes = function () {
  signOut(auth).then(() => {
    window.location.href = "../../index.html";
  });
};
