// Navigációs segédfüggvény
window.navigalas = function (utvonal) {
  window.location.href = utvonal;
};

// Itt fogjuk később inicializálni a Firebase adatlekérést a kiemelt ingatlanokhoz
console.log("hazbazis.hu - Főoldal betöltve (zöld verzió)");
window.inditsKeresest = function () {
  const keresoMezo = document.getElementById("fooldali-ai-kereso");
  const uzenet = keresoMezo.value.trim();

  if (uzenet.length > 2) {
    // Átirányítás a chat oldalra, az üzenetet URL paraméterként adjuk át
    window.location.href = `src/html/vevo/ai-filter.html?query=${encodeURIComponent(
      uzenet
    )}`;
  }
};

// Enter billentyű figyelése a keresőmezőben
document
  .getElementById("fooldali-ai-kereso")
  ?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") window.inditsKeresest();
  });
