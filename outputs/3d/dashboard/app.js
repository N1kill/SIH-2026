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
      morbi: { name: "Morbi City Center (5.2 km)", lat: 22.8684, lon: 70.8117, peak_depth: 6.32, arrival: 7.47, peak_time: 19.30 },
      lilapar: { name: "Lilapar / Dhuva (12 km)", lat: 22.9161, lon: 70.7853, peak_depth: 3.87, arrival: 17.50, peak_time: 23.73 },
      malia: { name: "Malia Miyana (25 km)", lat: 22.9802, lon: 70.7675, peak_depth: 0.85, arrival: 22.00, peak_time: 24.00 }
    },

    // High Ground Evacuation Centers (With Real Hydrodynamic Safety Calculations)
    shelters: [
      {
        id: "S1_EAST",
        shortName: "SHELTER 1 (EAST)",
        name: "Morbi East High Ground Shelter 1",
        lat: 22.875,
        lon: 70.852,
        elev: 56.40,
        capacity: 25000,
        type: "Topographic Elevation Ridge",
        distance_km: 2.10,
        walk_time_hrs: 0.60,
        allocation: 23550,
        safe_clearance_m: 23.87,
        safety_factor: 1.73,
        lead_buffer_hrs: 6.87,
        hazard_rating_site: 0.00
      },
      {
        id: "S2_SOUTHEAST",
        shortName: "SHELTER 2 (SE)",
        name: "South-East Relief Complex",
        lat: 22.842,
        lon: 70.848,
        elev: 54.20,
        capacity: 18000,
        type: "Reinforced Government Complex",
        distance_km: 3.45,
        walk_time_hrs: 0.99,
        allocation: 16820,
        safe_clearance_m: 21.67,
        safety_factor: 1.67,
        lead_buffer_hrs: 6.48,
        hazard_rating_site: 0.00
      },
      {
        id: "S3_LILIYA",
        shortName: "SHELTER 3 (LILIYA)",
        name: "Liliya Ridge Transit Hub",
        lat: 22.905,
        lon: 70.825,
        elev: 53.80,
        capacity: 12000,
        type: "Elevated Transit Interchange",
        distance_km: 4.80,
        walk_time_hrs: 1.37,
        allocation: 11150,
        safe_clearance_m: 21.27,
        safety_factor: 1.65,
        lead_buffer_hrs: 6.10,
        hazard_rating_site: 0.00
      }
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
  // 2. TAB VIEW SWITCHER & LANDING PAGE NAVIGATION
  // ------------------------------------------------------------------------
  const tabButtons = document.querySelectorAll(".tab-btn");
  const viewPanels = document.querySelectorAll(".view-panel");

  function switchTab(targetViewId) {
    if (targetViewId === "view-landing") {
      document.body.classList.add("is-landing-mode");
    } else {
      document.body.classList.remove("is-landing-mode");
    }

    tabButtons.forEach(b => {
      if (b.getAttribute("data-tab") === targetViewId) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });

    viewPanels.forEach(p => p.classList.remove("active"));
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
  }

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetViewId = btn.getAttribute("data-tab");
      if (targetViewId) switchTab(targetViewId);
    });
  });

  // Attach listener to all "Launch / Try Model" CTA buttons across landing page
  document.querySelectorAll(".launch-model-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const targetView = btn.getAttribute("data-tab") || "view-gis";
      switchTab(targetView);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Add Shelters with Real Mathematical Safety Calculations
  function addShelterMarkers() {
    shelterMarkers = [];
    PIPELINE_DATA.shelters.forEach(sh => {
      const shelterIcon = L.divIcon({
        className: "shelter-marker",
        html: `<div style="background:#06d6a0; border:2px solid white; border-radius:4px; padding:3px 7px; font-size:10px; font-weight:800; color:#040812; display:flex; align-items:center; gap:4px; box-shadow:0 0 14px rgba(6,214,160,0.7); cursor:pointer;">
                 <i class="fa-solid fa-shield-heart"></i> ${sh.shortName || 'SHELTER'}
               </div>`,
        iconAnchor: [35, 12]
      });

      const m = L.marker([sh.lat, sh.lon], { icon: shelterIcon }).addTo(leafletMap);

      const popupHtml = `
        <div style="font-family: var(--font-main); font-size: 11px; width: 250px; color: #f8fafc;">
          <div style="font-family: var(--font-heading); font-size: 13px; font-weight: 700; color: var(--accent-emerald); margin-bottom: 4px; display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-shield-halved"></i> ${sh.name}
          </div>
          <div style="background: rgba(6,214,160,0.12); border: 1px solid rgba(6,214,160,0.3); border-radius:4px; padding:4px 8px; margin-bottom:6px; font-size:10px; font-weight:700; color:var(--accent-emerald);">
            STATUS: VERIFIED TOPOGRAPHIC HIGH GROUND
          </div>
          <div style="display:flex; flex-direction:column; gap:3px;">
            <div><strong>Ground Elevation (Z_ground):</strong> ${sh.elev.toFixed(2)} m MSL</div>
            <div><strong>Max Flood WSE (WSE_max):</strong> 32.53 m MSL</div>
            <div><strong>Hydraulic Freeboard (ΔH):</strong> <span style="color:var(--accent-emerald); font-weight:700;">+${sh.safe_clearance_m.toFixed(2)} m clearance</span></div>
            <div><strong>Hydro Safety Factor (SF):</strong> <span style="color:var(--accent-cyan); font-weight:700;">${sh.safety_factor.toFixed(2)} (Safe ≥ 1.25)</span></div>
            <div style="border-top:1px solid rgba(255,255,255,0.1); margin-top:4px; padding-top:4px;"></div>
            <div><strong>Evac Distance (D_evac):</strong> ${sh.distance_km.toFixed(2)} km</div>
            <div><strong>Walking Travel Time:</strong> ${(sh.walk_time_hrs * 60).toFixed(0)} mins (${sh.walk_time_hrs.toFixed(2)} hrs)</div>
            <div><strong>Flood Arrival Lead Time:</strong> <span style="color:var(--accent-emerald); font-weight:700;">+${sh.lead_buffer_hrs.toFixed(2)} hrs buffer</span></div>
            <div><strong>Capacity Allocation:</strong> ${sh.allocation.toLocaleString()} / ${sh.capacity.toLocaleString()} (${((sh.allocation / sh.capacity) * 100).toFixed(1)}%)</div>
          </div>
        </div>
      `;
      m.bindPopup(popupHtml);
      m.shelterId = sh.id;
      shelterMarkers.push(m);
    });

    // Attach click listeners to right sidebar shelter cards to focus map and open popup
    document.querySelectorAll(".shelter-calc-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-shelter");
        const found = shelterMarkers.find(m => m.shelterId === id);
        if (found && leafletMap) {
          leafletMap.flyTo(found.getLatLng(), 14, { duration: 1.2 });
          setTimeout(() => { found.openPopup(); }, 1300);
        }
      });
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
  // 7. PHYSICS-BASED THREE.JS DIGITAL TWIN
  //
  // Design goals:
  //   - Keep the existing dashboard/GIS/analytics API intact.
  //   - Separate hydraulic state from rendering.
  //   - Use a fixed physics timestep.
  //   - Use hydrostatic head + orifice/weir-style discharge for the breach.
  //   - Conserve reservoir volume in the local dam-break model.
  //   - Visualize the resulting jet with GPU-friendly THREE.Points.
  //   - Use shader-driven surface motion instead of CPU normals every frame.
  //
  // IMPORTANT:
  // This is a reduced-order hydraulic/visual model, NOT a CFD/Navier-Stokes
  // solver. The supplied scenario values remain the dashboard's ground-truth
  // outputs; this 3D layer provides a physically coupled visualization.
  // ------------------------------------------------------------------------

  let threeScene = null;
  let threeCamera = null;
  let threeRenderer = null;
  let threeControls = null;

  let terrainMesh = null;
  let waterMesh = null;
  let downstreamWaterMesh = null;
  let dflowFmWaterMesh = null;
  let dflowFmWaterLoaded = false;
  let dflowFmResult = null;
  let dflowFmFrameIndex = -1;
  let dflowFmReplaySeconds = 0;
  let dflowFmFlowPoints = null;
  let dflowFmFlowState = [];
  const dflowFmStream = { ws: null, connected: false, frameDriven: false, pendingTime: null };
  let damGroup = null;
  let breachCavity = null;
  let breachLeftBlock = null;
  let breachRightBlock = null;
  let breachCrest = null;
  let spillwayGateLeaves = [];
  let spillwayFlowMeshes = [];
  let impactFoam = null;
  let reservoirMarker = null;

  let isThreeInitialized = false;
  let threeAnimationStarted = false;
  let threeKeyboardBound = false;
  let terrainVertElevations = [];
  let terrainVertDepths = [];
  let globalElevMin = 0.0;
  const threeMovementKeys = new Set();
  // The dam model's breach/gate centre.  Projected DEM and D-Flow FM
  // coordinates are transformed around this same point.
  // The FM source, DEM origin, and rendered dam centreline share this exact
  // anchor. The SPH jet begins just downstream of it.
  const FM_SCENE_ANCHOR = { x: 15, z: -22 };

  const THREE_PHYSICS = {
    gravity: 9.81,
    waterDensity: 1000.0,
    dischargeCoefficient: 0.62,

    // The real Machhu-II structure is represented at dashboard scale.
    // These values control the visual 3D model, not the supplied scenario Qpeak.
    damPhysicalHeight: 22.56,
    reservoirInitialLevel: 141.0,
    breachElevation: 130.0,

    // Reduced-order breach erosion controls.
    initialBreachWidth: 0.50,
    initialBreachHeight: 0.35,
    finalBreachWidth: 156.0,
    finalBreachHeight: 11.0,
    breachStartHour: 0.10,
    breachGrowthHours: 2.50,

    // Visual scene scale: 120 scene units represent 12 km.
    terrainSize: 120.0,
    terrainPhysicalWidth: 12000.0,
    // A terrain-scale scene needs vertical emphasis for the dam's profile
    // and the reservoir level to remain legible at overview distance.
    verticalExaggeration: 8.0,

    // GPU particle budget suitable for a laptop 4060.
    mainParticleCount: 24000,
    sprayParticleCount: 7000,

    // Physics is intentionally independent from render FPS.
    fixedDt: 1.0 / 120.0,

    // Numerical safeguards.
    maxParticleSpeed: 65.0,
    particleLifeSeconds: 7.0
  };

  const threeSim = {
    timeHours: 0,
    timeSeconds: 0,
    reservoirVolume: 101.0e6,
    reservoirInitialVolume: 101.0e6,
    waterLevel: THREE_PHYSICS.reservoirInitialLevel,
    discharge: 0,
    breachWidth: THREE_PHYSICS.initialBreachWidth,
    breachHeight: THREE_PHYSICS.initialBreachHeight,
    breachBottomElevation: THREE_PHYSICS.breachElevation,
    spillwayDischarge: 0,
    breachArea: 0,
    head: 0,
    outletVelocity: 0,
    phase: "STABLE",
    initializedPhysics: false,

    // Visual particle simulation uses scene units.
    particleAccumulator: 0,
    sprayAccumulator: 0
  };

  let threeTerrainData = null;
  let threeLastWallTime = 0;
  let threePhysicsAccumulator = 0;

  // ── Backend Physics Stream (WebSocket) ──────────────────────────────
  //
  //  LIVE:      100% particle positions ← backend
  //  FALLBACK:  100% procedural particles (existing calculateHydraulics)
  //
  //  The backend is AUTHORITATIVE. The frontend NEVER recalculates
  //  physics from backend values. It only renders.

  const physicsStream = {
    ws: null,
    connected: false,
    latestFrame: null,
    latestParticles: [],   // fluid-only, deterministic-sampled by backend
    frameBuffer: [],       // ring buffer for interpolation
    maxBuffer: 8,
    config: null,
    status: "disconnected"  // disconnected | connecting | live | error
  };

  function connectPhysicsStream() {
    if (window.location.protocol === "file:") {
      physicsStream.status = "disconnected";
      updatePhysicsBadge();
      return;
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/physics`;

    physicsStream.status = "connecting";
    updatePhysicsBadge();

    try {
      physicsStream.ws = new WebSocket(wsUrl);
    } catch (e) {
      physicsStream.status = "disconnected";
      updatePhysicsBadge();
      return;
    }

    physicsStream.ws.onopen = function () {
      console.log("[PhysicsStream] WebSocket connected");
      // Send default config (no custom config for now)
    };

    physicsStream.ws.onmessage = function (evt) {
      try {
        const msg = JSON.parse(evt.data);

        if (msg.type === "simulation_start") {
          physicsStream.config = msg.config;
          physicsStream.connected = true;
          physicsStream.status = "live";
          updatePhysicsBadge();
          return;
        }

        if (msg.type === "simulation_complete") {
          physicsStream.status = "live";
          console.log("[PhysicsStream] Simulation complete:",
                      msg.simulation);
          return;
        }

        if (msg.type === "physics_frame") {
          physicsStream.latestFrame = msg;
          physicsStream.connected = true;
          physicsStream.status = "live";

          // Buffer frames for smooth interpolation
          physicsStream.frameBuffer.push(msg);
          if (physicsStream.frameBuffer.length > physicsStream.maxBuffer) {
            physicsStream.frameBuffer.shift();
          }

          // Extract SPH particles if present
          if (msg.sph && Array.isArray(msg.sph.particles)) {
            physicsStream.latestParticles = msg.sph.particles;
          }

          // Apply backend-authoritative state to threeSim
          applyBackendFrame(msg);
          updatePhysicsBadge();
        }
      } catch (e) {
        console.warn("[PhysicsStream] Parse error:", e);
      }
    };

    physicsStream.ws.onclose = function () {
      physicsStream.connected = false;
      physicsStream.status = "disconnected";
      updatePhysicsBadge();
      console.log("[PhysicsStream] WebSocket closed");
    };

    physicsStream.ws.onerror = function (err) {
      physicsStream.connected = false;
      physicsStream.status = "error";
      updatePhysicsBadge();
      console.warn("[PhysicsStream] WebSocket error:", err);
    };
  }

  function connectDflowFmStream() {
    if (window.location.protocol === "file:") return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    try {
      dflowFmStream.ws = new WebSocket(`${protocol}//${window.location.host}/ws/dflowfm`);
      dflowFmStream.ws.onmessage = function (event) {
        const message = JSON.parse(event.data);
        if (message.type === "dflow_start") {
          dflowFmStream.connected = true;
          dflowFmStream.frameDriven = true;
        } else if (message.type === "dflow_frame" && message.frame) {
          dflowFmStream.pendingTime = message.frame.time_s;
          if (dflowFmResult) updateDflowFmWaterFrame(message.frame.time_s);
        } else if (message.type === "dflow_complete") {
          dflowFmStream.connected = false;
        }
      };
      dflowFmStream.ws.onclose = function () { dflowFmStream.connected = false; };
      dflowFmStream.ws.onerror = function () { dflowFmStream.connected = false; };
    } catch (error) {
      console.warn("[D-Flow FM] stream unavailable:", error);
    }
  }

  function applyBackendFrame(frame) {
    // Backend is authoritative. No recalculation.
    if (frame.breach) {
      threeSim.discharge = frame.breach.outflow_m3s || 0;
      threeSim.breachWidth = frame.breach.bottom_width_m || THREE_PHYSICS.initialBreachWidth;

      if (frame.breach.bottom_elevation_m !== undefined) {
        threeSim.breachBottomElevation = frame.breach.bottom_elevation_m;
        // Calculate breach height dynamically from bottom elevation
        threeSim.breachHeight = Math.max(
          THREE_PHYSICS.initialBreachHeight,
          THREE_PHYSICS.reservoirInitialLevel - frame.breach.bottom_elevation_m
        );
      }
    }
    if (frame.reservoir) {
      threeSim.waterLevel = frame.reservoir.elevation_m || THREE_PHYSICS.reservoirInitialLevel;
      threeSim.spillwayDischarge = frame.reservoir.spillway_outflow_m3s || 0;
    }
    if (frame.sph) {
      threeSim.outletVelocity = frame.sph.mean_velocity_ms || 0;
    }
    if (frame.simulation) {
      threeSim.timeSeconds = frame.simulation.time_s || 0;
      threeSim.timeHours = frame.simulation.time_hours || 0;
    }
    if (frame.breach) {
      const status = frame.breach.status;
      if (status === "not_initiated") threeSim.phase = "STABLE";
      else if (status === "eroding") threeSim.phase = "BREACH_GROWTH";
      else if (status === "collapsed_slice") threeSim.phase = "FULL_FAILURE";
      else threeSim.phase = status || "STABLE";
    }
    threeSim.head = Math.max(0, threeSim.waterLevel -
      THREE_PHYSICS.breachElevation);
  }

  function isLiveMode() {
    return physicsStream.connected && physicsStream.latestFrame !== null;
  }

  function updatePhysicsBadge() {
    const badge = document.getElementById("physics-mode-badge");
    if (!badge) return;

    if (physicsStream.status === "live") {
      badge.className = "hud-badge hud-badge-live";
      badge.innerHTML = '<span class="badge-pulse-dot"></span> LIVE PHYSICS';
    } else if (physicsStream.status === "connecting") {
      badge.className = "hud-badge hud-badge-connecting";
      badge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> CONNECTING';
    } else {
      badge.className = "hud-badge hud-badge-offline";
      badge.innerHTML = '<i class="fa-solid fa-plug-circle-xmark"></i> OFFLINE DEMO';
    }
  }

  // Connect on page load (non-blocking)
  setTimeout(connectPhysicsStream, 500);
  setTimeout(connectDflowFmStream, 550);

  // ----------------------------------------------------------------------
  // Coordinate conversion helpers
  // ----------------------------------------------------------------------

  function physicalToSceneX(xMeters) {
    return xMeters * (THREE_PHYSICS.terrainSize / THREE_PHYSICS.terrainPhysicalWidth);
  }

  function physicalToSceneY(elevationMeters) {
    const verticalScale =
      (THREE_PHYSICS.terrainSize / THREE_PHYSICS.terrainPhysicalWidth) *
      THREE_PHYSICS.verticalExaggeration;

    return (elevationMeters - globalElevMin) * verticalScale;
  }

  function sceneToPhysicalX(xScene) {
    return xScene * (THREE_PHYSICS.terrainPhysicalWidth / THREE_PHYSICS.terrainSize);
  }

  function bilinearInterpolate(grid, x, y) {
    const rows = grid.length;
    const cols = grid[0].length;

    const cx = Math.max(0, Math.min(cols - 1, x));
    const cy = Math.max(0, Math.min(rows - 1, y));

    const x1 = Math.floor(cx);
    const x2 = Math.min(cols - 1, x1 + 1);
    const y1 = Math.floor(cy);
    const y2 = Math.min(rows - 1, y1 + 1);

    const dx = cx - x1;
    const dy = cy - y1;

    const q11 = grid[y1][x1];
    const q21 = grid[y1][x2];
    const q12 = grid[y2][x1];
    const q22 = grid[y2][x2];

    return (
      q11 * (1 - dx) * (1 - dy) +
      q21 * dx * (1 - dy) +
      q12 * (1 - dx) * dy +
      q22 * dx * dy
    );
  }

  function terrainElevationAtScene(x, z) {
    if (!threeTerrainData || !threeTerrainData.elevation_grid) {
      return globalElevMin;
    }

    const grid = threeTerrainData.elevation_grid;
    const rows = grid.length;
    const cols = grid[0].length;

    const gx =
      ((x - FM_SCENE_ANCHOR.x + THREE_PHYSICS.terrainSize / 2) / THREE_PHYSICS.terrainSize) *
      (cols - 1);

    const gy =
      ((z - FM_SCENE_ANCHOR.z + THREE_PHYSICS.terrainSize / 2) / THREE_PHYSICS.terrainSize) *
      (rows - 1);

    return bilinearInterpolate(grid, gx, gy);
  }

  // ----------------------------------------------------------------------
  // Scene initialization
  // ----------------------------------------------------------------------

  async function initThreeJsDigitalTwin() {
    if (isThreeInitialized) return;

    const container = document.getElementById("webgl-canvas");
    if (!container) return;

    try {
      // Load the selected scenario terrain when available, then fall back to
      // the explicitly named base terrain file.
      let terrainData = null;

      try {
        const scenarioKey = currentScenarioKey || "base";
        const scenarioResponse =
          await fetch(`terrain_3d_data_${scenarioKey}.json`);

        if (scenarioResponse.ok) {
          terrainData = await scenarioResponse.json();
        }
      } catch (scenarioError) {
        console.warn(
          "[3D] Scenario terrain unavailable; using base terrain.",
          scenarioError
        );
      }

      if (!terrainData) {
        const baseResponse = await fetch("terrain_3d_data_base.json");
        if (!baseResponse.ok) {
          throw new Error(
            `terrain_3d_data_base.json returned HTTP ${baseResponse.status}`
          );
        }
        terrainData = await baseResponse.json();
      }

      threeTerrainData = terrainData;

      // -------------------- Scene --------------------

      threeScene = new THREE.Scene();
      threeScene.background = new THREE.Color(0x040812);
      threeScene.fog = new THREE.FogExp2(0x040812, 0.0065);

      // -------------------- Camera --------------------

      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);

      threeCamera = new THREE.PerspectiveCamera(
        45,
        width / height,
        0.1,
        1000
      );

      threeCamera.position.set(0, 42, 76);

      // -------------------- Renderer --------------------

      threeRenderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
      });

      threeRenderer.setSize(width, height);
      threeRenderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 1.75)
      );

      threeRenderer.outputColorSpace = THREE.SRGBColorSpace;
      threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      threeRenderer.toneMappingExposure = 1.05;

      threeRenderer.shadowMap.enabled = true;
      threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

      container.innerHTML = "";
      container.appendChild(threeRenderer.domElement);

      // -------------------- Controls --------------------

      if (THREE.OrbitControls) {
        threeControls = new THREE.OrbitControls(
          threeCamera,
          threeRenderer.domElement
        );

        threeControls.enableDamping = true;
        threeControls.dampingFactor = 0.045;
        threeControls.minDistance = 12;
        threeControls.maxDistance = 150;
        threeControls.maxPolarAngle = Math.PI / 2 - 0.02;
        threeControls.target.set(0, 7, 0);
      }

      // -------------------- Lighting --------------------

      const hemi = new THREE.HemisphereLight(
        0x9ed8ff,
        0x111827,
        1.15
      );
      threeScene.add(hemi);

      const sun = new THREE.DirectionalLight(0xfff0d8, 2.25);
      sun.position.set(-55, 65, 35);
      sun.castShadow = true;

      sun.shadow.mapSize.width = 2048;
      sun.shadow.mapSize.height = 2048;
      sun.shadow.camera.left = -75;
      sun.shadow.camera.right = 75;
      sun.shadow.camera.top = 75;
      sun.shadow.camera.bottom = -75;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 180;
      sun.shadow.bias = -0.00035;

      threeScene.add(sun);

      const fill = new THREE.DirectionalLight(0x58bdf8, 0.65);
      fill.position.set(45, 25, -45);
      threeScene.add(fill);

      const rim = new THREE.DirectionalLight(0xffffff, 0.75);
      rim.position.set(0, 18, -70);
      threeScene.add(rim);

      // -------------------- Build scene --------------------

      buildAnalyticalTerrain(terrainData);
      buildPhysicalDam();
      buildHydraulicWater();
      buildWaterParticles();
      buildSprayParticles();
      buildFoamSystem();
      buildSceneMarkers();
      loadDflowFmWaterMesh();

      resetThreePhysics();

      setupCameraDirector();
      window.addEventListener("resize", onThreeWindowResize);

      isThreeInitialized = true;
      setupThreeKeyboardControls();

      if (!threeAnimationStarted) {
        threeAnimationStarted = true;
        threeLastWallTime = performance.now();
        requestAnimationFrame(animateThreeJs);
      }

      // Ensure the current dashboard time is represented immediately.
      updateThreeSimulation(currentTimeHours);
    } catch (error) {
      console.error("[3D] Digital twin initialization failed:", error);
      const fallback = document.getElementById("webgl-canvas");
      if (fallback) {
        fallback.innerHTML =
          `<div style="padding:24px;color:#fca5a5;font-family:monospace;">
             3D initialization failed. Check terrain_3d_data_base.json and Three.js dependencies.
           </div>`;
      }
    }
  }

  // ----------------------------------------------------------------------
  // Terrain
  // ----------------------------------------------------------------------

  function smoothStep(edge0, edge1, value) {
    const t = Math.max(
      0,
      Math.min(1, (value - edge0) / (edge1 - edge0))
    );
    return t * t * (3 - 2 * t);
  }

  function engineeredDamSiteElevation(x, z) {
    const damZ = -22;
    const damBase = THREE_PHYSICS.breachElevation - 5;
    let elevation;

    if (z < damZ) {
      // Upstream: a quiet reservoir basin that rises smoothly into its
      // valley shoulders instead of exposing high-frequency DEM noise.
      const upstreamDistance = damZ - z;
      elevation =
        damBase - 3.7 +
        0.012 * x * x +
        0.018 * upstreamDistance;
    } else {
      // Downstream: a graded valley with a defined channel issuing from the
      // breach. The channel bends gently toward the right bank.
      const downstreamDistance = z - damZ;
      const channelX = 15 + downstreamDistance * 0.045;
      const channelOffset = x - channelX;
      elevation =
        damBase - 0.075 * downstreamDistance +
        0.009 * channelOffset * channelOffset;
    }

    // The apron and abutment platform are deliberately level so the dam is
    // seated in a constructed site rather than on a lumpy raster surface.
    const damZone = 1 - smoothStep(3, 11, Math.abs(z - damZ));
    return elevation * (1 - damZone) + damBase * damZone;
  }

  function buildAnalyticalTerrain(terrainData) {
    const RES = 220;
    const SIZE = THREE_PHYSICS.terrainSize;

    const terrainGeo = new THREE.PlaneGeometry(
      SIZE,
      SIZE,
      RES - 1,
      RES - 1
    );

    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    terrainVertElevations = new Float32Array(pos.count);
    terrainVertDepths = new Float32Array(pos.count);

    const sourceGrid = terrainData.elevation_grid;
    const depthGrid = terrainData.depth_grid || null;

    // Terrain is the same conditioned DEM used to generate the FM mesh.
    // A renderer-only "engineered" surface would put water and ground in
    // different coordinate/elevation systems.
    const rows = sourceGrid.length;
    const cols = sourceGrid[0].length;
    const damRow = Math.round((rows - 1) * 0.5);
    const damCol = Math.round((cols - 1) * 0.5);
    const damFoundationElevation = sourceGrid[damRow][damCol];
    const grid = sourceGrid.map((row, rowIndex) => row.map((elevation, colIndex) => {
      const x = FM_SCENE_ANCHOR.x - SIZE / 2 + (colIndex / (cols - 1)) * SIZE;
      const z = FM_SCENE_ANCHOR.z - SIZE / 2 + (rowIndex / (rows - 1)) * SIZE;
      // The constructed footprint cuts into, rather than being occluded by,
      // the sampled terrain.  This is the display counterpart of the dam
      // foundation and eliminates terrain triangles through the dam body.
      const withinDamFootprint = x >= -55 && x <= 75 && Math.abs(z - FM_SCENE_ANCHOR.z) <= 11;
      return withinDamFootprint ? Math.min(elevation, damFoundationElevation) : elevation;
    }));

    threeTerrainData.elevation_grid = grid;
    globalElevMin = Math.min(
      ...grid.map(row => Math.min(...row))
    );
    const damGroundElevation = terrainElevationAtScene(15, -22);
    THREE_PHYSICS.breachElevation = damGroundElevation;
    THREE_PHYSICS.reservoirInitialLevel = damGroundElevation + 2.5;

    const low = new THREE.Color(0x242b2e);
    const mid = new THREE.Color(0x4b514f);
    const high = new THREE.Color(0x777c78);

    for (let i = 0; i < pos.count; i++) {
      const col = i % RES;
      const row = Math.floor(i / RES);

      const gx =
        (col / (RES - 1)) * (grid[0].length - 1);
      const gy =
        (row / (RES - 1)) * (grid.length - 1);

      const elevation = bilinearInterpolate(grid, gx, gy);
      const depth = depthGrid
        ? bilinearInterpolate(depthGrid, gx, gy)
        : 0;

      terrainVertElevations[i] = elevation;
      terrainVertDepths[i] = depth;

      pos.setY(i, physicalToSceneY(elevation));

      const normalized =
        Math.max(
          0,
          Math.min(
          1,
          (elevation - globalElevMin) / 32
          )
        );

      const c =
        normalized < 0.55
          ? low.clone().lerp(mid, normalized / 0.55)
          : mid.clone().lerp(high, (normalized - 0.55) / 0.45);

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    terrainGeo.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3)
    );

    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.02
    });

    terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.position.set(FM_SCENE_ANCHOR.x, 0, FM_SCENE_ANCHOR.z);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    threeScene.add(terrainMesh);

    // Solid presentation plinth.
    const baseThickness = 26;

    const baseGeo = new THREE.BoxGeometry(
      SIZE,
      baseThickness,
      SIZE
    );

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x05070b,
      roughness: 0.88,
      metalness: 0.05
    });

    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -baseThickness / 2 - 1.5;
    base.receiveShadow = true;
    threeScene.add(base);

    const edges = new THREE.EdgesGeometry(baseGeo);
    const edgeLines = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: 0x1f2937,
        transparent: true,
        opacity: 0.7
      })
    );
    base.add(edgeLines);
  }

  // ----------------------------------------------------------------------
  // Physical dam model
  //
  // The right embankment is divided into blocks around the breach opening.
  // This allows the opening to start tiny and physically/visually enlarge.
  // ----------------------------------------------------------------------

  function buildPhysicalDam() {
    damGroup = new THREE.Group();
    spillwayGateLeaves = [];
    spillwayFlowMeshes = [];

    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x9b9fa0,
      roughness: 0.82,
      metalness: 0.02
    });

    const concreteDarkMat = new THREE.MeshStandardMaterial({
      color: 0x596166,
      roughness: 0.88,
      metalness: 0.01
    });

    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x746a5d,
      roughness: 0.97,
      metalness: 0
    });

    const earthCutMat = new THREE.MeshStandardMaterial({
      color: 0x302a25,
      roughness: 1
    });

    const H = physicalToSceneY(
      globalElevMin + THREE_PHYSICS.damPhysicalHeight
    ) - physicalToSceneY(globalElevMin);

    const damBaseY = physicalToSceneY(
      terrainElevationAtScene(15, -22)
    );

    const crestY = damBaseY + H;

    const damZ = -22;
    const breachCenterX = 15;

    // Each section is a real embankment cross-section extruded along the
    // dam axis. This replaces the disconnected rectangular slabs.
    function addDamSection(xStart, length, material, isSpillway = false) {
      const profile = new THREE.Shape();
      const downstreamToe = isSpillway ? -3.6 : -4.8;
      const upstreamToe = isSpillway ? 3.8 : 4.8;
      const downstreamCrest = isSpillway ? -0.9 : -1.3;
      const upstreamCrest = isSpillway ? 1.15 : 1.3;
      profile.moveTo(downstreamToe, 0);
      profile.lineTo(upstreamToe, 0);
      profile.lineTo(upstreamCrest, H);
      profile.lineTo(downstreamCrest, H);
      profile.closePath();

      const geometry = new THREE.ExtrudeGeometry(profile, {
        depth: length,
        bevelEnabled: false
      });
      geometry.rotateY(Math.PI / 2);

      const section = new THREE.Mesh(geometry, material);
      section.position.set(xStart, damBaseY, damZ);
      section.castShadow = true;
      section.receiveShadow = true;
      damGroup.add(section);
      return section;
    }

    // Continuous earth embankments. The centre is a real open spillway,
    // assembled from piers, sill, and crest beam rather than a solid block.
    addDamSection(-30, 20, earthMat);
    addDamSection(8, 2, earthMat);
    breachLeftBlock = addDamSection(10, 5, earthMat);
    breachRightBlock = addDamSection(15, 5, earthMat);
    addDamSection(20, 10, earthMat);

    // Five actual through-bays extend from the reservoir face to the
    // downstream apron. Three gate leaves are raised clear of their openings.
    const gateMat = new THREE.MeshStandardMaterial({
      color: 0x34424a,
      roughness: 0.62,
      metalness: 0.55
    });
    const openingMat = new THREE.MeshStandardMaterial({
      color: 0x10191d,
      roughness: 0.95,
      metalness: 0
    });
    const openGateIndices = new Set([1, 2, 3]);
    const gateWidth = 2.42;
    const gateHeight = H * 0.48;
    const openingCenterY = damBaseY + H * 0.34;
    const openingTopY = openingCenterY + gateHeight * 0.5;

    const spillwaySill = new THREE.Mesh(
      new THREE.BoxGeometry(18.0, 0.22, 9.0),
      concreteMat
    );
    spillwaySill.position.set(-1, damBaseY + 0.11, damZ);
    spillwaySill.receiveShadow = true;
    damGroup.add(spillwaySill);

    const spillwayCrestBeam = new THREE.Mesh(
      new THREE.BoxGeometry(18.0, 0.35, 9.0),
      concreteMat
    );
    spillwayCrestBeam.position.set(-1, damBaseY + H * 0.77, damZ);
    spillwayCrestBeam.castShadow = true;
    damGroup.add(spillwayCrestBeam);

    for (let index = 0; index < 5; index++) {
      const x = -8 + index * 3.2;
      // Two inner side walls define a genuine unobstructed passage through
      // the dam; there is deliberately no back-face panel in this bay.
      for (const side of [-1, 1]) {
        const innerWall = new THREE.Mesh(
          new THREE.BoxGeometry(0.10, gateHeight, 8.6),
          openingMat
        );
        innerWall.position.set(
          x + side * (gateWidth * 0.5 - 0.05),
          openingCenterY,
          damZ
        );
        damGroup.add(innerWall);
      }

      const channelFloor = new THREE.Mesh(
        new THREE.BoxGeometry(gateWidth, 0.08, 8.6),
        concreteDarkMat
      );
      channelFloor.position.set(x, damBaseY + 0.27, damZ);
      damGroup.add(channelFloor);

      const gate = new THREE.Mesh(
        new THREE.BoxGeometry(gateWidth * 0.88, gateHeight, 0.22),
        gateMat
      );
      const isOpen = openGateIndices.has(index);
      gate.position.set(
        x,
        isOpen ? openingTopY + gateHeight * 0.5 + 0.08 : openingCenterY,
        damZ - 4.36
      );
      gate.castShadow = true;
      gate.userData.openFraction = isOpen ? 1 : 0;
      spillwayGateLeaves.push(gate);
      damGroup.add(gate);

      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(0.30, H * 0.82, 9.0),
        concreteMat
      );
      pier.position.set(x - 1.36, damBaseY + H * 0.41, damZ);
      pier.castShadow = true;
      damGroup.add(pier);

      // Hoist housing identifies each bay as a working sluice gate.
      const hoist = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.34, 0.58),
        concreteDarkMat
      );
      hoist.position.set(x, crestY + 0.38, damZ + 1.35);
      hoist.castShadow = true;
      damGroup.add(hoist);

      if (isOpen) {
        // Renderer-only representation of water released by the backend's
        // sluice-gate equation. It has no local velocity or discharge logic.
        const flowMaterial = makeReservoirWaterMaterial();
        flowMaterial.uniforms.uOpacity.value = 0.78;

        const channelFlow = new THREE.Mesh(
          new THREE.PlaneGeometry(gateWidth * 0.78, 8.35),
          flowMaterial
        );
        channelFlow.rotation.x = -Math.PI / 2;
        // Gate leaves are on the negative-Z face; route the visible ribbon
        // away from that downstream face, never back into the reservoir.
        channelFlow.position.set(x, damBaseY + 0.34, damZ - 8.5);
        channelFlow.visible = false;
        channelFlow.renderOrder = 4;
        channelFlow.userData.flowKind = "channel";
        channelFlow.userData.baseWidth = gateWidth * 0.78;
        damGroup.add(channelFlow);
        spillwayFlowMeshes.push(channelFlow);

        const outletFlow = new THREE.Mesh(
          new THREE.PlaneGeometry(gateWidth * 0.78, H * 0.52),
          flowMaterial
        );
        outletFlow.position.set(
          x,
          damBaseY + H * 0.34,
          damZ - 4.34
        );
        outletFlow.visible = false;
        outletFlow.renderOrder = 4;
        outletFlow.userData.flowKind = "outlet";
        outletFlow.userData.baseWidth = gateWidth * 0.78;
        damGroup.add(outletFlow);
        spillwayFlowMeshes.push(outletFlow);
      }
    }

    const endPier = new THREE.Mesh(
      new THREE.BoxGeometry(0.30, H * 0.82, 9.0),
      concreteMat
    );
    endPier.position.set(6.96, damBaseY + H * 0.41, damZ);
    endPier.castShadow = true;
    damGroup.add(endPier);

    // A visible, continuous crest road is broken only across the active
    // breach sector. Its parapets make the structure read as a dam at range.
    function addCrestSegment(xStart, length) {
      const road = new THREE.Mesh(
        new THREE.BoxGeometry(length, 0.16, 2.6),
        concreteMat
      );
      road.position.set(xStart + length / 2, crestY + 0.08, damZ);
      road.castShadow = true;
      road.receiveShadow = true;
      damGroup.add(road);

      for (const zOffset of [-1.05, 1.05]) {
        const parapet = new THREE.Mesh(
          new THREE.BoxGeometry(length, 0.24, 0.14),
          concreteDarkMat
        );
        parapet.position.set(xStart + length / 2, crestY + 0.25, damZ + zOffset);
        damGroup.add(parapet);
      }
    }

    addCrestSegment(-30, 40);
    addCrestSegment(20, 10);

    breachCavity = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 8.8),
      earthCutMat
    );
    breachCavity.position.set(breachCenterX, damBaseY + H * 0.34, damZ);
    breachCavity.visible = true;
    damGroup.add(breachCavity);

    breachCrest = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.16, 2.6),
      concreteMat
    );
    breachCrest.position.set(breachCenterX, crestY + 0.08, damZ);
    breachCrest.castShadow = true;
    damGroup.add(breachCrest);

    const foundation = new THREE.Mesh(
      new THREE.BoxGeometry(62, 0.32, 10.2),
      concreteDarkMat
    );
    foundation.position.set(0, damBaseY - 0.16, damZ);
    foundation.castShadow = true;
    foundation.receiveShadow = true;
    damGroup.add(foundation);

    const downstreamApron = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.12, 5.5),
      concreteDarkMat
    );
    downstreamApron.position.set(-1, damBaseY + 0.02, damZ + 6.4);
    downstreamApron.receiveShadow = true;
    damGroup.add(downstreamApron);

    threeScene.add(damGroup);
  }

  // ----------------------------------------------------------------------
  // Water surface shader
  // ----------------------------------------------------------------------

  function makeWaterMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.82 },
        uDeepColor: {
          value: new THREE.Color(0x075985)
        },
        uShallowColor: {
          value: new THREE.Color(0x38bdf8)
        }
      },

      vertexShader: `
        uniform float uTime;

        varying vec2 vUv;
        varying float vWave;

        void main() {
          vUv = uv;

          vec3 p = position;

          float w1 = sin(p.x * 0.65 + uTime * 1.15);
          float w2 = cos(p.z * 0.48 + uTime * 0.82);
          float w3 = sin((p.x + p.z) * 0.23 + uTime * 0.55);

          float wave = (w1 * 0.045) + (w2 * 0.035) + (w3 * 0.025);
          p.y += wave;
          vWave = wave;

          gl_Position =
            projectionMatrix *
            modelViewMatrix *
            vec4(p, 1.0);
        }
      `,

      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;

        varying vec2 vUv;
        varying float vWave;

        void main() {
          float fresnel =
            pow(
              1.0 - abs(dot(normalize(vWorldPosition), vec3(0.0,1.0,0.0))),
              2.0
            );

          vec3 color =
            mix(uDeepColor, uShallowColor, 0.30 + fresnel * 0.45);

          float highlight =
            smoothstep(
              0.01,
              0.06,
              abs(vWave)
            );

          color += highlight * 0.045;

          gl_FragColor =
            vec4(color, uOpacity);
        }
      `
    });
  }

  // The fragment shader above needs world position; create a corrected
  // material here so the shader remains self-contained.
  function makeReservoirWaterMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.72 },
        uColor: {
          value: new THREE.Color(0x0b7ea4)
        },
        uFoam: {
          value: new THREE.Color(0xbdeeff)
        }
      },

      vertexShader: `
        uniform float uTime;

        varying vec3 vWorldPos;
        varying float vWave;

        void main() {
          vec3 p = position;

          float w1 = sin(p.x * 0.72 + uTime * 1.20);
          float w2 = cos(p.z * 0.53 + uTime * 0.91);
          float w3 = sin((p.x - p.z) * 0.24 + uTime * 0.48);

          vWave =
            w1 * 0.045 +
            w2 * 0.035 +
            w3 * 0.025;

          p.y += vWave;

          vec4 world =
            modelMatrix * vec4(p, 1.0);

          vWorldPos = world.xyz;

          gl_Position =
            projectionMatrix *
            viewMatrix *
            world;
        }
      `,

      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uColor;
        uniform vec3 uFoam;

        varying vec3 vWorldPos;
        varying float vWave;

        void main() {
          vec3 viewDir =
            normalize(cameraPosition - vWorldPos);

          float fresnel =
            pow(
              1.0 - max(
                0.0,
                dot(viewDir, vec3(0.0,1.0,0.0))
              ),
              3.0
            );

          float crest =
            smoothstep(0.025, 0.07, abs(vWave));

          vec3 color =
            mix(uColor, uFoam, fresnel * 0.22 + crest * 0.08);

          gl_FragColor =
            vec4(color, uOpacity);
        }
      `
    });
  }

  // ----------------------------------------------------------------------
  // Reservoir and downstream water geometry
  // ----------------------------------------------------------------------

  function buildHydraulicWater() {
    const SIZE = THREE_PHYSICS.terrainSize;

    // This is deliberately a bounded upstream reservoir footprint, not a
    // terrain-sized flood plane.  Live water outside this polygon must come
    // from a real downstream depth grid, which the current backend does not
    // provide yet.
    // Full upstream basin – extends to the terrain boundary on all sides so
    // there are no gaps between the water surface and the valley walls.
    // The near edge meets the upstream dam face at Z ≈ -24.9 (scene units).
    const reservoirShape = new THREE.Shape();
    reservoirShape.moveTo(-62, 62);   // far-left  corner of terrain
    reservoirShape.lineTo( 62, 62);   // far-right corner
    reservoirShape.lineTo( 62, 40);   // right mid
    reservoirShape.lineTo( 32, 24.9); // right dam shoulder
    reservoirShape.lineTo(-30, 24.9); // left  dam shoulder
    reservoirShape.lineTo(-62, 40);   // left  mid
    reservoirShape.closePath();

    const reservoirGeo = new THREE.ShapeGeometry(reservoirShape);
    reservoirGeo.rotateX(-Math.PI / 2);

    waterMesh = new THREE.Mesh(
      reservoirGeo,
      makeReservoirWaterMaterial()
    );

    waterMesh.position.set(
      0,
      physicalToSceneY(THREE_PHYSICS.reservoirInitialLevel),
      0
    );

    waterMesh.renderOrder = 2;
    threeScene.add(waterMesh);

    // Downstream water is a separate shallow layer. It grows only where
    // the reduced-order flood state says water has reached.
    const downstreamGeo = new THREE.PlaneGeometry(
      SIZE,
      SIZE,
      160,
      160
    );

    downstreamGeo.rotateX(-Math.PI / 2);

    downstreamWaterMesh = new THREE.Mesh(
      downstreamGeo,
      makeReservoirWaterMaterial()
    );

    downstreamWaterMesh.position.y =
      physicalToSceneY(globalElevMin) - 0.01;

    downstreamWaterMesh.scale.set(
      1,
      1,
      1
    );

    downstreamWaterMesh.visible = false;
    downstreamWaterMesh.renderOrder = 1;

    threeScene.add(downstreamWaterMesh);
  }

  async function loadDflowFmWaterMesh() {
    try {
      const response = await fetch("delft3d_fm_latest.json", { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json();
      if (!result.coordinate_bounds || !Array.isArray(result.frames)) return;
      dflowFmResult = result;
      dflowFmFrameIndex = -1;
      // Keep an always-wet visual state.  The zero-time FM state is dry by
      // definition and looked like the water had vanished between replay
      // loops rather than like an advancing flood front.
      const firstWet = result.frames.find(frame =>
        Array.isArray(frame.wet_cells) && frame.wet_cells.length > 0
      );
      dflowFmReplaySeconds = dflowFmStream.pendingTime ?? (firstWet ? firstWet.time_s : 0);
      updateDflowFmWaterFrame(dflowFmReplaySeconds);
    } catch (error) {
      console.warn("[D-Flow FM] wet-cell render unavailable:", error);
    }
  }

  function updateDflowFmWaterFrame(timeSeconds) {
    if (!dflowFmResult || !dflowFmResult.frames) return;
    const frames = dflowFmResult.frames;
    let index = 0;
    for (let i = 1; i < frames.length; i++) {
      if (frames[i].time_s > timeSeconds) break;
      index = i;
    }
    if (index === dflowFmFrameIndex) return;
    dflowFmFrameIndex = index;
    const frame = frames[index];
    const cells = frame.wet_cells || [];
    const bounds = dflowFmResult.coordinate_bounds;
    if (!cells.length) {
      if (dflowFmWaterMesh) dflowFmWaterMesh.visible = false;
      if (dflowFmFlowPoints) dflowFmFlowPoints.visible = false;
      return;
    }

      const originX = (bounds.min_x + bounds.max_x) * 0.5;
      const originY = (bounds.min_y + bounds.max_y) * 0.5;
      const scale = THREE_PHYSICS.terrainSize / THREE_PHYSICS.terrainPhysicalWidth;
      const positions = [];
      const colors = [];
      const flowPositions = [];
      dflowFmFlowState = [];

      for (const cell of cells) {
        const corners = cell.corners || [];
        if (corners.length < 3 || !(cell.depth_m > 0.01)) continue;
        const speed = Math.min(1, Math.max(0, cell.velocity_ms / 4));
        const color = new THREE.Color().setHSL(0.55 - speed * 0.07, 0.78, 0.42 + speed * 0.08);
        const sceneCorners = corners.map(([x, y]) => [
          FM_SCENE_ANCHOR.x + (x - originX) * scale,
          0,
          FM_SCENE_ANCHOR.z - (y - originY) * scale,
        ]);
        // FM values are cell-centred (200 m in this run), whereas the
        // displayed DEM retains finer relief.  Render at the physical FM
        // level, but never let an intermediate terrain vertex protrude
        // through a wet solver cell.
        sceneCorners.forEach(corner => {
          const displayedGround = terrainElevationAtScene(corner[0], corner[2]);
          corner[1] = physicalToSceneY(
            Math.max(cell.surface_elevation_m, displayedGround + Math.min(cell.depth_m, 0.05))
          ) + 0.02;
        });
        for (let i = 1; i < sceneCorners.length - 1; i++) {
          for (const vertex of [sceneCorners[0], sceneCorners[i], sceneCorners[i + 1]]) {
            positions.push(...vertex);
            colors.push(color.r, color.g, color.b);
          }
        }
        const center = sceneCorners.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]], [0, 0, 0]).map(value => value / sceneCorners.length);
        flowPositions.push(...center);
        dflowFmFlowState.push({
          center,
          vx: (cell.velocity_x_ms || 0) * scale,
          vz: -(cell.velocity_y_ms || 0) * scale,
        });
      }

      if (!positions.length) return;
      if (dflowFmWaterMesh) {
        threeScene.remove(dflowFmWaterMesh);
        dflowFmWaterMesh.geometry.dispose();
        dflowFmWaterMesh.material.dispose();
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      dflowFmWaterMesh = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.78,
        roughness: 0.16,
        metalness: 0.04,
        side: THREE.DoubleSide,
        depthWrite: false,
      }));
      dflowFmWaterMesh.renderOrder = 3;
      threeScene.add(dflowFmWaterMesh);
      if (dflowFmFlowPoints) {
        threeScene.remove(dflowFmFlowPoints);
        dflowFmFlowPoints.geometry.dispose();
        dflowFmFlowPoints.material.dispose();
      }
      const flowGeometry = new THREE.BufferGeometry();
      flowGeometry.setAttribute("position", new THREE.Float32BufferAttribute(flowPositions, 3));
      dflowFmFlowPoints = new THREE.Points(flowGeometry, new THREE.PointsMaterial({
        color: 0xe0f7ff, size: 0.18, transparent: true, opacity: 0.9,
        depthWrite: false, sizeAttenuation: true,
      }));
      dflowFmFlowPoints.renderOrder = 4;
      // Velocity vectors are exported for analytics, not rendered as a
      // cyan lattice in the water scene.
      dflowFmFlowPoints.visible = false;
      threeScene.add(dflowFmFlowPoints);
      dflowFmWaterLoaded = true;
      // FM begins at the dam outlet in the present domain; its wet cells do
      // not replace the upstream reservoir surface.
      if (waterMesh) waterMesh.visible = true;
      if (downstreamWaterMesh) downstreamWaterMesh.visible = false;
      console.info(`[D-Flow FM] rendered ${cells.length} wet cells at ${frame.time_s}s`);
  }

  function advanceDflowFmReplay(wallDt) {
    if (dflowFmStream.frameDriven) return;
    if (!dflowFmResult || !dflowFmResult.frames || dflowFmResult.frames.length < 2) return;
    const firstWet = dflowFmResult.frames.find(frame =>
      Array.isArray(frame.wet_cells) && frame.wet_cells.length > 0
    );
    const firstTime = firstWet ? firstWet.time_s : 0;
    const lastTime = dflowFmResult.frames[dflowFmResult.frames.length - 1].time_s;
    // A ten-second loop replays the actual FM output timesteps. It is a
    // visualization clock only; it never changes the solver fields.
    dflowFmReplaySeconds += wallDt * 300;
    if (dflowFmReplaySeconds > lastTime) {
      dflowFmReplaySeconds = firstTime;
    }
    updateDflowFmWaterFrame(dflowFmReplaySeconds);
    if (!dflowFmFlowPoints) return;
    const positions = dflowFmFlowPoints.geometry.attributes.position.array;
    dflowFmFlowState.forEach((flow, index) => {
      const phase = (dflowFmReplaySeconds * 0.7 + index * 0.37) % 1;
      positions[index * 3] = flow.center[0] + flow.vx * phase * 3;
      positions[index * 3 + 1] = flow.center[1] + 0.03;
      positions[index * 3 + 2] = flow.center[2] + flow.vz * phase * 3;
    });
    dflowFmFlowPoints.geometry.attributes.position.needsUpdate = true;
  }

  // ----------------------------------------------------------------------
  // GPU-friendly main water particles
  // ----------------------------------------------------------------------

  const mainParticles = {
    points: null,
    positions: null,
    velocities: null,
    ages: null,
    life: null,
    sizes: null,
    seed: null
  };

  function buildWaterParticles() {
    const count = THREE_PHYSICS.mainParticleCount;

    mainParticles.positions =
      new Float32Array(count * 3);

    mainParticles.velocities =
      new Float32Array(count * 3);

    mainParticles.ages =
      new Float32Array(count);

    mainParticles.life =
      new Float32Array(count);

    mainParticles.sizes =
      new Float32Array(count);

    mainParticles.seed =
      new Float32Array(count);

    for (let i = 0; i < count; i++) {
      mainParticles.ages[i] = 999;
      mainParticles.life[i] = 1;
      mainParticles.sizes[i] =
        0.035 + Math.random() * 0.055;
      mainParticles.seed[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();

    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(
        mainParticles.positions,
        3
      )
    );

    geo.setAttribute(
      "aSize",
      new THREE.BufferAttribute(
        mainParticles.sizes,
        1
      )
    );

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uColor: {
          value: new THREE.Color(0x9eeaff)
        }
      },

      vertexShader: `
        attribute float aSize;

        varying float vDepth;

        void main() {
          vec4 mvPosition =
            modelViewMatrix *
            vec4(position, 1.0);

          gl_PointSize =
            aSize *
            (170.0 / max(1.0, -mvPosition.z));

          gl_Position =
            projectionMatrix *
            mvPosition;

          vDepth = -mvPosition.z;
        }
      `,

      fragmentShader: `
        uniform vec3 uColor;

        void main() {
          vec2 p =
            gl_PointCoord - vec2(0.5);

          float d =
            length(p);

          if (d > 0.5) discard;

          float alpha =
            smoothstep(0.5, 0.04, d);

          gl_FragColor =
            vec4(uColor, alpha * 0.78);
        }
      `
    });

    mainParticles.points =
      new THREE.Points(geo, mat);

    mainParticles.points.frustumCulled = false;
    mainParticles.points.renderOrder = 5;

    threeScene.add(mainParticles.points);
  }

  // ----------------------------------------------------------------------
  // GPU-friendly spray particles
  // ----------------------------------------------------------------------

  const sprayParticles = {
    points: null,
    positions: null,
    velocities: null,
    ages: null,
    life: null,
    sizes: null
  };

  function buildSprayParticles() {
    const count = THREE_PHYSICS.sprayParticleCount;

    sprayParticles.positions =
      new Float32Array(count * 3);

    sprayParticles.velocities =
      new Float32Array(count * 3);

    sprayParticles.ages =
      new Float32Array(count);

    sprayParticles.life =
      new Float32Array(count);

    sprayParticles.sizes =
      new Float32Array(count);

    for (let i = 0; i < count; i++) {
      sprayParticles.ages[i] = 999;
      sprayParticles.life[i] = 1;
      sprayParticles.sizes[i] =
        0.02 + Math.random() * 0.045;
    }

    const geo = new THREE.BufferGeometry();

    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(
        sprayParticles.positions,
        3
      )
    );

    geo.setAttribute(
      "aSize",
      new THREE.BufferAttribute(
        sprayParticles.sizes,
        1
      )
    );

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,

      uniforms: {
        uColor: {
          value: new THREE.Color(0xe7f8ff)
        }
      },

      vertexShader: `
        attribute float aSize;

        void main() {
          vec4 mv =
            modelViewMatrix *
            vec4(position, 1.0);

          gl_PointSize =
            aSize *
            (180.0 / max(1.0, -mv.z));

          gl_Position =
            projectionMatrix *
            mv;
        }
      `,

      fragmentShader: `
        uniform vec3 uColor;

        void main() {
          vec2 p =
            gl_PointCoord - 0.5;

          float d =
            length(p);

          if (d > 0.5) discard;

          float a =
            smoothstep(0.5, 0.05, d);

          gl_FragColor =
            vec4(uColor, a * 0.55);
        }
      `
    });

    sprayParticles.points =
      new THREE.Points(geo, mat);

    sprayParticles.points.frustumCulled = false;
    sprayParticles.points.renderOrder = 6;

    threeScene.add(sprayParticles.points);
  }

  // ----------------------------------------------------------------------
  // Foam: cheap animated impact ring
  // ----------------------------------------------------------------------

  function buildFoamSystem() {
    const geo = new THREE.RingGeometry(
      0.6,
      1.2,
      64
    );

    const mat = new THREE.MeshBasicMaterial({
      color: 0xd9f8ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    impactFoam = new THREE.Mesh(
      geo,
      mat
    );

    impactFoam.rotation.x = -Math.PI / 2;
    impactFoam.position.set(
      15,
      physicalToSceneY(THREE_PHYSICS.breachElevation - 4) + 0.05,
      -13
    );

    impactFoam.visible = false;
    impactFoam.renderOrder = 7;

    threeScene.add(impactFoam);
  }

  function buildSceneMarkers() {
    // Subtle reservoir surface marker for orientation.
    const markerGeo =
      new THREE.SphereGeometry(0.12, 12, 12);

    const markerMat =
      new THREE.MeshBasicMaterial({
        color: 0x00d9ff
      });

    reservoirMarker =
      new THREE.Mesh(markerGeo, markerMat);

    reservoirMarker.position.set(
      0,
      physicalToSceneY(THREE_PHYSICS.reservoirInitialLevel) + 0.15,
      -45
    );

    reservoirMarker.visible = false;
    threeScene.add(reservoirMarker);
  }

  // ----------------------------------------------------------------------
  // Hydraulic model
  // ----------------------------------------------------------------------

  function scenarioFinalBreachWidth(sc) {
    if (!sc) return THREE_PHYSICS.finalBreachWidth;

    return Math.max(
      30,
      sc.b_avg || THREE_PHYSICS.finalBreachWidth
    );
  }

  function resetThreePhysics() {
    const sc =
      PIPELINE_DATA.scenarios[currentScenarioKey] ||
      PIPELINE_DATA.scenarios.base;

    threeSim.timeHours = 0;
    threeSim.timeSeconds = 0;

    threeSim.reservoirInitialVolume =
      PIPELINE_DATA.gross_storage_mcm * 1.0e6;

    threeSim.reservoirVolume =
      threeSim.reservoirInitialVolume;

    threeSim.waterLevel =
      THREE_PHYSICS.reservoirInitialLevel;

    threeSim.discharge = 0;
    threeSim.spillwayDischarge = 0;
    threeSim.breachWidth =
      THREE_PHYSICS.initialBreachWidth;

    threeSim.breachHeight =
      THREE_PHYSICS.initialBreachHeight;

    threeSim.breachBottomElevation =
      THREE_PHYSICS.breachElevation;

    threeSim.breachArea =
      threeSim.breachWidth *
      threeSim.breachHeight;

    threeSim.head = 0;
    threeSim.outletVelocity = 0;
    threeSim.phase = "STABLE";
    threeSim.initializedPhysics = true;

    // Clear particles.
    resetParticleArrays();

    // Reposition water.
    if (waterMesh) {
      waterMesh.position.y =
        physicalToSceneY(
          threeSim.waterLevel
        );
    }

    if (downstreamWaterMesh) {
      downstreamWaterMesh.visible = false;
    }

    for (const flow of spillwayFlowMeshes) {
      flow.visible = false;
    }

    if (impactFoam) {
      impactFoam.visible = false;
      impactFoam.scale.setScalar(1);
    }

    // Ensure breach starts essentially closed.
    updateDamBreachVisual();
  }

  function resetParticleArrays() {
    if (mainParticles.ages) {
      mainParticles.ages.fill(999);

      mainParticles.positions.fill(0);
      mainParticles.velocities.fill(0);
    }

    if (sprayParticles.ages) {
      sprayParticles.ages.fill(999);

      sprayParticles.positions.fill(0);
      sprayParticles.velocities.fill(0);
    }
  }

  function calculateHydraulics(dt) {
    const sc =
      PIPELINE_DATA.scenarios[currentScenarioKey] ||
      PIPELINE_DATA.scenarios.base;

    const t = threeSim.timeHours;

    // Before overtopping/breach initiation there is no breach discharge.
    if (t < THREE_PHYSICS.breachStartHour) {
      threeSim.breachWidth =
        THREE_PHYSICS.initialBreachWidth;

      threeSim.breachHeight =
        THREE_PHYSICS.initialBreachHeight;

      threeSim.discharge = 0;
      threeSim.head = Math.max(
        0,
        threeSim.waterLevel -
        THREE_PHYSICS.breachElevation
      );

      threeSim.outletVelocity = 0;
      threeSim.phase = "STABLE";
      return;
    }

    // Breach growth is smooth and bounded by the scenario's reported
    // average breach width. The dashboard scenario remains authoritative
    // for its final Qpeak and impact metrics.
    const targetWidth =
      scenarioFinalBreachWidth(sc);

    const normalized =
      Math.max(
        0,
        Math.min(
          1,
          (t - THREE_PHYSICS.breachStartHour) /
          Math.max(
            0.01,
            sc.t_f
          )
        )
      );

    // Cubic easing creates a small initial hole followed by rapid widening.
    const growth =
      normalized * normalized *
      (3 - 2 * normalized);

    threeSim.breachWidth =
      THREE_PHYSICS.initialBreachWidth +
      (targetWidth -
        THREE_PHYSICS.initialBreachWidth) *
      growth;

    // Breach depth grows from a small notch toward a bounded visual opening.
    threeSim.breachHeight =
      THREE_PHYSICS.initialBreachHeight +
      (THREE_PHYSICS.finalBreachHeight -
        THREE_PHYSICS.initialBreachHeight) *
      Math.pow(normalized, 1.35);

    threeSim.breachArea =
      Math.max(
        0.01,
        threeSim.breachWidth *
        threeSim.breachHeight
      );

    threeSim.head =
      Math.max(
        0,
        threeSim.waterLevel -
        THREE_PHYSICS.breachElevation
      );

    // Pressure at the breach.
    const pressure =
      THREE_PHYSICS.waterDensity *
      THREE_PHYSICS.gravity *
      threeSim.head;

    // Pressure-derived velocity.
    const theoreticalVelocity =
      Math.sqrt(
        Math.max(
          0,
          (2 * pressure) /
          THREE_PHYSICS.waterDensity
        )
      );

    threeSim.outletVelocity =
      Math.min(
        THREE_PHYSICS.maxParticleSpeed,
        theoreticalVelocity
      );

    // Hydraulic discharge.
    const rawQ =
      THREE_PHYSICS.dischargeCoefficient *
      threeSim.breachArea *
      threeSim.outletVelocity;

    // Couple the visualization to the supplied scenario Qpeak.
    // The hydraulic equation determines the shape/response; the scenario
    // peak caps the rendered/dashboard-consistent event magnitude.
    const targetPeak =
      Math.max(
        1,
        sc.q_peak
      );

    const peakScale =
      targetPeak /
      Math.max(
        targetPeak,
        rawQ
      );

    threeSim.discharge =
      Math.min(
        targetPeak,
        rawQ / Math.max(0.25, peakScale)
      );

    // During early failure, use the actual hydraulic discharge. After
    // the scenario's failure time, smoothly transition toward the supplied
    // scenario hydrograph so the 3D model remains consistent with the
    // dashboard's published Qpeak.
    const dashboardQ =
      t <= sc.t_f
        ? sc.q_peak *
          Math.pow(
            Math.max(0, t / Math.max(0.01, sc.t_f)),
            1.8
          )
        : Math.max(
            300,
            sc.q_peak *
            Math.exp(
              -(t - sc.t_f) / 4.5
            )
          );

    const hydraulicBlend =
      Math.max(
        0,
        Math.min(
          1,
          t / Math.max(0.2, sc.t_f * 0.55)
        )
      );

    threeSim.discharge =
      THREE_PHYSICS.dischargeCoefficient *
      rawQ *
      (1 - hydraulicBlend) +
      dashboardQ *
      hydraulicBlend;

    threeSim.discharge =
      Math.min(
        sc.q_peak,
        Math.max(
          0,
          threeSim.discharge
        )
      );

    // Convert discharge to a scene-level reservoir-volume loss.
    // This is a reduced-order local storage balance.
    const volumeOut =
      threeSim.discharge * dt;

    threeSim.reservoirVolume =
      Math.max(
        0,
        threeSim.reservoirVolume -
        volumeOut
      );

    // Convert storage fraction to water-level decline.
    // This is intentionally stable for a dashboard-scale model.
    const storageFraction =
      threeSim.reservoirVolume /
      Math.max(
        1,
        threeSim.reservoirInitialVolume
      );

    const initialHead =
      THREE_PHYSICS.reservoirInitialLevel -
      globalElevMin;

    const minimumLevel =
      THREE_PHYSICS.breachElevation + 0.5;

    threeSim.waterLevel =
      minimumLevel +
      initialHead *
      Math.max(
        0,
        Math.min(1, storageFraction)
      );

    if (t < THREE_PHYSICS.breachStartHour) {
      threeSim.phase = "STABLE";
    } else if (t < sc.t_f * 0.55) {
      threeSim.phase = "BREACH_INITIATION";
    } else if (t < sc.t_f) {
      threeSim.phase = "BREACH_GROWTH";
    } else {
      threeSim.phase = "FULL_FAILURE";
    }
  }

  // ----------------------------------------------------------------------
  // Dam breach visual deformation
  // ----------------------------------------------------------------------

  function updateDamBreachVisual() {
    if (
      !damGroup ||
      !breachLeftBlock ||
      !breachRightBlock ||
      !breachCavity ||
      !breachCrest
    ) {
      return;
    }

    const initialW =
      THREE_PHYSICS.initialBreachWidth;

    const finalW =
      Math.max(
        initialW,
        threeSim.breachWidth
      );

    const visualMaxWidth = 9.0;

    const visualWidth =
      Math.min(
        visualMaxWidth,
        Math.max(
          0.12,
          finalW * 0.06
        )
      );

    const centerX = 15.0;

    // The two tapered embankment sections begin edge-to-edge at X=15 and
    // separate around the breach without breaking the rest of the dam.
    const separation =
      (visualWidth - 0.12) * 0.5;

    breachLeftBlock.position.x =
      10 - separation;

    breachRightBlock.position.x =
      15 + separation;

    const damBaseY = physicalToSceneY(
      terrainElevationAtScene(15, -22)
    );
    const damHeight = physicalToSceneY(
      globalElevMin + THREE_PHYSICS.damPhysicalHeight
    ) - physicalToSceneY(globalElevMin);

    // Breach cavity grows inside the embankment profile, not as a detached
    // box floating above the foundation.
    const visualHeight =
      damHeight * Math.max(
        0.15,
        Math.min(
          0.88,
          threeSim.breachHeight /
          THREE_PHYSICS.damPhysicalHeight
        )
      );

    breachCavity.scale.set(
      Math.max(0.2, visualWidth),
      Math.max(0.2, visualHeight),
      1
    );

    breachCavity.position.set(
      centerX,
      damBaseY + visualHeight * 0.5,
      -22
    );

    // The crest remnant progressively breaks and tilts.
    const progress =
      Math.max(
        0,
        Math.min(
          1,
          (threeSim.breachWidth - initialW) /
          Math.max(
            0.01,
            THREE_PHYSICS.finalBreachWidth -
            initialW
          )
        )
      );

    breachCrest.scale.x =
      Math.max(
        0.15,
        1 - progress * 0.82
      );

    breachCrest.rotation.z =
      -progress * 0.18;

    breachCrest.position.x = centerX;
  }

  // ----------------------------------------------------------------------
  // Particle spawn/update
  // ----------------------------------------------------------------------

  function getBreachOrigin() {
    const x = 15.0;

    const y =
      physicalToSceneY(
        THREE_PHYSICS.breachElevation
      ) -
      0.8;

    const z = -18.5;

    return new THREE.Vector3(x, y, z);
  }

  function respawnMainParticle(i) {
    const origin = getBreachOrigin();

    const j = i * 3;

    const spreadX =
      (Math.random() - 0.5) *
      Math.max(
        0.15,
        Math.min(
          5,
          threeSim.breachWidth * 0.025
        )
      );

    const spreadY =
      Math.random() *
      0.75;

    const spreadZ =
      (Math.random() - 0.5) *
      1.2;

    mainParticles.positions[j] =
      origin.x + spreadX;

    mainParticles.positions[j + 1] =
      origin.y + spreadY;

    mainParticles.positions[j + 2] =
      origin.z + spreadZ;

    // Convert physical outlet velocity to a visually useful scene velocity.
    const v =
      Math.min(
        22,
        1.5 +
        threeSim.outletVelocity *
        0.23
      );

    // Predominantly downstream (-Z), with a slight lateral spread.
    mainParticles.velocities[j] =
      (Math.random() - 0.5) *
      v *
      0.35;

    mainParticles.velocities[j + 1] =
      v *
      (0.12 + Math.random() * 0.20);

    mainParticles.velocities[j + 2] =
      -v *
      (0.65 + Math.random() * 0.25);

    mainParticles.ages[i] = 0;
    mainParticles.life[i] =
      1.8 +
      Math.random() * 4.5;
  }

  function respawnSprayParticle(i) {
    const origin = getBreachOrigin();

    const j = i * 3;

    sprayParticles.positions[j] =
      origin.x +
      (Math.random() - 0.5) * 2.5;

    sprayParticles.positions[j + 1] =
      origin.y +
      Math.random() * 1.8;

    sprayParticles.positions[j + 2] =
      origin.z +
      (Math.random() - 0.5) * 2.2;

    const v =
      Math.min(
        24,
        4 +
        threeSim.outletVelocity *
        0.28
      );

    sprayParticles.velocities[j] =
      (Math.random() - 0.5) *
      v;

    sprayParticles.velocities[j + 1] =
      v *
      (0.35 + Math.random() * 0.75);

    sprayParticles.velocities[j + 2] =
      -v *
      (0.25 + Math.random() * 0.65);

    sprayParticles.ages[i] = 0;
    sprayParticles.life[i] =
      0.55 +
      Math.random() * 1.6;
  }

  function updateMainParticles(dt) {
    if (!mainParticles.points) return;

    const count =
      THREE_PHYSICS.mainParticleCount;

    const active =
      threeSim.discharge > 5 &&
      threeSim.timeHours >=
        THREE_PHYSICS.breachStartHour;

    for (let i = 0; i < count; i++) {
      const j = i * 3;

      if (
        !active ||
        mainParticles.ages[i] >
          mainParticles.life[i]
      ) {
        if (
          active &&
          Math.random() <
            Math.min(
              1,
              threeSim.discharge / 2500
            ) * dt * 18
        ) {
          respawnMainParticle(i);
        } else {
          mainParticles.ages[i] = 999;
        }

        continue;
      }

      mainParticles.ages[i] += dt;

      mainParticles.velocities[j + 1] -=
        9.81 * dt * 0.36;

      // Mild air drag.
      mainParticles.velocities[j] *= 0.998;
      mainParticles.velocities[j + 1] *= 0.998;
      mainParticles.velocities[j + 2] *= 0.998;

      mainParticles.positions[j] +=
        mainParticles.velocities[j] * dt;

      mainParticles.positions[j + 1] +=
        mainParticles.velocities[j + 1] * dt;

      mainParticles.positions[j + 2] +=
        mainParticles.velocities[j + 2] * dt;

      // Terrain impact approximation.
      const x =
        mainParticles.positions[j];

      const z =
        mainParticles.positions[j + 2];

      const terrainY =
        physicalToSceneY(
          terrainElevationAtScene(x, z)
        );

      if (
        mainParticles.positions[j + 1] <
        terrainY + 0.12
      ) {
        // Convert downward motion into a shallow downstream slide.
        mainParticles.positions[j + 1] =
          terrainY + 0.12;

        mainParticles.velocities[j + 1] *= -0.12;
        mainParticles.velocities[j] *= 0.72;
        mainParticles.velocities[j + 2] *= 0.84;
      }

      // Recycle particles once they have travelled well downstream.
      if (
        mainParticles.positions[j + 2] >
          52 ||
        Math.abs(
          mainParticles.positions[j]
        ) > 70
      ) {
        mainParticles.ages[i] = 999;
      }
    }

    mainParticles.points.geometry.attributes.position.needsUpdate = true;
  }

  // LIVE MODE: render backend SPH particles, hide unused slots.
  function updateMainParticlesFromBackend() {
    if (!mainParticles.points) return;

    const count = THREE_PHYSICS.mainParticleCount;
    const backendPts = physicsStream.latestParticles;
    const nBackend = backendPts.length;

    // SPH coordinates are a vertical slice: x is downstream distance and y
    // is height above the breach invert.  The Three scene uses X=lateral,
    // Y=elevation, Z=downstream, so never map SPH x directly to scene X.
    const breachOrigin = getBreachOrigin();
    const downstreamScale = 0.8;
    // SPH y is local to the breach invert.  Its backend datum must not be
    // confused with the projected DEM elevation used by the FM mesh.
    const invertElevation = terrainElevationAtScene(breachOrigin.x, breachOrigin.z);

    for (let i = 0; i < count; i++) {
      const j = i * 3;

      if (i < nBackend) {
        const p = backendPts[i];
        const particleId = Number.isFinite(p.id) ? p.id : i;

        // Negative SPH X lies in the upstream inlet/reservoir block.  That
        // water is represented by the reservoir mesh; only particles that
        // have crossed the breach become the visible downstream jet.
        if (p.x < 0) {
          mainParticles.positions[j] = 0;
          mainParticles.positions[j + 1] = -500;
          mainParticles.positions[j + 2] = 0;
          mainParticles.ages[i] = 999;
          continue;
        }

        // Give the 2D slice a stable, narrow visual thickness on scene X.
        mainParticles.positions[j] =
          breachOrigin.x + ((particleId % 7) - 3) * 0.16;
        // Convert invert-relative physical height to scene elevation.
        const particleY = physicalToSceneY(invertElevation + p.y);
        // SPH x is downstream distance; scene Z is the downstream axis.
        mainParticles.positions[j + 2] =
          breachOrigin.z + p.x * downstreamScale;

        // The backend has a local near-field bed constraint.  This render
        // clamp additionally conforms that slice to the displayed terrain,
        // so points cannot visually pass through the environment.
        const terrainY = physicalToSceneY(
          terrainElevationAtScene(
            mainParticles.positions[j],
            mainParticles.positions[j + 2]
          )
        ) + 0.05;
        mainParticles.positions[j + 1] = Math.max(particleY, terrainY);

        mainParticles.ages[i] = 0;
      } else {
        // Hide unused particle slots by parking them far away
        mainParticles.positions[j] = 0;
        mainParticles.positions[j + 1] = -500;
        mainParticles.positions[j + 2] = 0;
        mainParticles.ages[i] = 999;
      }
    }

    mainParticles.points.geometry.attributes.position.needsUpdate = true;
  }

  // LIVE MODE: hide procedural spray — backend spray_fraction controls.
  function updateSprayParticlesLive(dt) {
    if (!sprayParticles.points) return;
    // In live mode, park all spray particles offscreen.
    // The backend's spray_fraction is displayed in the HUD as data.
    const count = THREE_PHYSICS.sprayParticleCount;
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      sprayParticles.positions[j + 1] = -500;
      sprayParticles.ages[i] = 999;
    }
    sprayParticles.points.geometry.attributes.position.needsUpdate = true;
  }

  function updateSprayParticles(dt) {
    if (!sprayParticles.points) return;

    const count =
      THREE_PHYSICS.sprayParticleCount;

    const active =
      threeSim.discharge > 150;

    for (let i = 0; i < count; i++) {
      const j = i * 3;

      if (
        !active ||
        sprayParticles.ages[i] >
          sprayParticles.life[i]
      ) {
        if (
          active &&
          Math.random() <
            Math.min(
              1,
              threeSim.discharge / 5000
            ) *
            dt *
            45
        ) {
          respawnSprayParticle(i);
        } else {
          sprayParticles.ages[i] = 999;
        }

        continue;
      }

      sprayParticles.ages[i] += dt;

      sprayParticles.velocities[j + 1] -=
        9.81 * dt * 0.9;

      sprayParticles.velocities[j] *= 0.985;
      sprayParticles.velocities[j + 1] *= 0.985;
      sprayParticles.velocities[j + 2] *= 0.985;

      sprayParticles.positions[j] +=
        sprayParticles.velocities[j] * dt;

      sprayParticles.positions[j + 1] +=
        sprayParticles.velocities[j + 1] * dt;

      sprayParticles.positions[j + 2] +=
        sprayParticles.velocities[j + 2] * dt;

      if (
        sprayParticles.positions[j + 1] <
        physicalToSceneY(
          terrainElevationAtScene(
            sprayParticles.positions[j],
            sprayParticles.positions[j + 2]
          )
        ) + 0.05
      ) {
        sprayParticles.ages[i] = 999;
      }
    }

    sprayParticles.points.geometry.attributes.position.needsUpdate = true;
  }

  // ----------------------------------------------------------------------
  // Downstream flood visual
  // ----------------------------------------------------------------------

  function updateDownstreamFloodVisual() {
    if (!downstreamWaterMesh) return;

    // The live backend currently streams near-field SPH only, not a 2D
    // depth grid. Do not fabricate a floodplain surface from old timing
    // heuristics while live physics owns the hydraulic state.
    if (isLiveMode()) {
      downstreamWaterMesh.visible = false;
      return;
    }

    // If the spillway overfill logic has already made the downstream mesh
    // visible (gates opened due to high water level), don't override it with
    // the arrival-time logic — let the two paths coexist.
    const crestElevation = THREE_PHYSICS.reservoirInitialLevel;
    const isOverfilling =
      threeSim.waterLevel >= crestElevation - 2;
    if (isOverfilling && downstreamWaterMesh.visible) return;

    const sc =
      PIPELINE_DATA.scenarios[currentScenarioKey] ||
      PIPELINE_DATA.scenarios.base;

    const t =
      threeSim.timeHours;

    // The dashboard already provides arrival/peak times. Use those to
    // drive the visual flood front rather than inventing a second GIS model.
    const arrival =
      sc.morbi_arrival_time || 7.47;

    const visible =
      t >= Math.max(
        0,
        arrival - 1.5
      );

    downstreamWaterMesh.visible = visible;

    if (!visible) return;

    const progress =
      Math.max(
        0,
        Math.min(
          1,
          (t - (arrival - 1.5)) /
          Math.max(
            0.1,
            24 - (arrival - 1.5)
          )
        )
      );

    // Reveal downstream water from the dam toward the right side of the
    // diorama. This is a visual layer; the GIS/2D solver remains the
    // authoritative inundation result.
    downstreamWaterMesh.scale.z =
      Math.max(
        0.03,
        progress
      );

    downstreamWaterMesh.position.z =
      -60 +
      progress * 30;

    downstreamWaterMesh.material.uniforms.uOpacity.value =
      0.18 +
      Math.min(
        0.45,
        progress * 0.45
      );
  }

  // ----------------------------------------------------------------------
  // Foam animation
  // ----------------------------------------------------------------------

  function updateFoamVisual(dt) {
    if (!impactFoam) return;

    // The legacy foam ring is part of the offline procedural renderer.
    if (isLiveMode()) {
      impactFoam.visible = false;
      return;
    }

    const active =
      threeSim.discharge > 20;

    impactFoam.visible = active;

    if (!active) return;

    const qNorm =
      Math.min(
        1,
        threeSim.discharge /
        Math.max(
          1,
          PIPELINE_DATA.scenarios[
            currentScenarioKey
          ].q_peak
        )
      );

    const pulse =
      1 +
      Math.sin(
        performance.now() * 0.004
      ) *
      0.08;

    const radius =
      (0.8 + qNorm * 5.5) *
      pulse;

    impactFoam.scale.set(
      radius,
      radius,
      radius
    );

    impactFoam.material.opacity =
      0.18 +
      qNorm * 0.32;

    impactFoam.rotation.z +=
      dt * 0.25;
  }

  // ----------------------------------------------------------------------
  // Public API consumed by the existing dashboard.
  //
  // updateSimulationTime() calls this function with dashboard hours.
  // The physics engine advances internally from its previous state to the
  // requested time. Scrubbing backward resets the local 3D state and
  // replays it deterministically.
  // ----------------------------------------------------------------------

  window.updateThreeSimulation = function(targetHours) {
    if (!isThreeInitialized) return;

    // Dashboard scrubbing must not restart or advance the offline hydraulic
    // model while a backend stream is authoritative.
    if (isLiveMode()) {
      updateLiveHydraulicWater();
      updateHydraulicHUD();
      return;
    }

    const requested =
      Math.max(
        0,
        Math.min(
          24,
          Number(targetHours) || 0
        )
      );

    if (
      !threeSim.initializedPhysics ||
      requested < threeSim.timeHours - 0.001
    ) {
      resetThreePhysics();
    }

    const targetSeconds =
      requested * 3600;

    // Scrubbing needs only dashboard-scale state, not a 60 Hz replay.  The
    // old 1/60 s loop ran 5.18 million iterations for a 24 h jump and could
    // freeze the dashboard for about a minute.
    let remaining =
      Math.max(
        0,
        targetSeconds -
        threeSim.timeSeconds
      );

    const maxReplaySeconds =
      24 * 3600;

    remaining =
      Math.min(
        remaining,
        maxReplaySeconds
      );

    const replayDt = 60.0;

    let safety = 0;

    while (
      remaining > 0 &&
      safety < 2000
    ) {
      const dt =
        Math.min(
          replayDt,
          remaining
        );

      threeSim.timeSeconds += dt;
      threeSim.timeHours =
        threeSim.timeSeconds / 3600;

      calculateHydraulics(dt);
      updateDamBreachVisual();

      remaining -= dt;
      safety++;
    }

    threeSim.timeHours = requested;
    threeSim.timeSeconds =
      requested * 3600;

    updateHydraulicHUD();
    updateDownstreamFloodVisual();
  };

  function updateLiveHydraulicWater() {
    if (waterMesh) {
      waterMesh.visible = true;
      waterMesh.position.y = physicalToSceneY(threeSim.waterLevel);
    }

    if (reservoirMarker) {
      reservoirMarker.position.y = physicalToSceneY(threeSim.waterLevel) + 0.15;
    }

    // No backend depth grid is available yet, so the live view intentionally
    // renders no downstream sheet.
    if (downstreamWaterMesh) downstreamWaterMesh.visible = false;

    updateSpillwayFlowVisual();
  }

  function updateSpillwayFlowVisual() {
    const gateFlowQ = threeSim.spillwayDischarge;
    // Water-level overfill: when reservoir reaches or exceeds crest the
    // spillway gates open automatically and water flows downstream.
    const crestElevation = THREE_PHYSICS.reservoirInitialLevel;
    const overfillFraction = Math.max(
      0,
      Math.min(
        1,
        (threeSim.waterLevel - (crestElevation - 2)) / 2.0
      )
    );
    const isOverfilling = overfillFraction > 0;

    // Animate gate leaves: slide up when overfilling.
    const H_scene = physicalToSceneY(
      globalElevMin + THREE_PHYSICS.damPhysicalHeight
    ) - physicalToSceneY(globalElevMin);
    const damBaseY = physicalToSceneY(terrainElevationAtScene(15, -22));
    const gateHeight = H_scene * 0.48;
    const openingCenterY = damBaseY + H_scene * 0.34;
    const openingTopY = openingCenterY + gateHeight * 0.5;
    const raisedY = openingTopY + gateHeight * 0.5 + 0.08;
    for (const gate of spillwayGateLeaves) {
      const currentFrac = gate.userData.openFraction || 0;
      const targetFrac = isOverfilling ? overfillFraction : currentFrac;
      gate.userData.openFraction = targetFrac;
      gate.position.y = THREE.MathUtils.lerp(
        openingCenterY,
        raisedY,
        gate.userData.openFraction
      );
    }

    // Keep the received physical release visible after the websocket has
    // completed its fast calculation, rather than tying it to socket state.
    const gateTrigger = gateFlowQ > 0.01 || isOverfilling;
    const flowScale = isOverfilling
      ? Math.max(0.35, overfillFraction)
      : Math.max(0.35, Math.min(1, gateFlowQ / 100));

    for (const flow of spillwayFlowMeshes) {
      flow.visible = gateTrigger;
      flow.scale.x = flowScale;
    }

    // Show downstream water sheet as soon as gates are releasing.
    if (downstreamWaterMesh && isOverfilling && !isLiveMode()) {
      downstreamWaterMesh.visible = true;
      const spread = Math.max(0.04, overfillFraction * 0.55);
      downstreamWaterMesh.scale.z = spread;
      downstreamWaterMesh.position.z = -60 + overfillFraction * 15;
      downstreamWaterMesh.material.uniforms.uOpacity.value =
        0.2 + Math.min(0.42, overfillFraction * 0.42);
    }
  }

  // ----------------------------------------------------------------------
  // Real-time physics loop used when the 3D scene is running.
  // ----------------------------------------------------------------------

  function stepThreePhysics(dt) {
    if (!threeSim.initializedPhysics) {
      resetThreePhysics();
    }

    // In LIVE mode, backend is authoritative — don't advance local time
    // or recalculate hydraulics. applyBackendFrame() already set threeSim.
    if (isLiveMode()) {
      try {
        updateDamBreachVisual();
        updateLiveHydraulicWater();
        updateMainParticlesFromBackend();
        updateSprayParticlesLive(dt);
        updateFoamVisual(dt);
        updateDownstreamFloodVisual();
        updateHydraulicHUD();
      } catch (e) {
        console.error("Error in live mode stepThreePhysics:", e);
      }
      return;
    }

    // OFFLINE DEMO: existing reduced-order visualization model
    threeSim.timeSeconds += dt;
    threeSim.timeHours =
      threeSim.timeSeconds / 3600;

    // Do not allow the visual simulation to run beyond the dashboard range.
    if (threeSim.timeHours > 24) {
      threeSim.timeHours = 24;
      threeSim.timeSeconds = 24 * 3600;
    }

    calculateHydraulics(dt);
    updateDamBreachVisual();

    // Keep upstream water surface at the current simulated level.
    if (waterMesh) {
      waterMesh.visible = true;
      waterMesh.position.y = physicalToSceneY(threeSim.waterLevel);
    }
    if (reservoirMarker) {
      reservoirMarker.position.y = physicalToSceneY(threeSim.waterLevel) + 0.15;
    }

    updateSpillwayFlowVisual();
    updateMainParticles(dt);
    updateSprayParticles(dt);
    updateFoamVisual(dt);
    updateDownstreamFloodVisual();
  }

  function updateHydraulicHUD() {
    const hudQ =
      document.getElementById("hud-q-out");

    const hudHead =
      document.getElementById("hud-head");

    const hudVel =
      document.getElementById("hud-velocity");

    const hudStage =
      document.getElementById("hud-morbi-stage");

    if (hudQ) {
      hudQ.textContent =
        `${Math.round(
          threeSim.discharge
        ).toLocaleString()} m³/s`;
    }

    if (hudHead) {
      hudHead.textContent =
        `${threeSim.head.toFixed(1)} m`;
    }

    if (hudVel) {
      hudVel.textContent =
        `${threeSim.outletVelocity.toFixed(1)} m/s`;
    }

    // In live mode, show spray fraction from backend
    if (isLiveMode() && physicsStream.latestFrame) {
      const spray = physicsStream.latestFrame.sph;
      const hudSpray = document.getElementById("hud-spray-fraction");
      if (hudSpray && spray) {
        hudSpray.textContent =
          `${(spray.spray_fraction * 100).toFixed(1)}%`;
      }
      // Show structural status
      const structs = physicsStream.latestFrame.structures;
      if (structs && structs.length > 0) {
        const hudBridge = document.getElementById("hud-bridge-status");
        if (hudBridge) {
          const s = structs[0];
          const load = s.horizontal_load_kN ?? s.force_kN ?? 0;
          hudBridge.textContent = s.failed
            ? `FAILED: ${s.failure_reason || "capacity"} (${load.toFixed(0)} kN)`
            : `INTACT (${load.toFixed(0)} kN)`;
          hudBridge.style.color = s.failed
            ? "var(--accent-red, #e63946)"
            : "var(--accent-emerald, #06d6a0)";
        }
      }
    }

    const sc =
      PIPELINE_DATA.scenarios[
        currentScenarioKey
      ] ||
      PIPELINE_DATA.scenarios.base;

    // Keep the HUD stage consistent with the existing dashboard telemetry.
    let morbiDepth = 0;

    if (
      threeSim.timeHours >=
      sc.morbi_arrival_time
    ) {
      const dt =
        threeSim.timeHours -
        sc.morbi_arrival_time;

      const rise =
        sc.morbi_peak_time -
        sc.morbi_arrival_time;

      if (dt <= rise) {
        morbiDepth =
          sc.morbi_peak_depth *
          Math.pow(
            Math.max(
              0,
              Math.min(1, dt / rise)
            ),
            1.4
          );
      } else {
        morbiDepth =
          Math.max(
            1,
            sc.morbi_peak_depth *
            Math.exp(
              -(dt - rise) / 10
            )
          );
      }
    }

    if (hudStage) {
      hudStage.textContent =
        `${morbiDepth.toFixed(2)} m`;
    }
  };

  // ----------------------------------------------------------------------
  // Camera director
  // ----------------------------------------------------------------------

  function setupCameraDirector() {
    const camBtns =
      document.querySelectorAll(".cam-btn");

    camBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        camBtns.forEach(b =>
          b.classList.remove("active")
        );

        btn.classList.add("active");

        const mode =
          btn.getAttribute("data-cam");

        if (mode === "overview") {
          tweenCamera(
            0, 45, 75,
            0, 5, -5
          );
        } else if (mode === "dam") {
          tweenCamera(
            4, 17, -7,
            13, 7, -22
          );
        } else if (mode === "morbi") {
          tweenCamera(
            -18, 28, 38,
            0, 5, 22
          );
        } else if (mode === "chase") {
          tweenCamera(
            15, 18, 12,
            12, 5, 18
          );
        } else if (mode === "ridge") {
          tweenCamera(
            48, 32, 10,
            0, 6, 8
          );
        }
      });
    });
  }

  function tweenCamera(
    px,
    py,
    pz,
    tx,
    ty,
    tz
  ) {
    if (!threeCamera) return;

    threeCamera.position.set(
      px,
      py,
      pz
    );

    if (threeControls) {
      threeControls.target.set(
        tx,
        ty,
        tz
      );

      threeControls.update();
    } else {
      threeCamera.lookAt(
        tx,
        ty,
        tz
      );
    }
  }

  // ----------------------------------------------------------------------
  // Keyboard camera movement
  // ----------------------------------------------------------------------

  function setupThreeKeyboardControls() {
    if (threeKeyboardBound || !threeRenderer) return;

    threeKeyboardBound = true;
    const canvas = threeRenderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      "3D dam view. Use W, A, S, and D to move the camera."
    );
    canvas.addEventListener("pointerdown", () => canvas.focus());

    window.addEventListener("keydown", event => {
      if (
        event.ctrlKey || event.metaKey || event.altKey ||
        isTextEntryTarget(event.target) ||
        !["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)
      ) {
        return;
      }

      threeMovementKeys.add(event.code);
      event.preventDefault();
    });

    window.addEventListener("keyup", event => {
      if (!["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
        return;
      }

      threeMovementKeys.delete(event.code);
    });

    window.addEventListener("blur", () => threeMovementKeys.clear());
  }

  function isTextEntryTarget(target) {
    return target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      Boolean(target && target.isContentEditable);
  }

  function moveThreeCameraWithKeyboard(dt) {
    if (
      !threeCamera ||
      !threeControls ||
      threeMovementKeys.size === 0
    ) {
      return;
    }

    const forward = new THREE.Vector3();
    threeCamera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() === 0) return;
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(
      forward,
      threeCamera.up
    ).normalize();
    const movement = new THREE.Vector3();

    if (threeMovementKeys.has("KeyW")) movement.add(forward);
    if (threeMovementKeys.has("KeyS")) movement.sub(forward);
    if (threeMovementKeys.has("KeyD")) movement.add(right);
    if (threeMovementKeys.has("KeyA")) movement.sub(right);
    if (movement.lengthSq() === 0) return;

    movement.normalize().multiplyScalar(18 * dt);
    threeCamera.position.add(movement);
    threeControls.target.add(movement);
  }

  // ----------------------------------------------------------------------
  // Resize
  // ----------------------------------------------------------------------

  function onThreeWindowResize() {
    const container =
      document.getElementById("webgl-canvas");

    if (
      !container ||
      !threeRenderer ||
      !threeCamera
    ) {
      return;
    }

    const width =
      Math.max(1, container.clientWidth);

    const height =
      Math.max(1, container.clientHeight);

    threeCamera.aspect =
      width / height;

    threeCamera.updateProjectionMatrix();

    threeRenderer.setSize(
      width,
      height
    );
  }

  // ----------------------------------------------------------------------
  // Render loop
  // ----------------------------------------------------------------------

  function animateThreeJs(now) {
    requestAnimationFrame(animateThreeJs);

    if (!threeRenderer || !threeScene || !threeCamera) {
      return;
    }

    const wallDt =
      Math.min(
        0.05,
        Math.max(
          0,
          (now - threeLastWallTime) / 1000
        )
      );

    threeLastWallTime = now;
    advanceDflowFmReplay(wallDt);

    // The dashboard's time slider is authoritative. Only advance the
    // physical simulation automatically when playback is active.
    if (isPlaying) {
      threePhysicsAccumulator += wallDt;

      // Speed is expressed in simulated hours per real second.
      const simulatedSecondsPerRealSecond =
        Math.max(
          0.1,
          speedMultiplier * 3600
        );

      let remainingReal =
        threePhysicsAccumulator;

      threePhysicsAccumulator = 0;

      // Break large simulation jumps into bounded physics chunks.
      let guard = 0;

      while (
        remainingReal > 0 &&
        guard < 40
      ) {
        const realStep =
          Math.min(
            0.02,
            remainingReal
          );

        const physicsSeconds =
          Math.min(
            2.0,
            realStep *
            simulatedSecondsPerRealSecond
          );

        stepThreePhysics(
          physicsSeconds
        );

        remainingReal -= realStep;
        guard++;
      }

      // Synchronize the dashboard controls with the actual 3D simulation.
      if (
        Math.abs(
          currentTimeHours -
          threeSim.timeHours
        ) > 0.02
      ) {
        currentTimeHours =
          Math.min(
            24,
            threeSim.timeHours
          );

        if (timeSlider) {
          timeSlider.value =
            currentTimeHours;
        }

        updatePhaseDescription(
          currentTimeHours
        );

        updateGaugesAtTime(
          currentTimeHours
        );
      }

      if (threeSim.timeHours >= 24) {
        isPlaying = false;

        if (btnPlay) {
          btnPlay.innerHTML =
            '<i class="fa-solid fa-play"></i>';

          btnPlay.classList.remove(
            "active"
          );
        }
      }
    }

    // Shader time.
    const shaderTime =
      now * 0.001;

    if (
      waterMesh &&
      waterMesh.material &&
      waterMesh.material.uniforms &&
      waterMesh.material.uniforms.uTime
    ) {
      waterMesh.material.uniforms.uTime.value =
        shaderTime;
    }

    if (
      downstreamWaterMesh &&
      downstreamWaterMesh.material &&
      downstreamWaterMesh.material.uniforms &&
      downstreamWaterMesh.material.uniforms.uTime
    ) {
      downstreamWaterMesh.material.uniforms.uTime.value =
        shaderTime;
    }

    for (const flow of spillwayFlowMeshes) {
      if (flow.material.uniforms && flow.material.uniforms.uTime) {
        flow.material.uniforms.uTime.value = shaderTime;
      }
    }

    moveThreeCameraWithKeyboard(wallDt);

    if (threeControls) {
      threeControls.update();
    }

    threeRenderer.render(
      threeScene,
      threeCamera
    );
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
