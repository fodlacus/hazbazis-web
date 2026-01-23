import {
  doc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

window.confirmTorles = async function (id) {
  if (confirm("Biztosan törölni szeretnéd ezt a hirdetést?")) {
    try {
      const hirdetesRef = doc(adatbazis, "lakasok", id);
      await deleteDoc(hirdetesRef);
      alert("Hirdetés sikeresen törölve!");
      location.reload(); // Frissítés, hogy eltűnjön a kártya
    } catch (error) {
      console.error("Törlési hiba:", error);
      alert("Nem sikerült a törlés.");
    }
  }
};
