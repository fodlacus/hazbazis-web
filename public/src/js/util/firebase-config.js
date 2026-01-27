import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
// Figyelem: A Firestore és az Auth külön könyvtár!
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  addDoc,
  query,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAKHxkRj41Y_e6x5TTfXbiBGRtN99V9SGM",
  authDomain: "hazbazis.firebaseapp.com",
  projectId: "hazbazis",
  storageBucket: "hazbazis.firebasestorage.app",
  messagingSenderId: "228035570741",
  appId: "1:228035570741:web:58827ab31ede50f1f6157c",
};

export const app = initializeApp(firebaseConfig);

// Exportáljuk a példányokat
export const adatbazis = getFirestore(app);
export const auth = getAuth(app);
// Exportáljuk a hivatkozásokat
export const lakasok_gyujtemeny = collection(adatbazis, "lakasok");
export const felhasznalok_gyujtemeny = collection(adatbazis, "felhasznalok");

// Exportáljuk a metódusokat, hogy máshol ne kelljen importálni
export { collection, getDocs, getDoc, doc, setDoc, addDoc, query, limit };
