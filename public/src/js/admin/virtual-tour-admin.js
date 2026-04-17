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
const MEDIA_BASE_URL = "https://media.hazbazis.hu";
let availableMediaFiles = [];

/** Ha a Pin Keresőből jön vissza x,y, ide írjuk a szobába. */
let pendingPinEdit = null; // { levelIndex, roomIndex }

/** Szint index → helyi alaprajz (data URL), csak Pin előnézethez; nem megy Firestore-ba. */
let levelAlaprajzDataUrl = {};

/** Pin ablak megnyitásakor: helyi kép átküldése postMessage-szel. */
let pendingFloorImageForPin = null;

// Később: Hotspot (HP) gombok kezelése – minden hotspotnak kell "yaw" (iránymutató).
// Érdemes lehet globális vezérlés: pl. egy közös "yaw beállítás" vagy szobánkénti lista,
// hogy ne kelljen kézzel minden hotspotnál külön megadni (tour_config.json struktúra: hotspots[].cel_id, szoveg, yaw).

function renderJson() {
  const hbForPreview = currentHbId || (hbInput?.value || "").trim();
  const previewTour = buildFirestoreVirtualTour(virtualTour, hbForPreview);
  jsonPreview.textContent = JSON.stringify(
    { tobb_szintes: true, ...previewTour },
    null,
    2
  );
}

