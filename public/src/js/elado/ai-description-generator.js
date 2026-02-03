// Fájl: src/js/elado/ai-description-generator.js

// ⚠️ FONTOS: IDE MÁSOLD BE A TE CLOUDFLARE WORKER CÍMEDET!
// (Ugyanazt, amit a chat-engine.js-ben is használsz)
const CLOUDFLARE_WORKER_URL = "https://hazbazis-ai.cardepo.workers.dev";

export async function generaljLeirast() {
  // 1. UI Elemek keresése
  const textArea = document.getElementById("leírás");

  // Gomb keresése a szövege alapján (mert dinamikus az űrlap)
  const buttons = document.getElementsByTagName("button");
  let genBtn = null;
  for (let btn of buttons) {
    if (btn.innerText.includes("AI SZÖVEG GENERÁLÁSA")) {
      genBtn = btn;
      break;
    }
  }

  if (!textArea) {
    console.error("Hiba: Nem találom a 'leírás' nevű mezőt!");
    return;
  }

  // 2. ADATGYŰJTÉS

  const adatok = {
    // Város: többféleképpen is hívhatják
    varos: getValue("telepules") || getValue("varos") || getValue("város"),

    utca: getValue("utca"),
    iranyitoszam: getValue("iranyitoszam") || getValue("irányítószám"),

    // MÉRET (Itt volt a hiba: alapterulet vs alapterület)
    meret:
      getValue("alapterulet") ||
      getValue("alapterület") ||
      getValue("meret") ||
      getValue("méret"),

    // SZOBÁK (szobaszam vs szobaszám)
    szobak: getValue("szobaszam") || getValue("szobaszám") || getValue("szoba"),

    // ÁR (ar vs ár vs vetelar vs vételár)
    ar:
      getValue("ar") ||
      getValue("ár") ||
      getValue("vetelar") ||
      getValue("vételár"),

    tipus: getValue("tipus") || getValue("ingatlan_tipus") || getValue("típus"),
    allapot: getValue("allapot") || getValue("állapot"),
    futes: getValue("futes") || getValue("fűtés"),
  };

  // DEBUG: Kiírjuk a konzolra, hogy mit találtunk (így látni fogod, ha valami még mindig üres)
  console.log("🔍 Összeszedett adatok:", adatok);

  if (!adatok.varos) {
    alert("Kérlek, legalább a Települést add meg a generáláshoz!");
    return;
  }

  // 3. UI VISSZAJELZÉS (Loading)
  let eredetiGombSzoveg = "";
  if (genBtn) {
    eredetiGombSzoveg = genBtn.innerHTML;
    genBtn.disabled = true;
    genBtn.innerHTML = `⏳ Fogalmazás...`;
    genBtn.classList.add("opacity-50", "cursor-not-allowed");
  }

  try {
    // 4. PROMPT ÉPÍTÉS (Ezt küldjük a rendszernek)
    const systemPrompt =
      "Te egy profi ingatlanügynök vagy. Írj vonzó, figyelemfelkeltő, de megbízható hirdetést. Használj emojikat és tagolást.";
    const userPrompt = keszitsUserPromptot(adatok);

    console.log("Küldés a Cloudflare-nek...");

    // 5. VALÓDI AI HÍVÁS (A Te mintád alapján!)
    const generaltSzoveg = await hivasCloudflareWorker(
      systemPrompt,
      userPrompt
    );

    // 6. EREDMÉNY BEÍRÁSA
    textArea.value = generaltSzoveg;

    // Textarea igazítása
    textArea.style.height = "auto";
    textArea.style.height = textArea.scrollHeight + 10 + "px";
  } catch (error) {
    console.error("AI Hiba:", error);
    alert("Hiba történt a generáláskor. Ellenőrizd a konzolt!");
  } finally {
    // 7. VISSZAÁLLÍTÁS
    if (genBtn) {
      genBtn.innerHTML = eredetiGombSzoveg;
      genBtn.disabled = false;
      genBtn.classList.remove("opacity-50", "cursor-not-allowed");
    }
  }
}

// --- CLOUDFLARE KOMMUNIKÁCIÓ (A chat-engine.js logikája alapján) ---
async function hivasCloudflareWorker(systemMsg, userMsg) {
  // Összeállítjuk az üzenetlistát, ahogy az OpenAI/Cloudflare várja
  const messages = [
    { role: "system", content: systemMsg },
    { role: "user", content: userMsg },
  ];

  const response = await fetch(CLOUDFLARE_WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: messages }),
  });

  if (!response.ok) {
    throw new Error(`API Hiba: ${response.status}`);
  }

  const data = await response.json();

  // A chat-engine.js alapján a válasz a 'reply' mezőben jön
  return (
    data.reply ||
    data.choices?.[0]?.message?.content ||
    "Hiba: Üres válasz az AI-tól."
  );
}

// --- SEGÉDFÜGGVÉNYEK ---

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function keszitsUserPromptot(adatok) {
  return `
    Kérlek írj egy ingatlanhirdetést az alábbi adatokból:
    
    Helyszín: ${adatok.iranyitoszam} ${adatok.varos}, ${adatok.utca || ""}
    Típus: ${adatok.tipus}
    Méret: ${adatok.meret} m²
    Szobák: ${adatok.szobak}
    Ár: ${adatok.ar} Ft
    Állapot: ${adatok.allapot}
    Fűtés: ${adatok.futes}

    Kérlek emeld ki a környék előnyeit (közlekedés, parkok) a ${
      adatok.varos
    }-i tudásod alapján.
    `;
}
