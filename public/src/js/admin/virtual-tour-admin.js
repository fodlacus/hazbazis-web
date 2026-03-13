import { adatbazis, auth } from "../util/firebase-config.js";
import {
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const hbInput = document.getElementById("hb-id");
const loadBtn = document.getElementById("load-tour-btn");
const newBtn = document.getElementById("new-tour-btn");
const statusLabel = document.getElementById("tour-status");
const levelsList = document.getElementById("levels-list");
const jsonPreview = document.getElementById("json-preview");
const saveBtn = document.getElementById("save-tour-btn");
const copyBtn = document.getElementById("copy-json-btn");
const addLevelBtn = document.getElementById("add-level-btn");
const logoutBtn = document.getElementById("logout-btn");

let currentHbId = null;
let virtualTour = { szintek: [] };

// Pin Keresőből érkező x,y (VT szerkesztőből megnyitott ablakból)
let pendingPin = null;

window.addEventListener("message", (e) => {
  if (e.data && e.data.type === "pin-koordinata" && pendingPin) {
    const { lIdx, rIdx } = pendingPin;
    const level = virtualTour.szintek[lIdx];
    if (level && level.szobak && level.szobak[rIdx]) {
      level.szobak[rIdx].x = e.data.x;
      level.szobak[rIdx].y = e.data.y;
      touchStatus(
        "Pin koordináták megkaptuk (x: " + e.data.x + ", y: " + e.data.y + ")."
      );
      pendingPin.received = { x: e.data.x, y: e.data.y };
      renderLevels();
      renderJson();
    }
  }
});

function renderJson() {
  jsonPreview.textContent = JSON.stringify(virtualTour, null, 2);
}

function renderLevels() {
  if (!virtualTour.szintek || virtualTour.szintek.length === 0) {
    levelsList.innerHTML =
      '<p class="text-white/40 text-xs">Még nincs szint. Kattints az „Új szint” gombra.</p>';
    return;
  }

  levelsList.innerHTML = "";

  virtualTour.szintek.forEach((level, levelIndex) => {
    const wrapper = document.createElement("div");
    wrapper.className =
      "border border-white/10 rounded-xl p-3 bg-black/20 space-y-2";

    wrapper.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div class="flex-1 flex flex-col md:flex-row md:items-center md:gap-3">
          <div>
            <label class="block text-[10px] text-white/50 uppercase tracking-wider mb-0.5">Szint ID</label>
            <input value="${
              level.id || ""
            }" data-level-index="${levelIndex}" data-field="id"
              class="level-input w-full md:w-32 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#E2F1B0]" />
          </div>
          <div class="flex-1">
            <label class="block text-[10px] text-white/50 uppercase tracking-wider mb-0.5">Név</label>
            <input value="${
              level.nev || ""
            }" data-level-index="${levelIndex}" data-field="nev"
              class="level-input w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#E2F1B0]" />
          </div>
        </div>
        <button data-level-index="${levelIndex}" class="delete-level text-xs text-red-300 hover:text-red-400">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      <div>
        <label class="block text-[10px] text-white/50 uppercase tracking-wider mb-0.5">Alaprajz URL</label>
        <input value="${
          level.alaprajz_url || ""
        }" data-level-index="${levelIndex}" data-field="alaprajz_url"
          class="level-input w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#E2F1B0]" />
      </div>
      <div class="flex items-center justify-between mt-1">
        <div class="flex items-center gap-2 text-[11px] text-white/60">
          <input type="checkbox" ${
            level.tobb_szintes ? "checked" : ""
          } data-level-index="${levelIndex}" data-field="tobb_szintes"
            class="level-checkbox rounded bg-black/50 border-white/20 text-[#E2F1B0]" />
          <span>Több szintes lakás rész</span>
        </div>
        <button data-level-index="${levelIndex}" class="add-room text-[11px] px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10">
          + Szoba
        </button>
      </div>
      <div class="mt-2 space-y-1">
        ${(level.szobak || [])
          .map(
            (room, roomIndex) => `
          <div class="flex items-center justify-between text-[11px] bg-black/30 border border-white/10 rounded px-2 py-1">
            <div class="flex-1 truncate">
              <span class="font-semibold">${room.nev || "(név nélkül)"}</span>
              <span class="opacity-50 ml-1">(${room.id || ""})</span>
            </div>
            <div class="flex items-center gap-2">
              <button data-level-index="${levelIndex}" data-room-index="${roomIndex}" class="edit-room text-xs text-[#E2F1B0] hover:underline">
                Szerkesztés
              </button>
              <button data-level-index="${levelIndex}" data-room-index="${roomIndex}" class="delete-room text-xs text-red-300 hover:text-red-400">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        `
          )
          .join("")}
        ${
          !level.szobak || level.szobak.length === 0
            ? '<p class="text-white/30 text-[11px] italic">Nincs még szoba ezen a szinten.</p>'
            : ""
        }
      </div>
    `;

    levelsList.appendChild(wrapper);
  });
}

function touchStatus(msg, isError = false) {
  statusLabel.textContent = msg;
  statusLabel.className = `text-xs ${
    isError ? "text-red-400" : "text-white/60"
  }`;
}

function ensureStructure() {
  if (!virtualTour || typeof virtualTour !== "object") {
    virtualTour = { szintek: [] };
  }
  if (!Array.isArray(virtualTour.szintek)) {
    virtualTour.szintek = [];
  }
}

async function loadTour() {
  const hb = (hbInput.value || "").trim();
  if (!hb) {
    touchStatus("Adj meg egy HB azonosítót.", true);
    return;
  }

  currentHbId = hb;
  touchStatus("Betöltés folyamatban...");

  try {
    const ref = doc(adatbazis, "lakasok", hb);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      touchStatus("Nem található ilyen HB azonosítójú ingatlan.", true);
      virtualTour = { szintek: [] };
      renderLevels();
      renderJson();
      return;
    }

    const data = snap.data();
    if (data.virtual_tour && data.virtual_tour.szintek) {
      virtualTour = data.virtual_tour;
      touchStatus("Meglévő virtuális túra betöltve.");
    } else {
      virtualTour = { szintek: [] };
      touchStatus(
        "Nincs még virtuális túra ehhez az ingatlanhoz. Újat hozhatsz létre."
      );
    }

    ensureStructure();
    renderLevels();
    renderJson();
  } catch (err) {
    console.error(err);
    touchStatus("Hiba történt a betöltéskor.", true);
  }
}

function newTour() {
  virtualTour = { szintek: [] };
  ensureStructure();
  renderLevels();
  renderJson();
  touchStatus("Üres virtuális túra létrehozva. Add hozzá az első szintet.");
}

function addLevel() {
  ensureStructure();
  virtualTour.szintek.push({
    id: `szint${virtualTour.szintek.length}`,
    nev: "",
    alaprajz_url: "",
    szobak: [],
  });
  renderLevels();
  renderJson();
}

function handleLevelsListClick(e) {
  const target = e.target;

  if (
    target.classList.contains("delete-level") ||
    target.closest(".delete-level")
  ) {
    const btn = target.closest(".delete-level");
    const idx = Number(btn.getAttribute("data-level-index"));
    virtualTour.szintek.splice(idx, 1);
    renderLevels();
    renderJson();
    return;
  }

  if (target.classList.contains("add-room") || target.closest(".add-room")) {
    const btn = target.closest(".add-room");
    const idx = Number(btn.getAttribute("data-level-index"));
    const level = virtualTour.szintek[idx];
    if (!level.szobak) level.szobak = [];
    level.szobak.push({
      id: "",
      nev: "",
      panorama_url: "",
      x: 50,
      y: 50,
      kezdo_irany: 0,
      m2: 0,
      hotspots: [],
    });
    renderLevels();
    renderJson();
    return;
  }

  if (
    target.classList.contains("delete-room") ||
    target.closest(".delete-room")
  ) {
    const btn = target.closest(".delete-room");
    const lIdx = Number(btn.getAttribute("data-level-index"));
    const rIdx = Number(btn.getAttribute("data-room-index"));
    const level = virtualTour.szintek[lIdx];
    if (level && Array.isArray(level.szobak)) {
      level.szobak.splice(rIdx, 1);
      renderLevels();
      renderJson();
    }
    return;
  }

  if (target.classList.contains("edit-room") || target.closest(".edit-room")) {
    const btn = target.closest(".edit-room");
    const lIdx = Number(btn.getAttribute("data-level-index"));
    const rIdx = Number(btn.getAttribute("data-room-index"));
    const level = virtualTour.szintek[lIdx];
    if (!level || !Array.isArray(level.szobak) || !level.szobak[rIdx]) return;

    const room = level.szobak[rIdx];
    pendingPin = { lIdx, rIdx };

    if (level.alaprajz_url) {
      const pinUrl =
        "pin-kereso.html?image=" + encodeURIComponent(level.alaprajz_url);
      window.open(pinUrl, "pin-kereso", "width=900,height=700,scrollbars=yes");
      touchStatus(
        "Pin Kereső megnyitva. Kattints az alaprajzon, majd a «Visszaküldés» gombra – vagy kézzel add meg később az x,y-t."
      );
    }

    const nev = prompt("Szoba neve", room.nev || "");
    if (nev === null) {
      pendingPin = null;
      return;
    }
    room.nev = nev.trim();

    const id = prompt("Szoba ID (pl. nappali)", room.id || "");
    if (id === null) {
      pendingPin = null;
      return;
    }
    room.id = id.trim();

    const pano = prompt("Panoráma URL", room.panorama_url || "");
    if (pano === null) {
      pendingPin = null;
      return;
    }
    room.panorama_url = pano.trim();

    let xStr, yStr;
    if (pendingPin && pendingPin.received) {
      xStr = String(pendingPin.received.x);
      yStr = String(pendingPin.received.y);
    } else {
      xStr = prompt(
        "X pozíció az alaprajzon (0-100)",
        room.x != null ? String(room.x) : "50"
      );
      if (xStr === null) {
        pendingPin = null;
        return;
      }
      yStr = prompt(
        "Y pozíció az alaprajzon (0-100)",
        room.y != null ? String(room.y) : "50"
      );
      if (yStr === null) {
        pendingPin = null;
        return;
      }
    }

    const dirStr = prompt(
      "Kezdő irány (fok, pl. 0)",
      room.kezdo_irany != null ? String(room.kezdo_irany) : "0"
    );
    if (dirStr === null) {
      pendingPin = null;
      return;
    }

    const m2Str = prompt(
      "Alapterület m² (opcionális)",
      room.m2 != null ? String(room.m2) : ""
    );
    if (m2Str === null) {
      pendingPin = null;
      return;
    }

    const x = parseFloat(String(xStr).replace(",", "."));
    const y = parseFloat(String(yStr).replace(",", "."));
    const dir = parseFloat(dirStr.replace(",", "."));
    const m2 = m2Str.trim() ? parseFloat(m2Str.replace(",", ".")) : null;

    if (!Number.isNaN(x)) room.x = x;
    if (!Number.isNaN(y)) room.y = y;
    if (!Number.isNaN(dir)) room.kezdo_irany = dir;
    if (m2 !== null && !Number.isNaN(m2)) room.m2 = m2;

    pendingPin = null;
    renderLevels();
    renderJson();
    return;
  }
}

function handleLevelsListInput(e) {
  const target = e.target;
  if (target.classList.contains("level-input")) {
    const idx = Number(target.getAttribute("data-level-index"));
    const field = target.getAttribute("data-field");
    if (!virtualTour.szintek[idx]) return;
    virtualTour.szintek[idx][field] = target.value;
    renderJson();
  }

  if (target.classList.contains("level-checkbox")) {
    const idx = Number(target.getAttribute("data-level-index"));
    const field = target.getAttribute("data-field");
    if (!virtualTour.szintek[idx]) return;
    virtualTour.szintek[idx][field] = target.checked;
    renderJson();
  }
}

async function saveTour() {
  if (!currentHbId) {
    touchStatus("Először tölts be egy ingatlant (HB azonosító).", true);
    return;
  }

  touchStatus("Mentés Firestore-ba folyamatban...");

  try {
    const ref = doc(adatbazis, "lakasok", currentHbId);
    await updateDoc(ref, {
      virtual_tour: virtualTour,
    });
    touchStatus("Sikeres mentés a Firestore-ba.");
  } catch (err) {
    console.error(err);
    touchStatus("Hiba történt mentés közben.", true);
  }
}

function copyJson() {
  navigator.clipboard
    .writeText(JSON.stringify(virtualTour, null, 2))
    .then(() => touchStatus("JSON a vágólapra másolva."))
    .catch(() => touchStatus("A JSON másolása nem sikerült.", true));
}

// AUTH & logout
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/index.html";
  }
});

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    signOut(auth)
      .then(() => (window.location.href = "/index.html"))
      .catch((error) => console.error("Hiba kilépéskor:", error));
  });
}

// Eseménykezelők
if (loadBtn) loadBtn.addEventListener("click", loadTour);
if (newBtn) newBtn.addEventListener("click", newTour);
if (addLevelBtn) addLevelBtn.addEventListener("click", addLevel);
if (saveBtn) saveBtn.addEventListener("click", saveTour);
if (copyBtn) copyBtn.addEventListener("click", copyJson);
if (levelsList) {
  levelsList.addEventListener("click", handleLevelsListClick);
  levelsList.addEventListener("input", handleLevelsListInput);
}

// Alapértelmezett JSON megjelenítés
ensureStructure();
renderLevels();
renderJson();
