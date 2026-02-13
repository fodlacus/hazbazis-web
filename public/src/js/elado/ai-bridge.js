// ai-bridge.js - Szigorú AI adatkinyerés és validáció (Function Calling verzió)

// src/js/elado/ai-bridge.js

const ingatlanTools = [
  {
    type: "function",
    function: {
      name: "ingatlan_szures",
      description:
        "Kinyeri a KERESÉSI FELTÉTELEKET. SOHA ne generálj találatokat!",
      parameters: {
        type: "object",
        properties: {
          telepules: { type: "string" },
          kerulet: { type: "string", description: "Római szám, pl. XIV." },

          // Az eladó oldal (hirdetésfeladás) miatt kellenek ezek az ID-k:
          vételár: {
            type: "number",
            description: "Vételár vagy bérleti díj összege forintban.",
          },
          szobák: { type: "number", description: "Szobák száma (egész szám)." },
          alapterület: {
            type: "number",
            description: "Az ingatlan mérete m2-ben.",
          },

          // A vevő oldal (keresés) finomhangolása miatt maradhatnak ezek is,
          // de a chat-engine.js-ben lévő normalizáló összefésüli őket:
          max_ar: {
            type: "number",
            description: "Maximális ár forintban (kereséskor).",
          },
          min_szoba: { type: "number", description: "Minimum szobaszám." },
          min_terulet: {
            type: "number",
            description: "Minimum alapterület m2-ben.",
          },
          max_terulet: {
            type: "number",
            description: "Maximum alapterület m2-ben.",
          },

          kategoria: {
            type: "string",
            enum: ["elado", "kiado"],
            description: "Bérlésnél 'kiado', vásárlásnál 'elado'.",
          },
          tipus: {
            type: "string",
            enum: ["Lakás", "Ház", "Garázs"],
            description:
              "Az ingatlan típusa. Ha garázs vagy beálló, válaszd a 'Garázs'-t.",
          },
          allapot: {
            type: "string",
            enum: ["Felújított", "Újszerű", "Felújítandó", "Jó állapotú"],
          },

          // --- EXTRA MEZŐK ---
          van_erkely: {
            type: "boolean",
            description: "True, ha van vagy kell erkély/terasz.",
          },
          min_emelet: {
            type: "number",
            description: "Minimum emelet. Földszint = 0.",
          },
          kell_lift: {
            type: "boolean",
            description: "True, ha szükséges a lift.",
          },
          parkolas_kulcsszo: {
            type: "string",
            description: "Pl: 'garázs', 'udvari beálló'.",
          },
          futes_tipus: {
            type: "string",
            description: "Pl: 'cirkó', 'hőszivattyú'.",
          },
          kell_klima: {
            type: "boolean",
            description: "True, ha van vagy kell klíma.",
          },
          min_epites_eve: {
            type: "number",
            description: "Építési év korlát (pl. 2010).",
          },
          lakopark_e: { type: "string", enum: ["Nem", "Igen"] },
          lakopark_nev: {
            type: "string",
            description: "Projekt neve (pl. Metrodom).",
          },
        },
        // A kötelező mezőt vedd ki vagy módosítsd, ha a keresésnél nem mindig tudjuk az árat!
        required: ["kategoria"],
      },
    },
  },
];

let aktualisLat = null;
let aktualisLng = null;

