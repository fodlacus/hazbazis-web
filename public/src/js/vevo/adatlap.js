import {
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { adatbazis } from "../util/firebase-config.js";

// FŐ INDÍTÓ FÜGGVÉNY
window.addEventListener("DOMContentLoaded", initAdatlap);

async function initAdatlap() {
  // 1. URL paraméter (ID) kiolvasása
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  if (!id) {
    alert("Nincs kiválasztott ingatlan!");
    window.location.href = "../../../index.html";
    return;
  }

  console.log("Adatlap betöltése ID alapján:", id);

  try {
    // 2. Adatok lekérése Firebase-ből
    const docRef = doc(adatbazis, "lakasok", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() };

      // 3. Részfeladatok (függvényhívások)
      renderGaleria(data);
      renderAdatok(data);
      renderVezerloGombok(data);
      renderKornyek(data); // "Places API" logika
      renderAjanlo(data); // Hasonló lakások
      renderKapcsolat(data);
    } else {
      document.body.innerHTML =
        "<h1 class='text-center mt-20 text-red-500'>Az ingatlan nem található (vagy törölték).</h1>";
    }
  } catch (error) {
    console.error("Hiba az adatlap betöltésekor:", error);
  }
}

// -------------------------------------------------------------
// 1. FUNKCIÓ: GALÉRIA (Swiper Cube Effect)
// -------------------------------------------------------------
export function renderGaleria(data) {
  const container = document.getElementById("galeria-container");
  container.innerHTML = "";

  // Képek összegyűjtése (vízszintes prioritás)
  let kepek = [];
  if (data.kepek_horiz && data.kepek_horiz.length > 0) kepek = data.kepek_horiz;
  else if (data.kepek && data.kepek.length > 0) kepek = data.kepek;
  else kepek = ["https://placehold.co/800x600/3D4A16/E2F1B0?text=Nincs+kép"];

  // HTML generálás
  kepek.forEach((img) => {
    const url = typeof img === "object" ? img.url : img;
    const slide = document.createElement("div");
    slide.className = "swiper-slide shadow-2xl";
    slide.style.backgroundImage = `url('${url}')`;
    container.appendChild(slide);
  });

  // Swiper Indítása (Cube Effect!)
  new Swiper(".mySwiper", {
    effect: "cube",
    grabCursor: true,
    cubeEffect: {
      shadow: true,
      slideShadows: true,
      shadowOffset: 20,
      shadowScale: 0.94,
    },
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev",
    },
    autoplay: {
      delay: 3500,
      disableOnInteraction: false,
    },
  });
}