function renderLevels() {
  if (!virtualTour.szintek || virtualTour.szintek.length === 0) {
    levelsList.innerHTML =
      '<p class="text-white/40 text-xs">Még nincs szint. Kattints az „Új szint” gombra.</p>';
    return;
  }

  levelsList.innerHTML = "";
  const mediaPickerCard = document.createElement("div");
  mediaPickerCard.className =
    "border border-white/10 rounded-xl p-3 bg-black/20 space-y-1";
  mediaPickerCard.innerHTML = `
    <div class="flex items-center gap-3 flex-wrap">
      <label class="text-[11px] text-[#E2F1B0] cursor-pointer">
        <span class="underline">Fotólista betöltése mappából</span>
        <input type="file" class="media-directory-picker hidden" webkitdirectory directory multiple accept="image/*" />
      </label>
      <span class="text-[10px] text-white/55">Betöltött képek: <strong class="text-white/75">${
        availableMediaFiles.length
      }</strong></span>
    </div>
    ${
      availableMediaFiles.length
        ? `<p class="text-[10px] text-white/45">Példák: ${escapeHtml(
            availableMediaFiles.slice(0, 6).join(", ")
          )}${availableMediaFiles.length > 6 ? ", ..." : ""}</p>`
        : '<p class="text-[10px] text-white/45">Válaszd ki a local `virtual_tour` mappát, és a szobáknál listából választhatsz fájlnevet.</p>'
    }
  `;
  levelsList.appendChild(mediaPickerCard);

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
        <label class="block text-[10px] text-white/50 uppercase tracking-wider mb-0.5">Alaprajz (fájlnév vagy publikus URL)</label>
        <input value="${
          level.alaprajz_url || ""
        }" data-level-index="${levelIndex}" data-field="alaprajz_url"
          class="level-input w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#E2F1B0]"
          placeholder="pl. alaprajz.png vagy https://media.hazbazis.hu/HB-.../virtual_tour/alaprajz.png" />
        <p class="text-[10px] text-white/45 mt-1 leading-snug">
          Mentéskor a rendszer automatikusan kiegészíti a sima fájlneveket:
          <strong class="text-white/60">https://media.hazbazis.hu/&lt;HB-ID&gt;/virtual_tour/...</strong>
        </p>
        <p class="text-[10px] text-white/45 mt-1 leading-snug">
          A látogatói bejárás és a böngésző csak <strong class="text-white/60">https</strong> címről tud képet betölteni.
          Pin koordinátához választhatsz helyi fájlt is – az nem kerül a JSON-ba, csak segít kattintani az alaprajzon.
        </p>
        <div class="flex items-center gap-2 mt-1 flex-wrap">
          <label class="text-[10px] text-white/70 cursor-pointer">
            <span class="underline">Alaprajz fájlnév kiválasztása</span>
            <input type="file" accept="image/*" data-level-index="${levelIndex}" class="level-alaprajz-filename hidden" />
          </label>
          <label class="text-[10px] text-[#E2F1B0]/80 cursor-pointer">
            <span class="underline">Helyi alaprajz (Pin előnézet)</span>
            <input type="file" accept="image/*" data-level-index="${levelIndex}" class="level-alaprajz-local hidden" />
          </label>
          ${
            levelAlaprajzDataUrl[levelIndex]
              ? '<span class="text-[10px] text-green-400/90">✓ betöltve</span>'
              : ""
          }
        </div>
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
          <div class="text-[11px] bg-black/30 border border-white/10 rounded px-2 py-1.5 space-y-1">
            <div class="flex items-center justify-between">
              <div class="flex-1 truncate">
                <span class="font-semibold">${room.nev || "(név nélkül)"}</span>
                <span class="opacity-50 ml-1">(${room.id || ""})</span>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <button data-level-index="${levelIndex}" data-room-index="${roomIndex}" class="edit-room text-xs text-[#E2F1B0] hover:underline">
                  Szerkesztés
                </button>
                <button data-level-index="${levelIndex}" data-room-index="${roomIndex}" class="delete-room text-xs text-red-300 hover:text-red-400">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <label class="text-white/50">x:</label>
              <input type="text" inputmode="decimal" value="${
                room.x != null ? room.x : 50
              }" data-level-index="${levelIndex}" data-room-index="${roomIndex}" data-field="x" class="room-xy-input w-14 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-xs font-mono text-right" />
              <label class="text-white/50">y:</label>
              <input type="text" inputmode="decimal" value="${
                room.y != null ? room.y : 50
              }" data-level-index="${levelIndex}" data-room-index="${roomIndex}" data-field="y" class="room-xy-input w-14 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-xs font-mono text-right" />
              <button type="button" data-level-index="${levelIndex}" data-room-index="${roomIndex}" class="open-pin-btn text-[10px] px-2 py-0.5 rounded bg-[#3D4A16] text-[#E2F1B0] border border-white/20 hover:bg-[#4d5e1c]" title="Alaprajzon kattintva megkapod az x,y-t, és visszaküldi a szerkesztőbe">
                📍 Pin megnyitása
              </button>
            </div>
            <div class="space-y-1">
              <label class="text-white/50 block">Panoráma (fájlnév vagy URL)</label>
              <select
                data-level-index="${levelIndex}"
                data-room-index="${roomIndex}"
                class="room-panorama-select w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#E2F1B0]"
              >
                <option value="">Válassz a betöltött fotólistából…</option>
                ${buildRoomPanoramaSelectOptions(room.panorama_url || "")}
              </select>
              <input
                type="text"
                value="${room.panorama_url || ""}"
                data-level-index="${levelIndex}"
                data-room-index="${roomIndex}"
                data-field="panorama_url"
                class="room-input w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-[#E2F1B0]"
                placeholder="pl. furdo.jpg vagy https://media.hazbazis.hu/HB-.../virtual_tour/furdo.jpg"
              />
              <label class="text-[10px] text-white/70 cursor-pointer">
                <span class="underline">Panoráma fájlnév kiválasztása</span>
                <input type="file" accept="image/*" data-level-index="${levelIndex}" data-room-index="${roomIndex}" class="room-panorama-local hidden" />
              </label>
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

