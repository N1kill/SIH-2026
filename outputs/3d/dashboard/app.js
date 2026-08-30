/* ==========================================================================
   Machhu-II 3D Simulation & HADR Dashboard Logic
   Interactive Leaflet Map, Time-Series Playback & Dynamic Hydrograph
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // ------------------------------------------------------------------------
  // 1. SCENARIO CONFIGURATIONS
  // ------------------------------------------------------------------------
  const scenarios = {
    base: {
      name: "Base Case (Froehlich 2008)",
      q_peak: 6647,
      b_avg: 156,
      t_f: 2.5,
      morbi_peak: 3.02,
      inund_area: 27.75,
      pop_exposed: 70252,
      buildings: 14635,
      loss_cr: 1070.11,
      peak_time_morbi: 4.5,
    },
    plus25: {
      name: "+25% Breach Width",
      q_peak: 8309,
      b_avg: 195,
      t_f: 2.0,
      morbi_peak: 3.65,
      inund_area: 32.40,
      pop_exposed: 84100,
      buildings: 17520,
      loss_cr: 1340.50,
      peak_time_morbi: 4.0,
    },
    minus25: {
      name: "-25% Conservative",
      q_peak: 4985,
      b_avg: 117,
      t_f: 3.12,
      morbi_peak: 2.38,
      inund_area: 21.80,
      pop_exposed: 52300,
      buildings: 10890,
      loss_cr: 780.20,
      peak_time_morbi: 5.5,
    },
    extreme50: {
      name: "+50% Extreme Overtopping",
      q_peak: 10500,
      b_avg: 234,
      t_f: 1.5,
      morbi_peak: 4.42,
      inund_area: 38.90,
      pop_exposed: 98500,
      buildings: 20500,
      loss_cr: 1690.80,
      peak_time_morbi: 3.5,
    }
  };

  let currentScenario = "base";
  let currentTime = 2.5;
  let isPlaying = false;
  let playInterval = null;

  // ------------------------------------------------------------------------
  // 2. INITIALIZE LEAFLET MAP
  // ------------------------------------------------------------------------
  const map = L.map("map", {
    center: [22.84, 70.83],
    zoom: 12,
    zoomControl: false
  });

  L.control.zoom({ position: "bottomright" }).addTo(map);

  // Basemap Tile Layers (No API Key Required, Clean High-Resolution)
  const esriDark = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ | SIH-2026',
    maxZoom: 16
  });

  const esriLabels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 16
  });

  const esriSatellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics | SIH-2026',
    maxZoom: 19
  });

  const osmStandard = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors | SIH-2026',
    maxZoom: 19
  });

  // Add default dark basemap + labels
  esriDark.addTo(map);
  esriLabels.addTo(map);

  const baseMaps = {
    "<span style='color:#00b4d8; font-weight:600;'>Dark Canvas</span>": L.layerGroup([esriDark, esriLabels]),
    "<span style='color:#06d6a0; font-weight:600;'>Satellite Imagery</span>": esriSatellite,
    "<span style='color:#f4a261; font-weight:600;'>OpenStreetMap</span>": osmStandard
  };

  L.control.layers(baseMaps, null, { position: "topright" }).addTo(map);

  // GeoJSON / Feature Layer Groups
  const depthLayerGroup = L.layerGroup().addTo(map);
  const riskLayerGroup = L.layerGroup().addTo(map);
  const satelliteLayerGroup = L.layerGroup();
  const evacuationLayerGroup = L.layerGroup().addTo(map);

  // Station Coordinates: [Lat, Lon]
  const damLoc = [22.82, 70.84];
  const morbiLoc = [22.818, 70.838];
  const lilaparLoc = [22.875, 70.815];
  const maliaLoc = [22.980, 70.750];

  // ------------------------------------------------------------------------
  // 3. MAP MARKERS & MONITORING GAUGES
  // ------------------------------------------------------------------------
  const damIcon = L.divIcon({
    className: 'custom-map-pin dam-pin',
    html: '<i class="fa-solid fa-dam" style="color:#d90429; font-size:18px; text-shadow:0 0 8px #d90429;"></i>',
    iconSize: [24, 24]
  });

  const cityIcon = L.divIcon({
    className: 'custom-map-pin city-pin',
    html: '<i class="fa-solid fa-city" style="color:#00b4d8; font-size:16px; text-shadow:0 0 8px #00b4d8;"></i>',
    iconSize: [22, 22]
  });

  const shelterIcon = L.divIcon({
    className: 'custom-map-pin shelter-pin',
    html: '<i class="fa-solid fa-shield-heart" style="color:#06d6a0; font-size:18px; text-shadow:0 0 8px #06d6a0;"></i>',
    iconSize: [24, 24]
  });

  L.marker(damLoc, { icon: damIcon }).addTo(map)
    .bindPopup(`<b>Machhu-II Dam (Failure Origin)</b><br>Coordinates: 22.82°N, 70.84°E<br>Height: 22.56m | Gross Storage: 101 Mm³<br>Failure Mode: Overtopping (11 Aug 1979)`);

  L.marker(morbiLoc, { icon: cityIcon }).addTo(map)
    .bindPopup(`<b>Morbi City Center (5.2 km Downstream)</b><br>Historical Flood Stage: ~3.0 m (10 ft)<br>Critical Wave Arrival: 2.5 hours post-breach`);

  L.marker([22.835, 70.885], { icon: shelterIcon }).addTo(map)
    .bindPopup(`<b>Morbi East Safe High Ground Shelter</b><br>Ridge Elevation: 56.4 m (Above Inundation)<br>Capacity: 25,000 Persons`);

  L.marker([22.795, 70.875], { icon: shelterIcon }).addTo(map)
    .bindPopup(`<b>South-East Relief Center</b><br>Safe Elevation: 54.2 m<br>Capacity: 18,000 Persons`);

  // ------------------------------------------------------------------------
  // 4. DRAW INUNDATION CORRIDOR & EVACUATION ROUTES
  // ------------------------------------------------------------------------
  function renderMapLayers() {
    depthLayerGroup.clearLayers();
    riskLayerGroup.clearLayers();
    evacuationLayerGroup.clearLayers();

    // Inundation Footprint Polygon (Simulated Corridor)
    const floodPolygonCoords = [
      [22.822, 70.838],
      [22.828, 70.835],
      [22.845, 70.825],
      [22.870, 70.810],
      [22.910, 70.785],
      [22.970, 70.745],
      [22.985, 70.760],
      [22.920, 70.805],
      [22.860, 70.835],
      [22.835, 70.848],
      [22.820, 70.842]
    ];

    const floodPoly = L.polygon(floodPolygonCoords, {
      color: '#e63946',
      weight: 2,
      fillColor: '#d62828',
      fillOpacity: 0.45
    }).addTo(depthLayerGroup);

    floodPoly.bindPopup(`<b>Machhu-II 2D Inundation Corridor</b><br>Max Simulated Depth: 3.02m (Morbi)<br>Total Inundation: 27.75 km²`);

    // Evacuation Route Lines
    const routeEast = [
      morbiLoc,
      [22.825, 70.860],
      [22.835, 70.885]
    ];
    L.polyline(routeEast, { color: '#06d6a0', weight: 4, dashArray: '6, 8' }).addTo(evacuationLayerGroup)
      .bindPopup("<b>Primary Safe Evacuation Corridor (East Bypass Ridge)</b>");
  }

  renderMapLayers();

  // ------------------------------------------------------------------------
  // 5. CHART.JS HYDROGRAPH
  // ------------------------------------------------------------------------
  const ctx = document.getElementById("hydrographChart").getContext("2d");
  const hydroChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["0h", "2h", "4h", "6h", "8h", "10h", "12h", "16h", "20h", "24h"],
      datasets: [
        {
          label: "Breach Outflow (m³/s)",
          data: [450, 5800, 4800, 3100, 1900, 1200, 800, 520, 470, 450],
          borderColor: "#e63946",
          backgroundColor: "rgba(230, 57, 70, 0.15)",
          fill: true,
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          label: "Morbi Depth (m)",
          data: [0.0, 0.2, 2.8, 3.02, 2.7, 2.1, 1.5, 0.8, 0.3, 0.1],
          borderColor: "#00b4d8",
          backgroundColor: "rgba(0, 180, 216, 0.1)",
          fill: false,
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#8d99ae", font: { size: 9 } } },
        y: { type: 'linear', position: 'left', grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#e63946", font: { size: 9 } } },
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { color: "#00b4d8", font: { size: 9 } } }
      },
      plugins: {
        legend: { labels: { color: "#f1faee", font: { size: 9, family: "Inter" } } }
      }
    }
  });

  // ------------------------------------------------------------------------
  // 6. DYNAMIC UI & SCENARIO SWITCHING
  // ------------------------------------------------------------------------
  function updateDashboard(scKey, timeVal) {
    const sc = scenarios[scKey];
    
    // Calculate dynamic stage at current time
    let morbiDepth = 0.0;
    if (timeVal >= 2.0 && timeVal <= 18.0) {
      const peakFactor = Math.exp(-Math.pow((timeVal - sc.peak_time_morbi) / 3.0, 2));
      morbiDepth = sc.morbi_peak * peakFactor;
    }

    let damDepth = 2.28 * Math.exp(-timeVal / 8.0) + (timeVal < 3.0 ? (timeVal * 1.5) : 0);

    // Update Telemetry Gauges
    document.getElementById("val-dam-depth").innerText = `${damDepth.toFixed(2)} m`;
    document.getElementById("val-morbi-depth").innerText = `${morbiDepth.toFixed(2)} m`;
    document.getElementById("bar-dam").style.width = `${Math.min(damDepth * 20, 100)}%`;
    document.getElementById("bar-morbi").style.width = `${Math.min(morbiDepth * 25, 100)}%`;

    // Update KPI Cards
    document.getElementById("kpi-pop").innerText = Number(sc.pop_exposed).toLocaleString();
    document.getElementById("kpi-area").innerText = `${sc.inund_area.toFixed(2)} km²`;
    document.getElementById("kpi-buildings").innerText = Number(sc.buildings).toLocaleString();
    document.getElementById("kpi-loss").innerText = `₹${sc.loss_cr.toFixed(1)} Cr`;

    // Update Time Label
    const hrs = Math.floor(timeVal);
    const mins = Math.round((timeVal - hrs) * 60);
    document.getElementById("time-val").innerText = `T + ${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')} hrs`;
  }

  // Scenario Button Events
  document.querySelectorAll(".scenario-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".scenario-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentScenario = btn.dataset.scenario;
      updateDashboard(currentScenario, currentTime);
    });
  });

  // Time Slider Event
  const slider = document.getElementById("time-slider");
  slider.addEventListener("input", (e) => {
    currentTime = parseFloat(e.target.value);
    updateDashboard(currentScenario, currentTime);
  });

  // Play / Pause Animation
  const playBtn = document.getElementById("btn-play");
  playBtn.addEventListener("click", () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
      playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
      playInterval = setInterval(() => {
        currentTime += 0.25;
        if (currentTime > 24) currentTime = 0;
        slider.value = currentTime;
        updateDashboard(currentScenario, currentTime);
      }, 300);
    } else {
      playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      clearInterval(playInterval);
    }
  });

  // Reset Button
  document.getElementById("btn-reset").addEventListener("click", () => {
    currentTime = 0;
    slider.value = 0;
    updateDashboard(currentScenario, currentTime);
  });

  // Layer Visibility Events
  document.getElementById("layer-depth").addEventListener("change", (e) => {
    if (e.target.checked) map.addLayer(depthLayerGroup);
    else map.removeLayer(depthLayerGroup);
  });

  document.getElementById("layer-evacuation").addEventListener("change", (e) => {
    if (e.target.checked) map.addLayer(evacuationLayerGroup);
    else map.removeLayer(evacuationLayerGroup);
  });

  updateDashboard(currentScenario, currentTime);
});
