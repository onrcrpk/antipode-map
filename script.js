const API_KEY = "590413f4a652f2004b01cdfb16051ff8";
const GEOCODE_KEY = "5567ef8983834c77ac00af94334f316e";
let currentSelectionId1 = 0; // sol kutu için
let currentSelectionId2 = 0; // sağ kutu için


const globe1 = document.getElementById("globe1");
const globe2 = document.getElementById("globe2");
const coord1El = document.getElementById("coord1");
const coord2El = document.getElementById("coord2");

const dpr = window.devicePixelRatio || 1;
const canvasSize = 400;

globe1.width = canvasSize * dpr;
globe1.height = canvasSize * dpr;
globe2.width = canvasSize * dpr;
globe2.height = canvasSize * dpr;

globe1.style.width = globe2.style.width = "100%";
globe1.style.height = globe2.style.height = "auto";

const ctx1 = globe1.getContext("2d");
const ctx2 = globe2.getContext("2d");

ctx1.scale(dpr, dpr);
ctx2.scale(dpr, dpr);

let rotation = [0, 0];
let rotation2 = [180, 0];
let scale = 180;

let world, selectedCoord = null;

const projection1 = d3.geoOrthographic()
  .scale(scale)
  .translate([canvasSize / 2, canvasSize / 2]);

const projection2 = d3.geoOrthographic()
  .scale(scale)
  .translate([canvasSize / 2, canvasSize / 2]);

const path1 = d3.geoPath(projection1, ctx1);
const path2 = d3.geoPath(projection2, ctx2);

function getAntipode([lon, lat]) {
  let antiLon = (lon + 180) % 360;
  if (antiLon > 180) antiLon -= 360;
  return [antiLon, -lat];
}


function draw(ctx, path, projection, marker) {
  ctx.clearRect(0, 0, canvasSize, canvasSize);

  // Arka Plan (Sphere)
  ctx.beginPath();
  path({ type: "Sphere" });
  ctx.fillStyle = "#e3f2fd"; // Soluk mavi
  ctx.fill();
  ctx.strokeStyle = "#b0bec5"; // İnce gri çerçeve
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Dünya Yüzeyi (Yeşil tonları)
  ctx.beginPath();
  path(world);
  ctx.fillStyle = "#a5d6a7"; // Soft yeşil tonlarında
  ctx.fill();
  ctx.strokeStyle = "#4caf50"; // Hafif yeşil çerçeve
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Marker (İşaretçi - Kırmızımsı ton)
  if (marker) {
    const [x, y] = projection(marker);
    const markerSize = Math.max(5, 800 / scale); // Marker boyutunu yine biraz artırdım
    ctx.beginPath();
    ctx.arc(x, y, markerSize, 0, 2 * Math.PI);
    ctx.fillStyle = "#f44336"; // Kırmızımsı turuncu marker
    ctx.fill();
  }
}



function updateGlobes() {
  rotation[1] = Math.max(-89, Math.min(89, rotation[1]));

  projection1.rotate(rotation).scale(scale);
  projection2.rotate(rotation2).scale(scale);

  draw(ctx1, path1, projection1, selectedCoord);
  draw(ctx2, path2, projection2, selectedCoord ? getAntipode(selectedCoord) : null);
}

