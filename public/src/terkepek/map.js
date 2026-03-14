let terkep;
let markerLista = [];
let rekordLista = [];
let markerKlaszter = null;
let aktivInfoAblak = null;

let rajzoloKezelo = null;
let aktivPolygon = null;
let kijeloltRekordok = [];
let ajanlatiKosarRekordok = [];
let koltsegParameterek = null;

async function initMap() {
  try {
    await betoltKoltsegParameterek();

    terkep = new google.maps.Map(document.getElementById("map"), {
      center: { lat: 47.4979, lng: 19.0402 },
      zoom: 11,
      maxZoom: 18,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_LEFT,
      },
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
        {
          featureType: "administrative",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "road",
          elementType: "labels.icon",
          stylers: [{ visibility: "off" }],
        },
        { featureType: "poi.business", stylers: [{ visibility: "off" }] },
        {
          featureType: "poi.park",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
      ],
    });

    letrehozRajzoloKezelo();
    bekotEsemenyek();
    frissitStatisztika();
    frissitKijeloltLista();
    betoltUthibak();

    setTimeout(() => {
      google.maps.event.trigger(terkep, "resize");
    }, 200);
  } catch (hiba) {
    console.error("Hiba az initMap futasa kozben:", hiba);
  }
}

function bekotEsemenyek() {
  document
    .getElementById("betoltGomb")
    .addEventListener("click", betoltUthibak);
  const temaSelect = document.getElementById("temaSelect");
  if (temaSelect) {
    temaSelect.addEventListener("change", betoltUthibak);
  }
  document
    .getElementById("rajzolasInditGomb")
    .addEventListener("click", inditPolygonRajzolas);
  document
    .getElementById("polygonTorolGomb")
    .addEventListener("click", torolAktivPolygont);

  document.querySelectorAll(".statuszCheckbox").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      szuresAlkalmazasa();
      frissitKijelolesPolygonAlapjan();
    });
  });

  document
    .getElementById("kosarbaGomb")
    .addEventListener("click", kosarbaHozzaad);

  document
    .getElementById("kosarTorolGomb")
    .addEventListener("click", kosarUrit);

  window.addEventListener("resize", kezeliAtmeretezes);
  window.addEventListener("orientationchange", kezeliAtmeretezes);
}

function kezeliAtmeretezes() {
  if (!terkep) return;

  setTimeout(() => {
    google.maps.event.trigger(terkep, "resize");
  }, 250);
}

function letrehozRajzoloKezelo() {
  rajzoloKezelo = new google.maps.drawing.DrawingManager({
    drawingMode: null,
    drawingControl: false,
    polygonOptions: {
      fillColor: "#7b4f2c",
      fillOpacity: 0.18,
      strokeColor: "#7b4f2c",
      strokeOpacity: 0.9,
      strokeWeight: 2,
      editable: true,
      draggable: false,
      zIndex: 10,
    },
  });

  rajzoloKezelo.setMap(terkep);

  google.maps.event.addListener(rajzoloKezelo, "overlaycomplete", (esemeny) => {
    if (esemeny.type !== google.maps.drawing.OverlayType.POLYGON) return;

    if (aktivPolygon) {
      aktivPolygon.setMap(null);
    }

    aktivPolygon = esemeny.overlay;
    rajzoloKezelo.setDrawingMode(null);

    bekotPolygonValtozasok(aktivPolygon);
    frissitKijelolesPolygonAlapjan();
  });
}

function bekotPolygonValtozasok(polygon) {
  const utvonal = polygon.getPath();

  google.maps.event.addListener(
    utvonal,
    "set_at",
    frissitKijelolesPolygonAlapjan
  );
  google.maps.event.addListener(
    utvonal,
    "insert_at",
    frissitKijelolesPolygonAlapjan
  );
  google.maps.event.addListener(
    utvonal,
    "remove_at",
    frissitKijelolesPolygonAlapjan
  );
}

function inditPolygonRajzolas() {
  torolAktivPolygont();
  rajzoloKezelo.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
}