function escapeHtml(raw) {
  return String(raw || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildRoomPanoramaSelectOptions(selectedRaw) {
  const selected = String(selectedRaw || "").trim();
  return availableMediaFiles
    .map((fileName) => {
      const esc = escapeHtml(fileName);
      const isSelected = fileName === selected ? " selected" : "";
      return `<option value="${esc}"${isSelected}>${esc}</option>`;
    })
    .join("");
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

  if (
    target.classList.contains("open-pin-btn") ||
    target.closest(".open-pin-btn")
  ) {
    const btn = target.closest(".open-pin-btn");
    const lIdx = Number(btn.getAttribute("data-level-index"));
    const rIdx = Number(btn.getAttribute("data-room-index"));
    const level = virtualTour.szintek[lIdx];
    if (!level || !Array.isArray(level.szobak) || !level.szobak[rIdx]) return;
    const alaprajzUrl = (level.alaprajz_url || "").trim();
    const localData = levelAlaprajzDataUrl[lIdx];
    pendingPinEdit = { levelIndex: lIdx, roomIndex: rIdx };
    if (localData) {
      pendingFloorImageForPin = localData;
      window.open(
        "pin-kereso.html",
        "pin-kereso",
        "width=900,height=700,scrollbars=yes"
      );
      touchStatus("Pin Kereső: helyi alaprajz átküldése…");
    } else if (alaprajzUrl) {
      pendingFloorImageForPin = null;
      window.open(
        `pin-kereso.html?image=${encodeURIComponent(alaprajzUrl)}`,
        "pin-kereso",
        "width=900,height=700,scrollbars=yes"
      );
    } else {
      pendingFloorImageForPin = null;
      window.open(
        "pin-kereso.html",
        "pin-kereso",
        "width=900,height=700,scrollbars=yes"
      );
      touchStatus(
        "Nincs URL és helyi alaprajz – a Pin Keresőben húzd be a képet.",
        true
      );
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

    const nev = prompt("Szoba neve", room.nev || "");
    if (nev === null) return;
    room.nev = nev.trim();

    const id = prompt("Szoba ID (pl. nappali)", room.id || "");
    if (id === null) return;
    room.id = id.trim();

    const xStr = prompt(
      "X pozíció az alaprajzon (0-100)",
      room.x != null ? String(room.x) : "50"
    );
    if (xStr === null) return;
    const yStr = prompt(
      "Y pozíció az alaprajzon (0-100)",
      room.y != null ? String(room.y) : "50"
    );
    if (yStr === null) return;

    const dirStr = prompt(
      "Kezdő irány (fok, pl. 0)",
      room.kezdo_irany != null ? String(room.kezdo_irany) : "0"
    );
    if (dirStr === null) return;

    const m2Str = prompt(
      "Alapterület m² (opcionális)",
      room.m2 != null ? String(room.m2) : ""
    );
    if (m2Str === null) return;

    const x = parseFloat(String(xStr).replace(",", "."));
    const y = parseFloat(String(yStr).replace(",", "."));
    const dir = parseFloat(dirStr.replace(",", "."));
    const m2 = m2Str.trim() ? parseFloat(m2Str.replace(",", ".")) : null;

    if (!Number.isNaN(x)) room.x = x;
    if (!Number.isNaN(y)) room.y = y;
    if (!Number.isNaN(dir)) room.kezdo_irany = dir;
    if (m2 !== null && !Number.isNaN(m2)) room.m2 = m2;

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

  if (target.classList.contains("room-xy-input")) {
    const lIdx = Number(target.getAttribute("data-level-index"));
    const rIdx = Number(target.getAttribute("data-room-index"));
    const field = target.getAttribute("data-field");
    const val = parseFloat(String(target.value).replace(",", "."));
    if (virtualTour.szintek[lIdx]?.szobak[rIdx] != null && !Number.isNaN(val)) {
      virtualTour.szintek[lIdx].szobak[rIdx][field] = val;
      renderJson();
    }
  }

  if (target.classList.contains("room-input")) {
    const lIdx = Number(target.getAttribute("data-level-index"));
    const rIdx = Number(target.getAttribute("data-room-index"));
    const field = target.getAttribute("data-field");
    if (!virtualTour.szintek[lIdx]?.szobak?.[rIdx] || !field) return;
    virtualTour.szintek[lIdx].szobak[rIdx][field] = target.value;
    renderJson();
  }

  if (target.classList.contains("room-panorama-select")) {
    const lIdx = Number(target.getAttribute("data-level-index"));
    const rIdx = Number(target.getAttribute("data-room-index"));
    if (!virtualTour.szintek[lIdx]?.szobak?.[rIdx]) return;
    const selected = String(target.value || "").trim();
    if (!selected) return;
    virtualTour.szintek[lIdx].szobak[rIdx].panorama_url = selected;
    renderLevels();
    renderJson();
  }
}

function problematikusMediaUrl(virtualTourObj) {
  for (const sz of virtualTourObj.szintek || []) {
    const u = String(sz.alaprajz_url || "").trim();
    if (u && (u.startsWith("data:") || u.startsWith("blob:"))) {
      return u.slice(0, 40) + "…";
    }
    for (const room of sz.szobak || []) {
      const p = String(room.panorama_url || "").trim();
      if (p && (p.startsWith("data:") || p.startsWith("blob:"))) {
        return p.slice(0, 40) + "…";
      }
    }
  }
  return null;
}

function mediaUrlFromInput(rawUrl, hbId) {
  const val = String(rawUrl || "").trim();
  if (!val) return "";
  if (
    val.startsWith("https://") ||
    val.startsWith("http://") ||
    val.startsWith("data:") ||
    val.startsWith("blob:")
  ) {
    return val;
  }

  const clean = val.replace(/^\/+/, "");
  if (!hbId) return clean;
  if (clean.startsWith(`${hbId}/`)) {
    return `${MEDIA_BASE_URL}/${clean}`;
  }
  return `${MEDIA_BASE_URL}/${hbId}/virtual_tour/${clean}`;
}

function buildFirestoreVirtualTour(sourceTour, hbId) {
  const clone = JSON.parse(JSON.stringify(sourceTour || { szintek: [] }));
  for (const szint of clone.szintek || []) {
    szint.alaprajz_url = mediaUrlFromInput(szint.alaprajz_url, hbId);
    for (const room of szint.szobak || []) {
      room.panorama_url = mediaUrlFromInput(room.panorama_url, hbId);
    }
  }
  return clone;
}

async function saveTour() {
  if (!currentHbId) {
    touchStatus("Először tölts be egy ingatlant (HB azonosító).", true);
    return;
  }

  const invalid = problematikusMediaUrl(virtualTour);
  if (invalid) {
    touchStatus(
      "A kép mezőkben ne data:/blob: címet használj. Adj meg fájlnevet vagy publikus https URL-t.",
      true
    );
    return;
  }

  touchStatus("Mentés Firestore-ba folyamatban...");

  try {
    const ref = doc(adatbazis, "lakasok", currentHbId);
    const virtualTourForSave = buildFirestoreVirtualTour(virtualTour, currentHbId);
    await updateDoc(ref, {
      virtual_tour: { tobb_szintes: true, ...virtualTourForSave },
    });
    touchStatus("Sikeres mentés a Firestore-ba.");
  } catch (err) {
    console.error(err);
    touchStatus("Hiba történt mentés közben.", true);
  }
}

function copyJson() {
  const hbForPreview = currentHbId || (hbInput?.value || "").trim();
  const virtualTourForSave = buildFirestoreVirtualTour(virtualTour, hbForPreview);
  navigator.clipboard
    .writeText(JSON.stringify({ tobb_szintes: true, ...virtualTourForSave }, null, 2))
    .then(() => touchStatus("JSON a vágólapra másolva."))
    .catch(() => touchStatus("A JSON másolása nem sikerült.", true));
}

/** Pin Kereső ablakból érkező koordináta (postMessage). */
function applyPinFromMessage(x, y) {
  if (pendingPinEdit == null) return;
  const { levelIndex, roomIndex } = pendingPinEdit;
  const level = virtualTour.szintek[levelIndex];
  if (!level?.szobak?.[roomIndex]) return;
  level.szobak[roomIndex].x = x;
  level.szobak[roomIndex].y = y;
  pendingPinEdit = null;
  renderLevels();
  renderJson();
  touchStatus("Pin koordináta beírva (x: " + x + ", y: " + y + ").");
}

window.addEventListener("message", (e) => {
  if (
    e.data?.type === "pin-koordinata" &&
    typeof e.data.x === "number" &&
    typeof e.data.y === "number"
  ) {
    applyPinFromMessage(e.data.x, e.data.y);
    return;
  }
  if (e.data?.type === "pin-kereso-ready" && e.source && pendingFloorImageForPin) {
    try {
      e.source.postMessage(
        { type: "vt-floor-image", dataUrl: pendingFloorImageForPin },
        "*"
      );
    } catch (err) {
      console.warn("Pin kép átküldése sikertelen:", err);
    }
    pendingFloorImageForPin = null;
  }
});

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
function handleLevelAlaprajzLocalChange(e) {
  const target = e.target;
  if (!target.classList.contains("level-alaprajz-local")) return;
  const idx = Number(target.getAttribute("data-level-index"));
  const file = target.files && target.files[0];
  if (!file || !virtualTour.szintek[idx]) return;
  if (file.size > 8 * 1024 * 1024) {
    touchStatus("A helyi alaprajz max. ~8 MB legyen (Pin előnézethez).", true);
    target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    levelAlaprajzDataUrl[idx] = reader.result;
    renderLevels();
    renderJson();
    touchStatus("Helyi alaprajz betöltve ehhez a szinthez (Pin megnyitásakor ezt használjuk).");
  };
  reader.readAsDataURL(file);
}

function handleLevelAlaprajzFilenameChange(e) {
  const target = e.target;
  if (!target.classList.contains("level-alaprajz-filename")) return;
  const idx = Number(target.getAttribute("data-level-index"));
  const file = target.files && target.files[0];
  if (!file || !virtualTour.szintek[idx]) return;
  virtualTour.szintek[idx].alaprajz_url = file.name;
  renderLevels();
  renderJson();
  touchStatus(`Alaprajz fájlnév kiválasztva: ${file.name}`);
}

function handleRoomPanoramaLocalChange(e) {
  const target = e.target;
  if (!target.classList.contains("room-panorama-local")) return;
  const lIdx = Number(target.getAttribute("data-level-index"));
  const rIdx = Number(target.getAttribute("data-room-index"));
  const file = target.files && target.files[0];
  if (!file || !virtualTour.szintek[lIdx]?.szobak?.[rIdx]) return;
  virtualTour.szintek[lIdx].szobak[rIdx].panorama_url = file.name;
  renderLevels();
  renderJson();
  touchStatus(`Panoráma fájlnév kiválasztva: ${file.name}`);
}

function handleMediaDirectoryPickerChange(e) {
  const target = e.target;
  if (!target.classList.contains("media-directory-picker")) return;
  const files = Array.from(target.files || []);
  if (files.length === 0) return;

  const imageFileNames = Array.from(
    new Set(
      files
        .filter((file) => /^image\//i.test(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name))
        .map((file) => file.name.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "hu"));

  if (imageFileNames.length === 0) {
    touchStatus("A kiválasztott mappában nem találtam képfájlokat.", true);
    return;
  }

  availableMediaFiles = imageFileNames;
  renderLevels();
  renderJson();
  touchStatus(`${availableMediaFiles.length} képfájl betöltve. Most már listából választhatsz.`);
}

if (levelsList) {
  levelsList.addEventListener("click", handleLevelsListClick);
  levelsList.addEventListener("input", handleLevelsListInput);
  levelsList.addEventListener("change", handleLevelAlaprajzLocalChange);
  levelsList.addEventListener("change", handleLevelAlaprajzFilenameChange);
  levelsList.addEventListener("change", handleRoomPanoramaLocalChange);
  levelsList.addEventListener("change", handleMediaDirectoryPickerChange);
}

// Alapértelmezett JSON megjelenítés
ensureStructure();
renderLevels();
renderJson();