function setupInput(canvas) {
  let isDragging = false;
  let last = null;
  let dragStart = null;
  let lastTouchDist = null;

  canvas.addEventListener("pointerdown", e => {
    isDragging = true;
    last = [e.clientX, e.clientY];
    dragStart = [e.clientX, e.clientY];
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", e => {
    if (!isDragging || !last) return;
    const dx = e.clientX - last[0];
    const dy = e.clientY - last[1];
    last = [e.clientX, e.clientY];

    const panSpeedFactor = 90 / scale;
    rotation[0] += dx * panSpeedFactor;
    rotation[1] -= dy * panSpeedFactor;
    rotation[1] = Math.max(-89, Math.min(89, rotation[1]));

    updateGlobes();
  });

  canvas.addEventListener("pointerup", (e) => {
    isDragging = false;
    const moveDist = Math.hypot(e.clientX - dragStart[0], e.clientY - dragStart[1]);

    if (moveDist < 5) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const coord = projection1.invert([
        x / rect.width * canvasSize,
        y / rect.height * canvasSize
      ]);
      if (coord) {
        selectedCoord = coord;
        const antipode = getAntipode(coord);
        rotation2 = [-antipode[0], -antipode[1]];
        updateGlobes();

        const [lon, lat] = selectedCoord.map(n => n.toFixed(4));
        const [alon, alat] = antipode.map(n => n.toFixed(4));
        
        updateInfoBoxes(lat, lon, coord1El, 1);  // sol kutu
        updateInfoBoxes(alat, alon, coord2El, 2); // sağ kutu
        
      }
    }
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const newScale = scale * (e.deltaY < 0 ? 1.1 : 0.9);
    scale = Math.max(80, Math.min(2000, newScale));
    updateGlobes();
  });

  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      lastTouchDist = getTouchDistance(e);
    }
  });

  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && lastTouchDist) {
      e.preventDefault();
      const newDist = getTouchDistance(e);
      const zoomFactor = newDist / lastTouchDist;

      const newScale = Math.min(2000, Math.max(80, scale * zoomFactor));
      if (Math.abs(newScale - scale) > 0.5) {
        scale = newScale;
        updateGlobes();
      }

      lastTouchDist = newDist;
    }
  });

  canvas.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
      lastTouchDist = null;
    }
  });

  function getTouchDistance(e) {
    const [t1, t2] = e.touches;
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

async function fetchWeather(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=tr`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) {
      return {
        temp: Math.round(data.main.temp),
        description: data.weather[0].description
      };
    } else {
      console.warn("Hava durumu alınamadı:", data.message);
      return null;
    }
  } catch (err) {
    console.error("API hatası:", err);
    return null;
  }
}

async function fetchElevation(lat, lon) {
  const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok && data.results && data.results.length > 0) {
      return Math.round(data.results[0].elevation);
    } else {
      console.warn("Rakım alınamadı");
      return null;
    }
  } catch (err) {
    console.error("Rakım API hatası:", err);
    return null;
  }
}



const MAPBOX_TOKEN = "pk.eyJ1Ijoib25yY3JwayIsImEiOiJjbHZxYW96ZXUwOTFqMmpycm1ydmxodm03In0.-QAfHKC4v-0m330viawnew";

function updateInfoBoxes(lat, lon, el, which) {
  if (which === 1) {
    currentSelectionId1++;
  } else if (which === 2) {
    currentSelectionId2++;
  }
  const thisSelectionId = which === 1 ? currentSelectionId1 : currentSelectionId2;

  el.innerHTML = `
    <span class="coord">Lat: ${lat}, Lon: ${lon}</span>
    <span class="location">📍 Yükleniyor...</span>
    <span class="weather">🌡️ Yükleniyor...</span>
    <span class="elevation">🗻 Yükleniyor...</span>
    <div class="satellite-image">🛰️ Yükleniyor...</div> <!-- buraya uydu fotoğrafı gelecek -->
  `;

  const locationPromise = fetchLocationName(lat, lon);
  const weatherPromise = fetchWeather(lat, lon);
  const elevationPromise = fetchElevation(lat, lon);

  Promise.all([locationPromise, weatherPromise, elevationPromise])
    .then(([loc, weather, elev]) => {
      const stillCurrent = (which === 1 && thisSelectionId === currentSelectionId1) ||
                           (which === 2 && thisSelectionId === currentSelectionId2);
      if (!stillCurrent) return;

      if (loc) {
        el.querySelector(".location").textContent = `📍 ${loc}`;
      } else {
        el.querySelector(".location").textContent = "📍 Konum bulunamadı";
      }

      if (weather) {
        el.querySelector(".weather").textContent = `🌡️ ${weather.temp}°C, ${weather.description}`;
      } else {
        el.querySelector(".weather").textContent = "🌡️ Hava durumu yok";
      }

      if (elev !== null) {
        el.querySelector(".elevation").textContent = `🗻 ${elev} m`;
      } else {
        el.querySelector(".elevation").textContent = "🗻 Yükseklik yok";
      }

      // ✨ Şimdi uydu fotoğrafını ekle
      const imgUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lon},${lat},1,0,0/300x200?access_token=${MAPBOX_TOKEN}`;

      const img = document.createElement("img");
      img.src = imgUrl;
      img.alt = "Uydu Görüntüsü";
      img.style.marginTop = "0.5rem";
      img.style.width = "100%";
      img.style.borderRadius = "8px";
      img.style.objectFit = "cover";

      const satDiv = el.querySelector(".satellite-image");
      satDiv.innerHTML = ""; // "Yükleniyor..." yazısını temizle
      satDiv.appendChild(img);
    });
}





async function loadWorld() {
  const res = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
  const topo = await res.json();
  world = topojson.feature(topo, topo.objects.countries);
  updateGlobes();
}

setupInput(globe1);
loadWorld();


async function fetchLocationName(lat, lon) {
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${GEOCODE_KEY}&language=tr`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok && data.results && data.results.length > 0) {
      const comp = data.results[0].components;

      // Eğer deniz/okyanus varsa onu göster
      if (comp.body_of_water) {
        return comp.body_of_water;
      }

      // Şehir + ülke gösterimi (ilçe atlanır)
      const cityOrRegion = comp.city || comp.state_district || comp.state;
      const country = comp.country;

      if (cityOrRegion && country) return `${cityOrRegion}, ${country}`;
      if (country) return country;

      return "Konum bilinmiyor";
    } else {
      console.warn("Yer adı alınamadı.");
      return null;
    }
  } catch (err) {
    console.error("Geocode API hatası:", err);
    return null;
  }
}