function torolAktivPolygont() {
  if (aktivPolygon) {
    aktivPolygon.setMap(null);
    aktivPolygon = null;
  }

  kijeloltRekordok = [];
  frissitKijeloltLista();
  frissitKijeloltOsszeg();
}

function markerSzine(statusz) {
  if (statusz === "alacsony") return "green";
  if (statusz === "kozepes") return "orange";
  if (statusz === "magas") return "red";
  if (statusz === "elkeszult") return "purple";
  return "blue";
}

function markerMeret(adat) {
  if (adat.kosarban) return 44;
  return 32;
}

function generalMarkerIkon(adat) {
  return {
    url: `https://maps.google.com/mapfiles/ms/icons/${markerSzine(
      adat.statusz
    )}-dot.png`,
    scaledSize: new google.maps.Size(markerMeret(adat), markerMeret(adat)),
  };
}

function frissitMarkerIkon(markerElem) {
  markerElem.marker.setIcon(generalMarkerIkon(markerElem.adat));
}

function aktivStatuszok() {
  return Array.from(document.querySelectorAll(".statuszCheckbox:checked")).map(
    (elem) => elem.value
  );
}

function allitBetoltesAllapot(szoveg) {
  document.getElementById("betoltesAllapot").textContent = szoveg;
}

function frissitStatisztika() {
  document.getElementById("osszDb").textContent = String(rekordLista.length);

  const lathatoDb = markerLista.filter((elem) => elem.lathato).length;
  document.getElementById("lathatoDb").textContent = String(lathatoDb);

  const onkoriId = document.getElementById("onkoriSelect")?.value || "-";
  document.getElementById("aktivOnkori").textContent = onkoriId;
}

function frissitKijeloltLista() {
  document.getElementById("kijeloltDb").textContent = String(
    kijeloltRekordok.length
  );

  const listaElem = document.getElementById("kijeloltLista");

  if (!kijeloltRekordok.length) {
    listaElem.innerHTML = `<div class="ures-lista">Nincs kijelolt elem.</div>`;
    return;
  }

  listaElem.innerHTML = kijeloltRekordok
    .map((adat) => {
      return `
        <div class="kijelolt-elem">
          <div class="kijelolt-azonosito">${adat.id}</div>
          <div class="kijelolt-meta">
            Statusz: ${adat.statusz}<br />
            Meret: ${adat.meret_kategoria}<br />
            Telepules: ${adat.telepules}
          </div>
        </div>
      `;
    })
    .join("");
}

function torolMindenMarker() {
  if (markerKlaszter) {
    markerKlaszter.clearMarkers();
    markerKlaszter = null;
  }

  markerLista.forEach((elem) => {
    elem.marker.setMap(null);
  });

  markerLista = [];
  rekordLista = [];

  if (aktivInfoAblak) {
    aktivInfoAblak.close();
    aktivInfoAblak = null;
  }

  torolAktivPolygont();
}

function generalInfoTartalom(adat) {
  const statuszCimke = adat.statusz || "-";
  const meretCimke = adat.meret_kategoria || "-";
  const telepulesCimke = adat.telepules || "-";

  return `
    <div style="width:240px; color:#3f3f3f; font-family:Arial,sans-serif;">
      <div style="font-weight:700; color:#7b4f2c;">${adat.id}</div>

      <img
        src="${adat.kep_url}"
        style="width:100%; height:230px; object-fit:cover; border-radius:10px; margin-bottom:10px;"
      />

      <div style="font-size:14px;">
        <div><strong>Statusz:</strong> ${statuszCimke}</div>
        <div><strong>Meret:</strong> ${meretCimke}</div>
        <div><strong>Telepules:</strong> ${telepulesCimke}</div>
      </div>
    </div>
  `;
}

function letrehozMarker(adat) {
  adat.kosarban = false;

  const marker = new google.maps.Marker({
    position: { lat: adat.lat, lng: adat.lng },
    title: adat.id,
    icon: generalMarkerIkon(adat),
  });

  const infoAblak = new google.maps.InfoWindow({
    content: generalInfoTartalom(adat),
  });

  marker.addListener("click", () => {
    if (aktivInfoAblak) {
      aktivInfoAblak.close();
    }

    infoAblak.open({
      anchor: marker,
      map: terkep,
    });

    aktivInfoAblak = infoAblak;
  });

  return { marker, adat, lathato: true };
}

