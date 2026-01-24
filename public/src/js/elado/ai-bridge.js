// ai-bridge.js - Szigorú AI adatkinyerés és validáció (Function Calling verzió)
// src/js/elado/ai-bridge.js

// 1. A keresési feltételek definíciója (Tools)
const ingatlanTools = [
  {
    type: "function",
    function: {
      name: "ingatlan_szures",
      description:
        "Kinyeri az ingatlan keresési paramétereket a felhasználó mondatából. Ha árat említenek (pl. 50 millió alatt), azt a 'vételár' mezőbe tedd.",
      parameters: {
        type: "object",
        properties: {
          telepules: { type: "string", description: "Pl. Budapest, Debrecen" },
          kerulet: {
            type: "string",
            description: "Római számmal, pl. XIV. vagy XI.",
          }, // Fontos: római számra tanítjuk
          vételár: { type: "number", description: "A maximális ár forintban." },
          szobák: { type: "number", description: "A minimum szobaszám." },
          alapterület: {
            type: "number",
            description: "Minimum alapterület m2-ben.",
          }, // Ezt is felvettem
          allapot: {
            type: "string",
            enum: ["Felújított", "Újszerű", "Felújítandó", "Jó állapotú"],
          },
          tipus: { type: "string", enum: ["Lakás", "Ház", "Sorház"] },
        },
      },
    },
  },
];

window.ertelmezdAkeresest = async function (szoveg) {
  console.log("AI Kérés indítása ezzel:", szoveg);

  try {
    const response = await fetch("/ai-proxy", {
      // Vagy a teljes URL, ha lokálisan tesztelsz
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "Ingatlan kereső asszisztens vagy. Értelmezd a felhasználó igényeit és hívd meg a megfelelő függvényt.",
          },
          { role: "user", content: szoveg },
        ],
        // ITT VOLT A HIÁNY: Át kell adni a tools-t!
        tools: ingatlanTools,
        tool_choice: {
          type: "function",
          function: { name: "ingatlan_szures" },
        }, // Kényszerítjük a struktúrát
      }),
    });

    const data = await response.json();

    // Function calling válasz kezelése
    const toolCall = data.choices[0].message.tool_calls?.[0];

    if (toolCall && toolCall.function.name === "ingatlan_szures") {
      const jsonString = toolCall.function.arguments;
      const eredmeny = JSON.parse(jsonString);
      console.log("Sikeres AI értelmezés:", eredmeny);
      return eredmeny;
    } else {
      console.warn("Az AI nem hívott függvényt, nyers válasz:", data);
      return {};
    }
  } catch (hiba) {
    console.error("Proxy / Parse hiba:", hiba);
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
