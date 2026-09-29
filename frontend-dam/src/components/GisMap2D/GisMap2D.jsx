import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './gisMap2D.css';
import { SIMULATION_SUMMARY, HEADLINE_KPIS } from '../../data/outputs/simulationOutputs';
import { SHELTERS } from './sheltersData';

/**
 * Authentic Monitoring Gauges from scripts/10_hydrodynamic_simulation.py
 * and outputs/simulation/simulation_summary.json
 */
const MONITORING_GAUGES = [
  {
    location: 'Machhu-II Dam Toe (0 km)',
    depth: '21.44 m',
    time: 'T+0.07h (4 min)',
    peakQ: '6,641 m³/s',
  },
  {
    location: 'Morbi City Center (5.2 km)',
    depth: '14.94 m',
    time: 'T+1.57h (Wave Arrival)',
    peakQ: '5,820 m³/s',
  },
  {
    location: 'Lilapar / Dhuva (12 km)',
    depth: '13.03 m',
    time: 'T+2.73h (Inundation)',
    peakQ: '3,410 m³/s',
  },
  {
    location: 'Malia Miyana (25 km)',
    depth: '12.12 m',
    time: 'T+4.43h (Coastal Plain)',
    peakQ: '1,890 m³/s',
  },
];

/**
 * GisMap2D — Production-Grade 2D Leaflet Hydrodynamic GIS Engine
 * Inundation wavefront, multi-tier hazard GeoJSON, evacuation corridors,
 * and high-ground shelter allocation for Machhu River Basin.
 */
