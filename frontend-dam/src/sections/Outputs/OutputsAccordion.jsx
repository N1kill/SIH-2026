import React, { useState } from 'react';
import SectionLabel from '../../components/SectionLabel';
import ScientificPlotModal from '../../components/ScientificPlotModal';
import GisMap2D from '../../components/GisMap2D/GisMap2D';
import {
  DAMAGE_ASSESSMENT,
  RISK_ANALYSIS,
  SIMULATION_SUMMARY,
  VALIDATION_REPORT,
  SCIENTIFIC_PLOTS,
  HEADLINE_KPIS,
} from '../../data/outputs/simulationOutputs';
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
 * Connected to authentic SIH-2026 simulation datasets and high-resolution GIS plots.
 */
export default function OutputsAccordion() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [inspectModal, setInspectModal] = useState(null);
  const [selectedPlotModal, setSelectedPlotModal] = useState(null);
  const [showLiveGisModal, setShowLiveGisModal] = useState(false);

  // Helper to find a registered scientific plot by ID
  const getPlot = (id) => SCIENTIFIC_PLOTS.find((p) => p.id === id);

  const outputs = [
    {
      id: 'summary',
      pillLabel: 'SIMULATION SUMMARY',
      filename: 'simulation_summary.json',
      title: 'Headline KPI Stat Cards & Downstream Gauging',
      subtitle: '2D Unsteady Hydrodynamic Raster Engine (Manning / Diffusive Wave, 30m Grid)',
      badge: 'KPI ENGINE',
      icon: BoltIcon,
      accentColor: '#3fa89b',
      plotId: 'inflow_hydrograph',
      secondaryPlotId: 'breach_parameter_plot',
      plotButtonLabel: 'VIEW INFLOW HYDROGRAPH (HI-RES)',
      description:
        'The primary hydrodynamic KPI engine output. Calibrated to the Froehlich (2008) breach formulation, tracking downstream flood wave progression across 4 real-time gauging checkpoints between Machhu-II Dam Toe and Malia Miyana.',
      keyMetrics: [
        { label: 'PEAK DISCHARGE', val: `${Math.round(HEADLINE_KPIS.peakDischargeM3s).toLocaleString()} m³/s` },
        { label: 'MORBI ARRIVAL', val: `${HEADLINE_KPIS.morbiArrivalTimeHours.toFixed(2)}h (${HEADLINE_KPIS.morbiArrivalMinutes}m)` },
        { label: 'MORBI PEAK DEPTH', val: `${HEADLINE_KPIS.morbiPeakDepthM.toFixed(2)} m` },
        { label: 'BREACH WIDTH (Bavg)', val: `${SIMULATION_SUMMARY.breach_parameters_used?.B_avg_m || 156} m` },
      ],
      pipelineRole: 'Directly hydrates React dashboard KPI cards and downstream timeline gauge telemetry.',
      payloadSample: SIMULATION_SUMMARY,
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
          <text x="275" y="85" fill="#fde047" fontFamily="var(--font-mono)" fontSize="12" fontWeight="700">
            PEAK: 6,641 m³/s (t=2.5h) · MORBI ARRIVAL: 94m
          </text>
          {/* Grid annotations */}
          <line x1="260" y1="90" x2="260" y2="265" stroke="rgba(253, 224, 71, 0.4)" strokeDasharray="4 4" />
          <text x="50" y="40" fill="#3fa89b" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700">
            OUTPUT: simulation_summary.json // FROEHLICH (2008) BREACH ENGINE
          </text>
          <text x="50" y="60" fill="rgba(167, 182, 169, 0.6)" fontFamily="var(--font-mono)" fontSize="10">
            4 DOWNSTREAM GAUGING STATIONS · 30M RESOLUTION · 100% DETERMINISTIC
          </text>
        </svg>
      ),
    },
    {
      id: 'rasters',
      pillLabel: 'HYDRO RASTERS',
      filename: 'depth_max.tif / velocity_max.tif',
      title: '2D Leaflet Heatmap & 3D Three.js Water Mesh Grid',
      subtitle: 'Dense floating-point hydrodynamic GeoTIFF matrices (30m Resolution)',
      badge: 'GEO-RASTER TWIN',
      icon: WaveIcon,
      accentColor: '#38bdf8',
      plotId: 'inundation_depth_map',
      plotButtonLabel: 'VIEW 2D INUNDATION DEPTH MAP',
      description:
        'The colored flood-extent raster layers driving our 2D Leaflet flood map and Three.js 3D displaced water mesh. Converted via 15_export_3d_terrain.py into coordinate elevation grids capturing maximum depth and velocity across 123.38 km².',
      keyMetrics: [
        { label: 'MAX WATER DEPTH', val: `${SIMULATION_SUMMARY.max_simulated_depth_m?.toFixed(2) || '21.44'} m` },
        { label: 'PEAK VELOCITY', val: `${SIMULATION_SUMMARY.max_simulated_velocity_ms?.toFixed(1) || '123.6'} m/s` },
        { label: 'GRID RESOLUTION', val: '29.98 m (30m DEM)' },
        { label: 'CRS STANDARD', val: 'EPSG:4326 (WGS84)' },
      ],
      pipelineRole: 'Runs through 15_export_3d_terrain.py to drive the real-time 3D digital twin.',
      payloadSample: {
        raster_layers: ['depth_max.tif', 'velocity_max.tif', 'arrival_time.tif', 'flood_duration.tif'],
        grid_resolution_m: SIMULATION_SUMMARY.grid_resolution_m,
        max_simulated_depth_m: SIMULATION_SUMMARY.max_simulated_depth_m,
        max_simulated_velocity_ms: SIMULATION_SUMMARY.max_simulated_velocity_ms,
        total_valley_area_km2: HEADLINE_KPIS.totalInundatedAreaKm2,
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
          <line x1="220" y1="160" x2="280" y2="165" stroke="#fff" strokeWidth="2" />
          <line x1="320" y1="175" x2="380" y2="180" stroke="#fff" strokeWidth="2" />
          <text x="50" y="40" fill="#38bdf8" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700">
            OUTPUT: depth_max.tif & velocity_max.tif // 2D RASTER & 3D MESH
          </text>
          <text x="50" y="60" fill="rgba(167, 182, 169, 0.6)" fontFamily="var(--font-mono)" fontSize="10">
            PYTHON BRIDGE: 15_export_3d_terrain.py · 29.98m CELL VERTEX DISPLACEMENT
          </text>
        </svg>
      ),
    },
    {
      id: 'gee',
      pillLabel: 'GEE SATELLITE',
      filename: 'gee_flood_extent.tif',
      title: 'Google Earth Engine Satellite Ground-Truth Comparison',
      subtitle: 'Orbital Sentinel-1 SAR radar observation layer (Copernicus GRD)',
      badge: 'ORBITAL SAR',
      icon: SatelliteIcon,
      accentColor: '#c084fc',
      plotId: 'satellite_validation_plot',
      plotButtonLabel: 'VIEW SAR VALIDATION PLOT',
      description:
        'Orbital validation layer pulling Sentinel-1 Synthetic Aperture Radar (SAR) imagery via Google Earth Engine. Places actual radar-penetrated cloud-free flood boundaries side-by-side with our 2D hydrodynamic wavefront.',
      keyMetrics: [
        { label: 'DATA SOURCE', val: 'Sentinel-1 C-Band SAR' },
        { label: 'GEE PROCESSING', val: 'Otsu Threshold Mask' },
        { label: 'POLARIZATION', val: 'VV + VH dB Ratio' },
        { label: 'PIXEL ACCURACY', val: `${(HEADLINE_KPIS.validationAccuracy * 100).toFixed(2)}%` },
      ],
      pipelineRole: 'Direct dual-panel split slider benchmark against actual orbital observation.',
      payloadSample: {
        satellite_mission: 'Copernicus Sentinel-1 GRD',
        engine: 'Google Earth Engine (GEE API)',
        band: 'VV_decibel_filtered',
        flood_mask_threshold_db: -16.5,
        comparison_mode: 'Dual-panel Split-Screen Slider',
        confusion_matrix: VALIDATION_REPORT.accuracy_metrics,
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
          <text x="50" y="60" fill="rgba(167, 182, 169, 0.6)" fontFamily="var(--font-mono)" fontSize="10">GOOGLE EARTH ENGINE ORBITAL C-BAND RADAR · OVERALL ACCURACY: 99.91%</text>
        </svg>
      ),
    },
    {
      id: 'validation',
      pillLabel: 'VALIDATION REPORT',
      filename: 'validation_report.json',
      title: 'Critical Success Index & Historical Ground-Truth Match',
      subtitle: '1979 Machhu-II Disaster Benchmark (Sandesara & Wooten, CWC/NDMA Records)',
      badge: 'METRICS & CSI',
      icon: ChartIcon,
      accentColor: '#10b981',
      plotId: 'sensitivity_scenarios_plot',
      plotButtonLabel: 'VIEW SENSITIVITY PLOT',
      description:
        'Comprehensive empirical verification comparing simulated water elevations against documented high-water marks from the 1979 disaster. Demonstrates exceptional mathematical convergence with only 3.61% relative depth error at Morbi City.',
      keyMetrics: [
        { label: 'CSI SCORE', val: `${HEADLINE_KPIS.validationCSI.toFixed(4)} (84.4%)` },
        { label: 'F1-SCORE', val: `${HEADLINE_KPIS.validationF1.toFixed(4)}` },
        { label: 'HIT RATE (RECALL)', val: `${(VALIDATION_REPORT.accuracy_metrics?.Hit_Rate_Sensitivity * 100 || 97.7).toFixed(1)}%` },
        { label: 'HISTORICAL ERROR', val: `${HEADLINE_KPIS.historicalDepthErrorPercent}% (6.1m vs 6.32m)` },
      ],
      pipelineRole: 'Empirical calibration against 1979 post-disaster survey benchmarks and 5 parametric sensitivity runs.',
      payloadSample: VALIDATION_REPORT,
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
          <text x="50" y="40" fill="#10b981" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700">OUTPUT: validation_report.json // CSI: 0.8435 · F1: 0.9151</text>
          <text x="50" y="60" fill="rgba(167, 182, 169, 0.6)" fontFamily="var(--font-mono)" fontSize="10">HISTORICAL BENCHMARK: 6.1m SUSTAINED / 6.32m SIMULATED (3.61% RELATIVE ERROR)</text>
        </svg>
      ),
    },
    {
      id: 'damage',
      pillLabel: 'DAMAGE ASSESSMENT',
      filename: 'damage_assessment.json',
      title: 'Socio-Economic Exposure & Multi-Sector Infrastructure Loss',
      subtitle: 'Population Density Grids, Road Networks & ₹3,629.14 Cr Loss Model',
      badge: 'DEMOGRAPHIC EXPOSURE',
      icon: BuildingIcon,
      accentColor: '#b88d2a',
      plotId: 'economic_loss_summary',
      plotButtonLabel: 'VIEW ECONOMIC LOSS SUMMARY',
      description:
        'Spatially coupled loss model cross-referencing maximum flood inundation boundaries with residential cadastre, transport arteries, and agrarian zones. Captures 214,559 total exposed individuals and 44,699 affected structures.',
      keyMetrics: [
        { label: 'POPULATION EXPOSED', val: `${HEADLINE_KPIS.totalExposedPopulation.toLocaleString()}` },
        { label: 'STRUCTURES AFFECTED', val: `${HEADLINE_KPIS.buildingsAffected.toLocaleString()}` },
        { label: 'ESTIMATED LOSS', val: `₹${HEADLINE_KPIS.totalEconomicLossCr.toFixed(2)} Cr` },
        { label: 'INFRASTRUCTURE', val: `${HEADLINE_KPIS.roadsInundatedKm} km · ${HEADLINE_KPIS.bridgesOvertopped} Bridges` },
      ],
      pipelineRole: 'Feeds high-level economic loss and humanitarian exposure summaries.',
      payloadSample: DAMAGE_ASSESSMENT,
      renderGraphic: () => (
        <svg viewBox="0 0 700 320" className="unified-theme-svg">
          <defs>
            <pattern id="gridDmg" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(184, 141, 42, 0.12)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridDmg)" />
          {/* Isometric building footprints */}
          {[
            [120, 160, 40, 50, '#ef4444'], [180, 140, 35, 60, '#f97316'], [230, 170, 45, 40, '#fde047'],
            [300, 130, 50, 70, '#ef4444'], [370, 160, 40, 45, '#f97316'], [430, 145, 38, 55, '#fde047'],
            [490, 165, 42, 40, 'rgba(167,182,169,0.3)'], [550, 150, 35, 50, 'rgba(167,182,169,0.3)']
          ].map(([x, y, w, h, col], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} rx="3" fill={col} fillOpacity="0.3" stroke={col} strokeWidth="1.5" />
          ))}
          <text x="50" y="40" fill="#b88d2a" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700">OUTPUT: damage_assessment.json // ₹3,629.14 CR SOCIO-ECONOMIC LOSS</text>
          <text x="50" y="60" fill="rgba(167, 182, 169, 0.6)" fontFamily="var(--font-mono)" fontSize="10">214,559 EXPOSED CITIZENS · 44,699 STRUCTURES · 394.8 KM ROADS · 6 BRIDGES</text>
        </svg>
      ),
    },
    {
      id: 'risk',
      pillLabel: 'RISK & EVACUATION',
      filename: 'risk_analysis_summary.json / risk_map.tif',
      title: 'Topographic Risk Zoning & High-Ground HADR Centers',
      subtitle: 'Dynamic Network Routing to High-Ground Shelters (>52m MSL)',
      badge: 'HAZARD MATRIX',
      icon: AlertIcon,
      accentColor: '#ef4444',
      plotId: 'risk_evacuation_map',
      plotButtonLabel: 'VIEW EVACUATION MAP',
      description:
        'Tactical disaster management routing isolating submerged roadway segments and directing civic evacuations along primary safe corridor R1_EAST and secondary route R2_SOUTH toward 3 designated high-ground HADR centers.',
      keyMetrics: [
        { label: 'CRITICAL LEAD TIME', val: '2.5 Hours (Morbi)' },
        { label: 'HIGH GROUND BUFFER', val: '> 52.0 m MSL' },
        { label: 'SHELTER CAPACITY', val: '55,000 Persons' },
        { label: 'SAFE CORRIDORS', val: 'R1_EAST & R2_SOUTH' },
      ],
      pipelineRole: 'Drives the tactical evacuation priority list and emergency routing.',
      payloadSample: RISK_ANALYSIS,
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
          <text x="50" y="40" fill="#ef4444" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700">OUTPUT: risk_analysis_summary.json // TACTICAL EVACUATION ROUTING</text>
          <text x="50" y="60" fill="rgba(167, 182, 169, 0.6)" fontFamily="var(--font-mono)" fontSize="10">2.5H CRITICAL LEAD TIME · 3 HADR CENTERS (55,000 CAPACITY) · ELEVATION &gt;52M MSL</text>
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
      plotId: 'accuracy_comparison_map',
      plotButtonLabel: 'VIEW GIS ACCURACY MAP',
      description:
        'The export bundle allowing real disaster-management officers to ingest PRALAYA simulation rasters directly into QGIS, ArcGIS, or Google Earth. Georeferenced in EPSG:4326 with standard attribute tables for field deployment.',
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
        available_plots: SCIENTIFIC_PLOTS.map((p) => p.title),
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
  const currentPlot = current.plotId ? getPlot(current.plotId) : null;
  const currentSecondaryPlot = current.secondaryPlotId ? getPlot(current.secondaryPlotId) : null;

  const handleExportDownload = (format = 'zip') => {
    const fileMap = {
      zip: '/exports/machhu_flood_extent_shp.zip',
      kml: '/exports/machhu_flood_extent.kml',
      geojson: '/exports/machhu_flood_extent.geojson',
    };
    const target = fileMap[format] || fileMap.zip;
    const a = document.createElement('a');
    a.href = target;
    a.download = target.split('/').pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyJSON = () => {
    if (inspectModal) {
      navigator.clipboard.writeText(JSON.stringify(inspectModal.payloadSample, null, 2));
      alert(`Copied ${inspectModal.filename} payload to clipboard!`);
    }
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
          <p className="lede" style={{ maxWidth: '880px' }}>
            PRALAYA generates verified computational outputs from the 2D hydrodynamic raster engine.
            Explore authentic simulation payloads, empirical validation benchmarks, and high-resolution GIS visualization plots.
          </p>
        </div>

        {/* Horizontal Expanding Accordion Container */}
        <div className="outputs-accordion-deck">
          {outputs.map((item, idx) => {
            const isActive = idx === activeIndex;
            const PillIcon = item.icon;
            const itemPlot = item.plotId ? getPlot(item.plotId) : null;

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
                    <div className="pill-bottom-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#5eead4', opacity: 0.6 }} />
                  </div>
                )}

                {/* 2. EXPANDED VIEW: Rich Featured Showcase Card */}
                {isActive && (
                  <div className="expanded-showcase-card">
                    {/* Authentic High-Resolution Scientific GIS Plot Backdrop */}
                    <div className="showcase-graphic-backdrop">
                      {itemPlot ? (
                        <img
                          src={itemPlot.image}
                          alt={itemPlot.title}
                          className="showcase-plot-bg-img"
                        />
                      ) : (
                        item.renderGraphic()
                      )}
                    </div>
                    <div className="showcase-dark-gradient" />

                    {/* Top Meta Bar */}
                    <div className="showcase-top-bar">
                      <div className="showcase-badge-pill">
                        <span className="badge-pulse" />
                        {item.badge}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {itemPlot && (
                          <span className="plot-available-badge">
                            ● HI-RES PLOT ATTACHED
                          </span>
                        )}
                        <div className="showcase-filename-code">
                          <code>{item.filename}</code>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Content Area */}
                    <div className="showcase-bottom-content">
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
                          {/* Button to open the actual high-resolution plot modal */}
                          {currentPlot && (
                            <button
                              type="button"
                              className="view-plot-btn"
                              onClick={() => setSelectedPlotModal(currentPlot)}
                              title="Inspect high-resolution GIS scientific plot"
                            >
                              <span>{item.plotButtonLabel || 'VIEW HI-RES PLOT'}</span>
                              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                                <path d="M3 11L11 3M11 3H5M11 3V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          )}

                          {currentSecondaryPlot && (
                            <button
                              type="button"
                              className="view-plot-btn"
                              style={{ background: 'rgba(253, 224, 71, 0.15)', borderColor: 'rgba(253, 224, 71, 0.45)', color: '#fde047' }}
                              onClick={() => setSelectedPlotModal(currentSecondaryPlot)}
                              title="Inspect secondary failure equation plot"
                            >
                              <span>BREACH FORMULAS ↗</span>
                            </button>
                          )}

                          {item.id === 'rasters' && (
                            <button
                              type="button"
                              className="view-plot-btn"
                              style={{ background: 'rgba(56, 189, 248, 0.22)', borderColor: 'rgba(56, 189, 248, 0.55)', color: '#38bdf8' }}
                              onClick={() => setShowLiveGisModal(true)}
                              title="Launch interactive 2D Leaflet flood contour map"
                            >
                              <span>LAUNCH 2D LEAFLET MAP 🗺️</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="inspect-payload-btn"
                            onClick={() => setInspectModal(item)}
                          >
                            INSPECT SCHEMA ▾
                          </button>

                          {item.isExportAction && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="export-pack-btn"
                                onClick={() => handleExportDownload('zip')}
                                title="Download ESRI Shapefile Package (.shp, .shx, .dbf, .prj in zip)"
                              >
                                SHP (.ZIP) ↓
                              </button>
                              <button
                                type="button"
                                className="export-pack-btn"
                                style={{ background: 'rgba(56, 189, 248, 0.2)', borderColor: 'rgba(56, 189, 248, 0.45)', color: '#38bdf8' }}
                                onClick={() => handleExportDownload('kml')}
                                title="Download Google Earth KML"
                              >
                                KML ↓
                              </button>
                              <button
                                type="button"
                                className="export-pack-btn"
                                style={{ background: 'rgba(167, 182, 169, 0.15)', borderColor: 'rgba(167, 182, 169, 0.3)', color: '#e2e8f0' }}
                                onClick={() => handleExportDownload('geojson')}
                                title="Download GeoJSON Polygons"
                              >
                                GEOJSON ↓
                              </button>
                            </div>
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
                <span className="inspect-modal-badge">DIRECT PIPELINE ARTIFACT</span>
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
                Standardized SIH-2026 pipeline artifact consumed by PRALAYA frontend telemetry.
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="modal-download-json-btn"
                  onClick={handleCopyJSON}
                >
                  Copy JSON
                </button>
                <a
                  href={`/data/outputs/${inspectModal.filename}`}
                  download={inspectModal.filename}
                  className="modal-download-json-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download File
                </a>
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
        </div>
      )}

      {/* High-Resolution Scientific GIS Plot Modal */}
      {selectedPlotModal && (
        <ScientificPlotModal
          plot={selectedPlotModal}
          onClose={() => setSelectedPlotModal(null)}
        />
      )}

      {/* Interactive 2D Leaflet GIS Map Modal */}
      {showLiveGisModal && (
        <div className="inspect-modal-backdrop" onClick={() => setShowLiveGisModal(false)}>
          <div
            className="inspect-modal-card"
            style={{ maxWidth: '1100px', width: '95vw', padding: '18px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inspect-modal-header" style={{ marginBottom: '14px' }}>
              <div>
                <span className="inspect-modal-badge">INTERACTIVE 2D LEAFLET GIS ENGINE</span>
                <h4 style={{ margin: '4px 0 0 0', color: '#ffffff' }}>Machhu-II Basin 2D Hydrodynamic Flood Extent & HADR Shelters</h4>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setShowLiveGisModal(false)}
              >
                ✕
              </button>
            </div>
            <div style={{ borderRadius: '10px', overflow: 'hidden' }}>
              <GisMap2D height="560px" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
