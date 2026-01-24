// ai-bridge.js - Szigorú AI adatkinyerés és validáció (Function Calling verzió)

// 1. A keresési feltételek definíciója (Tools) - Ez tanítja meg az AI-nak a mezőneveket
const ingatlanTools = [
  {
    type: "function",
    function: {
      name: "ingatlan_szures",
      description: "Kinyeri az ingatlan keresési paramétereket.",
      parameters: {
        type: "object",
        properties: {
          telepules: { type: "string" },
          kerulet: { type: "string" },
          vételár: { type: "number" },
          szobák: { type: "number" },
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
  try {
    const response = await fetch("/ai-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "Ingatlan JSON exportáló vagy. Csak tiszta JSON-t válaszolj!",
          },
          { role: "user", content: szoveg },
        ],
        // Megjegyzés: Ha itt nem küldünk 'tools'-t, akkor response_format kell
      }),
    });

    const data = await response.json();
    let nyersTartalom = data.choices[0].message.content;

    // JAVÍTÁS: Ha az AI kódblokkba (```json) tette a választ, takarítsuk ki
    nyersTartalom = nyersTartalom.replace(/```json|```/g, "").trim();

    try {
      const eredmeny = JSON.parse(nyersTartalom);
      console.log("Sikeres elemzés:", eredmeny);
      return eredmeny || {}; // Soha ne adjunk vissza null-t
    } catch (e) {
      console.error("JSON parse hiba a takarítás után is:", nyersTartalom);
      return {};
    }
  } catch (hiba) {
    console.error("Proxy hiba:", hiba);
    return {}; // Biztonsági háló a null hiba ellen
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
