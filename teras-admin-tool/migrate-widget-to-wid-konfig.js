/**
 * widget kollekció -> wid-konfig másolás (Shorts / partner beágyazás).
 *
 * Futtatás (teras-admin-tool mappából, serviceAccountKey.json mellett):
 *   node migrate-widget-to-wid-konfig.js
 * Meglévő beagyazas_kulcs felülírása:
 *   FORCE=1 node migrate-widget-to-wid-konfig.js
 *
 * Szükséges: ./serviceAccountKey.json (ugyanaz, mint a többi admin scriptnél)
 */

const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const FORCE = process.env.FORCE === "1";

const ALAP_MEGJELENES = {
  primer_szin: "#E2F1B0",
  masodlagos_szin: "#3D4A16",
  nyelv: "hu",
  powered_by_lathato: true,
};

const ALAP_SHORTS = {
  aktiv: true,
  kijelzett_azon: true,
  kijelzett_ar: true,
  kijelzett_cim: true,
  cta_szoveg: "Részletek megtekintése",
  cta_url: "",
};

function ts() {
  return admin.firestore.FieldValue.serverTimestamp();
}

async function vanMarBeagyazasKulcs(beagyazasKulcs) {
  const q = await db
    .collection("wid-konfig")
    .where("beagyazas_kulcs", "==", beagyazasKulcs)
    .limit(1)
    .get();
  return !q.empty;
}

function widgetToWidKonfig(widgetId, w) {
  const beagyazasKulcs = w.hb_azon != null ? String(w.hb_azon).trim() : "";
  const hirdetoAzon =
    w.hirdeto_azon != null ? String(w.hirdeto_azon).trim() : "";

  const aktiv = w.active !== false && w.aktiv !== false;

  const megjelenes = {
    ...ALAP_MEGJELENES,
    ...(w.megjelenes && typeof w.megjelenes === "object" ? w.megjelenes : {}),
  };

  const shorts = {
    ...ALAP_SHORTS,
    ...(w.shorts && typeof w.shorts === "object" ? w.shorts : {}),
  };

  const ingatlanAzon =
    w.ingatlan_azon != null
      ? String(w.ingatlan_azon).trim()
      : "";

  const engedelyezett =
    Array.isArray(w.engedelyezett_domainek) ? w.engedelyezett_domainek : [];

  return {
    ingatlan_azon: ingatlanAzon,
    hirdeto_azon: hirdetoAzon,
    beagyazas_kulcs: beagyazasKulcs,
    aktiv,
    letrehozva: ts(),
    frissitve: ts(),
    engedelyezett_domainek: engedelyezett,
    megjelenes,
    shorts,
    tour: w.tour && typeof w.tour === "object" ? w.tour : null,
    terkep: w.terkep && typeof w.terkep === "object" ? w.terkep : null,
    wallet: w.wallet && typeof w.wallet === "object" ? w.wallet : null,
    regi_widget_dokumentum_id: widgetId,
    migralt_widget_bol: true,
  };
}

async function main() {
  console.log("widget -> wid-konfig migráció indul…");
  const snap = await db.collection("widget").get();

  if (snap.empty) {
    console.log("Nincs dokumentum a 'widget' kollekcióban.");
    process.exit(0);
    return;
  }

  let letrehozva = 0;
  let kihagyva = 0;
  let hiba = 0;

  for (const doc of snap.docs) {
    const w = doc.data();
    const payload = widgetToWidKonfig(doc.id, w);
    const kulcs = payload.beagyazas_kulcs;

    if (!kulcs) {
      console.warn(`[kihagyva] ${doc.id}: hiányzik a hb_azon (beagyazas_kulcs).`);
      kihagyva++;
      continue;
    }

    if (!payload.hirdeto_azon) {
      console.warn(`[kihagyva] ${doc.id}: hiányzik a hirdeto_azon.`);
      kihagyva++;
      continue;
    }

    try {
      const marVan = await vanMarBeagyazasKulcs(kulcs);
      if (marVan && !FORCE) {
        console.log(`[már van] beagyazas_kulcs=${kulcs} — kihagyva (FORCE=1 felülírás nincs)`);
        kihagyva++;
        continue;
      }

      if (marVan && FORCE) {
        const existing = await db
          .collection("wid-konfig")
          .where("beagyazas_kulcs", "==", kulcs)
          .limit(1)
          .get();
        const ref = existing.docs[0].ref;
        payload.letrehozva = existing.docs[0].get("letrehozva") || ts();
        payload.frissitve = ts();
        await ref.set(payload, { merge: true });
        console.log(`[frissítve] ${ref.id} beagyazas_kulcs=${kulcs}`);
      } else {
        const ref = await db.collection("wid-konfig").add(payload);
        console.log(`[létrehozva] ${ref.id} beagyazas_kulcs=${kulcs}`);
      }
      letrehozva++;
    } catch (e) {
      console.error(`[hiba] ${doc.id}:`, e.message);
      hiba++;
    }
  }

  console.log("--- kész ---");
  console.log(`létrehozva/frissítve: ${letrehozva}, kihagyva: ${kihagyva}, hiba: ${hiba}`);
  process.exit(hiba > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
