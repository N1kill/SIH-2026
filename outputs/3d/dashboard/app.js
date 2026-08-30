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
  // 3. HIGH-CLARITY MAP LABELS & MARKERS
  // ------------------------------------------------------------------------
  function createStationLabel(text, subtext, color, iconClass) {
    return L.divIcon({
      className: 'custom-station-badge',
      html: `
        <div class="station-pill" style="border-color: ${color}; box-shadow: 0 0 10px ${color}66;">
          <i class="${iconClass}" style="color: ${color};"></i>
          <div class="pill-text">
            <div class="pill-title">${text}</div>
            <div class="pill-sub" style="color: ${color};">${subtext}</div>
          </div>
        </div>
      `,
      iconSize: [180, 36],
      iconAnchor: [90, 18]
    });
  }

  // Station Locations with High-Clarity Pins
  const markerDam = L.marker(damLoc, { 
    icon: createStationLabel("Machhu-II Dam", "BREACH ORIGIN (0 km)", "#e63946", "fa-solid fa-burst")
  }).addTo(map);

  const markerMorbi = L.marker(morbiLoc, { 
    icon: createStationLabel("Morbi City Center", "INUNDATED (5.2 km)", "#f4a261", "fa-solid fa-city")
  }).addTo(map);

  const markerLilapar = L.marker(lilaparLoc, { 
    icon: createStationLabel("Lilapar Bridge", "RIVER CROSSING (12 km)", "#00b4d8", "fa-solid fa-bridge-water")
  }).addTo(map);

  const markerMalia = L.marker(maliaLoc, { 
    icon: createStationLabel("Malia Miyana", "COASTAL DELTA (32 km)", "#2a9d8f", "fa-solid fa-water")
  }).addTo(map);

  const markerShelter1 = L.marker([22.835, 70.885], { 
    icon: createStationLabel("East Ridge Shelter", "SAFE ZONE (>56m MSL)", "#06d6a0", "fa-solid fa-shield-heart")
  }).addTo(map);

  const markerShelter2 = L.marker([22.795, 70.875], { 
    icon: createStationLabel("SE Relief Complex", "SAFE ZONE (>54m MSL)", "#06d6a0", "fa-solid fa-campground")
  }).addTo(map);

  // Flow Streamlines & Wave Front Group
  const flowStreamlineGroup = L.layerGroup().addTo(map);
  const waveFrontMarkerGroup = L.layerGroup().addTo(map);

  // ------------------------------------------------------------------------
  // 4. DYNAMIC FLOOD WAVE PROPAGATION & MULTI-TIER CONTOURS
  // ------------------------------------------------------------------------
  // Accurate Downstream Thalweg Coordinates from Dam (South) to Little Rann Delta (North)
  const channelWaypoints = [
    [22.820, 70.842], // 0.0 km - Machhu-II Dam Toe
    [22.823, 70.840], // 1.2 km
    [22.828, 70.836], // 2.5 km
    [22.833, 70.833], // 3.8 km
    [22.838, 70.830], // 5.2 km - Central Morbi
    [22.846, 70.825], // 7.5 km - North Morbi Industrial Zone
    [22.858, 70.818], // 9.8 km
    [22.870, 70.810], // 12.0 km - Lilapar Bridge
    [22.890, 70.798], // 16.5 km
    [22.915, 70.782], // 21.0 km
    [22.945, 70.762], // 26.5 km
    [22.975, 70.745], // 32.0 km - Malia Coastal Delta
  ];

  function renderMapLayers(t) {
    depthLayerGroup.clearLayers();
    riskLayerGroup.clearLayers();
    flowStreamlineGroup.clearLayers();
    waveFrontMarkerGroup.clearLayers();

    if (t <= 0.2) {
      const initDamPool = L.circle([22.820, 70.842], {
        radius: 450,
        color: '#00b4d8',
        fillColor: '#0077b6',
        fillOpacity: 0.7
      }).addTo(depthLayerGroup);
      initDamPool.bindPopup("<b>Machhu-II Dam Reservoir</b><br>Initial Pre-Breach Storage: 101 Mm³");
      return;
    }

    // 1. Calculate Flood Wave Front Position
    // Wave moves at ~2.2 km/h; reaches Morbi (5.2 km) at t = 2.4h, Malia (32 km) at t = 14h
    const reachKm = Math.min(32.0, t * 2.3);
    const progressFrac = Math.min(1.0, Math.max(0.08, reachKm / 32.0));
    const activeWaypointsCount = Math.max(2, Math.floor(progressFrac * channelWaypoints.length));
    const activeChannel = channelWaypoints.slice(0, activeWaypointsCount);
    const currentFrontPos = activeChannel[activeChannel.length - 1];

    // Hydrograph Stage Intensity
    const hydroFactor = Math.exp(-Math.pow((t - 3.5) / 4.0, 2));
    const channelDepth = (3.02 * hydroFactor).toFixed(2);

    // Dynamic Floodplain Contours:
    // Outer Zone (Shallow 0.1 - 1.5m): Wide lateral spread
    const outerWidth = 0.005 + 0.016 * hydroFactor;
    const outerLeft = [];
    const outerRight = [];
    activeChannel.forEach((pt, idx) => {
      const taper = Math.sin((idx / (activeChannel.length - 1)) * Math.PI) * 0.4 + 0.6;
      const w = outerWidth * taper;
      outerLeft.push([pt[0] + w * 0.8, pt[1] - w * 1.1]);
      outerRight.unshift([pt[0] - w * 0.8, pt[1] + w * 1.1]);
    });
    const outerPoly = L.polygon(outerLeft.concat(outerRight), {
      color: '#f4a261',
      weight: 1.5,
      fillColor: '#e76f51',
      fillOpacity: 0.35
    }).addTo(depthLayerGroup);
    outerPoly.bindPopup(`<b>Flood Margin Zone (0.5 – 1.5 m)</b><br>Time: T + ${t.toFixed(1)}h | Area: Shallow Inundation`);

    // Core Channel Zone (Deep 1.5 - 3.0m): High velocity central corridor
    const coreWidth = 0.0025 + 0.007 * hydroFactor;
    const coreLeft = [];
    const coreRight = [];
    activeChannel.forEach((pt, idx) => {
      const taper = Math.sin((idx / (activeChannel.length - 1)) * Math.PI) * 0.4 + 0.6;
      const w = coreWidth * taper;
      coreLeft.push([pt[0] + w * 0.7, pt[1] - w * 0.9]);
      coreRight.unshift([pt[0] - w * 0.7, pt[1] + w * 0.9]);
    });
    const corePoly = L.polygon(coreLeft.concat(coreRight), {
      color: '#e63946',
      weight: 2,
      fillColor: '#d62828',
      fillOpacity: 0.65,
      className: 'pulsing-flood-wave'
    }).addTo(depthLayerGroup);
    corePoly.bindPopup(`<b>High-Hazard Deep Channel (1.5 – 3.02 m)</b><br>Peak Depth: ${channelDepth} m | Velocity: ~2.8 m/s`);

    // 2. Animated Flow Velocity Streamlines with Glowing Dash Arrows
    if (activeChannel.length >= 2) {
      // Main Centerline Flow
      L.polyline(activeChannel, {
        color: '#00ffff',
        weight: 4.5,
        opacity: 0.9,
        dashArray: '12, 14',
        className: 'animated-streamline'
      }).addTo(flowStreamlineGroup);

      // Flank Currents
      const leftCurrent = activeChannel.map(pt => [pt[0] + 0.0025, pt[1] - 0.0035]);
      const rightCurrent = activeChannel.map(pt => [pt[0] - 0.0025, pt[1] + 0.0035]);

      L.polyline(leftCurrent, {
        color: '#70e000',
        weight: 2.5,
        opacity: 0.75,
        dashArray: '8, 12',
        className: 'animated-streamline-fast'
      }).addTo(flowStreamlineGroup);

      L.polyline(rightCurrent, {
        color: '#70e000',
        weight: 2.5,
        opacity: 0.75,
        dashArray: '8, 12',
        className: 'animated-streamline-fast'
      }).addTo(flowStreamlineGroup);
    }

    // 3. Moving Wave Front Indicator Callout
    const waveFrontIcon = L.divIcon({
      className: 'custom-wavefront-badge',
      html: `
        <div class="wavefront-pill">
          <span class="wavefront-pulse"></span>
          <i class="fa-solid fa-water"></i>
          <span>WAVE FRONT: ${reachKm.toFixed(1)} km (${t.toFixed(1)}h)</span>
        </div>
      `,
      iconSize: [200, 30],
      iconAnchor: [100, 15]
    });

    L.marker(currentFrontPos, { icon: waveFrontIcon }).addTo(waveFrontMarkerGroup);
  }

  // 4. Interactive Click-to-Inspect Tool on Map
  map.on("click", (e) => {
    const lat = e.latlng.lat.toFixed(4);
    const lon = e.latlng.lng.toFixed(4);
    
    // Approximate distance from river channel thalweg
    let minDist = 999;
    channelWaypoints.forEach(pt => {
      const d = Math.hypot(e.latlng.lat - pt[0], e.latlng.lng - pt[1]);
      if (d < minDist) minDist = d;
    });

    const isFlooded = minDist < 0.018 && currentTime >= 1.0;
    const estDepth = isFlooded ? Math.max(0.2, (3.0 - (minDist / 0.018) * 2.8)).toFixed(2) : "0.00";
    const estVelocity = isFlooded ? (estDepth * 0.9 + 0.4).toFixed(2) : "0.00";
    const hazardLevel = isFlooded ? (estDepth > 2.0 ? "<span style='color:#e63946;'>CRITICAL (>2m)</span>" : (estDepth > 0.8 ? "<span style='color:#f4a261;'>MODERATE</span>" : "<span style='color:#00b4d8;'>LOW</span>")) : "<span style='color:#06d6a0;'>DRY GROUND</span>";

    L.popup()
      .setLatLng(e.latlng)
      .setContent(`
        <div style="font-family:'Inter',sans-serif; min-width:180px;">
          <div style="font-weight:700; color:#00b4d8; font-size:12px; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
            <i class="fa-solid fa-crosshairs"></i> Grid Point Inspection
          </div>
          <div style="font-size:11px; margin-bottom:3px;"><b>Coords:</b> ${lat}°N, ${lon}°E</div>
          <div style="font-size:11px; margin-bottom:3px;"><b>Simulation Time:</b> T + ${currentTime.toFixed(1)}h</div>
          <div style="font-size:11px; margin-bottom:3px;"><b>Water Depth:</b> <span style="font-family:'JetBrains Mono'; font-weight:700;">${estDepth} m</span></div>
          <div style="font-size:11px; margin-bottom:3px;"><b>Flow Velocity:</b> <span style="font-family:'JetBrains Mono';">${estVelocity} m/s</span></div>
          <div style="font-size:11px;"><b>Hazard Tier:</b> ${hazardLevel}</div>
        </div>
      `)
      .openOn(map);
  });

  // 3. Evacuation Corridors & Shelters Layer
  function renderEvacuationRoutes() {
    evacuationLayerGroup.clearLayers();
    const routeEast = [
      morbiLoc,
      [22.825, 70.860],
      [22.835, 70.885]
    ];
    L.polyline(routeEast, { color: '#06d6a0', weight: 4, dashArray: '6, 8' }).addTo(evacuationLayerGroup)
      .bindPopup("<b>Primary Safe Evacuation Corridor (East Bypass Ridge)</b><br>Status: Elevated above maximum flood line");
  }

  renderEvacuationRoutes();
  renderMapLayers(currentTime);

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

    // Dynamic Map Flood Wave & Flow Streamlines Update
    renderMapLayers(timeVal);
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
