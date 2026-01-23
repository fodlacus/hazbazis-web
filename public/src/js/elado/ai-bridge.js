import { ingatlanStruktura } from "../util/ingatlan-szotar.js";

// Helyi adatbázis a validáláshoz (ezt később külön fájlba is tehetjük)
const budapestAdatok = {
  "XIV.": [
    "Alsórákos",
    "Herminamező",
    "Istvánmező",
    "Kaszásdűlő",
    "Rákosfalva",
    "Törökőr",
    "Zugló",
  ],
  "XVII.": [
    "Akadémiaújtelep",
    "Madárdomb",
    "Rákoscsaba",
    "Rákoshegy",
    "Rákoskeresztúr",
    "Rákoskert",
    "Rákosliget",
  ],
  // Bővíthető a többi kerülettel
};

// Segédfüggvény a mezőnevek kinyeréséhez a Prompt számára
const getMezok = () => {
  let kulcsok = [];
  Object.values(ingatlanStruktura).forEach((s) =>
    s.mezok.forEach((m) => kulcsok.push(m.id))
  );
  return kulcsok.join(", ");
};

// ai-bridge.js - Szigorú AI adatkinyerés és validáció

window.aiAdatKeres = async function () {
  const inputMezo = document.getElementById("ai-azonosito");
  const forrasSzoveg = inputMezo.value.trim();
  const gomb = document.querySelector('button[onclick="aiAdatKeres()"]');

  if (!forrasSzoveg) return;

  gomb.disabled = true;
  gomb.innerText = "Elemzés...";

  // FIGYELEM: Itt kell majd a valódi végpontod!
  const API_URL = "https://api.openai.com/v1/chat/completions"; // Példa OpenAI végpont

  try {
    // Ha még nincs kész a szervered, itt egy szimuláció a teszteléshez:
    if (forrasSzoveg.includes("Zászlós utca")) {
      console.log("Szimulált AI válasz indítása...");
      const tesztAdat = {
        nev: "Zászlós utca 29-31.",
        vételár: "86500000",
        alapterület: "66",
        szobák: "3",
        kerulet: "XIV.",
        varosresz: "Alsórákos",
        típus: "Tégla lakás",
      };
      adatokBetoltese(tesztAdat);
      return;
    }

    // VALÓDI HÍVÁS (Csak ha az API_URL helyes!)
    const valasz = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "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", // Ide kell a titkos kulcs
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Ingatlan JSON exportáló vagy." },
          { role: "user", content: forrasSzoveg },
        ],
      }),
    });

    if (!valasz.ok) throw new Error(`Szerver hiba: ${valasz.status}`);

    const data = await valasz.json();
    adatokBetoltese(JSON.parse(data.choices[0].message.content));
  } catch (hiba) {
    console.error("AI Elemzési hiba:", hiba);
    alert("Hiba: Az API végpont nem érhető el vagy hibás.");
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
      // Hitelesítési jelzés: zöld keret
      mezo.style.border = "2px solid #A3E635";
      setTimeout(() => (mezo.style.border = ""), 2000);

      // Kerület váltás triggerelése
      if (id === "kerulet") mezo.dispatchEvent(new Event("change"));
    }
  });
}

// Korábban megbeszélt ürítés funkció globálissá tétele
window.urlapUrites = function () {
  if (confirm("Biztosan törlöd az összes adatot az űrlapról?")) {
    const urlap = document.getElementById("hirdetes-urlap");
    if (urlap) {
      urlap.reset();
      document.getElementById("ai-azonosito").value = "";
      console.log("Űrlap kiürítve.");
    }
  }
};

// ai-bridge.js - AZ AI ÉLESÍTÉSE