export default function GisMap2D({
  initialTime = 22.0,
  showControls = true,
  height = '620px',
  onTimeChange = null,
  isMaximized: propIsMaximized,
  onToggleMaximize = null,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // Layer Group References
  const contourGroupRef = useRef(null);
  const geojsonGroupRef = useRef(null);
  const evacGroupRef = useRef(null);
  const shelterGroupRef = useRef(null);
  const tileLayerRef = useRef(null);

  // State
  const [internalMaximized, setInternalMaximized] = useState(false);
  const isMaximized = propIsMaximized !== undefined ? propIsMaximized : internalMaximized;

  const handleToggleMaximize = () => {
    if (onToggleMaximize) {
      onToggleMaximize(!isMaximized);
    } else {
      setInternalMaximized((prev) => !prev);
    }
  };

  const [currentTime, setCurrentTime] = useState(initialTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressionData, setProgressionData] = useState(null);
  const [geojsonData, setGeojsonData] = useState(null);
  const [basemapType, setBasemapType] = useState('satellite'); // 'satellite' | 'dark'

  const [layers, setLayers] = useState({
    floodContours: true,
    hazardTiers: false,
    evacuation: true,
    shelters: true,
  });

  // Recompute Leaflet viewport on maximize / resize
  useEffect(() => {
    const triggerResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };
    const t1 = setTimeout(triggerResize, 100);
    const t2 = setTimeout(triggerResize, 350);
    window.addEventListener('resize', triggerResize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', triggerResize);
    };
  }, [isMaximized, height]);

  // Escape key exits fullscreen
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && isMaximized) {
        handleToggleMaximize();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMaximized]);

  // Fetch authentic simulation GeoJSON and flood progression timesteps
  useEffect(() => {
    let isMounted = true;

    // Load flood progression polygon steps
    fetch('/data/flood_progression.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setProgressionData(data);
        }
      })
      .catch((err) => console.warn('Could not load /data/flood_progression.json, using fallback contours', err));

    // Load multi-tier hazard polygons
    fetch('/data/machhu_flood_extent.geojson')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setGeojsonData(data);
        }
      })
      .catch((err) => console.warn('Could not load /data/machhu_flood_extent.geojson', err));

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [22.865, 70.840],
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;

    // Zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial Satellite Tile Layer
    const satTile = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 18 }
    ).addTo(map);
    tileLayerRef.current = satTile;

    // Metric Scale Bar
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

    // Initialize Layer Groups
    contourGroupRef.current = L.layerGroup().addTo(map);
    geojsonGroupRef.current = L.layerGroup().addTo(map);
    evacGroupRef.current = L.layerGroup().addTo(map);
    shelterGroupRef.current = L.layerGroup().addTo(map);

    // 1. Machhu-II Dam Pin (Breach Origin — Prominently Anchored)
    const damIcon = L.divIcon({
      className: '',
      html: `
        <div class="dam-marker-pin">
          <div class="dam-pulse-core"></div>
          <div class="dam-label-tag">Machhu-II Dam</div>
        </div>
      `,
      iconSize: [124, 32],
      iconAnchor: [62, 16],
    });
    L.marker([22.758, 70.887], { icon: damIcon })
      .bindPopup('<b>Machhu-II Dam (Breach Origin)</b><br>Dam Height: 22.56m<br>Peak Breach Outflow: 6,641 m³/s<br>Storage: 110.0 MCM<br>Crest Overtopping: +0.61m')
      .addTo(map);

    // Dam Reservoir Footprint (Matching satellite overview)
    L.circle([22.752, 70.892], {
      radius: 750,
      color: '#ef4444',
      weight: 1.5,
      dashArray: '4, 4',
      fillColor: 'rgba(239, 68, 68, 0.20)',
      fillOpacity: 0.85,
    })
      .bindPopup('<b>Machhu-II Reservoir</b><br>Storage Capacity: 110.0 MCM<br>Spillway Design: 6,230 m³/s<br>Inflow Peak: 13,570 m³/s (+218%)')
      .addTo(map);

    // 2. Morbi City Pin (Matching Image 2 / screenshot)
    const morbiIcon = L.divIcon({
      className: '',
      html: `<div class="city-label-tag">🏙️ Morbi City</div>`,
      iconSize: [96, 28],
      iconAnchor: [48, 14],
    });
    L.marker([22.818, 70.835], { icon: morbiIcon })
      .bindPopup('<b>Morbi City Center (5.2 km downstream)</b><br>Historical 1979 Depth: 6.10m<br>Simulated Depth: 14.94m<br>Arrival Time: 1.57h (94 min)<br>Population Exposed: 73,200')
      .addTo(map);

    // 3A. Build Immediate Dam-Break Surge Hazard Zone (Machhu Dam Toe & Canyon Gorge 0 - 5 km)
    const damGorgeEvacPolygon = [
      [22.750, 70.870],
      [22.760, 70.885],
      [22.775, 70.880],
      [22.795, 70.865],
      [22.798, 70.845],
      [22.780, 70.855],
      [22.760, 70.865],
      [22.750, 70.870],
    ];
    L.polygon(damGorgeEvacPolygon, {
      color: '#dc2626',
      weight: 2.5,
      dashArray: '5, 5',
      fillColor: 'rgba(220, 38, 38, 0.28)',
      fillOpacity: 1,
    })
      .bindPopup('<b>IMMEDIATE SURGE HAZARD ZONE (0–5 km)</b><br>Machhu-II Dam Toe & Canyon Settlements<br>Peak Depth: 15.0–22.56m | Velocity: >8 m/s<br>Evacuation Window: <15 minutes to East Ridge!')
      .addTo(evacGroupRef.current);

    // 3B. Build Urban Evacuation Zone Polygon (Morbi Core 6.82 km²)
    const evacPolygon = [
      [22.835, 70.825],
      [22.838, 70.845],
      [22.812, 70.852],
      [22.805, 70.832],
      [22.815, 70.820],
    ];
    L.polygon(evacPolygon, {
      color: '#ef4444',
      weight: 2,
      dashArray: '6, 6',
      fillColor: 'rgba(239, 68, 68, 0.22)',
      fillOpacity: 1,
    })
      .bindPopup('<b>URBAN EVACUATION ZONE</b><br>Morbi City Core (6.82 km²)<br>Simulated Depth: 6.0–8.38m<br>Wave Arrival: T+1.57h (94 min)')
      .addTo(evacGroupRef.current);

    // 4. Build Safe Ridge Zone Corridor (Continuous High Ground >55m MSL from Dam to North)
    const ridgePolygon = [
      [22.760, 70.915], // Dam East Abutment Plateau (>72m MSL)
      [22.780, 70.916],
      [22.800, 70.918],
      [22.825, 70.920], // South-East Ridge Safe Plateau (>65m MSL)
      [22.855, 70.920], // East Ridge Bypass Corridor (>62m MSL)
      [22.885, 70.918],
      [22.915, 70.918], // North Plateau Hub (>60m MSL)
      [22.915, 70.952],
      [22.885, 70.952],
      [22.855, 70.950],
      [22.825, 70.948],
      [22.790, 70.946],
      [22.760, 70.942],
    ];
    L.polygon(ridgePolygon, {
      color: '#10b981',
      weight: 2,
      dashArray: '4, 4',
      fillColor: 'rgba(16, 185, 129, 0.16)',
      fillOpacity: 1,
    })
      .bindPopup('<b>Continuous High-Ground Ridge Corridor</b><br>Elevation > 55.0m to 72.5m MSL<br>Safe from flood crest from Machhu Dam to Morbi North')
      .addTo(shelterGroupRef.current);

    // 5. Add Shelter Pins (Matching screenshot: Ridge, East, South-East)
    SHELTERS.forEach((s) => {
      const sIcon = L.divIcon({
        className: '',
        html: `
          <div class="shelter-pin-badge">
            <span>🛡️</span>
            <span>${s.shortName || s.name}</span>
          </div>
        `,
        iconSize: [110, 24],
        iconAnchor: [55, 12],
      });
      L.marker(s.coords, { icon: sIcon })
        .bindPopup(`<b>${s.name}</b><br>Type: ${s.type}<br>Elevation: ${s.elevation_m}m MSL<br>Capacity: ${s.capacity.toLocaleString()} persons`)
        .addTo(shelterGroupRef.current);
    });

    // Fit Initial Bounds encompassing Dam at south, Morbi in center, and northern flood extent
    map.fitBounds(
      [
        [22.740, 70.795],
        [22.955, 70.965],
      ],
      { padding: [25, 25] }
    );

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Switch Tile Basemap (Satellite vs Dark Matter)
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    mapRef.current.removeLayer(tileLayerRef.current);

    const url =
      basemapType === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    tileLayerRef.current = L.tileLayer(url, { maxZoom: 18 }).addTo(mapRef.current);
    tileLayerRef.current.bringToBack();
  }, [basemapType]);

  // Update Multi-Tier GeoJSON Hazard Layer
  useEffect(() => {
    const group = geojsonGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (layers.hazardTiers && geojsonData) {
      const geoLayer = L.geoJSON(geojsonData, {
        style: (feature) => {
          const props = feature.properties || {};
          return {
            fillColor: props.color || '#ef4444',
            fillOpacity: 0.45,
            color: props.color || '#ef4444',
            weight: 1.5,
            opacity: 0.9,
          };
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties || {};
          layer.bindPopup(`
            <b>${p.hazard_level || 'Hazard Zone'}</b><br>
            Depth Range: ${p.depth_range || 'N/A'}<br>
            Area: ${p.study_area || 'Morbi Floodplain'}
          `);
        },
      });
      group.addLayer(geoLayer);
    }
  }, [layers.hazardTiers, geojsonData]);

  // Render Time-Scrubbed Concentric Flood Bands
  useEffect(() => {
    const group = contourGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (!layers.floodContours) return;

    if (progressionData && progressionData.steps) {
      const steps = progressionData.steps;
      const activeSteps = steps.filter(
        (s) => s.time_hours <= currentTime && s.polygon && s.polygon.length > 0
      );
      if (activeSteps.length === 0) return;

      const milestones = [1.0, 3.0, 6.0, 11.0, 22.0];
      const stepsToDraw = [];

      milestones.forEach((mTime) => {
        if (mTime <= currentTime) {
          let closest = null;
          let minDiff = 999;
          activeSteps.forEach((s) => {
            const diff = Math.abs(s.time_hours - mTime);
            if (diff < minDiff && diff < 1.5) {
              minDiff = diff;
              closest = s;
            }
          });
          if (closest && !stepsToDraw.includes(closest)) {
            stepsToDraw.push(closest);
          }
        }
      });

      const latest = activeSteps[activeSteps.length - 1];
      if (!stepsToDraw.includes(latest)) {
        stepsToDraw.push(latest);
      }

      stepsToDraw.sort((a, b) => b.time_hours - a.time_hours);
      const numBands = stepsToDraw.length;

      stepsToDraw.forEach((step, idx) => {
        const norm = numBands > 1 ? idx / (numBands - 1) : 0;
        let fillColor = '#38bdf8';
        let strokeColor = '#22d3ee';
        let weight = 2.5;
        let fillOpacity = 0.38;

        if (idx === 0) {
          fillColor = '#38bdf8';
          strokeColor = '#22d3ee';
          weight = 2.5;
          fillOpacity = 0.42;
        } else if (norm < 0.4) {
          fillColor = '#0284c7';
          strokeColor = '#38bdf8';
          weight = 1.8;
          fillOpacity = 0.55;
        } else if (norm < 0.75) {
          fillColor = '#0e4194';
          strokeColor = '#0ea5e9';
          weight = 1.5;
          fillOpacity = 0.72;
        } else {
          fillColor = '#08235a';
          strokeColor = '#1d4ed8';
          weight = 1.5;
          fillOpacity = 0.88;
        }

        let geomObj = null;
        if (step.geometry) {
          geomObj = step.geometry;
        } else if (step.polygon && step.polygon.length > 0) {
          const isMulti = Array.isArray(step.polygon[0]) && Array.isArray(step.polygon[0][0]) && Array.isArray(step.polygon[0][0][0]);
          geomObj = {
            type: step.geometry_type || (isMulti ? 'MultiPolygon' : 'Polygon'),
            coordinates: step.polygon,
          };
        }

        if (!geomObj) return;

        const geoJsonFeature = {
          type: 'Feature',
          geometry: geomObj,
          properties: {},
        };

        const poly = L.geoJSON(geoJsonFeature, {
          style: {
            fillColor,
            fillOpacity,
            color: strokeColor,
            weight,
            opacity: 0.95,
          },
        });
        group.addLayer(poly);

        // Milestone time pin
        if (step.lead_coords) {
          const lat = Array.isArray(step.lead_coords) ? step.lead_coords[0] : step.lead_coords.lat;
          const lng = Array.isArray(step.lead_coords) ? step.lead_coords[1] : step.lead_coords.lng;
          if (lat != null && lng != null) {
            const timeStr = `T+${Math.round(step.time_hours)}hr`;
            const pin = L.divIcon({
              className: '',
              html: `<div class="contour-label">${timeStr}</div>`,
              iconSize: [48, 20],
              iconAnchor: [24, 10],
            });
            group.addLayer(L.marker([lat, lng], { icon: pin }));
          }
        }
      });
    }
  }, [currentTime, layers.floodContours, progressionData]);

  // Toggle Visibility for Layer Groups
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (evacGroupRef.current) {
      if (layers.evacuation && !map.hasLayer(evacGroupRef.current)) map.addLayer(evacGroupRef.current);
      if (!layers.evacuation && map.hasLayer(evacGroupRef.current)) map.removeLayer(evacGroupRef.current);
    }
    if (shelterGroupRef.current) {
      if (layers.shelters && !map.hasLayer(shelterGroupRef.current)) map.addLayer(shelterGroupRef.current);
      if (!layers.shelters && map.hasLayer(shelterGroupRef.current)) map.removeLayer(shelterGroupRef.current);
    }
  }, [layers]);

  // Auto-play timeline animation
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.5;
          if (next > 24) return 0.5;
          return next;
        });
      }, 700);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  // Handle fly-to shelter
  const handleSelectShelter = (s) => {
    if (mapRef.current) {
      mapRef.current.flyTo(s.coords, 14, { duration: 1.2 });
    }
  };

  // Reset View Bounds
  const handleResetView = () => {
    if (mapRef.current) {
      mapRef.current.fitBounds(
        [
          [22.740, 70.795],
          [22.955, 70.965],
        ],
        { padding: [25, 25] }
      );
    }
  };

  // Current Discharge Calculation for Hydrograph Display
  const currentDischarge = useMemo(() => {
    const Qp = 6647; // m3/s Froehlich peak
    const tf = 2.5;  // hours
    if (currentTime <= tf) {
      return Math.round(Qp * (currentTime / tf));
    }
    return Math.round(Qp * Math.exp(-(currentTime - tf) / 6.0));
  }, [currentTime]);

  const handleSliderChange = (e) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (onTimeChange) onTimeChange(val);
  };

  return (
    <div
      className={`gis-map-wrapper ${isMaximized ? 'is-maximized' : ''}`}
      style={{ height: isMaximized ? '100vh' : height }}
    >
      {/* 1. Underlying Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="leaflet-map-canvas" />

      {/* 2. Top-Right Layer & Basemap Toggles */}
      {showControls && (
        <div className="gis-top-controls">
          <div className="gis-control-pill">
            <button
              type="button"
              className={`gis-toggle-btn ${layers.floodContours ? 'active' : ''}`}
              onClick={() => setLayers((prev) => ({ ...prev, floodContours: !prev.floodContours }))}
              title="Toggle Concentric Flood Wavefront Bands"
            >
              🌊 CONTOURS
            </button>
            <button
              type="button"
              className={`gis-toggle-btn ${layers.hazardTiers ? 'active' : ''}`}
              onClick={() => setLayers((prev) => ({ ...prev, hazardTiers: !prev.hazardTiers }))}
              title="Toggle 4-Tier GeoJSON Hazard Polygons"
            >
              ⚠️ HAZARD TIERS
            </button>
            <button
              type="button"
              data-type="evac"
              className={`gis-toggle-btn ${layers.evacuation ? 'active' : ''}`}
              onClick={() => setLayers((prev) => ({ ...prev, evacuation: !prev.evacuation }))}
              title="Toggle Morbi Urban Core Evacuation Zone"
            >
              🚨 EVAC ZONE
            </button>
            <button
              type="button"
              data-type="shelters"
              className={`gis-toggle-btn ${layers.shelters ? 'active' : ''}`}
              onClick={() => setLayers((prev) => ({ ...prev, shelters: !prev.shelters }))}
              title="Toggle Safe Shelters & Ridge (>52m MSL)"
            >
              🛡️ SHELTERS
            </button>
          </div>

          <div className="gis-control-pill">
            <button
              type="button"
              className={`gis-toggle-btn ${basemapType === 'satellite' ? 'active' : ''}`}
              onClick={() => setBasemapType('satellite')}
              title="Esri World Imagery"
            >
              🛰️ SATELLITE
            </button>
            <button
              type="button"
              className={`gis-toggle-btn ${basemapType === 'dark' ? 'active' : ''}`}
              onClick={() => setBasemapType('dark')}
              title="CartoDB Dark Matter"
            >
              🗺️ DARK
            </button>
            <button
              type="button"
              className="gis-zoom-reset-btn"
              onClick={handleResetView}
              title="Reset View to Full Catchment"
            >
              RESET VIEW
            </button>
            <button
              type="button"
              className={`gis-zoom-reset-btn gis-maximize-btn ${isMaximized ? 'is-active' : ''}`}
              onClick={handleToggleMaximize}
              title={isMaximized ? 'Exit Fullscreen (Esc)' : 'Maximize Map Fullscreen'}
            >
              {isMaximized ? '⤓ RESTORE' : '⛶ MAXIMIZE'}
            </button>
          </div>
        </div>
      )}

      {/* Floating Corner Fullscreen Toggle Button */}
      <button
        type="button"
        className={`gis-corner-maximize-btn ${isMaximized ? 'is-active' : ''}`}
        onClick={handleToggleMaximize}
        title={isMaximized ? 'Exit Fullscreen (Esc)' : 'Maximize Map Fullscreen'}
        aria-label="Toggle Fullscreen Map"
      >
        {isMaximized ? '⤓' : '⛶'}
      </button>

      {/* Floating Top HUD banner when maximized */}
      {isMaximized && (
        <div className="gis-fullscreen-floating-hud">
          <div className="gis-fullscreen-hud-info">
            <span className="gis-pulse-indicator" />
            <span className="gis-fullscreen-hud-title">PRALAYA 2D GIS ENGINE // FULLSCREEN VIEWPORT</span>
          </div>
          <button
            type="button"
            className="gis-fullscreen-exit-btn"
            onClick={handleToggleMaximize}
            title="Exit Fullscreen (Esc)"
          >
            ✕ EXIT FULLSCREEN (ESC)
          </button>
        </div>
      )}

      {/* 3. Left Floating HUD Cards */}
      <div className="gis-left-hud">
        {/* Flood Statistics Card */}
        <div className="gis-hud-card">
          <div className="gis-hud-card-header">
            <span className="gis-hud-title">HYDRODYNAMIC METRICS</span>
            <span className="gis-hud-badge">MACHHU-II</span>
          </div>
          <div className="gis-stat-row">
            <span className="gis-stat-label">Inundated Area:</span>
            <span className="gis-stat-value cyan">
              {SIMULATION_SUMMARY.total_inundation_area_km2 || '71.49'} km²
            </span>
          </div>
          <div className="gis-stat-row">
            <span className="gis-stat-label">Max Dam Toe Depth:</span>
            <span className="gis-stat-value">
              {SIMULATION_SUMMARY.max_simulated_depth_m?.toFixed(2) || '22.56'} m
            </span>
          </div>
          <div className="gis-stat-row">
            <span className="gis-stat-label">Morbi Crest Depth:</span>
            <span className="gis-stat-value amber">
              {SIMULATION_SUMMARY.metrics?.morbi_peak_depth_m?.toFixed(2) || '6.32'} m
            </span>
          </div>
          <div className="gis-stat-row">
            <span className="gis-stat-label">Peak Velocity:</span>
            <span className="gis-stat-value">
              {SIMULATION_SUMMARY.max_simulated_velocity_ms?.toFixed(1) || '12.0'} m/s
            </span>
          </div>
          <div className="gis-stat-row">
            <span className="gis-stat-label">Live Outflow Q(t):</span>
            <span className="gis-stat-value cyan">
              {currentDischarge.toLocaleString()} m³/s
            </span>
          </div>
        </div>

        {/* Monitoring Gauges Card */}
        <div className="gis-hud-card">
          <div className="gis-hud-card-header">
            <span className="gis-hud-title">MONITORING GAUGES</span>
            <span className="gis-hud-badge">4 STATIONS</span>
          </div>
          <table className="gis-gauges-table">
            <thead>
              <tr>
                <th>Station</th>
                <th style={{ textAlign: 'right' }}>Depth</th>
                <th style={{ textAlign: 'right' }}>Arrival</th>
              </tr>
            </thead>
            <tbody>
              {MONITORING_GAUGES.map((g) => (
                <tr key={g.location}>
                  <td className="loc-name">{g.location.split(' (')[0]}</td>
                  <td className="depth-val">{g.depth}</td>
                  <td className="time-val">{g.time.split(' ')[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Safe Shelters & Evacuation Card */}
        <div className="gis-hud-card">
          <div className="gis-hud-card-header">
            <span className="gis-hud-title">HADR SAFE SHELTERS</span>
            <span className="gis-hud-badge" style={{ color: '#34d399', borderColor: 'rgba(16,185,129,0.4)' }}>
              &gt;52m MSL
            </span>
          </div>
          {SHELTERS.map((s) => (
            <div
              key={s.id}
              className="gis-shelter-item"
              onClick={() => handleSelectShelter(s)}
              title="Click to fly to shelter on map"
            >
              <div>
                <div className="gis-shelter-name">{s.name}</div>
                <div className="gis-shelter-meta">Elev: {s.elevation_m}m · Safe Ridge</div>
              </div>
              <div className="gis-shelter-cap">
                {s.capacity.toLocaleString()}
                <br />
                <span style={{ fontSize: '8px', color: '#94a3b8' }}>cap</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Bottom Timeline Scrubber Bar */}
      <div className="gis-timeline-bar">
        <button
          type="button"
          className="gis-play-btn"
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? 'Pause Simulation Timeline' : 'Play Simulation Timeline'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div className="gis-slider-track-wrap">
          <div className="gis-timeline-info">
            <span className="gis-time-tag">
              TIMESTEP: T+{currentTime.toFixed(1)} HOURS
            </span>
            <span className="gis-stage-tag">
              {currentTime < 1.0
                ? 'INITIAL BREACH INCEPTION (Gorge Overtopping)'
                : currentTime < 2.5
                ? 'RAPID WAVE EXPANSION (Advancing toward Morbi)'
                : currentTime < 8.0
                ? 'PEAK FLOOD CREST (Morbi Inundation 6.32m)'
                : 'VALLEY RECESSION & GULF OF KUTCH DRAINAGE'}
            </span>
            <span className="gis-time-tag">
              DISCHARGE: {currentDischarge.toLocaleString()} m³/s
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="24"
            step="0.5"
            value={currentTime}
            onChange={handleSliderChange}
            className="gis-slider-input"
          />
        </div>
      </div>
    </div>
  );
}
