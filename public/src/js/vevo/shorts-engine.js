// --- BEÁLLÍTÁSOK ---
// IDE ÍRD BE A TE R2.DEV LINKEDET (Ne felejtsd a /shorts/ részt a végéről, ha kell, de itt most kódból fűzzük hozzá)
const R2_BASE_URL = "https://pub-cbf740778c2a46d3bcfb429ff54ec05d.r2.dev";
// A teszt videók listája (A képernyőfotód alapján)
const videoIds = [
  "HB-184032",
  "HB-372205",
  "HB-407050",
  "HB-589023",
  "HB-696655",
  "HB-719185", // Ellenőrizd, a képen mintha elírás lenne a fájlnévben (i betű 1-es helyett?), de másold pontosan!
];

const container = document.getElementById("shorts-container");

// --- INDÍTÁS ---
renderVideos();

function renderVideos() {
  videoIds.forEach((id) => {
    // Videó URL összerakása
    const videoUrl = `${R2_BASE_URL}/shorts/${id}.mp4`;

    const card = document.createElement("div");
    card.className = "video-card flex justify-center items-center";

    card.innerHTML = `
            <video 
                src="${videoUrl}" 
                class="h-full w-full object-cover md:max-w-md" 
                playsinline 
                loop 
                onclick="togglePlay(this)">
            </video>

            <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 to-transparent p-6 pt-20 pointer-events-none md:max-w-md md:left-1/2 md:-translate-x-1/2">
                <div class="flex items-end justify-between">
                    <div>
                        <div class="bg-[#E2F1B0] text-[#3D4A16] px-2 py-1 rounded inline-block text-xs font-bold mb-2">
                            #${id}
                        </div>
                        <h3 class="text-xl font-bold mb-1">Eladó Álomotthon 🏡</h3>
                        <p class="text-white/80 text-sm">Nézd meg ezt a csodás ingatlant!</p>
                    </div>
                    
                    <div class="flex flex-col gap-4 pointer-events-auto">
                        <button class="p-3 bg-white/10 rounded-full backdrop-blur-md hover:bg-[#E2F1B0] hover:text-black transition">
                            ❤️
                        </button>
                        <button onclick="window.location.href='adatlap.html?id=${id}'" class="p-3 bg-white/10 rounded-full backdrop-blur-md hover:bg-[#E2F1B0] hover:text-black transition">
                            👁️
                        </button>
                    </div>
                </div>
            </div>

            <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 transition-opacity duration-300 play-icon">
                <div class="bg-black/40 p-4 rounded-full backdrop-blur-sm">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                </div>
            </div>
        `;

    container.appendChild(card);
  });

  // Intersection Observer: Csak az a videó induljon el, ami épp látszik!
  setupScrollObserver();
}

function togglePlay(video) {
  if (video.paused) {
    video.play();
  } else {
    video.pause();
  }
}

function setupScrollObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target.querySelector("video");
        if (entry.isIntersecting) {
          video.play(); // Ha beúszik, indul
        } else {
          video.pause(); // Ha kiúszik, megáll
          video.currentTime = 0; // Visszatekerjük az elejére
        }
      });
    },
    { threshold: 0.6 }
  ); // Akkor vált, ha 60%-ban látszik

  document.querySelectorAll(".video-card").forEach((card) => {
    observer.observe(card);
  });
}
