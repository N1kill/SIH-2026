/* ==========================================================================
   SIH-2026: Machhu-II Dam Failure Digital Twin & HADR Decision Support Platform
   Master Application Logic (2D GIS + 3D WebGL Digital Twin + Analytics Engine)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // ------------------------------------------------------------------------
  // 1. VERIFIED PIPELINE SIMULATION DATA REPOSITORY (GROUND TRUTH)
  // ------------------------------------------------------------------------
  const PIPELINE_DATA = {
    dam_name: "Machhu-II Dam (Irrigation Project)",
    cwc_id: "GJ04MH0002",
    coordinates: { lat: 22.8212, lon: 70.8414 },
    structural_height_m: 22.56,
    crest_length_m: 3542.0,
    gross_storage_mcm: 101.0,
    designed_spillway_m3s: 5663.0,
    inflow_peak_m3s: 3078.30,
    
    // Scenarios (Base case verified from 2D hydrodynamic simulation)
    scenarios: {
      base: {
        id: "base",
        name: "Base Case (Froehlich 2008)",
        q_peak: 6647.0,
        b_avg: 156.0,
        t_f: 2.50,
        morbi_peak_depth: 6.32,
        morbi_arrival_time: 7.47,
        morbi_peak_time: 19.30,
        inund_area_km2: 123.38,
        pop_exposed: 214559,
        buildings_affected: 44699,
        economic_loss_cr: 3629.14,
        critical_risk_area_km2: 6.82,
        cropland_ha: 4274.7,
        roads_km: 394.8,
        bridges: 6,
      },
      plus25: {
        id: "plus25",
        name: "+25% Breach Width",
        q_peak: 8309.0,
        b_avg: 195.0,
        t_f: 2.00,
        morbi_peak_depth: 7.58,
        morbi_arrival_time: 6.20,
        morbi_peak_time: 16.50,
        inund_area_km2: 145.60,
        pop_exposed: 253180,
        buildings_affected: 52745,
        economic_loss_cr: 4282.40,
        critical_risk_area_km2: 8.05,
        cropland_ha: 5044.1,
        roads_km: 465.9,
        bridges: 6,
      },
      minus25: {
        id: "minus25",
        name: "-25% Conservative",
        q_peak: 4985.0,
        b_avg: 117.0,
        t_f: 3.12,
        morbi_peak_depth: 4.93,
        morbi_arrival_time: 9.10,
        morbi_peak_time: 21.00,
        inund_area_km2: 101.20,
        pop_exposed: 175938,
        buildings_affected: 36653,
        economic_loss_cr: 2975.90,
        critical_risk_area_km2: 5.59,
        cropland_ha: 3505.2,
        roads_km: 323.8,
        bridges: 6,
      },
      extreme50: {
        id: "extreme50",
        name: "+50% Extreme Overtopping",
        q_peak: 10500.0,
        b_avg: 234.0,
        t_f: 1.50,
        morbi_peak_depth: 9.16,
        morbi_arrival_time: 4.80,
        morbi_peak_time: 14.20,
        inund_area_km2: 172.70,
        pop_exposed: 300383,
        buildings_affected: 62580,
        economic_loss_cr: 5080.80,
        critical_risk_area_km2: 9.55,
        cropland_ha: 5984.6,
        roads_km: 552.6,
        bridges: 6,
      }
    },

    // Gauge Telemetry Data
    stations: {
      dam_toe: { name: "Machhu-II Dam Toe (0 km)", lat: 22.8212, lon: 70.8414, peak_depth: 22.56, arrival: 0.07, peak_time: 1.23 },
      morbi:   { name: "Morbi City Center (5.2 km)", lat: 22.8684, lon: 70.8117, peak_depth: 6.32, arrival: 7.47, peak_time: 19.30 },
      lilapar: { name: "Lilapar / Dhuva (12 km)", lat: 22.9161, lon: 70.7853, peak_depth: 3.87, arrival: 17.50, peak_time: 23.73 },
      malia:   { name: "Malia Miyana (25 km)", lat: 22.9802, lon: 70.7675, peak_depth: 0.85, arrival: 22.00, peak_time: 24.00 }
    },

    // High Ground Evacuation Centers
    shelters: [
      { name: "Morbi East High Ground Shelter 1", lat: 22.875, lon: 70.852, elev: 56.4, capacity: 25000, type: "Elevation Ridge (>55m)" },
      { name: "Morbi South-East Relief Complex", lat: 22.842, lon: 70.848, elev: 54.2, capacity: 18000, type: "Government Complex" },
      { name: "Liliya Ridge Transit Hub", lat: 22.905, lon: 70.825, elev: 53.8, capacity: 12000, type: "Elevated Transit Interchange" }
    ],

    // Evacuation Routes
    routes: [
      {
        id: "R1_EAST",
        name: "Corridor 1: Morbi Central to East Bypass Ridge",
        coords: [[22.8684, 70.8117], [22.8690, 70.8300], [22.8750, 70.8520]],
        color: "#06d6a0"
      },
      {
        id: "R2_SOUTH",
        name: "Corridor 2: Vankaner Elevated Highway",
        coords: [[22.8450, 70.8250], [22.8350, 70.8380], [22.8150, 70.8450]],
        color: "#00b4d8"
      }
    ]
  };

  // State
  let currentScenarioKey = "base";
  let currentTimeHours = 7.5;
  let isPlaying = false;
  let playTimer = null;
  let speedMultiplier = 5;
  let leafletMap = null;
  let geojsonLayer = null;
  let stationMarkers = {};
  let shelterMarkers = [];
  let routeLines = [];
  let hydrographChart = null;
  let sectorChart = null;
  let popChart = null;

  // ------------------------------------------------------------------------
  // 2. TAB VIEW SWITCHER
  // ------------------------------------------------------------------------
  const tabButtons = document.querySelectorAll(".tab-btn");
  const viewPanels = document.querySelectorAll(".view-panel");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetViewId = btn.getAttribute("data-tab");
      tabButtons.forEach(b => b.classList.remove("active"));
      viewPanels.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPanel = document.getElementById(targetViewId);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }

      // View-specific initialization triggers
      if (targetViewId === "view-gis" && leafletMap) {
        setTimeout(() => { leafletMap.invalidateSize(); }, 200);
      } else if (targetViewId === "view-3d") {
        initThreeJsDigitalTwin();
        setTimeout(() => { onThreeWindowResize(); }, 200);
      } else if (targetViewId === "view-analytics") {
        initAnalyticsCharts();
      }
    });
  });

  // ------------------------------------------------------------------------
  // 3. INITIALIZE 2D LEAFLET GIS MAP
  // ------------------------------------------------------------------------
  function initLeafletGisMap() {
    const mapEl = document.getElementById("map");
    if (!mapEl) return;

    leafletMap = L.map("map", {
      center: [22.88, 70.81],
      zoom: 11,
      zoomControl: false,
      attributionControl: true
    });

    L.control.zoom({ position: "bottomright" }).addTo(leafletMap);

    // Tile Layers
    const esriDark = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16,
      attribution: 'Tiles &copy; Esri &mdash; SIH-2026'
    });
    const esriLabels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16
    });
    const esriSatellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri, Maxar &mdash; SIH-2026'
    });
    const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &mdash; SIH-2026'
    });

    const darkBaseGroup = L.layerGroup([esriDark, esriLabels]);
    darkBaseGroup.addTo(leafletMap);

    const baseMaps = {
      "<span style='color:#00b4d8; font-weight:600;'>Esri Dark Canvas</span>": darkBaseGroup,
      "<span style='color:#06d6a0; font-weight:600;'>Satellite Imagery</span>": esriSatellite,
      "<span style='color:#f4a261; font-weight:600;'>OpenStreetMap</span>": osm
    };
    L.control.layers(baseMaps, null, { position: "topright" }).addTo(leafletMap);

    // Load Vector GeoJSON (Multi-Tier Inundation)
    loadFloodExtentGeoJson();

    // Add Monitoring Stations with radar-pulsing markers
    addStationMarkers();

    // Add High Ground Shelters
    addShelterMarkers();

    // Add Evacuation Routes
    addEvacuationRoutes();

    // Setup Layer Checkbox Toggles
    setupLayerToggles();
  }

  // Load GeoJSON
  async function loadFloodExtentGeoJson() {
    try {
      const res = await fetch("machhu_flood_extent.geojson");
      if (!res.ok) throw new Error("Could not fetch GeoJSON");
      const geoData = await res.json();

      geojsonLayer = L.geoJSON(geoData, {
        style: feature => {
          const color = feature.properties?.color || "#d62828";
          return {
            fillColor: color,
            fillOpacity: 0.65,
            color: color,
            weight: 1.5,
            opacity: 0.85
          };
        },
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          layer.bindPopup(`
            <div style="font-family: var(--font-main); font-size: 11px;">
              <strong style="color: ${props.color || '#00b4d8'}; font-size: 12px;">${props.hazard_level || 'Flood Zone'}</strong><br>
              <strong>Depth Range:</strong> ${props.depth_range || 'N/A'}<br>
              <strong>Study Corridor:</strong> ${props.study_area || 'Morbi Basin'}<br>
              <small style="color: #94a3b8;">Source: 2D Hydrodynamic Solver</small>
            </div>
          `);
        }
      }).addTo(leafletMap);
    } catch (e) {
      console.warn("[Dashboard GIS] GeoJSON local fetch fallback, rendering synthetic corridor polygon:", e);
      // Fallback synthetic envelope polygon
      const corridorCoords = [
        [22.8212, 70.8414], [22.8350, 70.8350], [22.8500, 70.8250],
        [22.8684, 70.8117], [22.9161, 70.7853], [22.9802, 70.7675],
        [22.9820, 70.7850], [22.9200, 70.8050], [22.8720, 70.8250],
        [22.8400, 70.8480], [22.8212, 70.8414]
      ];
      geojsonLayer = L.polygon(corridorCoords, {
        color: "#d62828",
        fillColor: "#e63946",
        fillOpacity: 0.55,
        weight: 2
      }).addTo(leafletMap);
    }
  }

  // Add Monitoring Stations
  function addStationMarkers() {
    const stations = PIPELINE_DATA.stations;
    const beaconIcon = L.divIcon({
      className: "beacon-wrap",
      html: `<div style="position:relative; width:18px; height:18px;">
               <div style="position:absolute; width:18px; height:18px; background:var(--accent-cyan); border-radius:50%; opacity:0.75; animation:pulse-ring 2s infinite ease-out;"></div>
               <div style="position:absolute; top:3px; left:3px; width:12px; height:12px; background:white; border:2px solid var(--accent-cyan); border-radius:50%;"></div>
             </div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    for (const [key, st] of Object.entries(stations)) {
      const marker = L.marker([st.lat, st.lon], { icon: beaconIcon }).addTo(leafletMap);
      marker.bindPopup(`
        <div style="font-family: var(--font-main); font-size: 11px;">
          <strong style="color: var(--accent-cyan); font-size: 12px;">${st.name}</strong><br>
          <strong>Coordinates:</strong> ${st.lat.toFixed(4)}°N, ${st.lon.toFixed(4)}°E<br>
          <strong>Peak Depth:</strong> <span style="color:var(--accent-red); font-weight:700;">${st.peak_depth.toFixed(2)} m</span><br>
          <strong>Wave Arrival:</strong> ${st.arrival !== null ? st.arrival.toFixed(2) + ' hrs' : 'None'}<br>
          <strong>Peak Stage Time:</strong> T + ${st.peak_time.toFixed(1)} hrs
        </div>
      `);
      stationMarkers[key] = marker;
    }
  }

  // Add Shelters
  function addShelterMarkers() {
    const shelterIcon = L.divIcon({
      className: "shelter-marker",
      html: `<div style="background:#06d6a0; border:2px solid white; border-radius:4px; padding:2px 5px; font-size:10px; font-weight:700; color:#040812; display:flex; align-items:center; gap:3px; box-shadow:0 0 10px rgba(6,214,160,0.5);">
               <i class="fa-solid fa-shield-heart"></i> SHELTER
             </div>`,
      iconAnchor: [30, 10]
    });

    PIPELINE_DATA.shelters.forEach(sh => {
      const m = L.marker([sh.lat, sh.lon], { icon: shelterIcon }).addTo(leafletMap);
      m.bindPopup(`
        <div style="font-family: var(--font-main); font-size: 11px;">
          <strong style="color: var(--accent-emerald); font-size: 12px;">${sh.name}</strong><br>
          <strong>Type:</strong> ${sh.type}<br>
          <strong>Elevation:</strong> ${sh.elev} m MSL (&gt;52m Safe Ridge)<br>
          <strong>Capacity:</strong> ${sh.capacity.toLocaleString()} Persons<br>
          <span style="color: #06d6a0; font-weight:600;">Status: Verified Topographic High Ground</span>
        </div>
      `);
      shelterMarkers.push(m);
    });
  }

  // Add Evacuation Routes
  function addEvacuationRoutes() {
    PIPELINE_DATA.routes.forEach(rt => {
      const poly = L.polyline(rt.coords, {
        color: rt.color,
        weight: 4,
        opacity: 0.9,
        dashArray: "6, 8"
      }).addTo(leafletMap);

      poly.bindPopup(`<strong>${rt.name}</strong><br>Designated High-Ground Escape Corridor`);
      routeLines.push(poly);
    });
  }

  // Setup Layer Toggles
  function setupLayerToggles() {
    const toggleDepth = document.getElementById("layer-depth");
    const toggleSat = document.getElementById("layer-satellite");
    const toggleRisk = document.getElementById("layer-risk");
    const toggleEvac = document.getElementById("layer-evacuation");

    if (toggleDepth) {
      toggleDepth.addEventListener("change", e => {
        if (geojsonLayer) {
          if (e.target.checked) leafletMap.addLayer(geojsonLayer);
          else leafletMap.removeLayer(geojsonLayer);
        }
      });
    }

    if (toggleEvac) {
      toggleEvac.addEventListener("change", e => {
        shelterMarkers.forEach(m => {
          if (e.target.checked) leafletMap.addLayer(m);
          else leafletMap.removeLayer(m);
        });
        routeLines.forEach(l => {
          if (e.target.checked) leafletMap.addLayer(l);
          else leafletMap.removeLayer(l);
        });
      });
    }
  }

  // ------------------------------------------------------------------------
  // 4. PLAYBACK CONTROLLER & DYNAMIC TIME SCRUBBING
  // ------------------------------------------------------------------------
  const timeSlider = document.getElementById("time-slider");
  const timeDisplay = document.getElementById("time-display");
  const hudSimTime = document.getElementById("hud-sim-time");
  const hudWaveStatus = document.getElementById("hud-wave-status");
  const btnPlay = document.getElementById("btn-play");
  const btnReset = document.getElementById("btn-reset");
  const btnStepBack = document.getElementById("btn-step-back");
  const btnStepFwd = document.getElementById("btn-step-fwd");
  const speedSelect = document.getElementById("speed-multiplier");

  function updateSimulationTime(timeVal) {
    currentTimeHours = parseFloat(timeVal);
    if (timeSlider) timeSlider.value = currentTimeHours;

    const hrs = Math.floor(currentTimeHours);
    const mins = Math.round((currentTimeHours - hrs) * 60);
    const timeStr = `T + ${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")} hrs`;

    if (timeDisplay) timeDisplay.textContent = timeStr;
    if (hudSimTime) hudSimTime.innerHTML = `<i class="fa-solid fa-stopwatch"></i> ${timeStr}`;

    // Update status description
    updatePhaseDescription(currentTimeHours);

    // Update gauges & telemetry
    updateGaugesAtTime(currentTimeHours);

    // Update 3D Three.js water surface
    if (typeof updateThreeSimulation === "function") {
      updateThreeSimulation(currentTimeHours);
    }

    // Update hydrograph scrubber tracker
    if (hydrographChart) {
      updateHydrographCursor(currentTimeHours);
    }
  }

  function updatePhaseDescription(t) {
    let status = "Breach Inflow Routing";
    let color = "var(--accent-cyan)";

    if (t < 0.5) {
      status = "Crest Overtopping & Embankment Erosion";
      color = "var(--accent-amber)";
    } else if (t >= 0.5 && t < 3.0) {
      status = "Catastrophic Breach Expansion (Q_peak = 6,647 m³/s)";
      color = "var(--accent-red)";
    } else if (t >= 3.0 && t < 7.5) {
      status = "High-Velocity Surge Advancing Down Machhu Gorge";
      color = "var(--accent-amber)";
    } else if (t >= 7.5 && t < 15.0) {
      status = "Destructive Flood Inundating Central Morbi (Peak 6.32m)";
      color = "var(--accent-red)";
    } else if (t >= 15.0 && t < 22.0) {
      status = "Drainage Through Lilapar & Downstream Delta";
      color = "var(--accent-cyan)";
    } else {
      status = "Late-Stage Attenuation & Recession Towards Gulf of Kutch";
      color = "var(--accent-emerald)";
    }

    if (hudWaveStatus) {
      hudWaveStatus.innerHTML = `<i class="fa-solid fa-water"></i> ${status}`;
      hudWaveStatus.style.color = color;
    }
  }

  function updateGaugesAtTime(t) {
    const sc = PIPELINE_DATA.scenarios[currentScenarioKey];
    
    // Dam toe depth curve (rises fast to 22.56m, then decays)
    let dDam = 0.0;
    if (t <= 1.2) dDam = (t / 1.2) * sc.morbi_peak_depth * 3.5;
    else dDam = Math.max(2.5, 22.56 * Math.exp(-(t - 1.2) / 6.0));
    dDam = Math.min(22.56, dDam);

    // Morbi depth curve (arrives at ~7.47h, peaks at 19.3h at 6.32m)
    let dMorbi = 0.0;
    if (t >= sc.morbi_arrival_time) {
      const dt = t - sc.morbi_arrival_time;
      const riseTime = sc.morbi_peak_time - sc.morbi_arrival_time;
      if (dt <= riseTime) {
        dMorbi = sc.morbi_peak_depth * Math.pow(dt / riseTime, 1.4);
      } else {
        dMorbi = Math.max(1.0, sc.morbi_peak_depth * Math.exp(-(dt - riseTime) / 10.0));
      }
    }

    // Lilapar depth curve (arrives at 17.5h)
    let dLilapar = 0.0;
    if (t >= 17.5) {
      dLilapar = Math.min(3.87, 3.87 * ((t - 17.5) / 6.2));
    }

    // Update gauge DOM
    const elDam = document.getElementById("val-dam-toe");
    const barDam = document.getElementById("bar-dam-toe");
    if (elDam) elDam.textContent = `${dDam.toFixed(2)} m`;
    if (barDam) barDam.style.width = `${Math.min(100, (dDam / 22.56) * 100)}%`;

    const elMorbi = document.getElementById("val-morbi");
    const barMorbi = document.getElementById("bar-morbi");
    if (elMorbi) elMorbi.textContent = `${dMorbi.toFixed(2)} m`;
    if (barMorbi) barMorbi.style.width = `${Math.min(100, (dMorbi / sc.morbi_peak_depth) * 100)}%`;

    const elLilapar = document.getElementById("val-lilapar");
    const barLilapar = document.getElementById("bar-lilapar");
    if (elLilapar) elLilapar.textContent = `${dLilapar.toFixed(2)} m`;
    if (barLilapar) barLilapar.style.width = `${Math.min(100, (dLilapar / 3.87) * 100)}%`;

    // Update 3D HUD Telemetry
    const hudQ = document.getElementById("hud-q-out");
    const hudHead = document.getElementById("hud-head");
    const hudVel = document.getElementById("hud-velocity");
    const hudStage = document.getElementById("hud-morbi-stage");

    let currentQ = 0.0;
    if (t <= sc.t_f) {
      currentQ = sc.q_peak * Math.pow(t / sc.t_f, 1.8);
    } else {
      currentQ = Math.max(450.0, sc.q_peak * Math.exp(-(t - sc.t_f) / 4.5));
    }

    if (hudQ) hudQ.textContent = `${Math.round(currentQ).toLocaleString()} m³/s`;
    if (hudHead) hudHead.textContent = `${dDam.toFixed(1)} m`;
    if (hudVel) hudVel.textContent = `${(Math.min(12.0, 1.5 + (currentQ / sc.q_peak) * 9.5)).toFixed(1)} m/s`;
    if (hudStage) hudStage.textContent = `${dMorbi.toFixed(2)} m`;

    // Dynamic GeoJSON polygon opacity matching wave propagation
    if (geojsonLayer) {
      const alpha = Math.min(0.85, Math.max(0.15, (t / 12.0)));
      geojsonLayer.setStyle({ fillOpacity: alpha });
    }
  }

  // Playback Event Handlers
  if (timeSlider) {
    timeSlider.addEventListener("input", e => {
      updateSimulationTime(e.target.value);
    });
  }

  function togglePlay() {
    isPlaying = !isPlaying;
    if (btnPlay) {
      btnPlay.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
      btnPlay.classList.toggle("active", isPlaying);
    }

    if (isPlaying) {
      playTimer = setInterval(() => {
        let nextTime = currentTimeHours + 0.25;
        if (nextTime > 24.0) {
          nextTime = 0.0;
        }
        updateSimulationTime(nextTime);
      }, 300 / speedMultiplier);
    } else {
      clearInterval(playTimer);
      playTimer = null;
    }
  }

  if (btnPlay) btnPlay.addEventListener("click", togglePlay);

  if (btnReset) {
    btnReset.addEventListener("click", () => {
      if (isPlaying) togglePlay();
      updateSimulationTime(0.0);
    });
  }

  if (btnStepBack) {
    btnStepBack.addEventListener("click", () => {
      updateSimulationTime(Math.max(0.0, currentTimeHours - 1.0));
    });
  }

  if (btnStepFwd) {
    btnStepFwd.addEventListener("click", () => {
      updateSimulationTime(Math.min(24.0, currentTimeHours + 1.0));
    });
  }

  if (speedSelect) {
    speedSelect.addEventListener("change", e => {
      speedMultiplier = parseFloat(e.target.value);
      if (isPlaying) {
        clearInterval(playTimer);
        playTimer = setInterval(() => {
          let nextTime = currentTimeHours + 0.25;
          if (nextTime > 24.0) nextTime = 0.0;
          updateSimulationTime(nextTime);
        }, 300 / speedMultiplier);
      }
    });
  }

  // ------------------------------------------------------------------------
  // 5. SCENARIO SELECTOR ENGINE
  // ------------------------------------------------------------------------
  const scenarioButtons = document.querySelectorAll(".scenario-btn");

  scenarioButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const scKey = btn.getAttribute("data-scenario");
      if (!PIPELINE_DATA.scenarios[scKey]) return;

      scenarioButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      currentScenarioKey = scKey;
      applyScenarioUpdate(scKey);
    });
  });

  function applyScenarioUpdate(scKey) {
    const sc = PIPELINE_DATA.scenarios[scKey];

    // Update KPI Grid
    const kpiPop = document.getElementById("kpi-pop");
    const kpiArea = document.getElementById("kpi-area");
    const kpiStruct = document.getElementById("kpi-structures");
    const kpiLoss = document.getElementById("kpi-loss");

    if (kpiPop) kpiPop.textContent = sc.pop_exposed.toLocaleString();
    if (kpiArea) kpiArea.textContent = `${sc.inund_area_km2.toFixed(2)} km²`;
    if (kpiStruct) kpiStruct.textContent = sc.buildings_affected.toLocaleString();
    if (kpiLoss) kpiLoss.textContent = `₹${sc.economic_loss_cr.toLocaleString()} Cr`;

    // Refresh simulation time calculations
    updateSimulationTime(currentTimeHours);

    // Refresh charts
    if (hydrographChart) updateHydrographData(sc);
    if (sectorChart) updateSectorChart(sc);
    if (popChart) updatePopChart(sc);
  }

  // ------------------------------------------------------------------------
  // 6. DYNAMIC HYDROGRAPH (CHART.JS)
  // ------------------------------------------------------------------------
  function initHydrographChart() {
    const canvas = document.getElementById("hydrographCanvas");
    if (!canvas) return;

    const timeLabels = [];
    const outflowData = [];
    const inflowData = [];
    const stageData = [];

    const sc = PIPELINE_DATA.scenarios[currentScenarioKey];

    for (let t = 0; t <= 24; t += 0.5) {
      timeLabels.push(`${t}h`);

      // Outflow curve
      if (t <= sc.t_f) {
        outflowData.push(Math.round(sc.q_peak * Math.pow(t / sc.t_f, 1.8)));
      } else {
        outflowData.push(Math.round(Math.max(300, sc.q_peak * Math.exp(-(t - sc.t_f) / 4.5))));
      }

      // Inflow curve (SCS-CN peak 3,078 m³/s at t=5.0h)
      const qIn = Math.max(120, 3078.3 * Math.exp(-Math.pow((t - 5.0) / 3.2, 2)));
      inflowData.push(Math.round(qIn));

      // Morbi Stage curve (scaled to 1000 for visibility)
      let stg = 0.0;
      if (t >= sc.morbi_arrival_time) {
        const dt = t - sc.morbi_arrival_time;
        stg = sc.morbi_peak_depth * Math.exp(-Math.pow((t - sc.morbi_peak_time) / 5.0, 2));
      }
      stageData.push(Math.round(stg * 600));
    }

    hydrographChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: timeLabels,
        datasets: [
          {
            label: "Breach Outflow Q(t) [m³/s]",
            data: outflowData,
            borderColor: "#00b4d8",
            backgroundColor: "rgba(0, 180, 216, 0.12)",
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            pointRadius: 0
          },
          {
            label: "SCS-CN Basin Inflow [m³/s]",
            data: inflowData,
            borderColor: "#e63946",
            borderDash: [4, 4],
            borderWidth: 1.5,
            tension: 0.35,
            fill: false,
            pointRadius: 0
          },
          {
            label: "Morbi Flood Stage (Scaled)",
            data: stageData,
            borderColor: "#06d6a0",
            borderWidth: 1.5,
            tension: 0.35,
            fill: false,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            backgroundColor: "rgba(10, 16, 30, 0.95)",
            titleColor: "#00b4d8",
            bodyFont: { family: "JetBrains Mono", size: 10 },
            borderColor: "rgba(0, 180, 216, 0.4)",
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,0.05)" },
            ticks: { color: "#64748b", font: { size: 9, family: "JetBrains Mono" }, maxTicksLimit: 7 }
          },
          y: {
            grid: { color: "rgba(255,255,255,0.05)" },
            ticks: { color: "#64748b", font: { size: 9, family: "JetBrains Mono" }, maxTicksLimit: 5 }
          }
        }
      }
    });
  }

  function updateHydrographData(sc) {
    if (!hydrographChart) return;
    const outflowData = [];
    for (let t = 0; t <= 24; t += 0.5) {
      if (t <= sc.t_f) {
        outflowData.push(Math.round(sc.q_peak * Math.pow(t / sc.t_f, 1.8)));
      } else {
        outflowData.push(Math.round(Math.max(300, sc.q_peak * Math.exp(-(t - sc.t_f) / 4.5))));
      }
    }
    hydrographChart.data.datasets[0].data = outflowData;
    hydrographChart.update();
  }

  function updateHydrographCursor(t) {
    // Optional highlight logic for chart line
  }

  // ------------------------------------------------------------------------
  // 7. 3D WEBGL DIGITAL TWIN (THREE.JS ENGINE)
  // ------------------------------------------------------------------------
  let threeScene, threeCamera, threeRenderer, threeControls;
  let terrainMesh, damGroup, waterMesh, buildingsGroup, flowParticles;
  let isThreeInitialized = false;

  const TERRAIN_SIZE = 120;
  const GRID_RES = 64;

  function initThreeJsDigitalTwin() {
    if (isThreeInitialized) return;
    const container = document.getElementById("webgl-canvas");
    if (!container) return;

    // Scene
    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x040812);
    threeScene.fog = new THREE.FogExp2(0x040812, 0.005);

    // Camera
    threeCamera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    threeCamera.position.set(0, 55, 85);

    // Renderer
    threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    threeRenderer.setSize(container.clientWidth, container.clientHeight);
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    threeRenderer.shadowMap.enabled = true;
    threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(threeRenderer.domElement);

    // Orbit Controls
    threeControls = new THREE.OrbitControls(threeCamera, threeRenderer.domElement);
    threeControls.enableDamping = true;
    threeControls.dampingFactor = 0.05;
    threeControls.maxPolarAngle = Math.PI / 2 - 0.05;
    threeControls.target.set(0, 4, 8);

    // Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xd0e1fd, 0.65);
    threeScene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff8ee, 1.4);
    sunLight.position.set(60, 90, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    threeScene.add(sunLight);

    const blueFill = new THREE.DirectionalLight(0x00b4d8, 0.45);
    blueFill.position.set(-50, 40, -40);
    threeScene.add(blueFill);

    // Build 3D Elements
    build3DTerrain();
    build3DDam();
    build3DWater();
    build3DMorbiBuildings();
    build3DFlowParticles();

    // Camera Director Buttons
    setupCameraDirector();

    window.addEventListener("resize", onThreeWindowResize);
    isThreeInitialized = true;

    animateThreeJs();
  }

  function build3DTerrain() {
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, GRID_RES - 1, GRID_RES - 1);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Sinuous Machhu river channel winding northwards
      const riverCenter = Math.sin(z * 0.08) * 8.0;
      const distFromRiver = Math.abs(x - riverCenter);

      // Downstream gradient + valley ridges
      const valleySlope = -(z / TERRAIN_SIZE) * 12.0 + 6.0;
      const valleyWalls = Math.pow(Math.abs(x) / 36.0, 1.8) * 16.0;
      const channelGorge = Math.exp(-Math.pow(distFromRiver / 6.5, 2)) * 6.5;
      const microNoise = Math.sin(x * 0.3) * Math.cos(z * 0.3) * 0.7;

      const y = Math.max(-2.5, valleySlope + valleyWalls - channelGorge + microNoise);
      pos.setY(i, y);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.9,
      metalness: 0.1
    });

    terrainMesh = new THREE.Mesh(geo, mat);
    terrainMesh.receiveShadow = true;
    threeScene.add(terrainMesh);

    // High-Tech Wireframe Overlay
    const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x00b4d8,
      wireframe: true,
      transparent: true,
      opacity: 0.08
    }));
    threeScene.add(wire);
  }

  function build3DDam() {
    damGroup = new THREE.Group();
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.2 });
    const earthMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });

    // Masonry Spillway Center
    const spill = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 6), concreteMat);
    spill.position.set(0, 6.0, -18);
    spill.castShadow = true;
    damGroup.add(spill);

    // Left Embankment Flank
    const leftE = new THREE.Mesh(new THREE.BoxGeometry(26, 12, 8), earthMat);
    leftE.position.set(-20, 6.2, -18);
    leftE.castShadow = true;
    damGroup.add(leftE);

    // Right Embankment Flank (Breaching Wing)
    const rightE = new THREE.Mesh(new THREE.BoxGeometry(26, 12, 8), earthMat);
    rightE.position.set(20, 6.2, -18);
    rightE.castShadow = true;
    damGroup.add(rightE);

    threeScene.add(damGroup);
  }

  function build3DWater() {
    const geo = new THREE.PlaneGeometry(36, 75, 48, 64);
    geo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x00b4d8,
      roughness: 0.15,
      metalness: 0.8,
      transparent: true,
      opacity: 0.82,
      depthWrite: false
    });

    waterMesh = new THREE.Mesh(geo, waterMat);
    waterMesh.position.set(0, 1.8, 4);
    threeScene.add(waterMesh);
  }

  function build3DMorbiBuildings() {
    buildingsGroup = new THREE.Group();
    const bldgMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });

    for (let i = 0; i < 42; i++) {
      const w = 2.0 + Math.random() * 2.5;
      const d = 2.0 + Math.random() * 2.5;
      const h = 3.0 + Math.random() * 6.5;

      const bldg = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bldgMat);
      const x = (Math.random() - 0.5) * 22.0 - 5.0;
      const z = 12.0 + Math.random() * 24.0;
      const y = h / 2.0;

      bldg.position.set(x, y, z);
      bldg.castShadow = true;
      buildingsGroup.add(bldg);
    }
    threeScene.add(buildingsGroup);
  }

  function build3DFlowParticles() {
    const pCount = 450;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = 2.5 + Math.random() * 1.5;
      positions[i * 3 + 2] = -18 + Math.random() * 65;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0x06d6a0,
      size: 0.8,
      transparent: true,
      opacity: 0.75
    });

    flowParticles = new THREE.Points(geo, pMat);
    threeScene.add(flowParticles);
  }

  // Synced 3D Simulation Loop Update
  window.updateThreeSimulation = function(t) {
    if (!waterMesh) return;
    const sc = PIPELINE_DATA.scenarios[currentScenarioKey];

    // Dynamic water level height
    const baseH = 1.2;
    let waveAdvanceZ = -18.0;
    let floodLevelY = baseH;

    if (t <= 2.5) {
      waveAdvanceZ = -18.0 + (t / 2.5) * 12.0;
      floodLevelY = baseH + (t / 2.5) * 3.5;
    } else if (t <= 7.5) {
      waveAdvanceZ = -6.0 + ((t - 2.5) / 5.0) * 22.0;
      floodLevelY = baseH + 3.5 + ((t - 2.5) / 5.0) * (sc.morbi_peak_depth * 0.4);
    } else if (t <= 19.3) {
      waveAdvanceZ = 35.0;
      floodLevelY = baseH + (sc.morbi_peak_depth * 0.65);
    } else {
      waveAdvanceZ = 45.0;
      floodLevelY = Math.max(baseH + 1.0, (baseH + sc.morbi_peak_depth * 0.65) * Math.exp(-(t - 19.3) / 8.0));
    }

    waterMesh.position.y = floodLevelY;
    waterMesh.position.z = waveAdvanceZ / 2.0;
    waterMesh.scale.z = Math.max(0.2, (waveAdvanceZ + 25.0) / 45.0);

    // Dam breach gap animation
    if (damGroup && damGroup.children[2]) {
      const breachFlank = damGroup.children[2];
      if (t >= 0.5) {
        const breachRatio = Math.min(1.0, (t - 0.5) / 2.0);
        breachFlank.position.x = 20.0 + breachRatio * 4.0;
        breachFlank.rotation.z = -breachRatio * 0.15;
      } else {
        breachFlank.position.x = 20.0;
        breachFlank.rotation.z = 0.0;
      }
    }
  };

  // Camera Director
  function setupCameraDirector() {
    const camBtns = document.querySelectorAll(".cam-btn");
    camBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        camBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const mode = btn.getAttribute("data-cam");

        if (mode === "overview") {
          tweenCamera(0, 55, 85, 0, 4, 8);
        } else if (mode === "dam") {
          tweenCamera(0, 16, -2, 0, 6, -18);
        } else if (mode === "morbi") {
          tweenCamera(-14, 28, 38, 0, 3, 22);
        } else if (mode === "chase") {
          tweenCamera(8, 18, 12, 0, 4, 24);
        } else if (mode === "ridge") {
          tweenCamera(48, 32, 10, 0, 5, 8);
        }
      });
    });
  }

  function tweenCamera(px, py, pz, tx, ty, tz) {
    if (!threeCamera || !threeControls) return;
    threeCamera.position.set(px, py, pz);
    threeControls.target.set(tx, ty, tz);
  }

  function onThreeWindowResize() {
    const container = document.getElementById("webgl-canvas");
    if (!container || !threeRenderer || !threeCamera) return;
    threeCamera.aspect = container.clientWidth / container.clientHeight;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(container.clientWidth, container.clientHeight);
  }

  function animateThreeJs() {
    requestAnimationFrame(animateThreeJs);

    if (threeControls) threeControls.update();

    // Subtle water surface wave ripple
    if (waterMesh && waterMesh.geometry) {
      const pos = waterMesh.geometry.attributes.position;
      const time = performance.now() * 0.0025;
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i);
        const v = pos.getY(i);
        const zWave = Math.sin(u * 0.4 + time) * 0.12 + Math.cos(v * 0.4 + time) * 0.12;
        pos.setZ(i, zWave);
      }
      waterMesh.geometry.computeVertexNormals();
      waterMesh.geometry.attributes.position.needsUpdate = true;
    }

    // Velocity Particle Stream
    if (flowParticles && flowParticles.geometry) {
      const pPos = flowParticles.geometry.attributes.position;
      for (let i = 0; i < pPos.count; i++) {
        let z = pPos.getZ(i) + 0.35 * (speedMultiplier / 2);
        if (z > 50) z = -18;
        pPos.setZ(i, z);
      }
      flowParticles.geometry.attributes.position.needsUpdate = true;
    }

    if (threeRenderer && threeScene && threeCamera) {
      threeRenderer.render(threeScene, threeCamera);
    }
  }

  // ------------------------------------------------------------------------
  // 8. ANALYTICS VIEW CHARTS (CHART.JS)
  // ------------------------------------------------------------------------
  function initAnalyticsCharts() {
    const sc = PIPELINE_DATA.scenarios[currentScenarioKey];

    // Sectoral Loss Donut Chart
    const sectorCanvas = document.getElementById("sectorLossChart");
    if (sectorCanvas && !sectorChart) {
      sectorChart = new Chart(sectorCanvas, {
        type: "doughnut",
        data: {
          labels: ["Residential Housing", "Commercial / Ceramics", "Public Infrastructure", "Agriculture & Farmland"],
          datasets: [{
            data: [2346.7, 1048.72, 201.66, 32.06],
            backgroundColor: ["#e63946", "#00b4d8", "#f4a261", "#06d6a0"],
            borderColor: "rgba(10, 16, 30, 0.8)",
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right",
              labels: { color: "#f8fafc", font: { family: "Inter", size: 11 }, boxWidth: 12 }
            },
            tooltip: {
              backgroundColor: "rgba(10, 16, 30, 0.95)",
              titleColor: "#00b4d8",
              callbacks: {
                label: ctx => ` ₹${ctx.parsed.toFixed(2)} Cr (${((ctx.parsed / 3629.14) * 100).toFixed(1)}%)`
              }
            }
          }
        }
      });
    }

    // Population Exposure Bar Chart
    const popCanvas = document.getElementById("popExposureChart");
    if (popCanvas && !popChart) {
      popChart = new Chart(popCanvas, {
        type: "bar",
        data: {
          labels: ["Low (<0.5m)", "Moderate (0.5–1.5m)", "High (1.5–3.0m)", "Extreme (>3.0m)"],
          datasets: [{
            label: "Exposed Population",
            data: [20537, 32702, 42806, 118514],
            backgroundColor: ["#2a9d8f", "#f4a261", "#e63946", "#d62828"],
            borderColor: "rgba(255,255,255,0.1)",
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(10, 16, 30, 0.95)",
              titleColor: "#00b4d8",
              callbacks: {
                label: ctx => ` ${ctx.parsed.y.toLocaleString()} Persons`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: "#94a3b8", font: { family: "Inter", size: 10 } }
            },
            y: {
              grid: { color: "rgba(255,255,255,0.06)" },
              ticks: { color: "#94a3b8", font: { family: "JetBrains Mono", size: 10 } }
            }
          }
        }
      });
    }
  }

  function updateSectorChart(sc) {
    if (!sectorChart) return;
    const factor = sc.economic_loss_cr / 3629.14;
    sectorChart.data.datasets[0].data = [
      Math.round(2346.7 * factor * 10) / 10,
      Math.round(1048.72 * factor * 10) / 10,
      Math.round(201.66 * factor * 10) / 10,
      Math.round(32.06 * factor * 10) / 10
    ];
    sectorChart.update();
  }

  function updatePopChart(sc) {
    if (!popChart) return;
    const factor = sc.pop_exposed / 214559;
    popChart.data.datasets[0].data = [
      Math.round(20537 * factor),
      Math.round(32702 * factor),
      Math.round(42806 * factor),
      Math.round(118514 * factor)
    ];
    popChart.update();
  }

  // ------------------------------------------------------------------------
  // 9. MODALS & UTILITIES
  // ------------------------------------------------------------------------
  const btnExport = document.getElementById("btn-export-modal");
  const modalExport = document.getElementById("modal-export");
  const btnBrief = document.getElementById("btn-brief-modal");
  const modalBrief = document.getElementById("modal-brief");
  const closeButtons = document.querySelectorAll(".modal-close");

  if (btnExport && modalExport) {
    btnExport.addEventListener("click", () => modalExport.classList.add("active"));
  }
  if (btnBrief && modalBrief) {
    btnBrief.addEventListener("click", () => modalBrief.classList.add("active"));
  }

  closeButtons.forEach(b => {
    b.addEventListener("click", () => {
      const mId = b.getAttribute("data-close");
      if (mId) {
        const m = document.getElementById(mId);
        if (m) m.classList.remove("active");
      } else {
        if (modalExport) modalExport.classList.remove("active");
        if (modalBrief) modalBrief.classList.remove("active");
      }
    });
  });

  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", e => {
      if (e.target === backdrop) backdrop.classList.remove("active");
    });
  });

  // Fullscreen
  const btnFullscreen = document.getElementById("btn-fullscreen");
  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn("Fullscreen request error:", err);
        });
      } else {
        document.exitFullscreen();
      }
    });
  }

  // Initialize Default View
  initLeafletGisMap();
  initHydrographChart();
  updateSimulationTime(7.5);
});
