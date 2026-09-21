import React, { useState } from 'react';
import SectionLabel from '../../components/SectionLabel';
import {
  BoltIcon,
  WaveIcon,
  SatelliteIcon,
  ChartIcon,
  BuildingIcon,
  AlertIcon,
  MapIcon,
} from '../../components/Icons';
import './outputs.css';

/**
 * Scene 04 — Deliverables & Outputs Engine
 * Horizontal Expanding Accordion Deck with 100% Unified Hydrodynamic Theme.
 * Zero emojis, all clean SVG vector iconography and unified digital twin visuals.
 */
export default function OutputsAccordion() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [inspectModal, setInspectModal] = useState(null);

  const outputs = [
    {
      id: 'summary',
      pillLabel: 'SIMULATION SUMMARY',
      filename: 'simulation_summary.json',
      title: 'Headline KPI Stat Cards & Breach Timeline',
      subtitle: 'Single file underpinning all primary dashboard metrics',
      badge: 'KPI ENGINE',
      icon: BoltIcon,
      accentColor: '#3fa89b',
      description:
        'This is the single file most of your "headline numbers" trace back to. Powers the primary KPI stat cards (peak depth, wave arrival time, inundated area) and the scenario cards\' "Breach width / Formation time" figures across the platform.',
      keyMetrics: [
        { label: 'PEAK DEPTH', val: '14.5 m' },
        { label: 'ARRIVAL TIME', val: '2h 45m' },
        { label: 'INUNDATED AREA', val: '68.4 km²' },
        { label: 'BREACH WIDTH', val: '215 m' },
      ],
      pipelineRole: 'Fed directly to React state to hydrate all landing & dashboard KPI components.',
      payloadSample: {
        simulation_id: 'PRALAYA_SIM_1979_MACHHU2',
        peak_depth_m: 14.5,
        wave_arrival_time_min: 165,
        total_inundated_area_km2: 68.4,
        breach_width_m: 215.0,
        formation_time_hr: 1.85,
        peak_discharge_m3s: 14850.0,
        downstream_checkpoint: 'Morbi City Center (18km)',
      },
      renderGraphic: () => (
        <svg viewBox="0 0 700 320" className="unified-theme-svg">
          <defs>
            <linearGradient id="gSummary" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3fa89b" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0d1b18" stopOpacity="0.05" />
            </linearGradient>
            <pattern id="gridSum" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(63, 168, 155, 0.12)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridSum)" />
          {/* Hydrograph wave fill */}
          <path d="M 40 240 Q 180 230 260 90 T 480 220 L 660 240 L 660 270 L 40 270 Z" fill="url(#gSummary)" />
          {/* Outflow line */}
          <path d="M 40 240 Q 180 230 260 90 T 480 220 L 660 240" fill="none" stroke="#3fa89b" strokeWidth="3" />
          {/* Peak point */}
          <circle cx="260" cy="90" r="7" fill="#fde047" stroke="#0a1110" strokeWidth="3" />
          <text x="275" y="85" fill="#fde047" fontFamily="var(--font-mono)" fontSize="12" fontWeight="700">PEAK: 14,850 m³/s (t=2h 45m)</text>
          {/* Grid annotations */}
          <line x1="260" y1="90" x2="260" y2="265" stroke="rgba(253, 224, 71, 0.4)" strokeDasharray="4 4" />
          <text x="50" y="40" fill="#3fa89b" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700">OUTPUT: simulation_summary.json // KPI HYDROGRAPH ENGINE</text>
          <text x="50" y="60" fill="rgba(167, 182, 169, 0.6)" fontFamily="var(--font-mono)" fontSize="10">COUPLED TO REACT DASHBOARD STATE · 100% DETERMINISTIC</text>
        </svg>
      ),
    },
    {
      id: 'rasters',
      pillLabel: 'HYDRO RASTERS',
      filename: 'depth_max.tif / velocity_max.tif',
      title: '2D Leaflet Heatmap & 3D Three.js Water Mesh Grid',
      subtitle: 'Dense floating-point hydrodynamic GeoTIFF matrices',
      badge: 'GEO-RASTER TWIN',
      icon: WaveIcon,
      accentColor: '#38bdf8',
      description:
        'The actual colored flood-extent layer on the 2D Leaflet map, and the height/color of water in the 3D terrain twin. These are rasters (grids of numbers), converted via 15_export_3d_terrain.py into a colored PNG overlay (2D map) or a cell-by-cell JSON coordinate grid that Three.js reads to displace vertex heights.',
      keyMetrics: [
        { label: 'SCRIPT WIRING', val: '15_export_3d_terrain.py' },
        { label: '2D CONSUMER', val: 'Leaflet Raster Layer' },
        { label: '3D CONSUMER', val: 'Three.js Mesh Grid' },
        { label: 'DATA FORMAT', val: '32-Bit Float GeoTIFF' },
      ],
      pipelineRole: 'Runs through 15_export_3d_terrain.py to drive the real-time 3D digital twin.',
      payloadSample: {
        raster_layers: ['depth_max.tif', 'velocity_max.tif'],
        grid_resolution_m: 25.0,
        crs: 'EPSG:4326 (WGS84)',
        nodata_value: -9999.0,
        max_depth_recorded: 14.52,
        max_velocity_ms: 8.42,
        export_bridge: '15_export_3d_terrain.py -> threejs_grid.json',
      },
      renderGraphic: () => (
        <svg viewBox="0 0 700 320" className="unified-theme-svg">
          <defs>
            <pattern id="gridRaster" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(56, 189, 248, 0.12)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridRaster)" />
          {/* Contour layers */}
          <path d="M 80 80 Q 220 50 360 110 T 620 120 L 590 260 Q 420 280 260 240 Z" fill="rgba(56, 189, 248, 0.12)" stroke="#38bdf8" strokeWidth="1.5" />
          <path d="M 140 110 Q 260 85 360 135 T 540 150 L 520 235 Q 380 250 250 215 Z" fill="rgba(63, 168, 155, 0.2)" stroke="#3fa89b" strokeWidth="1.5" />
          <path d="M 200 135 Q 290 120 370 150 T 460 170 L 440 215 Q 360 225 250 190 Z" fill="rgba(239, 68, 68, 0.28)" stroke="#ef4444" strokeWidth="2" />
          {/* Flow vectors */}
          <line x1="220" y1="160" x2="280" y2="165" stroke="#fff" strokeWidth="2" markerEnd="url(#arrow)" />
          <line x1="320" y1="175" x2="380" y2="180" stroke="#fff" strokeWidth="2" />
          <text x="50" y="40" fill="#38bdf8" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700">OUTPUT: depth_max.tif & velocity_max.tif // 2D RASTER & 3D MESH</text>
          <text x="50" y="60" fill="rgba(167, 182, 169, 0.6)" fontFamily="var(--font-mono)" fontSize="10">PYTHON BRIDGE: 15_export_3d_terrain.py · CELL VERTEX DISPLACEMENT</text>
        </svg>
      ),
    },
    {
      id: 'gee',
      pillLabel: 'GEE SATELLITE',
      filename: 'gee_flood_extent.tif',
      title: 'Google Earth Engine Satellite Ground-Truth Comparison',
      subtitle: 'Orbital Sentinel-1 SAR radar observation layer',
      badge: 'ORBITAL SAR',
      icon: SatelliteIcon,
      accentColor: '#c084fc',
      description:
        'The right-hand panel in the validation "compare" section. Pulls satellite-observed Sentinel-1 Synthetic Aperture Radar (SAR) flood extents through Google Earth Engine (GEE), placing orbital ground truth directly side-by-side with your simulated hydrodynamic wavefront.',
      keyMetrics: [
        { label: 'DATA SOURCE', val: 'Sentinel-1 C-Band SAR' },
        { label: 'GEE PROCESSING', val: 'Otsu Threshold Mask' },
        { label: 'POLARIZATION', val: 'VV + VH dB Ratio' },
        { label: 'RESOLUTION', val: '10m Orbital Pixel' },
      ],
      pipelineRole: 'Direct dual-panel split slider benchmark against actual orbital observation.',
      payloadSample: {
        satellite_mission: 'Copernicus Sentinel-1 GRD',
        engine: 'Google Earth Engine (GEE API)',
        band: 'VV_decibel_filtered',
        flood_mask_threshold_db: -16.5,
        comparison_mode: 'Dual-panel Split-Screen Slider',
      },
      renderGraphic: () => (
        <svg viewBox="0 0 700 320" className="unified-theme-svg">
          <defs>
            <pattern id="gridSat" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(63, 168, 155, 0.15)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridSat)" />
          {/* Left Sentinel boundary */}
          <path d="M 60 100 Q 160 80 260 120 T 340 240 L 80 250 Z" fill="rgba(63, 168, 155, 0.25)" stroke="#3fa89b" strokeWidth="2" />
          {/* Right Simulated overlay */}
          <path d="M 360 90 Q 460 75 560 115 T 640 245 L 380 255 Z" fill="rgba(94, 234, 212, 0.2)" stroke="#5eead4" strokeWidth="2" />
          {/* Split divider line */}
          <line x1="350" y1="50" x2="350" y2="280" stroke="#fde047" strokeWidth="2" strokeDasharray="6 4" />
          <text x="355" y="70" fill="#fde047" fontFamily="var(--font-mono)" fontSize="10" fontWeight="700">SPLIT: OBSERVED vs SIMULATED</text>
          <text x="50" y="40" fill="#81e6d9" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700">OUTPUT: gee_flood_extent.tif // SENTINEL-1 SAR CALIBRATION</text>
          <text x="50" y="60" fill="rgba(167, 182, 169, 0.6)" fontFamily="var(--font-mono)" fontSize="10">GOOGLE EARTH ENGINE ORBITAL C-BAND RADAR · OTSU THRESHOLD MASK</text>
        </svg>
      ),
    },
    {
      id: 'validation',
      pillLabel: 'VALIDATION REPORT',
      filename: 'validation_report.json',
      title: 'Critical Success Index & Historical Match Metrics',
      subtitle: 'Mathematical verification against documented benchmarks',
      badge: 'METRICS & CSI',
      icon: ChartIcon,
      accentColor: '#10b981',
      description:
        'Contains the CSI (Critical Success Index), F1-score, and historical-match statistics displayed across the dashboard and validation section. Empirically verifies simulation accuracy against recorded high-water marks (HWM) from the 1979 disaster.',
      keyMetrics: [
        { label: 'CSI SCORE', val: '0.88' },
        { label: 'F1-SCORE', val: '0.91' },
        { label: 'PRECISION', val: '93.4%' },
        { label: 'RECALL', val: '89.2%' },
      ],
      pipelineRole: 'Provides statistical proof of model convergence and spatial overlap fidelity.',
      payloadSample: {
        critical_success_index_csi: 0.882,
        f1_score: 0.914,
        precision: 0.934,
        recall: 0.892,
        historical_case: 'Machhu-II 1979 Survey Marks',
        gauge_stations_evaluated: 28,
        mean_depth_error_m: 0.42,
      },
      renderGraphic: () => (
        <svg viewBox="0 0 700 320" className="unified-theme-svg">
          <defs>
            <pattern id="gridVal" width="25" height="25" patternUnits="userSpaceOnUse">
              <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(16, 185, 129, 0.1)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridVal)" />
          {/* Regression Line */}
          <line x1="80" y1="240" x2="600" y2="80" stroke="rgba(16, 185, 129, 0.5)" strokeWidth="2" strokeDasharray="4 4" />
          {/* Scatter points */}
          {[
            [120, 225], [160, 210], [200, 195], [240, 180], [280, 168], [320, 155], [360, 142],
            [400, 130], [440, 118], [480, 105], [520, 95], [560, 85]
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx + (i % 3 - 1) * 6} cy={cy + ((i * 5) % 9 - 4)} r="5" fill="#10b981" stroke="#0a1110" strokeWidth="2" />
          ))}
          <text x="50" y="40" fill="#10b981" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700">OUTPUT: validation_report.json // CSI & HISTORICAL FIT</text>
          <text x="50" y="60" fill="rgba(167, 182, 169, 0.6)" fontFamily="var(--font-mono)" fontSize="10">CRITICAL SUCCESS INDEX: 0.88 · F1-SCORE: 0.91 · 28 BENCHMARK STATIONS</text>
        </svg>
      ),
    },
    {
      id: 'damage',
      pillLabel: 'DAMAGE ASSESSMENT',
      filename: 'damage_assessment.json',
      title: 'Socio-Economic Exposure & Infrastructure Loss',
      subtitle: 'Population density overlays & structural damage estimates',
      badge: 'DEMOGRAPHIC EXPOSURE',
      icon: BuildingIcon,
      accentColor: '#b88d2a',
      description:
        'Powers the impact-numbers band (population exposed, structures affected, estimated ₹ loss). Built with rigorous scientific honesty: this is explicitly a density-based demographic proxy estimate, not an individually GIS-verified cadastral building survey.',
      keyMetrics: [
        { label: 'POPULATION EXPOSED', val: '124,500' },
        { label: 'STRUCTURES AT RISK', val: '18,420' },
        { label: 'ESTIMATED LOSS', val: '₹3,420 Cr ($410M)' },
        { label: 'CRITICAL ASSETS', val: '102 Facilities' },
      ],
      pipelineRole: 'Feeds high-level economic loss and humanitarian exposure summaries.',
      isEstimateHonesty: true,
      honestyNote:
        'SCIENTIFIC HONESTY NOTICE: These loss figures are generated using demographic density proxies from census & WorldPop rasters, NOT individually GIS-verified ground structural surveys.',
      payloadSample: {
        population_exposed: 124500,
        structures_inundated: 18420,
        estimated_loss_inr_crores: 3420,
        residential_loss_cr: 250,
        infrastructure_loss_cr: 1850,
        agricultural_loss_cr: 720,
        methodology: 'Demographic density proxy (not cadastral building survey)',
      },
      renderGraphic: () => (
        <svg viewBox="0 0 700 320" className="unified-theme-svg">
          <defs>
            <pattern id="gridDmg" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(184, 141, 42, 0.12)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridDmg)" />
          {/* Isometric building footprint representations */}
          {[
            [120, 160, 40, 50, '#ef4444'], [180, 140, 35, 60, '#f97316'], [230, 170, 45, 40, '#fde047'],
            [300, 130, 50, 70, '#ef4444'], [370, 160, 40, 45, '#f97316'], [430, 145, 38, 55, '#fde047'],
            [490, 165, 42, 40, 'rgba(167,182,169,0.3)'], [550, 150, 35, 50, 'rgba(167,182,169,0.3)']
          ].map(([x, y, w, h, col], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} rx="3" fill={col} fillOpacity="0.3" stroke={col} strokeWidth="1.5" />
          ))}
          <text x="50" y="40" fill="#b88d2a" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700">OUTPUT: damage_assessment.json // SOCIO-ECONOMIC EXPOSURE</text>
          <text x="50" y="60" fill="rgba(167, 182, 169, 0.6)" fontFamily="var(--font-mono)" fontSize="10">METHODOLOGY: DEMOGRAPHIC DENSITY PROXY · NOT INDIVIDUALLY GIS-VERIFIED</text>
        </svg>
      ),
    },
    {
      id: 'risk',
      pillLabel: 'RISK & EVACUATION',
      filename: 'risk_analysis_summary.json / risk_map.tif',
      title: 'Evacuation-Priority Sequencing & Hazard Zoning',
      subtitle: 'Downstream ward rankings & multi-tier hazard boundaries',
      badge: 'HAZARD MATRIX',
      icon: AlertIcon,
      accentColor: '#ef4444',
      description:
        'Computes the dynamic evacuation-priority sequence list and color-coded hazard zones on the 2D dashboard\'s risk layer. Ranks downstream villages and municipal wards by wave arrival ETA and localized inundation depth.',
      keyMetrics: [
        { label: 'PRIORITY 1', val: 'Ward 4 (ETA 45m)' },
        { label: 'PRIORITY 2', val: 'Riverbank East (ETA 1h 10m)' },
        { label: 'HAZARD RED', val: '> 3.0 m Depth' },
        { label: 'SAFE SHELTERS', val: '12 Georeferenced' },
      ],
      pipelineRole: 'Drives the tactical evacuation priority list and emergency routing.',
      payloadSample: {
        priority_1_sector: 'Ward 4 (Morbi Central)',
        priority_1_eta_min: 45,
        priority_1_severity: 'EXTREME (>3.0m)',
        priority_2_sector: 'Riverbank East',
        priority_2_eta_min: 70,
        active_evacuation_routes: 8,
        nearest_highground_shelters: 12,
      },
      renderGraphic: () => (
        <svg viewBox="0 0 700 320" className="unified-theme-svg">
          <defs>
            <pattern id="gridRisk" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(239, 68, 68, 0.12)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridRisk)" />
          {/* Hazard Zones */}
          <path d="M 80 120 Q 200 80 320 130 T 580 140 L 560 250 Q 380 270 200 230 Z" fill="rgba(253, 224, 71, 0.15)" stroke="#fde047" strokeWidth="1.5" />
          <path d="M 140 140 Q 240 110 340 150 T 500 165 L 480 230 Q 340 245 220 210 Z" fill="rgba(249, 115, 22, 0.22)" stroke="#f97316" strokeWidth="1.5" />
          <path d="M 200 160 Q 280 140 360 170 T 440 185 L 420 220 Q 320 230 250 200 Z" fill="rgba(239, 68, 68, 0.35)" stroke="#ef4444" strokeWidth="2" />
          <text x="50" y="40" fill="#ef4444" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700">OUTPUT: risk_analysis_summary.json & risk_map.tif // HAZARD ZONING</text>
          <text x="50" y="60" fill="rgba(167, 182, 169, 0.6)" fontFamily="var(--font-mono)" fontSize="10">DYNAMIC EVACUATION SEQUENCING · HIGH-GROUND SHELTER CORRIDOR ROUTING</text>
        </svg>
      ),
    },
    {
      id: 'exports',
      pillLabel: 'GIS EXPORT PACK',
      filename: '.geojson / .kml / .shp Exports',
      title: 'Interoperable GIS Datasets for QGIS & Google Earth',
      subtitle: 'Universal spatial file formats ready for external command centers',
      badge: 'GIS DOWNLOADS',
      icon: MapIcon,
      accentColor: '#3fa89b',
      description:
        'The export bundle so a real disaster-management officer can pull the simulation results into QGIS, ArcGIS, or Google Earth outside PRALAYA\'s UI entirely. Fully georeferenced in EPSG:4326 with standard attribute tables for direct field deployment.',
      keyMetrics: [
        { label: 'GEOJSON', val: 'Vector Polygons' },
        { label: 'KML / KMZ', val: 'Google Earth 3D' },
        { label: 'SHAPEFILE', val: 'ESRI / QGIS Pack' },
        { label: 'CRS STANDARD', val: 'EPSG:4326 WGS84' },
      ],
      pipelineRole: 'Direct file download service for external GIS software and state emergency centers.',
      isExportAction: true,
      payloadSample: {
        export_formats: ['inundation_boundary.geojson', 'flood_contour.kml', 'hazard_zones.shp.zip'],
        spatial_reference: 'EPSG:4326 (WGS84)',
        feature_count: 342,
        bounding_box: [22.75, 70.80, 22.95, 71.05],
        compatibility: ['QGIS 3.x', 'ArcGIS Pro', 'Google Earth', 'OpenLayers'],
      },
      renderGraphic: () => (
        <svg viewBox="0 0 700 320" className="unified-theme-svg">
          <defs>
            <pattern id="gridGis" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(63, 168, 155, 0.12)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridGis)" />
          {/* Spatial Layer Stack */}
          <polygon points="120,180 340,110 560,180 340,250" fill="rgba(63, 168, 155, 0.15)" stroke="#3fa89b" strokeWidth="1.5" />
          <polygon points="120,150 340,80 560,150 340,220" fill="rgba(94, 234, 212, 0.15)" stroke="#5eead4" strokeWidth="1.5" />
          <polygon points="120,120 340,50 560,120 340,190" fill="rgba(253, 224, 71, 0.15)" stroke="#fde047" strokeWidth="1.5" />
          <text x="50" y="40" fill="#3fa89b" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700">OUTPUT: .geojson · .kml · .shp // OPEN GEOSPATIAL VECTOR LAYERS</text>
          <text x="50" y="60" fill="rgba(167, 182, 169, 0.6)" fontFamily="var(--font-mono)" fontSize="10">INTEROPERABLE WITH QGIS, ARCGIS & STATE DISASTER MITIGATION COMMAND CENTERS</text>
        </svg>
      ),
    },
  ];

  const current = outputs[activeIndex];
  const IconComponent = current.icon;

  const handleExportDownload = () => {
    alert(
      'Exporting PRALAYA GIS Package (inundation_boundary.geojson, flood_contour.kml, hazard_zones.shp.zip)...'
    );
  };

  return (
    <section id="outputs" className="outputs-section">
      <div className="container outputs-container">
        {/* Section Header */}
        <div className="outputs-header">
          <SectionLabel
            directive="DIRECTIVE 05 — 08"
            label="SCENE 04 // DELIVERABLE ARTIFACTS"
            variant="cyan"
          />
          <h2 className="h2" style={{ marginTop: '16px', marginBottom: '16px' }}>
            Every file powers an operational decision.
          </h2>
          <p className="lede" style={{ maxWidth: '840px' }}>
            PRALAYA generates 7 core standardized computational outputs. From floating-point hydrodynamic GeoTIFF rasters
            driving our 3D terrain twin to GIS vectors downloaded by state disaster officers, here is where every metric originates.
          </p>
        </div>

        {/* Horizontal Expanding Accordion Container */}
        <div className="outputs-accordion-deck">
          {outputs.map((item, idx) => {
            const isActive = idx === activeIndex;
            const PillIcon = item.icon;

            return (
              <div
                key={item.id}
                className={`accordion-slot ${isActive ? 'is-expanded' : 'is-collapsed'}`}
                onClick={() => !isActive && setActiveIndex(idx)}
                title={!isActive ? `Click to expand ${item.filename}` : undefined}
              >
                {/* 1. COLLAPSED VIEW: Sleek Vertical Pill Strip */}
                {!isActive && (
                  <div className="collapsed-pill-strip">
                    <div className="pill-top-icon">
                      <PillIcon size={16} color="#81e6d9" />
                    </div>
                    <div className="pill-rotated-label">
                      <span>{item.pillLabel}</span>
                    </div>
                    <div className="pill-bottom-idx">0{idx + 1}</div>
                  </div>
                )}

                {/* 2. EXPANDED VIEW: Rich Featured Showcase Card */}
                {isActive && (
                  <div className="expanded-showcase-card">
                    {/* Unified Cohesive Vector Graphic Canvas */}
                    <div className="showcase-graphic-backdrop">
                      {item.renderGraphic()}
                    </div>
                    <div className="showcase-dark-gradient" />

                    {/* Top Meta Bar */}
                    <div className="showcase-top-bar">
                      <div className="showcase-badge-pill">
                        <span className="badge-pulse" />
                        {item.badge}
                      </div>

                      <div className="showcase-filename-code">
                        <code>{item.filename}</code>
                      </div>
                    </div>

                    {/* Bottom Content Area */}
                    <div className="showcase-bottom-content">
                      {/* Honesty Callout if present */}
                      {item.isEstimateHonesty && (
                        <div className="honesty-warning-pill">
                          <AlertIcon size={16} color="#fde047" />
                          <span>{item.honestyNote}</span>
                        </div>
                      )}

                      <div className="title-row">
                        <div className="showcase-icon-avatar">
                          <IconComponent size={22} color="#81e6d9" />
                        </div>
                        <div>
                          <h3 className="showcase-title">{item.title}</h3>
                          <div className="showcase-subtitle">{item.subtitle}</div>
                        </div>
                      </div>

                      <p className="showcase-description">{item.description}</p>

                      {/* 4 Key Metrics Row */}
                      <div className="showcase-metrics-grid">
                        {item.keyMetrics.map((m, mIdx) => (
                          <div key={mIdx} className="metric-cell">
                            <span className="metric-label">{m.label}</span>
                            <span className="metric-value">{m.val}</span>
                          </div>
                        ))}
                      </div>

                      {/* Actions Footer */}
                      <div className="showcase-actions-footer">
                        <span className="pipeline-connection-text">
                          <strong>Engine Wire:</strong> {item.pipelineRole}
                        </span>

                        <div className="action-buttons-group">
                          <button
                            type="button"
                            className="inspect-payload-btn"
                            onClick={() => setInspectModal(item)}
                          >
                            INSPECT SCHEMA ▾
                          </button>

                          {item.isExportAction && (
                            <button
                              type="button"
                              className="export-pack-btn"
                              onClick={handleExportDownload}
                            >
                              EXPORT GIS PACK (.ZIP) ↓
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Jump Dots for mobile */}
        <div className="outputs-dots-nav">
          {outputs.map((_, dotIdx) => (
            <button
              key={dotIdx}
              type="button"
              className={`output-dot ${dotIdx === activeIndex ? 'active' : ''}`}
              onClick={() => setActiveIndex(dotIdx)}
              title={`Switch to output ${dotIdx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Schema / Payload Inspector Modal */}
      {inspectModal && (
        <div className="inspect-modal-backdrop" onClick={() => setInspectModal(null)}>
          <div className="inspect-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="inspect-modal-header">
              <div>
                <span className="inspect-modal-badge">DATA PAYLOAD SCHEMA</span>
                <h4>{inspectModal.filename}</h4>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setInspectModal(null)}
              >
                ✕
              </button>
            </div>

            <div className="inspect-modal-body">
              <pre className="inspect-json-code">
                {JSON.stringify(inspectModal.payloadSample, null, 2)}
              </pre>
            </div>

            <div className="inspect-modal-footer">
              <span className="footer-note">
                Standardized pipeline artifact consumed by PRALAYA frontend and backend modules.
              </span>
              <button
                type="button"
                className="modal-done-btn"
                onClick={() => setInspectModal(null)}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