function ujraepitKlaszterEsNezet() {
  if (markerKlaszter) {
    markerKlaszter.clearMarkers();
    markerKlaszter = null;
  }

  const lathatoMarkerek = markerLista
    .filter((elem) => elem.lathato)
    .map((elem) => elem.marker);

  markerKlaszter = new markerClusterer.MarkerClusterer({
    map: terkep,
    markers: lathatoMarkerek,
    onClusterClick: (event, cluster, map) => {
      const currentZoom = map.getZoom() || 11;
      const targetZoom = Math.min(currentZoom + 2, 18);
      const center = cluster.getCenter && cluster.getCenter();
      if (center) {
        map.panTo(center);
      }
      map.setZoom(targetZoom);
    },
  });

  frissitStatisztika();
}

function szuresAlkalmazasa() {
  const engedelyezettStatuszok = aktivStatuszok();

  markerLista.forEach((elem) => {
    const latszodjon = engedelyezettStatuszok.includes(elem.adat.statusz);
    elem.lathato = latszodjon;
    elem.marker.setMap(latszodjon ? terkep : null);
  });

  ujraepitKlaszterEsNezet();
}

function frissitKijelolesPolygonAlapjan() {
  if (!aktivPolygon) {
    kijeloltRekordok = [];
    frissitKijeloltLista();
    frissitKijeloltOsszeg();
    return;
  }

  kijeloltRekordok = markerLista
    .filter((elem) => elem.lathato)
    .filter((elem) => {
      const pozicio = elem.marker.getPosition();
      if (!pozicio) return false;

      return google.maps.geometry.poly.containsLocation(pozicio, aktivPolygon);
    })
    .map((elem) => elem.adat);

  frissitKijeloltLista();
  frissitKijeloltOsszeg();
}
async function betoltUthibak() {
  try {
    allitBetoltesAllapot("Betoltes folyamatban...");
    torolMindenMarker();

    const onkoriId = document.getElementById("onkoriSelect").value;
    let gyujtemenyNev =
      document.getElementById("temaSelect").value || "uthibak";
    if (!onkoriId) {
      allitBetoltesAllapot("Valaszd ki az onkormanyzatot");
      return;
    }
    if (!gyujtemenyNev) {
      allitBetoltesAllapot("Valaszd ki a reteget");
      return;
    }

    const snapshot = await db
      .collection(gyujtemenyNev)
      .where("onkori_id", "==", onkoriId)
      .get();

    rekordLista = snapshot.docs.map((doc) => doc.data());
    markerLista = rekordLista.map((adat) => letrehozMarker(adat));

    szuresAlkalmazasa();

    allitBetoltesAllapot(
      `Betoltve: ${rekordLista.length} rekord (${gyujtemenyNev})`
    );
  } catch (hiba) {
    console.error("Hiba a betoltes soran:", hiba);
    allitBetoltesAllapot("Hiba tortent a betoltes soran");
  }
}

async function betoltKoltsegParameterek() {
  const doc = await db.collection("rendszer").doc("koltseg_parameterek").get();
  koltsegParameterek = doc.data();
}

/* =========================
   JAVITASI KOLTSEG SZAMITAS
========================= */

function javitasKoltsegSzamitas(rekord) {
  if (!koltsegParameterek) return 0;

  const meretKategoriak = koltsegParameterek.kategoriak || {};

  const meretSzorzo =
    meretKategoriak[rekord.meret_kategoria] !== undefined
      ? meretKategoriak[rekord.meret_kategoria]
      : 1;

  const anyagKoltseg = koltsegParameterek.aszfalt_ar * meretSzorzo;

  const munkadij =
    (koltsegParameterek.alapdij_elokeszites +
      koltsegParameterek.munkadij_alap) *
    koltsegParameterek.korzet_szorzo;

  return anyagKoltseg + munkadij;
}

