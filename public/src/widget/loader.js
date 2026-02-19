(function () {
  // 1. Megkeressük a script taget, ami behúzta ezt a fájlt, hogy kiolvassuk az UID-t

  console.log("Elindult a loader.js");
  const scripts = document.getElementsByTagName("script");
  let currentScript = null;
  let partnerUid = null;

  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].getAttribute("data-uid")) {
      currentScript = scripts[i];
      partnerUid = currentScript.getAttribute("data-uid");
      break;
    }
  }

  if (!partnerUid) {
    console.error(
      "Hazbazis Widget Hiba: Hiányzik a 'data-uid' paraméter a beillesztett kódból!"
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
  container.style.height = "700px"; // Ideális magasság a Shorts videóknak
  container.style.maxWidth = "480px"; // Asztali gépen sem nyúlik szét
  container.style.margin = "0 auto"; // Középre igazítja magát
  container.style.borderRadius = "16px";
  container.style.overflow = "hidden";
  container.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
  container.style.backgroundColor = "#111"; // Sötét háttér a betöltés pillanatáig

  // 4. Az Iframe létrehozása és beállítása
  const iframe = document.createElement("iframe");

  // AZ ÉLES ÚTVONALAD A SZERVEREN:
  //  const widgetUrl = `https://hazbazis.hu/src/widget/view.html?partner=${partnerUid}`;
  const widgetUrl = `https://hazbazis.hu/src/widget/view?partner=JEFcSLfbHGguZhPBxik7q8Fxa572`;

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

  console.log(
    "✅ Hazbazis Widget sikeresen betöltve. Partner UID:",
    partnerUid
  );
})();
