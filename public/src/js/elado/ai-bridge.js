// ai-bridge.js - Szigorú AI adatkinyerés és validáció (Function Calling verzió)

// 1. A keresési feltételek definíciója (Tools) - Ez tanítja meg az AI-nak a mezőneveket
const ingatlanTools = [
  {
    type: "function",
    function: {
      name: "ingatlan_szures_futtatasa",
      description:
        "Lefuttat egy szűrést az ingatlanok között a megadott paraméterek alapján.",
      parameters: {
        type: "object",
        properties: {
          telepules: {
            type: "string",
            description: "A város neve, pl. 'Budapest', 'Debrecen'.",
          },
          kerulet: {
            type: "string",
            description:
              "Budapesti kerület római számmal és ponttal, pl. 'XIV.', 'II.'.",
          },
          vételár: {
            type: "number",
            description: "A maximális vételár forintban (számként).",
          },
          szobák: {
            type: "number",
            description: "A szobák minimális száma (számként).",
          },
          allapot: {
            type: "string",
            description: "Az ingatlan állapota.",
            enum: [
              "Felújított",
              "Újszerű",
              "Felújítandó",
              "Jó állapotú",
              "Befejezetlen",
            ],
          },
          tipus: {
            type: "string",
            description: "Az ingatlan típusa.",
            enum: ["Lakás", "Ház", "Telek", "Iroda", "Sorház"],
          },
          anyag: {
            type: "string",
            enum: ["Tégla", "Panel", "Vályog"],
            description: "Építési anyag.",
          },
          epites_eve: {
            type: "number",
            description: "Az építés éve (számként).",
          },
          lift: {
            type: "string",
            enum: ["Van", "Nincs"],
            description: "Van-e lift az épületben.",
          },
        },
        required: [],
      },
    },
  },
];

window.ertelmezdAkeresest = async function (szoveg) {
  console.log("AI elemzés indítása (Tools Mode)...", szoveg);
  const PROXY_URL = "/ai-proxy";

  try {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Gazdaságosabb és gyorsabb erre a feladatra
        messages: [
          {
            role: "system",
            content:
              "Te egy ingatlanos asszisztens vagy. A feladatod a felhasználó kéréséből a paraméterek kinyerése és a 'ingatlan_szures_futtatasa' függvény meghívása. Sose használj ékezetes kulcsokat a paraméterekben (pl. állapot helyett allapot).",
          },
          { role: "user", content: szoveg },
        ],
        tools: ingatlanTools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) throw new Error(`Proxy hiba: ${response.status}`);

    const data = await response.json();

    // Az OpenAI válaszának feldolgozása (Tool Call kinyerése)
    const aiMessage = data.choices[0].message;

    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      const feltetelek = JSON.parse(aiMessage.tool_calls[0].function.arguments);
      console.log("✅ AI által kinyert tiszta paraméterek:", feltetelek);
      return feltetelek;
    } else {
      console.warn("Az AI nem talált szűrhető paramétereket.");
      return {};
    }
  } catch (hiba) {
    console.error("AI hiba:", hiba.message);
    return null;
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

      ["iranyitoszam", "telepules", "utca", "hazszam"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.style.borderColor = siker ? "#A3E635" : "#EF4444";
          el.style.backgroundColor = siker
            ? "rgba(163, 230, 53, 0.05)"
            : "rgba(239, 68, 68, 0.05)";
        }
      });

      if (mentesGomb) {
        mentesGomb.disabled = !siker;
        mentesGomb.style.opacity = siker ? "1" : "0.5";
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