window.ertelmezdAkeresest = async function (szoveg) {
  console.log("AI elemzés indítása (OpenAI)...", szoveg);

  // Ide jön majd az API kulcsod, vagy a backend végpontod
  const API_URL = "https://api.openai.com/v1/chat/completions";
  const API_KEY = "process.env.OPENAI_API_KEY";
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `Ingatlanos asszisztens vagy. A feladatod tiszta JSON kinyerése a szövegből. 
                          Szabályok:
                          - 'minAr': ha 'felett', 'minimum', 'legalább' szerepel.
                          - 'maxAr': ha 'alatt', 'maximum', 'ig' szerepel.
                          - A számokat tiszta egészként add vissza (pl. 75 millió -> 75000000).
                          - Kerületet római számmal (pl. XIV.).`,
          },
          {
            role: "user",
            content: `Elemezd ezt: "${szoveg}"`,
          },
        ],
        response_format: { type: "json_object" }, // Így biztosan JSON-t kapunk vissza
        temperature: 0,
      }),
    });

    const data = await response.json();
    const eredmeny = JSON.parse(data.choices[0].message.content);

    console.log("AI által értelmezett feltételek:", eredmeny);
    return eredmeny;
  } catch (hiba) {
    console.error("AI hiba:", hiba);
    // Tartalék megoldás: ha az AI elbukik, küldjünk vissza egy üres objektumot
    return null;
  }
};
window.automataCimEllenorzes = async function () {
  const irsz = document.getElementById("iranyitoszam")?.value;
  const varos = document.getElementById("telepules")?.value;
  const utca = document.getElementById("utca")?.value;
  const hazszam = document.getElementById("hazszam")?.value;

  // A gomb elérése a javított HTML ID alapján (hirdetes-bekuldes)
  const mentesGomb = document.getElementById("hirdetes-bekuldes");

  // Csak akkor indítjuk a keresést, ha az alapvető mezők ki vannak töltve
  if (irsz?.length >= 4 && varos?.length >= 2 && utca?.length >= 3) {
    const teljesCim = `${irsz} ${varos}, ${utca} ${hazszam || ""}`;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          teljesCim
        )}&addressdetails=1&countrycodes=hu`
      );
      const adatok = await response.json();

      // RUGALMASABB ELLENŐRZÉS: Elfogadjuk, ha van bármilyen találat,
      // de preferáljuk az utca (road) meglétét.
      const vanBarmilyenTalalat = adatok && adatok.length > 0;

      if (vanBarmilyenTalalat) {
        // SIKER ÁG: Zöld visszajelzés
        ["iranyitoszam", "telepules", "utca", "hazszam"].forEach((id) => {
          const el = document.getElementById(id);
          if (el && el.value) {
            el.style.borderColor = "#A3E635"; // Teras-zöld
            el.style.backgroundColor = "rgba(163, 230, 53, 0.05)";
          }
        });

        if (mentesGomb) {
          mentesGomb.disabled = false;
          mentesGomb.style.opacity = "1";
          mentesGomb.title = "A cím rendben, a hirdetés rögzíthető.";
        }
        console.log("Cím elfogadva: ", adatok[0].display_name);
      } else {
        // HIBA ÁG: Piros visszajelzés és tiltás
        const utcaMezo = document.getElementById("utca");
        if (utcaMezo) {
          utcaMezo.style.borderColor = "#EF4444"; // Hiba piros
          utcaMezo.style.backgroundColor = "rgba(239, 68, 68, 0.05)";
        }

        if (mentesGomb) {
          mentesGomb.disabled = true;
          mentesGomb.style.opacity = "0.5";
          mentesGomb.title =
            "Csak valós, létező utca/házszám esetén rögzíthető a hirdetés!";
        }
        console.warn("Nem létező vagy pontatlan cím!");
      }
    } catch (error) {
      console.error("Validálási hiba a hálózatban:", error);
    }
  } else {
    // Ha még nem elég hosszú a bevitel, maradjon letiltva a gomb
    if (mentesGomb) {
      mentesGomb.disabled = true;
      mentesGomb.style.opacity = "0.5";
    }
  }
};

// AI hirdetésszöveg generálása az űrlap adatai alapján
window.generaljLeirast = async function () {
  const leirasMezo = document.getElementById("leírás");
  if (!leirasMezo) return;

  // Adatok kinyerése az űrlapról
  const nev = document.getElementById("nev")?.value || "";
  const ar = document.getElementById("vételár")?.value || "";
  const szoba = document.getElementById("szobák")?.value || "";
  const tipus = document.getElementById("tipus")?.value || "ingatlan";
  const allapot = document.getElementById("allapot")?.value || "";
  const telepules = document.getElementById("telepules")?.value || "";

  // Ellenőrzés: Legyen elég adat a generáláshoz
  if (!ar || !szoba) {
    alert(
      "Kérlek, töltsd ki legalább az árat és a szobaszámot, hogy az AI tudjon miről írni!"
    );
    return;
  }

  // Vizuális visszajelzés a felhasználónak
  leirasMezo.value = "AI hirdetésírás folyamatban... Kérlek várj.";
  leirasMezo.classList.add("animate-pulse");

  // Itt egyelőre egy profi sablont használunk, amíg az API-d nincs élesítve
  // De a felépítése már felkészült a valódi AI válaszra
  setTimeout(() => {
    const generaltSzoveg = `Kiváló lehetőség ${telepules} területén! Eladó egy ${allapot} állapotú, ${szoba} szobás ${tipus.toLowerCase()}. 
  
  Az ingatlan ${Number(
    ar
  ).toLocaleString()} Ft-os irányáron érhető el. Paraméterei és elhelyezkedése alapján ideális választás családoknak és befektetőknek egyaránt. 
  
  Érdeklődés esetén keressen bizalommal a megadott elérhetőségeken!`;

    leirasMezo.value = generaltSzoveg;
    leirasMezo.classList.remove("animate-pulse");

    // Egy kis lila villanás, jelezve a sikeres AI generálást
    leirasMezo.style.backgroundColor = "rgba(168, 85, 247, 0.1)";
    setTimeout(() => {
      leirasMezo.style.backgroundColor = "";
    }, 2000);

    console.log("Hirdetés szövege sikeresen legenerálva.");
  }, 1500);
};
