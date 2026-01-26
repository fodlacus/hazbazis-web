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
  apiKey: "AIzaSyCmcNz9wKV9oc7Xwla7dxHXbfbkYaV5iz8",
  authDomain: "teras-fe3e1.firebaseapp.com",
  projectId: "teras-fe3e1",
  storageBucket: "teras-fe3e1.firebasestorage.app",
  messagingSenderId: "1002443328434",
  appId: "1:1002443328434:web:508a6b1d4253eeb48172ab",
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
