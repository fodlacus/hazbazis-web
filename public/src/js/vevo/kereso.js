import {
  lakasok_gyujtemeny,
  getDocs,
  query,
  limit,
} from "../util/firebase-config.js";

async function lakasok_betoltese() {
  const folyam_kontener = document.getElementById("shorts-folyam");

  try {
    const q = query(lakasok_gyujtemeny, limit(10));
    const adatok = await getDocs(q);

    adatok.forEach((dok) => {
      const lakas = dok.data();
      const elem = document.createElement("section");
      elem.className = "short-elem flex items-center justify-center bg-black";

      elem.innerHTML = `
                <video loop muted autoplay class="h-full w-full object-cover opacity-70">
                    <source src="${lakas.video_url}" type="video/mp4">
                </video>
                <div class="absolute right-4 bottom-24 flex flex-col gap-6">
                    <button class="w-12 h-12 bg-white/20 rounded-full border border-white/40">🏠</button>
                    <button onclick="megnyitas_360('${lakas.panorama_url}')" class="w-12 h-12 bg-lime-600 rounded-full shadow-lg font-bold">360°</button>
                </div>
                <div class="absolute bottom-12 left-6">
                    <h3 class="bg-lime-500 text-black px-3 py-1 rounded-sm font-bold inline-block mb-1">${lakas.nev}</h3>
                    <p class="text-xl font-medium drop-shadow-md">${lakas.ar} Ft</p>
                    <p class="text-sm opacity-80 italic">${lakas.helyszin}</p>
                </div>
            `;
      folyam_kontener.appendChild(elem);
    });
  } catch (hiba) {
    console.error("Hiba az adatok lekeresekor:", hiba);
  }
}

window.megnyitas_360 = function (url) {
  // Itt hívjuk majd meg a Pannellum-ot
  console.log("360-as nézet indítása:", url);
};

lakasok_betoltese();
