// metro-script.js
let metroData = {};

// 1. A panel megnyitása és adatok betöltése
export async function openMetroPanel() {
  console.log("Metró panel nyitása...");
  const panel = document.getElementById("metro-panel");
  const container = document.getElementById("metro-stations-list");

  if (!panel || !container) {
    console.error(
      "Hiba: 'metro-panel' vagy 'metro-stations-list' nem található!"
    );
    return;
  }

  panel.classList.remove("hidden");

  // Csak akkor töltünk, ha még nincs adat
  if (Object.keys(metroData).length === 0) {
    container.innerHTML =
      '<p class="text-white/50 text-center py-4 italic">Megállók betöltése...</p>';
    try {
      // Figyelj az útvonalra! A shorts.html-hez képest kell megadni
      const response = await fetch("../js/vevo/metro_megallok.json");
      if (!response.ok) throw new Error("A JSON fájl nem érhető el");
      metroData = await response.json();
      renderMetroStations("all");
    } catch (error) {
      console.error("Hiba a metró adatok betöltésekor:", error);
      container.innerHTML =
        '<p class="text-red-400 text-sm p-4">Hiba a betöltés során.</p>';
    }
  } else {
    renderMetroStations("all");
  }
}

// 2. Megállók listázása (Checkboxok generálása)
function renderMetroStations(filterVonal) {
  const container = document.getElementById("metro-stations-list");
  if (!container) return;
  container.innerHTML = "";

  Object.keys(metroData).forEach((vonal) => {
    if (filterVonal !== "all" && filterVonal !== vonal) return;

    const vonalSzin = getVonalColor(vonal);

    metroData[vonal].forEach((megallo) => {
      const label = document.createElement("label");
      label.className =
        "flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/20 cursor-pointer transition-all group";
      label.innerHTML = `
        <input type="checkbox" class="metro-checkbox w-5 h-5 rounded border-white/20 text-lime-400 focus:ring-lime-400" 
               data-lat="${megallo.lat}" data-lng="${megallo.lng}">
        <span class="w-1.5 h-6 ${vonalSzin} rounded-full"></span>
        <div class="flex flex-col">
            <span class="text-white font-medium text-sm group-hover:text-lime-400 transition">${megallo.nev}</span>
            <span class="text-[10px] text-white/30 uppercase">${vonal} vonal</span>
        </div>
      `;
      container.appendChild(label);
    });
  });
}

// 3. A szűrés végrehajtása
export async function applyMetroFilter() {
  const checkboxes = document.querySelectorAll(".metro-checkbox:checked");
  if (checkboxes.length === 0) {
    alert("Válassz ki legalább egy megállót!");
    return;
  }

  const submitBtn = document.getElementById("apply-metro-filter");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Szűrés...";
  }

  setTimeout(() => {
    const selectedCoords = Array.from(checkboxes).map((cb) => ({
      lat: parseFloat(cb.dataset.lat),
      lng: parseFloat(cb.dataset.lng),
    }));

    // @ts-ignore - allVideos a globális térből jön
    const filtered = allVideos.filter((video) => {
      if (video.telepules !== "Budapest" || !video.lat || !video.lng)
        return false;

      return selectedCoords.some(
        (st) => calculateDistance(st.lat, st.lng, video.lat, video.lng) <= 500
      );
    });

    // @ts-ignore - renderVideos a globális térből jön
    if (typeof renderVideos === "function") {
      renderVideos(filtered);
      closeMetroPanel();
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "Ingatlanok mutatása";
    }
  }, 50);
}

// Segédfunkciók
function getVonalColor(vonal) {
  const colors = {
    M1: "bg-yellow-500",
    M2: "bg-red-500",
    M3: "bg-blue-500",
    M4: "bg-green-600",
  };
  return colors[vonal] || "bg-gray-500";
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function closeMetroPanel() {
  document.getElementById("metro-panel")?.classList.add("hidden");
}

// GLOBÁLIS ELÉRÉS BIZTOSÍTÁSA (Window-hoz kötés)
window.openMetroPanel = openMetroPanel;
window.applyMetroFilter = applyMetroFilter;
window.closeMetroPanel = closeMetroPanel;

// Megállók szűrése a panelen belül (Vonal gombok: M1, M2...)
window.filterMetroList = function (vonal) {
  // Meghívjuk a már létező renderelőt a választott vonallal
  if (typeof renderMetroStations === "function") {
    renderMetroStations(vonal);
  }
};

// Kijelölések törlése
window.resetMetroSelection = function () {
  const checkboxes = document.querySelectorAll(".metro-checkbox");
  checkboxes.forEach((cb) => (cb.checked = false));

  const countElem = document.getElementById("selected-count");
  if (countElem) countElem.innerText = "0 megálló kijelölve";
};

// Panel bezárása (globálisan is elérhetővé téve)
window.closeMetroPanel = function () {
  const panel = document.getElementById("metro-panel");
  if (panel) panel.classList.add("hidden");
};
