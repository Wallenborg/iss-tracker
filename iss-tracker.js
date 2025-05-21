let lastLat = 0,
  lastLon = 0,
  popupTimeout;
let firstView = true;

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrainProvider: new Cesium.EllipsoidTerrainProvider(),
  imageryProvider: false,
  baseLayerPicker: false,
  timeline: false,
  animation: false,
  infoBox: false,
  geocoder: false,
  homeButton: false,
  navigationHelpButton: false,
  sceneModePicker: false,
  fullscreenButton: false,
  selectionIndicator: false,
});

viewer.scene.imageryLayers.addImageryProvider(
  new Cesium.OpenStreetMapImageryProvider({
    url: "https://a.tile.openstreetmap.org/",
  })
);

function createCircleImage(size, color) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
  ctx.fillStyle = color.toCssColorString();
  ctx.fill();
  return canvas.toDataURL();
}

const issEntity = viewer.entities.add({
  name: "ISS",
  position: Cesium.Cartesian3.fromDegrees(0, 0, 500000),
  point: {
    pixelSize: 6,
    color: Cesium.Color.YELLOW,
    disableDepthTestDistance: 1_000_000,
  },
  billboard: {
    image: createCircleImage(12, Cesium.Color.YELLOW),
    scale: 1,
    eyeOffset: new Cesium.Cartesian3(0, 0, -150000),
    verticalOrigin: Cesium.VerticalOrigin.CENTER,
  },
});

const popup = document.getElementById("issPopup");
const popupClose = document.getElementById("popupClose");
const popupContent = document.getElementById("popupContent");

popupClose.addEventListener("click", () => {
  popup.classList.add("hidden");
  clearTimeout(popupTimeout);
});

async function fetchISS() {
  try {
    const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544"); // alternativt API som stöder CORS bättre
    const json = await res.json();
    const lat = parseFloat(json.latitude);
    const lon = parseFloat(json.longitude);
    lastLat = lat;
    lastLon = lon;

    const height = 500000;
    const carto = Cesium.Cartographic.fromDegrees(lon, lat, height);
    const issPos = Cesium.Ellipsoid.WGS84.cartographicToCartesian(carto);
    issEntity.position = issPos;

    // Debug: logga för att se att höjden används
    console.log("Live ISS höjd (meter):", height);
    console.log("Cartesian position:", issPos);
    if (firstView) {
        firstView = false;
      
        // ISS position
        const issCarto = Cesium.Cartographic.fromDegrees(lon, lat, height);
        const issCartesian = Cesium.Ellipsoid.WGS84.cartographicToCartesian(issCarto);
      
        // Kamera på motsatt sida av jorden (genom att invertera ISS-position)
        const cameraDirection = Cesium.Cartesian3.negate(issCartesian, new Cesium.Cartesian3());
        Cesium.Cartesian3.normalize(cameraDirection, cameraDirection);
      
        // Placera kameran långt ut från jordens centrum, i motsatt riktning mot ISS
        const cameraDistance = 20000000; // cirka 4x jordradien
        const cameraPos = Cesium.Cartesian3.multiplyByScalar(
          cameraDirection,
          cameraDistance,
          new Cesium.Cartesian3()
        );
      
        // Riktning mot jordens centrum (och bort från ISS)
        const direction = Cesium.Cartesian3.normalize(
          Cesium.Cartesian3.negate(cameraPos, new Cesium.Cartesian3()),
          new Cesium.Cartesian3()
        );
      
        // En "upp"-vektor som är vinkelrät mot riktningen
        const up = Cesium.Cartesian3.UNIT_Z; // duger i detta fall
      
        viewer.camera.setView({
          destination: cameraPos,
          orientation: {
            direction: direction,
            up: up,
          },
        });
      }
      
  } catch (e) {
    console.error("Kunde inte hämta ISS-data:", e);
  }
}

const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction((evt) => {
  const picked = viewer.scene.pick(evt.position);
  if (Cesium.defined(picked) && picked.id === issEntity) {
    popupContent.innerHTML =
      `<strong>ISS Information</strong><br><br>` +
      `<div class="coords">Lat: ${lastLat.toFixed(2)}°, Lon: ${lastLon.toFixed(
        2
      )}°</div>` +
      `<div class="description">` +
      `The International Space Station (ISS) is a habitable research laboratory and observatory orbiting Earth at approximately 400 km altitude. Jointly operated by NASA, Roscosmos, ESA, JAXA, and CSA, it travels at about 28 000 km/h, completing an orbit every 90 minutes.` +
      `<br><br>` +
      `Since its first module launch in 1998, the ISS has hosted hundreds of astronauts conducting experiments in biology, physics, and Earth observation under microgravity conditions. It serves as a platform for testing technologies for future deep-space missions.` +
      `</div>`;
    popup.classList.remove("hidden");
    clearTimeout(popupTimeout);
    popupTimeout = setTimeout(() => popup.classList.add("hidden"), 3000);
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

handler.setInputAction((move) => {
  const picked = viewer.scene.pick(move.endPosition);
  viewer.canvas.style.cursor =
    Cesium.defined(picked) && picked.id === issEntity ? "pointer" : "";
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

// 👇 Kör fetch först när globen är redo
viewer.scene.globe.readyPromise.then(() => {
  fetchISS();
  setInterval(fetchISS, 5000);
});