window.ertelmezdAkeresest = async function (szoveg) {
  const workerUrl = "https://hazbazis-ai.cardepo.workers.dev";

  console.log("🚀 AI kérés küldése a Workernek:", workerUrl);
  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `Te egy ingatlan-adat kinyerő specialista vagy. 
                A feladatod a hirdető által megadott szövegből az adatok kinyerése a 'ingatlan_szures' függvény számára.
                SZIGORÚ SZABÁLYOK:
                1. KATEGÓRIA: Ha bérlésről van szó (kiadó, albérlet), a kategória 'kiado', egyébként 'elado'.
                2. ÁR: Az árakat alakítsd számmá (pl. 50 millió -> 50000000).
                3. BÉRLETI DÍJ: Bérlésnél az összeget a 'vételár' mezőbe írd.`,
          },
          { role: "user", content: szoveg },
        ],
        tools: ingatlanTools,
        tool_choice: {
          type: "function",
          function: { name: "ingatlan_szures" },
        },
      }),
    });

    if (!response.ok) {
      console.error(`❌ Szerver hiba: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log("📥 Nyers AI válasz érkezett:", data);

    // --- JAVÍTOTT ELLENŐRZÉS A WORKER FORMÁTUMÁHOZ ---

    // 1. Ha a Worker a "reply" kulcsban küldi a választ (ahogy a konzolon látszik)
    if (data && data.reply) {
      try {
        // --- TISZTÍTÁS: Eltávolítjuk a Markdown kódblokkokat ---
        let tisztaJson = data.reply
          .replace(/```[a-z]*\n?/gi, "") // Eltávolítja a nyitó ```python vagy ```json részt
          .replace(/```/g, "") // Eltávolítja a záró ``` részt
          .trim();

        const args = JSON.parse(tisztaJson);
        console.log("✅ AI Szigorú Eredmény (Tisztított):", args);
        return args;
      } catch (e) {
        console.error("Hiba a reply JSON parzolásakor:", e);
      }
    }
    // 2. Szabványos OpenAI struktúra (ha később változna a Worker)
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
      const message = data.choices[0].message;
      if (message.tool_calls && message.tool_calls[0]) {
        const args = JSON.parse(message.tool_calls[0].function.arguments);
        console.log("✅ AI Szigorú Eredmény (Tool Call-ból):", args);
        return args;
      }
    }

    console.error("❌ Nem sikerült kinyerni az adatokat a válaszból:", data);
    return {};

    // --- BIZTONSÁGI ELLENŐRZÉS VÉGE ---
  } catch (hiba) {
    console.error("AI Hiba a feldolgozás során:", hiba);
    return {};
  }
};

window.aiAdatKeres = async function () {
  const inputMezo = document.getElementById("ai-azonosito");
  const forrasSzoveg = inputMezo?.value.trim();
  const gomb = document.querySelector('button[onclick="aiAdatKeres()"]');

  if (!forrasSzoveg) return;
  gomb.disabled = true;
  gomb.innerText = "Elemzés...";

  try {
    const data = await window.ertelmezdAkeresest(forrasSzoveg);
    if (data) adatokBetoltese(data);
  } catch (hiba) {
    console.error("Elemzési hiba:", hiba);
  } finally {
    gomb.disabled = false;
    gomb.innerText = "Elemzés";
  }
};

function adatokBetoltese(adatok) {
  Object.keys(adatok).forEach((id) => {
    const mezo = document.getElementById(id);
    if (mezo) {
      mezo.value = adatok[id];
      mezo.style.border = "2px solid #A3E635";
      setTimeout(() => (mezo.style.border = ""), 2000);
      if (id === "kategoria") {
        window.frissitArCimket(mezo.value);
      }
      if (id === "kerulet") mezo.dispatchEvent(new Event("change"));
    }
  });
}

window.urlapUrites = function () {
  if (confirm("Biztosan törlöd az összes adatot az űrlapról?")) {
    document.getElementById("hirdetes-urlap")?.reset();
    const aiInput = document.getElementById("ai-azonosito");
    if (aiInput) aiInput.value = "";
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const mezok = ["iranyitoszam", "telepules", "utca", "hazszam"];
  mezok.forEach((id) => {
    document
      .getElementById(id)
      ?.addEventListener("blur", window.automataCimEllenorzes);
  });
});

window.generaljLeirast = async function () {
  const leirasMezo = document.getElementById("leírás");
  if (!leirasMezo) return;

  const ar = document.getElementById("vételár")?.value || "";
  const szoba = document.getElementById("szobák")?.value || "";

  if (!ar || !szoba) {
    alert("Kérlek, töltsd ki az árat és a szobaszámot!");
    return;
  }

  leirasMezo.value = "AI hirdetésírás... ✍️";
  setTimeout(() => {
    leirasMezo.value = `Eladó egy kiváló adottságú, ${szoba} szobás ingatlan ${Number(
      ar
    ).toLocaleString()} Ft irányáron. Ideális választás befektetésnek vagy saját részre egyaránt.`;
    leirasMezo.style.backgroundColor = "rgba(168, 85, 247, 0.1)";
    setTimeout(() => (leirasMezo.style.backgroundColor = ""), 2000);
  }, 1000);
};

window.frissitArCimket = function (ertek) {
  const arCimke = document.querySelector('label[for="vételár"]');
  const arMezo = document.getElementById("vételár");

  if (ertek === "kiado") {
    if (arCimke) arCimke.innerText = "Bérleti díj / hó (Ft)";
    if (arMezo) arMezo.placeholder = "Havi bérleti díj összege";
  } else {
    if (arCimke) arCimke.innerText = "Vételár (Ft)";
    if (arMezo) arMezo.placeholder = "Teljes vételár összege";
  }
};
