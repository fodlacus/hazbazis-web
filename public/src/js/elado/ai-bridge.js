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
      // Ellenőrizd: nálad /ai-proxy vagy teljes URL kell?
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            // ITT A JAVÍTÁS LÉNYEGE:
            content: `Te egy ingatlan-adat kinyerő specialista vagy. 
                A feladatod a hirdető által megadott szövegből az adatok kinyerése a 'ingatlan_szures' függvény számára.

                SZIGORÚ SZABÁLYOK:
                1. KATEGÓRIA: Ha a szövegben szerepel a 'kiadó', 'albérlet', 'kiadnám', 'bérbeadó' szó, a kategória legyen: 'kiado'. Minden más esetben (eladó, kínálom) legyen: 'elado'.
                2. LAKÓPARK: Ha a szövegben konkrét projektnevet látsz (pl. Metrodom, Cordia, Elite Park, City Home), a 'lakopark_e' legyen 'Igen', és a projekt nevét írd a 'lakopark_nev' mezőbe.
                3. TÍPUS: Ha a szöveg garázst, kocsibeállót vagy tárolót említ, a 'tipus' legyen 'Garázs'.
                4. ÁR: Az árakat mindig alakítsd tiszta számmá (pl. 50 millió -> 50000000),
                5. BÉRLETI DÍJ: Ha bérlésről van szó, a megadott összeget a 'vételár' mezőbe írd (ez lesz a havidíj).`,
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

    if (response.status === 405 || !response.ok) {
      console.error(
        "❌ A szerver (Cloudflare) nem engedélyezi a POST hívást az /ai-proxy-ra."
      );
      return null; // Így nem fut rá a JSON hibára
    }
    const data = await response.json();

    // Ellenőrzés: kaptunk-e function call-t?
    const toolCall = data.choices[0].message.tool_calls?.[0];

    // BIZTONSÁGI ELLENŐRZÉS: Megnézzük, létezik-e a várt struktúra
    if (data && data.choices && data.choices[0] && data.choices[0].message) {
      const toolCall = data.choices[0].message.tool_calls?.[0];

      if (toolCall) {
        const args = JSON.parse(toolCall.function.arguments);
        console.log("✅ AI Szigorú Eredmény:", args);
        return args;
      } else {
        // Ha nem függvényt hívott, hanem sima szöveget írt
        console.warn("⚠️ Az AI nem használt függvényt, csak szöveget küldött.");
        return {};
      }
    } else {
      // Ha a válasz szerkezete teljesen rossz (pl. hibaüzenet az OpenAI-tól)
      console.error("❌ Váratlan válasz szerkezet az AI-tól:", data);
      return {};
    }
  } catch (hiba) {
    console.error("AI Hiba:", hiba);
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