// -------------------------------------------------------------
// 2. FUNKCIÓ: SZÖVEGES ADATOK KIÍRÁSA
// -------------------------------------------------------------
export function renderAdatok(data) {
  // Alapadatok
  setText("header-azon", data.azon || `#${data.id.substring(0, 6)}`);
  setText("adat-cim", data.nev || "Eladó Ingatlan");
  setText(
    "adat-lokacio",
    `${data.telepules}, ${data.kerulet || ""} ${data.varosresz || ""}`
  );

  const eredetiAr = Number(data.vételár);
  const akciosAr = Number(data.akcios_ar);
  const arKontener = document.getElementById("adat-ar");

  if (akciosAr && akciosAr > 0 && akciosAr < eredetiAr) {
    // Ha van érvényes akciós ár
    arKontener.innerHTML = `
        <span class="text-white/40 text-lg line-through mr-3">${eredetiAr.toLocaleString()} Ft</span>
        <span class="text-arany">${akciosAr.toLocaleString()} Ft</span>
    `;

    // Négyzetméter ár számolása az akciós árból
    if (data.alapterület) {
      const nmAr = Math.round(akciosAr / data.alapterület);
      setText("adat-nm-ar", nmAr.toLocaleString() + " Ft/m² (akciós)");
    }
  } else {
    // Normál ár megjelenítése
    setText(
      "adat-ar",
      !isNaN(eredetiAr) ? eredetiAr.toLocaleString() + " Ft" : "Ár kérésre"
    );

    if (data.alapterület && !isNaN(eredetiAr)) {
      const nmAr = Math.round(eredetiAr / data.alapterület);
      setText("adat-nm-ar", nmAr.toLocaleString() + " Ft/m²");
    }
  }

  // Ár formázás
  const ar = Number(data.vételár);
  setText("adat-ar", !isNaN(ar) ? ar.toLocaleString() + " Ft" : "Ár kérésre");

  // Négyzetméter ár
  if (data.alapterület && !isNaN(ar)) {
    const nmAr = Math.round(ar / data.alapterület);
    setText("adat-nm-ar", nmAr.toLocaleString() + " Ft/m²");
  }

  // Paraméterek
  setText("inf-meret", (data.alapterület || "?") + " m²");
  setText("inf-szoba", (data.szobák || "?") + " db");
  setText("inf-emelet", data.emelet || "Fsz.");
  setText("inf-tipus", data.tipus || "Lakás");

  // --- ÚJ RÉSZ: MŰSZAKI ADATOK LISTÁZÁSA ---
  const muszakiContainer = document.getElementById("muszaki-adatok-kontener");
  muszakiContainer.innerHTML = "";

  // Ezeket a mezőket keressük az adatbázisban
  const mezok = [
    { cimke: "Fűtés", kulcs: "fűtés" }, // vagy "futes" ékezet nélkül
    { cimke: "Parkolás", kulcs: "parkolas" },
    { cimke: "Kilátás", kulcs: "kilatas" },
    { cimke: "Rezsi (átlag)", kulcs: "rezsi" },
    { cimke: "Energetika", kulcs: "energetika" },
    { cimke: "Tájolás", kulcs: "tajolas" },
    { cimke: "Építés éve", kulcs: "epites_eve" },
    { cimke: "Erkély mérete", kulcs: "erkely_terasz", utotag: " m²" },
  ];

  mezok.forEach((mezo) => {
    // Kezeljük az ékezetes és ékezet nélküli kulcsokat is
    let ertek =
      data[mezo.kulcs] ||
      data[mezo.kulcs.replace("ő", "o").replace("ű", "u")] ||
      "-";

    // Ha van utótag (pl. m2) és van érték, tegyük hozzá
    if (ertek !== "-" && mezo.utotag) ertek += mezo.utotag;

    const sor = document.createElement("div");
    sor.className = "flex justify-between border-b border-white/5 py-2";
    sor.innerHTML = `
        <span class="text-white/50 text-sm">${mezo.cimke}</span>
        <span class="font-medium text-arany text-sm text-right">${ertek}</span>
    `;
    muszakiContainer.appendChild(sor);
  });
  // ----------------------------------------

  // Leírás (sortörések cseréje <br>-re)
  const leiras =
    data.leírás || data.leiras || "Ehhez az ingatlanhoz nem adtak meg leírást.";

  const leirasElem = document.getElementById("adat-leiras");
  if (leirasElem) {
    // Sortörések kezelése és kiírás
    leirasElem.innerHTML = leiras.replace(/\n/g, "<br>");
  }

  // Kapcsolat
  setText("hirdeto-email", data.hirdeto_email || "kapcsolat@hazbazis.hu");
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

// -------------------------------------------------------------
// 3. FUNKCIÓ: VEZÉRLŐ GOMBOK
// -------------------------------------------------------------
export function renderVezerloGombok(data) {
  // Shorts gomb megjelenítése, ha van videó link
  const btnShorts = document.getElementById("btn-shorts");
  if (data.video_url && btnShorts) {
    btnShorts.classList.remove("hidden");
    btnShorts.onclick = () => window.open(data.video_url, "_blank");
  }

  const btnVirtual = document.getElementById("btn-virtual-tour");

  if (btnVirtual) {
    // JAVÍTOTT SOR: Támogatjuk a régi és az új (többszintes) struktúrát is
    if (
      data.virtual_tour &&
      (data.virtual_tour.alaprajz_url || data.virtual_tour.tobb_szintes)
    ) {
      // Ha VAN adat -> Aktiválás
      btnVirtual.onclick = () => {
        window.location.href = `virtual-tour.html?id=${data.id}`;
      };

      // Stílus: Aktív (zöld)
      btnVirtual.classList.remove(
        "opacity-50",
        "cursor-not-allowed",
        "bg-white/5"
      );
      btnVirtual.classList.add(
        "bg-[#3D4A16]",
        "text-white",
        "border-lime-400",
        "hover:bg-[#4d5e1c]",
        "cursor-pointer"
      );
      btnVirtual.innerHTML = `<i class="fa-solid fa-street-view"></i> Virtuális séta indítása`;
      btnVirtual.title = "";
    } else {
      // Ha NINCS adat -> Letiltás
      btnVirtual.onclick = null;

      // Stílus: Inaktív (szürke/áttetsző)
      btnVirtual.classList.remove(
        "bg-[#3D4A16]",
        "text-white",
        "border-lime-400",
        "hover:bg-[#4d5e1c]",
        "cursor-pointer"
      );
      btnVirtual.classList.add(
        "bg-white/5",
        "opacity-50",
        "cursor-not-allowed"
      );
      btnVirtual.title = "Nincs elérhető virtuális séta";
    }
  }
}
// -------------------------------------------------------------
// 4. FUNKCIÓ: KÖRNYÉK (Valós BKK adatok megjelenítése)
// -------------------------------------------------------------
export function renderKornyek(data) {
  const container = document.getElementById("poi-container");
  container.innerHTML = "";

  // Ha nincsenek BKK adatok (üres a tömb vagy nem is létezik)
  if (!data.bkk_jaratok || data.bkk_jaratok.length === 0) {
    container.innerHTML =
      "<p class='text-white/40 text-sm p-3'>Nincs elérhető közlekedési információ 300 méteren belül.</p>";
    return;
  }

  // Ha vannak adatok, végigmegyünk rajtuk
  data.bkk_jaratok.forEach((jarat) => {
    // Ikon és típus magyarítása a BKK adatok alapján
    let ikon = "fa-bus";
    let tipusNev = "Busz";

    if (jarat.tipus === "TRAM") {
      ikon = "fa-train-tram";
      tipusNev = "Villamos";
    } else if (jarat.tipus === "SUBWAY") {
      ikon = "fa-train-subway";
      tipusNev = "Metró";
    } else if (jarat.tipus === "TROLLEYBUS") {
      ikon = "fa-bus-simple";
      tipusNev = "Trolibusz";
    }

    const div = document.createElement("div");
    div.className =
      "flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5";
    div.innerHTML = `
        <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" 
             style="background-color: #${jarat.szin}; color: #${jarat.szoveg_szin}; font-weight: bold; font-size: 14px;">
            ${jarat.szam}
        </div>
        <div>
            <div class="font-bold text-sm">BKK Járat</div>
            <div class="text-xs text-white/40"><i class="fa-solid ${ikon} mr-1"></i> ${tipusNev} (300m)</div>
        </div>
    `;
    container.appendChild(div);
  });
}

// -------------------------------------------------------------
// 5. FUNKCIÓ: AJÁNLÓ (Hasonló ingatlanok)
// -------------------------------------------------------------
export async function renderAjanlo(aktualisData) {
  const container = document.getElementById("ajanlo-kontener");

  try {
    // Logika: Keressünk max 4 ingatlant, ami NEM az aktuális, és hasonló az ára
    // (Egyszerűsített lekérdezés a demóhoz)
    const q = query(collection(adatbazis, "lakasok"), limit(4));

    const snap = await getDocs(q);

    container.innerHTML = "";

    snap.forEach((doc) => {
      const d = doc.data();
      if (doc.id === aktualisData.id) return; // Ne ajánlja önmagát

      // Kép kiválasztása
      let img = "https://placehold.co/400x300";
      const jeloltKepek = [];
      if (Array.isArray(d.kepek_horiz) && d.kepek_horiz.length > 0) {
        jeloltKepek.push(...d.kepek_horiz);
      }
      if (Array.isArray(d.kepek) && d.kepek.length > 0) {
        jeloltKepek.push(...d.kepek);
      }
      if (jeloltKepek.length > 0) {
        const elso = jeloltKepek[0];
        img = typeof elso === "object" ? elso.url : elso;
      }

      const azon = d.azon || `#${doc.id.substring(0, 5)}`;
      const card = document.createElement("div");
      card.className =
        "bg-white/5 rounded-2xl overflow-hidden border border-white/10 hover:border-arany transition group cursor-pointer";
      card.onclick = () => (window.location.href = `adatlap.html?id=${doc.id}`); // Újratöltés az új ID-val

      card.innerHTML = `
      <div class="h-40 overflow-hidden relative">
          <img src="${img}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
          
          <div class="absolute top-2 left-2 bg-black/80 px-2 py-1 rounded text-[10px] text-white font-mono border border-white/20">
              ${azon}
          </div>

          <div class="absolute bottom-2 right-2 bg-[#E2F1B0] px-2 py-1 rounded text-xs text-[#3D4A16] font-bold shadow-lg">
              ${Number(d.vételár).toLocaleString()} Ft
          </div>
      </div>
      <div class="p-4">
          <h4 class="font-bold truncate text-sm">${d.nev}</h4>
          <p class="text-xs text-white/50 mt-1">${d.telepules}</p>
      </div>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    console.error("Hiba az ajánlóban:", e);
  }
}

// -------------------------------------------------------------
// 6. FUNKCIÓ: KAPCSOLAT FELVÉTEL
// -------------------------------------------------------------
function renderKapcsolat(data) {
  const emailEl = document.getElementById("hirdeto-email");
  const btnHivas = document.getElementById("btn-hivas");
  const btnUzenet = document.getElementById("btn-uzenet");

  let cache = null;
  let folyamatban = false;

  function allapotBeallitas(email, telefon) {
    if (emailEl) {
      emailEl.innerText = email || "Kapcsolat kérésre";
    }

    if (btnHivas) {
      if (telefon) {
        btnHivas.classList.remove("opacity-50", "cursor-not-allowed");
      } else {
        btnHivas.classList.add("opacity-50", "cursor-not-allowed");
      }
    }

    if (btnUzenet) {
      if (email) {
        btnUzenet.classList.remove("opacity-50", "cursor-not-allowed");
      } else {
        btnUzenet.classList.add("opacity-50", "cursor-not-allowed");
      }
    }
  }

  const kezdetiEmail = data.hirdeto_email || data.email || "";
  const kezdetiTelefon = data.telefon || "";
  allapotBeallitas(kezdetiEmail, kezdetiTelefon);

  async function biztositsKapcsolat() {
    if (cache || folyamatban) return cache;
    folyamatban = true;

    let email = data.hirdeto_email || data.email || "";
    let telefon = data.telefon || "";

    try {
      if (!email || !telefon) {
        const hirdetoUid = data.hirdeto_uid;
        const hirdetoAzon = data.hirdeto_azon;

        if (hirdetoUid) {
          const userSnap = await getDoc(
            doc(adatbazis, "felhasznalok", hirdetoUid)
          );
          if (userSnap.exists()) {
            const user = userSnap.data();
            email = email || user.email || "";
            telefon = telefon || user.telefon || "";
          }
        } else if (hirdetoAzon) {
          const q = query(
            collection(adatbazis, "felhasznalok"),
            where("hirdeto_azon", "==", hirdetoAzon),
            limit(1)
          );
          const snap = await getDocs(q);
          snap.forEach((userDoc) => {
            const user = userDoc.data();
            email = email || user.email || "";
            telefon = telefon || user.telefon || "";
          });
        }
      }
    } catch (error) {
      console.warn("Kapcsolat adatok betöltése sikertelen:", error);
    }

    cache = { email, telefon };
    folyamatban = false;

    allapotBeallitas(email, telefon);

    return cache;
  }

  if (btnHivas) {
    btnHivas.onclick = async () => {
      const adat = await biztositsKapcsolat();
      const tisztaTelefon = adat.telefon
        ? adat.telefon.replace(/\s+/g, "")
        : "";
      if (tisztaTelefon) {
        window.location.href = `tel:${tisztaTelefon}`;
      }
    };
  }

  if (btnUzenet) {
    btnUzenet.onclick = async () => {
      const adat = await biztositsKapcsolat();
      if (adat.email) {
        window.location.href = `mailto:${adat.email}`;
      }
    };
  }
}
