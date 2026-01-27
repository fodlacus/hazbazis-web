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
          // --- Alap mezők ---
          telepules: { type: "string" },
          kerulet: { type: "string", description: "Római szám, pl. XIV." },
          max_ar: { type: "number", description: "A maximális ár forintban." },
          min_szoba: { type: "number" },
          min_terulet: {
            type: "number",
            description: "Minimum méret (pl. '50 m2 felett').",
          },
          max_terulet: {
            type: "number",
            description: "Maximum méret (pl. '60 m2 alatt', 'kicsi lakás').",
          },
          allapot: {
            type: "string",
            enum: ["Felújított", "Újszerű", "Felújítandó", "Jó állapotú"],
          },
          tipus: { type: "string", enum: ["Lakás", "Ház"] },

          // --- ÚJ "EXTRA" MEZŐK ---
          van_erkely: {
            type: "boolean",
            description:
              "True, ha a felhasználó kifejezetten erkélyt/teraszt/loggiát kér.",
          },
          min_emelet: {
            type: "number",
            description:
              "A legalacsonyabb emelet. Földszint = 0. Ha azt kérik 'ne földszint', akkor ez legyen 1.",
          },
          kell_lift: {
            type: "boolean",
            description: "True, ha a felhasználó liftet igényel.",
          },
          parkolas_kulcsszo: {
            type: "string",
            description:
              "Ha a felhasználó parkolást említ. Pl: 'garázs', 'beálló', 'udvar'.",
          },
          futes_tipus: {
            type: "string",
            description:
              "Fűtés típusa kulcsszóként. Pl: 'gáz', 'cirkó', 'padlófűtés', 'távfűtés'.",
          },
          kell_klima: {
            type: "boolean",
            description: "True, ha a felhasználó klímát/légkondit kér.",
          },
          min_epites_eve: {
            type: "number",
            description:
              "Melyik év után épült? Pl. 'új építésű' = 2020, '2010 utáni' = 2010.",
          },
        },
        required: ["max_ar"],
      },
    },
  },
];

let aktualisLat = null;
let aktualisLng = null;

window.ertelmezdAkeresest = async function (szoveg) {
  console.log("AI elemzés indítása:", szoveg);

  try {
    const response = await fetch("/ai-proxy", {
      // Ellenőrizd: nálad /ai-proxy vagy teljes URL kell?
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            // ITT A JAVÍTÁS LÉNYEGE:
            content:
              "Te egy Adatbázis Kereső Motor vagy. A feladatod NEM válaszolni a kérdésre, és NEM generálni ingatlanokat. A feladatod KIZÁRÓLAG a felhasználó mondatából kinyerni a számokat és kategóriákat a 'ingatlan_szures' függvény számára.",
          },
          { role: "user", content: szoveg },
        ],
        tools: ingatlanTools,
        tool_choice: {
          type: "function",
          function: { name: "ingatlan_szures" },
        }, // Kényszerítjük
      }),
    });

    const data = await response.json();

    // Ellenőrzés: kaptunk-e function call-t?
    const toolCall = data.choices[0].message.tool_calls?.[0];

    if (toolCall) {
      const args = JSON.parse(toolCall.function.arguments);
      console.log("✅ AI Szigorú Eredmény:", args);
      return args;
    } else {
      console.warn("⚠️ Az AI nem használta a függvényt:", data);
      return {};
    }
  } catch (hiba) {
    console.error("AI Hiba:", hiba);
    return {};
  }
};

// --- Eredeti funkciók megtartása és javítása ---

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

// Cím ellenőrzés Nominatim-mal
window.automataCimEllenorzes = async function () {
  const irsz = document.getElementById("iranyitoszam")?.value;
  const varos = document.getElementById("telepules")?.value;
  const utca = document.getElementById("utca")?.value;
  const hazszam = document.getElementById("hazszam")?.value;
  const mentesGomb = document.getElementById("hirdetes-bekuldes");

  if (irsz?.length >= 4 && varos?.length >= 2 && utca?.length >= 3) {
    const teljesCim = `${irsz} ${varos}, ${utca} ${hazszam || ""}`;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          teljesCim
        )}&addressdetails=1&countrycodes=hu`
      );
      const adatok = await response.json();
      const siker = adatok && adatok.length > 0;

      if (siker) {
        // SIKER
        window.aktualisLat = parseFloat(adatok[0].lat);
        window.aktualisLng = parseFloat(adatok[0].lon);

        console.log("📍 Koordináták:", window.aktualisLat, window.aktualisLng);

        // Zöld visszajelzés
        ["iranyitoszam", "telepules", "utca", "hazszam"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.style.borderColor = "#A3E635"; // Lime
        });

        if (mentesGomb) {
          mentesGomb.disabled = false;
          mentesGomb.style.opacity = "1";
        }
      } else {
        // HIBA
        window.aktualisLat = null;
        window.aktualisLng = null;

        // Piros visszajelzés
        ["iranyitoszam", "telepules", "utca"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.style.borderColor = "#EF4444"; // Red
        });

        if (mentesGomb) {
          // JAVÍTÁS: Itt volt az elírás (mmentesGomb -> mentesGomb)
          mentesGomb.disabled = true;
          mentesGomb.style.opacity = "0.5";
        }
      }
    } catch (e) {
      console.error("Cím ellenőrzési hiba", e);
    }
  }
};

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