// PDF generáláshoz használt sorok előállítása
window.roadscanGetPdfRows = function () {
  if (!Array.isArray(ajanlatiKosarRekordok)) return [];

  return ajanlatiKosarRekordok.map((rekord) => {
    const koltseg = javitasKoltsegSzamitas(rekord) || 0;

    return [
      rekord.id || "",
      rekord.statusz || "",
      rekord.meret_kategoria || "",
      rekord.telepules || "",
      koltseg.toLocaleString("hu-HU") + " Ft",
    ];
  });
};

function kosarOsszegSzamitas() {
  let osszeg = 0;

  ajanlatiKosarRekordok.forEach((rekord) => {
    osszeg += javitasKoltsegSzamitas(rekord);
  });

  return osszeg;
}

function frissitKosarOsszeg() {
  const elem = document.getElementById("becsultOsszeg");
  if (!elem) return;

  const osszeg = kosarOsszegSzamitas();

  elem.textContent =
    "Becsült javítási érték: " + osszeg.toLocaleString("hu-HU") + " Ft";
}

/* =========================
   KOSAR FUNKCIOK
========================= */

function kosarbaHozzaad() {
  kijeloltRekordok.forEach((rekord) => {
    if (rekord.statusz === "elkeszult") return;

    const marVan = ajanlatiKosarRekordok.some((elem) => elem.id === rekord.id);

    if (!marVan) {
      ajanlatiKosarRekordok.push(rekord);

      const markerElem = markerLista.find((elem) => elem.adat.id === rekord.id);
      if (markerElem) {
        markerElem.adat.kosarban = true;
        frissitMarkerIkon(markerElem);
      }
    }
  });

  frissitKosarLista();
}

function frissitKosarLista() {
  const lista = document.getElementById("kosarLista");

  document.getElementById("kosarDb").textContent = ajanlatiKosarRekordok.length;

  if (!ajanlatiKosarRekordok.length) {
    lista.innerHTML = `<div class="ures-lista">A kosar ures.</div>`;
    frissitKosarOsszeg();
    return;
  }

  lista.innerHTML = ajanlatiKosarRekordok
    .map((adat) => {
      const koltseg = javitasKoltsegSzamitas(adat);

      return `
      <div class="kijelolt-elem">

        <div class="kijelolt-azonosito">
          ${adat.id}
        </div>

        <div class="kijelolt-meta">
          Statusz: ${adat.statusz}<br>
          Meret: ${adat.meret_kategoria}<br>
          Telepules: ${adat.telepules}<br>
          <strong>Becsult javitas:</strong>
          ${koltseg.toLocaleString("hu-HU")} Ft
        </div>

        <button
          class="gomb-szurke gomb-kicsi"
          onclick="kosarElemTorol('${adat.id}')"
        >
          Torles
        </button>

      </div>
    `;
    })
    .join("");

  frissitKosarOsszeg();
}

function kosarElemTorol(id) {
  ajanlatiKosarRekordok = ajanlatiKosarRekordok.filter(
    (elem) => elem.id !== id
  );

  const markerElem = markerLista.find((elem) => elem.adat.id === id);
  if (markerElem) {
    markerElem.adat.kosarban = false;
    frissitMarkerIkon(markerElem);
  }

  frissitKosarLista();
}

function kosarUrit() {
  ajanlatiKosarRekordok = [];

  markerLista.forEach((markerElem) => {
    markerElem.adat.kosarban = false;
    frissitMarkerIkon(markerElem);
  });

  frissitKosarLista();
}

function frissitKijeloltOsszeg() {
  let osszeg = 0;

  kijeloltRekordok.forEach((rekord) => {
    if (rekord.statusz === "elkeszult") {
      return;
    }

    osszeg += javitasKoltsegSzamitas(rekord);
  });

  const elem = document.getElementById("kijeloltOsszeg");

  if (!elem) return;

  if (osszeg === 0) {
    elem.textContent = "Becsült javítás: 0 Ft";
    return;
  }

  elem.textContent =
    "Becsült javítás: " + osszeg.toLocaleString("hu-HU") + " Ft";
}
