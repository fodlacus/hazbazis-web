// Globális változó a szűrők tárolására (Fontos, hogy itt legyen legfelül!)
let aktualisSzuroFeltetelek = {}; 

// ============================================================
// INICIALIZÁLÁS (Amikor az oldal betöltődik)
// ============================================================
window.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Házbázis Chat Engine indul...");

  // 1. URL PARAMÉTEREK KEZELÉSE (Ha a főoldalról jön kérdés)
  const urlParams = new URLSearchParams(window.location.search);
  const kezdőKérdés = urlParams.get("query");

  if (kezdőKérdés) {
    console.log("📩 Bejövő kérdés:", kezdőKérdés);
    const input = document.getElementById("chat-input");
    if (input) input.value = kezdőKérdés;
    inditsChatKeresest();
  }

  // 2. MENTÉS MANAGER INDÍTÁSA
  // Ez kezeli a checkboxok pipálgatását (Multi-lista logika)
  initMentesManager(async (filterList, mode) => {
    if (mode === "clear") {
      belsoFlat = [];
      hozzaadBuborekot("Minden mentett szűrőt kikapcsoltál. A lista üres.", "ai");
      megjelenitTalalatokat();
      return;
    }

    if (mode === "merge") {
      hozzaadBuborekot(`Összefésülöm a ${filterList.length} kiválasztott listát...`, "ai");
      await multiLekeresEsMerge(filterList);
    }
  });

  // 3. GOMBOK BEKÖTÉSE (Debug logokkal!)
  
  // A) Mentés gomb
  const saveBtn = document.getElementById("btn-save-filter");
  if (saveBtn) {
      console.log("✅ Mentés gomb (btn-save-filter) megtalálva.");
      saveBtn.addEventListener("click", () => {
           console.log("🖱️ Mentés gomb megnyomva. Mentendő:", aktualisSzuroFeltetelek);
           saveCurrentSearch(aktualisSzuroFeltetelek);
      });
  } else {
      console.error("❌ HIBA: Nem találom a 'btn-save-filter' gombot a HTML-ben!");
  }

  // B) Haza gomb
  const homeBtn = document.getElementById("btn-home");
  if (homeBtn) {
      homeBtn.addEventListener("click", () => {
          window.location.href = "../../../index.html";
      });
  }

  // C) Kuka / Reset gomb
  const trashBtn = document.getElementById("btn-trash");
  if (trashBtn) {
      trashBtn.addEventListener("click", () => {
          if (confirm("Biztosan törlöd a beszélgetést és új keresést kezdesz?")) {
              resetChatEngine();
          }
      });
  }
  
  // D) Küldés gomb (Chat)
  const sendBtn = document.getElementById("send-btn");
  if (sendBtn) {
      sendBtn.addEventListener("click", inditsChatKeresest);
  }
});

// ... (Innentől jöhetnek a függvények: inditsChatKeresest, stb.) ...