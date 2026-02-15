import { adatbazis } from "./../js/util/firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class KeresoMotor {
  constructor() {
    this.utolsoTalalatok = [];
  }

  ekezetMentesit(text) {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  elemzes(szoveg, extraFilterek = {}) {
    const tisztaSzoveg = this.ekezetMentesit(szoveg || "");

    // JAVÍTÁS: Új mező: meretMax
    const feltetelek = {
      telepules: extraFilterek.telepules || null,
      arMax: extraFilterek.arMax || null,
      arMin: extraFilterek.arMin || null,
      szobaMin: extraFilterek.szobaMin || null,
      meretMin: extraFilterek.meretMin || null,
      meretMax: extraFilterek.meretMax || null, // ÚJ!
      kategoria: extraFilterek.kategoria || "elado",
      tipus: extraFilterek.tipus || null,
      metroIds: extraFilterek.metroIds || [],
      lakopark: extraFilterek.lakopark || false,
      lakoparkNev: extraFilterek.lakoparkNev || null,
      kerulet: extraFilterek.kerulet || null,
    };

    // 1. KATEGÓRIA
    if (tisztaSzoveg.includes("kiado") || tisztaSzoveg.includes("alberlet"))
      feltetelek.kategoria = "kiado";

    // 2. TÍPUS
    if (tisztaSzoveg.includes("garazs") || tisztaSzoveg.includes("parkolo"))
      feltetelek.tipus = "Garázs";
    else if (tisztaSzoveg.includes("haz") || tisztaSzoveg.includes("csaladi"))
      feltetelek.tipus = "Ház";
    else if (tisztaSzoveg.includes("telek") || tisztaSzoveg.includes("epitesi"))
      feltetelek.tipus = "Telek";
    else if (
      tisztaSzoveg.includes("lakas") ||
      tisztaSzoveg.includes("panel") ||
      tisztaSzoveg.includes("tegla")
    )
      feltetelek.tipus = "Lakás";

    // 3. ÁR LOGIKA
    const arMatch = tisztaSzoveg.match(/(\d+)\s*(m|millió|millio|e|ezer)/);
    if (arMatch) {
      let szam = parseInt(arMatch[1]);
      const egyseg = arMatch[2];

      if (egyseg.startsWith("m")) {
        szam = szam * 1000000;
        if (
          !tisztaSzoveg.includes("kiado") &&
          !tisztaSzoveg.includes("alberlet")
        )
          feltetelek.kategoria = "elado";
      }
      if (egyseg.startsWith("e")) szam = szam * 1000;

      if (
        tisztaSzoveg.includes("felett") ||
        tisztaSzoveg.includes("tobb") ||
        tisztaSzoveg.includes("min") ||
        tisztaSzoveg.includes("dragabb")
      ) {
        feltetelek.arMin = szam;
        feltetelek.arMax = null;
      } else {
        feltetelek.arMax = szam;
        feltetelek.arMin = null;
      }
    }

    // 4. VÁROS (Szótár)
    const varosSzotar = {
      budapest: "Budapest",
      debrecen: "Debrecen",
      szeged: "Szeged",
      pecs: "Pécs",
      gyor: "Győr",
      miskolc: "Miskolc",
      sopron: "Sopron",
      eger: "Eger",
      nyiregyhaza: "Nyíregyháza",
      szolnok: "Szolnok",
      kecskemet: "Kecskemét",
      szekesfehervar: "Székesfehérvár",
      veszprem: "Veszprém",
      godollo: "Gödöllő",
      vac: "Vác",
      erd: "Érd",
    };
    const talaltKulcs = Object.keys(varosSzotar).find((kulcs) =>
      tisztaSzoveg.includes(kulcs)
    );
    if (talaltKulcs) feltetelek.telepules = varosSzotar[talaltKulcs];

    // 5. EGYEBEK (SZOBA, MÉRET JAVÍTVA!)
    const szobaMatch = tisztaSzoveg.match(/(\d+)\s*(szoba|szobás)/);
    if (szobaMatch) feltetelek.szobaMin = parseInt(szobaMatch[1]);

    // MÉRET (m2) LOGIKA
    const meretMatch = tisztaSzoveg.match(/(\d+)\s*(nm|m2|négyzetméter)/);
    if (meretMatch) {
      let meret = parseInt(meretMatch[1]);
      // Ha a szövegben van "alatt", "kisebb", "max" ÉS a szám közelében van (egyszerűsítve: a szöveg tartalmazza)
      if (
        tisztaSzoveg.includes("alatt") ||
        tisztaSzoveg.includes("kisebb") ||
        tisztaSzoveg.includes("max")
      ) {
        feltetelek.meretMax = meret; // Felső korlát
        feltetelek.meretMin = null;
      } else {
        feltetelek.meretMin = meret; // Alsó korlát (alapértelmezett)
        feltetelek.meretMax = null;
      }
    }

    return feltetelek;
  }

  async keresesVegrehajtasa(bemenet, extraFilterek = {}) {
    const filter = this.elemzes(bemenet, extraFilterek);

    if (
      !filter.telepules &&
      !filter.arMax &&
      !filter.arMin &&
      filter.metroIds.length === 0 &&
      !filter.lakopark &&
      !filter.kerulet &&
      !filter.lakoparkNev
    ) {
      return {
        hiba: true,
        uzenet: "Adj meg települést, árat, vagy válassz a gyorsgombok közül!",
      };
    }

    try {
      let q = collection(adatbazis, "lakasok");
      const feltetelekTomb = [];

      if (filter.metroIds && filter.metroIds.length > 0) {
        feltetelekTomb.push(
          where("metro_kozelseg", "array-contains-any", filter.metroIds)
        );
      } else if (filter.lakopark || filter.lakoparkNev) {
        feltetelekTomb.push(where("lakopark_e", "==", "Igen"));
      } else if (filter.kerulet) {
        feltetelekTomb.push(where("kerulet", "==", filter.kerulet));
        feltetelekTomb.push(where("telepules", "==", "Budapest"));
      } else {
        if (filter.telepules)
          feltetelekTomb.push(where("telepules", "==", filter.telepules));
        if (filter.arMax) {
          feltetelekTomb.push(where("vételár", "<=", filter.arMax));
          feltetelekTomb.push(orderBy("vételár", "desc"));
        } else if (filter.arMin) {
          feltetelekTomb.push(where("vételár", ">=", filter.arMin));
          feltetelekTomb.push(orderBy("vételár", "asc"));
        } else {
          feltetelekTomb.push(orderBy("letrehozva", "desc"));
        }
      }

      feltetelekTomb.push(limit(50));
      q = query(q, ...feltetelekTomb);
      const snapshot = await getDocs(q);

      if (snapshot.empty)
        return {
          hiba: false,
          talalatok: [],
          uzenet: "Nincs találat.",
          filterObj: filter,
        };

      const nyersTalalatok = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          _ar: data.vételár || data.ar || 0,
          _szobak: data.szobák || data.szobak || 0,
          _alapterulet: data.alapterület || data.alapterulet || 0,
          _kategoria: this.ekezetMentesit(data.kategoria || "elado"),
          _tipus: data.tipus || "Lakás",
          _kerulet: data.kerulet || "",
          _lakoparkNev: data.lakopark_nev || "",
          _allapot: data.allapot || "-",
          _futes: data.fűtés || data.futes || "-",
          _parkolas: data.parkolas || "-",
          _furdo: data.fürdő_wc || data.furdo || "-",
          _erkely: parseInt(data.erkély_terasz || 0),
          _lift: data.lift || "Nincs",
          _videoUrl: data.videoUrl || null,
        };
      });

      // FINOMÍTÁS (Szűrés)
      const veglegesTalalatok = nyersTalalatok.filter((ingatlan) => {
        if (filter.lakoparkNev) {
          const kn = this.ekezetMentesit(filter.lakoparkNev);
          const dn = this.ekezetMentesit(ingatlan._lakoparkNev);
          if (!dn.includes(kn)) return false;
        }
        if (
          filter.kategoria &&
          filter.metroIds.length === 0 &&
          !filter.lakopark &&
          !filter.lakoparkNev
        ) {
          if (ingatlan._kategoria !== filter.kategoria) return false;
        }
        if (filter.tipus && ingatlan._tipus !== filter.tipus) return false;

        if (filter.szobaMin && ingatlan._szobak < filter.szobaMin) return false;

        // MÉRET SZŰRÉS JAVÍTVA
        if (filter.meretMin && ingatlan._alapterulet < filter.meretMin)
          return false;
        if (filter.meretMax && ingatlan._alapterulet > filter.meretMax)
          return false; // Felső korlát!

        return true;
      });

      return { hiba: false, talalatok: veglegesTalalatok, filterObj: filter };
    } catch (error) {
      console.error("Hiba:", error);
      return { hiba: true, uzenet: "Technikai hiba." };
    }
  }
}
export const engine = new KeresoMotor();
