import { ingatlanStruktura } from "../util/ingatlan-szotar.js";

/**
 * Generálja az űrlapot és kezeli a mezők validációját.
 */
export function urlapGeneralas(kontenerId) {
  const kontener = document.getElementById(kontenerId);
  if (!kontener) return;

  kontener.innerHTML = "";

  Object.keys(ingatlanStruktura).forEach((kulcs, index) => {
    const szekcio = ingatlanStruktura[kulcs];

    const accordionElem = document.createElement("div");
    accordionElem.className = "border-b border-white/10 mb-2";

    accordionElem.innerHTML = `
            <button type="button" class="w-full flex justify-between items-center py-4 px-6 bg-black/20 hover:bg-black/40 transition-all rounded-t-xl" 
                    onclick="this.nextElementSibling.classList.toggle('hidden')">
                <span class="font-bold text-[#E2F1B0]">${szekcio.cim}</span>
                <span class="opacity-50 text-xs">Kattints a nyitáshoz ▼</span>
            </button>
            <div class="${
              index === 0 ? "" : "hidden"
            } p-6 bg-white/5 space-y-4 rounded-b-xl border-x border-b border-white/10">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="mezok-${kulcs}">
                </div>
            </div>
        `;

    kontener.appendChild(accordionElem);
    const mezoKontener = document.getElementById(`mezok-${kulcs}`);

    szekcio.mezok.forEach((mezo) => {
      const mezoDiv = document.createElement("div");
      const kozosOsztalyok =
        "bevitel p-3 rounded-xl outline-none focus:border-lime-400 w-full transition-all bg-black/20 text-white border border-white/5";

      // Figyeljük a címmezőket az automatikus ellenőrzéshez
      const cimMezok = ["iranyitoszam", "telepules", "utca", "hazszam"];
      const esemenyFigyelo = cimMezok.includes(mezo.id)
        ? `onchange="window.automataCimEllenorzes()"`
        : "";

      let finalHtml = "";

      // 1. SELECT TÍPUS
      if (mezo.type === "select") {
        mezoDiv.className = "flex flex-col gap-1";
        finalHtml = `
            <label for="${
              mezo.id
            }" class="text-[10px] uppercase opacity-50 tracking-wider ml-1 text-white">${
          mezo.label
        }</label>
            <div class="relative">
                <select id="${
                  mezo.id
                }" class="${kozosOsztalyok} appearance-none cursor-pointer">
                    <option value="" disabled selected>Válassz...</option>
                    ${
                      mezo.options
                        ? mezo.options
                            .map(
                              (opt) =>
                                `<option value="${opt}" class="bg-[#1a1a1a] text-white">${opt}</option>`
                            )
                            .join("")
                        : ""
                    }
                </select>
                <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-[10px]">▼</div>
            </div>`;
      }

      // 2. TEXTAREA TÍPUS (AI Gombbal)
      else if (mezo.type === "textarea") {
        mezoDiv.className = "flex flex-col gap-1 col-span-1 md:col-span-2";
        const vanAiGomb = mezo.id === "leírás";

        finalHtml = `
            <div class="flex justify-between items-end mb-1">
                <label for="${
                  mezo.id
                }" class="text-[10px] uppercase opacity-50 tracking-wider ml-1 text-white">${
          mezo.label
        }</label>
                ${
                  vanAiGomb
                    ? `
                    <button type="button" onclick="window.generaljLeirast()" 
                            class="text-[10px] bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border border-purple-500/50 px-2 py-1 rounded transition-all flex items-center gap-1 shadow-sm">
                        ✨ AI SZÖVEG GENERÁLÁSA
                    </button>`
                    : ""
                }
            </div>
            <textarea id="${
              mezo.id
            }" rows="6" placeholder="Írj pár szót az ingatlanról..." class="${kozosOsztalyok}"></textarea>`;
      }

      // 3. ALAP INPUTOK (Cím-ellenőrzéssel kiegészítve)
      else {
        mezoDiv.className = "flex flex-col gap-1";
        const lepes = mezo.step ? `step="${mezo.step}"` : "";

        finalHtml = `
            <label for="${mezo.id}" class="text-[10px] uppercase opacity-50 tracking-wider ml-1 text-white">${mezo.label}</label>
            <div class="relative">
                <input type="${mezo.type}" id="${mezo.id}" ${lepes} ${esemenyFigyelo} placeholder="${mezo.label}" class="${kozosOsztalyok}">
            </div>`;
      }

      mezoDiv.innerHTML = finalHtml;
      mezoKontener.appendChild(mezoDiv);
    });
  });
}
