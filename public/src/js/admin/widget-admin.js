import { auth, adatbazis } from "../util/firebase-config.js";
import {
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const listaDiv = document.getElementById("widget-lista");
const form = document.getElementById("widget-form");
const frissitesBtn = document.getElementById("frissites-btn");

async function betoltWidgetek() {
  listaDiv.innerHTML = '<div class="text-white/40 text-sm">Betöltés...</div>';
  const q = query(
    collection(adatbazis, "widget"),
    orderBy("letrehozva", "desc")
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    listaDiv.innerHTML =
      '<div class="text-white/40 text-sm">Nincs még partner.</div>';
    return;
  }

  listaDiv.innerHTML = "";
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const active = data.active !== false;
    const embed = `<script src="https://hazbazis.hu/src/widget/loader.js" data-hb="${data.hb_azon}" defer></script>`;
    const toggleClasses = active
      ? "bg-[#E2F1B0] text-[#3D4A16]"
      : "bg-white/10 text-white/60";

    const card = document.createElement("div");
    card.className =
      "bg-black/30 border border-white/10 rounded-xl p-4 flex flex-col gap-3";
    card.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div class="text-white font-bold">${
            data.nev || "Névtelen partner"
          }</div>
          <div class="text-xs text-white/50 mt-1">Widget: ${
            data.hb_azon || "-"
          }</div>
          <div class="text-xs text-white/50">Hirdető: ${
            data.hirdeto_azon || "-"
          }</div>
          <div class="text-xs text-white/50">Domain: ${data.domain || "-"}</div>
        </div>
        <div class="flex items-center gap-2">
          <button data-id="${
            docSnap.id
          }" class="toggle-btn px-3 py-2 rounded-lg text-xs font-bold ${toggleClasses}">
            ${active ? "Aktív" : "Inaktív"}
          </button>
          <button data-id="${docSnap.id}"
                  class="delete-btn px-3 py-2 rounded-lg text-xs font-bold bg-red-500/20 text-red-300 hover:bg-red-500/40">
            Törlés
          </button>
        </div>
      </div>
      <div class="bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-white/70 font-mono break-all">
        ${embed}
      </div>
      <button data-embed="${embed.replace(/"/g, "&quot;")}"
              class="copy-btn text-xs text-[#E2F1B0] hover:text-white self-start">
        <i class="fa-solid fa-copy"></i> Embed kód másolása
      </button>
    `;
    listaDiv.appendChild(card);
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const hbAzon = document.getElementById("hb-azon").value.trim();
  const hirdetoAzon = document.getElementById("hirdeto-azon").value.trim();
  const nev = document.getElementById("partner-nev").value.trim();
  const domain = document.getElementById("partner-domain").value.trim();
  const active = document.getElementById("partner-active").checked;

  if (!hbAzon || !hirdetoAzon) {
    alert("A widget és hirdető HB azonosító kötelező.");
    return;
  }

  await addDoc(collection(adatbazis, "widget"), {
    hb_azon: hbAzon,
    hirdeto_azon: hirdetoAzon,
    nev: nev || null,
    domain: domain || null,
    active: active,
    letrehozva: new Date().toISOString(),
  });

  form.reset();
  document.getElementById("partner-active").checked = true;
  await betoltWidgetek();
});

listaDiv.addEventListener("click", async (e) => {
  const target = e.target.closest("button");
  if (!target) return;

  if (target.classList.contains("delete-btn")) {
    const id = target.getAttribute("data-id");
    if (confirm("Biztos törlöd ezt a partnert?")) {
      await deleteDoc(doc(adatbazis, "widget", id));
      await betoltWidgetek();
    }
  }

  if (target.classList.contains("toggle-btn")) {
    const id = target.getAttribute("data-id");
    const isActive = target.innerText.trim() === "Aktív";
    await updateDoc(doc(adatbazis, "widget", id), { active: !isActive });
    await betoltWidgetek();
  }

  if (target.classList.contains("copy-btn")) {
    const embed = target.getAttribute("data-embed").replace(/&quot;/g, '"');
    try {
      await navigator.clipboard.writeText(embed);
      target.innerText = "✅ Másolva";
      setTimeout(() => {
        target.innerHTML =
          '<i class="fa-solid fa-copy"></i> Embed kód másolása';
      }, 1200);
    } catch (err) {
      alert("A másolás nem sikerült.");
    }
  }
});

frissitesBtn.addEventListener("click", betoltWidgetek);

onAuthStateChanged(auth, (user) => {
  if (user) {
    betoltWidgetek();
    document.getElementById("partner-active").checked = true;
  } else {
    window.location.href = "/index.html";
  }
});

const logoutBtn = document.getElementById("logout-btn");
logoutBtn.addEventListener("click", () => {
  signOut(auth).then(() => (window.location.href = "/index.html"));
});
