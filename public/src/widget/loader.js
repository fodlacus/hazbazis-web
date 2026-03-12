(function () {
  // 1. Megkeressük a script taget, ami behúzta ezt a fájlt, hogy kiolvassuk az UID-t

  console.log("Elindult a loader.js");
  const scripts = document.getElementsByTagName("script");
  let currentScript = null;
  let partnerId = null;
  let partnerType = null;

  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].getAttribute("data-hb")) {
      currentScript = scripts[i];
      partnerId = currentScript.getAttribute("data-hb");
      partnerType = "hb";
      break;
    }
    if (scripts[i].getAttribute("data-uid")) {
      currentScript = scripts[i];
      partnerId = currentScript.getAttribute("data-uid");
      partnerType = "uid";
      break;
    }
  }

  if (!partnerId) {
    console.error(
      "Hazbazis Widget Hiba: Hiányzik a 'data-hb' paraméter a beillesztett kódból!"
    );
    return;
  }

  // 2. Megkeressük vagy létrehozzuk a céltartályt
  let container = document.getElementById("hazbazis-widget");
  if (!container) {
    container = document.createElement("div");
    container.id = "hazbazis-widget";
    // Közvetlenül a script után illesztjük be
    currentScript.parentNode.insertBefore(container, currentScript.nextSibling);
  }

  // 3. Stílusok beállítása (Ezt a partner oldalának CSS-e nem tudja elrontani)
  container.style.width = "100%";
  container.style.maxWidth = "400px"; // Asztali gépen és tableten sem lesz ennél szélesebb
  container.style.aspectRatio = "9 / 16"; // A VARÁZSLAT: Fix mobiltelefon képarány!
  container.style.margin = "30px auto"; // Szép térköz kívülről, középre igazítva
  container.style.borderRadius = "16px";
  container.style.overflow = "hidden";
  container.style.boxShadow = "0 15px 35px rgba(0,0,0,0.25)"; // Kicsit erősebb árnyék, hogy kiemelkedjen
  container.style.backgroundColor = "#111";

  // 4. Az Iframe létrehozása és beállítása
  const iframe = document.createElement("iframe");

  // AZ ÉLES ÚTVONALAD A SZERVEREN:
  const widgetUrl = `https://hazbazis.hu/src/widget/view.html?partner=${encodeURIComponent(
    partnerId
  )}&type=${partnerType}`;

  iframe.src = widgetUrl;
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";

  // Engedélyezzük a teljes képernyőt és az automatikus lejátszást
  iframe.setAttribute("allow", "autoplay; fullscreen; encrypted-media");

  // Csak akkor tölt be, ha a felhasználó odagörget (gyorsítja a partner oldalát)
  iframe.setAttribute("loading", "lazy");
  iframe.title = "Hazbazis Ingatlan Videók";

  // 5. Iframe beillesztése a konténerbe
  container.appendChild(iframe);

  console.log("✅ Hazbazis Widget sikeresen betöltve. Partner:", partnerId);
})();
