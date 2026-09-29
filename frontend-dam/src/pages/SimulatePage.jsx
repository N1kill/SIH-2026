import React, { useState, useRef, useEffect } from 'react';
import SectionLabel from '../components/SectionLabel';
import IndiaMapSVG from '../components/IndiaMapSVG';
import { INDIAN_DAMS } from '../data/damDatabase';
import {
  BoltIcon,
  WaveIcon,
  SatelliteIcon,
  ChartIcon,
  BuildingIcon,
  AlertIcon,
  MapIcon,
} from '../components/Icons';
import ScientificPlotModal from '../components/ScientificPlotModal';
import { SCIENTIFIC_PLOTS } from '../data/outputs/simulationOutputs';
import GisMap2D from '../components/GisMap2D/GisMap2D';
import InteractiveHydrograph from '../components/InteractiveHydrograph';
import InteractiveMorbiHydrograph from '../components/InteractiveMorbiHydrograph';
import InteractiveDamageAnalytics from '../components/InteractiveDamageAnalytics';
import InteractiveSensitivityScenarios from '../components/InteractiveSensitivityScenarios';
import EngineeringTwin3D from '../components/EngineeringTwin3D';
import './pages.css';

/**
 * SimulatePage — PRALAYA Simulation Outcome Dashboard
 * User selects a dam → sees location on India map → scrolls through 8 outcome sections.
 * Premium glassmorphic dark UI with hydrodynamic cyan palette.
 */

/** Icons for the 8 outcome sections */
const OUTCOME_SECTIONS = [
  {
    id: 'summary',
    badge: 'KPI ENGINE',
    pillLabel: 'SIMULATION SUMMARY',
    title: 'Headline KPI Stat Cards & Breach Timeline',
    subtitle: 'Primary dashboard metrics derived from hydrodynamic solver output',
    icon: BoltIcon,
    accentColor: '#3fa89b',
    plotId: 'inflow_hydrograph',
    plotTitle: 'INFLOW HYDROGRAPH',
    fields: ['peakDepth', 'arrivalTime', 'inundatedArea', 'breachWidth'],
    fieldLabels: ['PEAK DEPTH', 'WAVE ARRIVAL', 'INUNDATED AREA', 'BREACH WIDTH'],
    description:
      'Powers the primary KPI stat cards (peak depth, wave arrival time, inundated area) and the scenario cards\' breach width / formation time figures across the platform. Single file underpinning all headline numbers.',
  },
  {
    id: 'rasters',
    badge: 'GEO-RASTER TWIN',
    pillLabel: 'HYDRO RASTERS',
    title: '2D Leaflet Heatmap & 3D Three.js Water Mesh Grid',
    subtitle: 'Dense floating-point hydrodynamic GeoTIFF matrices',
    icon: WaveIcon,
    accentColor: '#38bdf8',
    plotId: 'inundation_depth_map',
    plotTitle: '2D INUNDATION DEPTH MAP',
    fields: ['gridRes', 'maxDepth', 'maxVelocity', 'crs'],
    fieldLabels: ['GRID RESOLUTION', 'MAX DEPTH (m)', 'MAX VELOCITY (m/s)', 'CRS'],
    description:
      'The actual colored flood-extent layer on the 2D Leaflet map, and the height/color of water in the 3D terrain twin. Rasters converted via 15_export_3d_terrain.py into a colored PNG overlay or cell-by-cell JSON coordinate grid.',
  },
  {
    id: 'satellite',
    badge: 'ORBITAL SAR',
    pillLabel: 'GEE SATELLITE',
    title: 'Google Earth Engine Satellite Ground-Truth Comparison',
    subtitle: 'Orbital Sentinel-1 SAR radar observation validation layer',
    icon: SatelliteIcon,
    accentColor: '#c084fc',
    plotId: 'satellite_validation_plot',
    plotTitle: 'ORBITAL SAR VALIDATION PLOT',
    fields: ['mission', 'threshold', 'resolution'],
    fieldLabels: ['DATA SOURCE', 'THRESHOLD (dB)', 'RESOLUTION'],
    description:
      'Pulls satellite-observed Sentinel-1 Synthetic Aperture Radar (SAR) flood extents through Google Earth Engine, placing orbital ground truth directly side-by-side with your simulated hydrodynamic wavefront.',
  },
  {
    id: 'timeseries',
    badge: 'TEMPORAL ANALYTICS',
    pillLabel: 'TIME-SERIES HYDROGRAPH',
    title: 'Outflow Hydrograph & Recession Curve Analytics',
    subtitle: 'Temporal discharge evolution from breach inception to recession',
    icon: ChartIcon,
    accentColor: '#fbbf24',
    plotId: 'morbi_hydrograph',
    plotTitle: 'MORBI GAUGING HYDROGRAPH',
    fields: ['peakTime', 'recessionHr', 'intervals'],
    fieldLabels: ['PEAK TIME', 'RECESSION (hr)', 'TIME STEPS'],
    description:
      'Complete temporal discharge evolution from breach inception through peak flow to full recession. Drives animated timeline slider and hydrograph chart components across the dashboard.',
  },
  {
    id: 'structural',
    badge: 'IMPACT FORENSICS',
    pillLabel: 'STRUCTURAL IMPACT',
    title: 'Infrastructure Vulnerability & Damage Assessment',
    subtitle: 'Bridge, building, and critical infrastructure exposure analysis',
    icon: BuildingIcon,
    accentColor: '#ef4444',
    plotId: 'economic_loss_summary',
    plotTitle: 'ECONOMIC LOSS SUMMARY PLOT',
    fields: ['bridgesAtRisk', 'buildingsExposed', 'criticalInfra'],
    fieldLabels: ['BRIDGES AT RISK', 'BUILDINGS EXPOSED', 'CRITICAL INFRA'],
    description:
      'Cross-references hydrodynamic depth/velocity grids with GIS building footprint layers to compute structural exposure. Identifies bridges at risk of scour failure and critical infrastructure (hospitals, schools, substations) within the inundation zone.',
  },
  {
    id: 'evacuation',
    badge: 'TACTICAL ROUTING',
    pillLabel: 'EVACUATION CORRIDORS',
    title: 'Dynamic Safe Corridors & Shelter Allocation',
    subtitle: 'GIS network analysis cross-referencing live wavefront depths',
    icon: AlertIcon,
    accentColor: '#86efac',
    plotId: 'risk_evacuation_map',
    plotTitle: 'TOPOGRAPHIC EVACUATION MAP',
    fields: ['corridors', 'shelters', 'maxEvacTime', 'safeZoneElevation'],
    fieldLabels: ['SAFE CORRIDORS', 'SHELTERS', 'MAX EVAC TIME', 'SAFE ZONE'],
    description:
      'Prevents civilian convoys from traversing submerged roads, dynamically verifying topographic high-ground buffers and capacity balancing. Outputs real-time safe route polylines and shelter allocation tables.',
  },
  {
    id: 'decision',
    badge: 'COMMAND CENTER',
    pillLabel: 'DECISION SUPPORT',
    title: 'Multi-Agency Coordination & Alert Dispatch',
    subtitle: 'Integrated command dashboard for emergency response orchestration',
    icon: MapIcon,
    accentColor: '#f97316',
    plotId: 'accuracy_comparison_map',
    plotTitle: 'GIS ACCURACY COMPARISON MAP',
    fields: ['alertLevel', 'responseTime', 'agenciesCoordinated'],
    fieldLabels: ['ALERT LEVEL', 'RESPONSE TIME', 'AGENCIES'],
    description:
      'Unifies all upstream output layers into a single command center dashboard. Dispatches automated alerts, coordinates multi-agency response, and tracks real-time shelter capacity and evacuation progress.',
  },
  {
    id: 'gis',
    badge: 'GIS DOWNLOADS',
    pillLabel: 'GIS EXPORT PACK',
    title: 'Interoperable GIS Datasets for QGIS & Google Earth',
    subtitle: 'Universal spatial file formats ready for external command centers',
    icon: MapIcon,
    accentColor: '#3fa89b',
    plotId: 'accuracy_comparison_map',
    plotTitle: 'GIS ACCURACY COMPARISON MAP',
    fields: ['geojson', 'kml', 'shp', 'crs'],
    fieldLabels: ['GEOJSON', 'KML / KMZ', 'SHAPEFILE', 'CRS STANDARD'],
    description:
      'The export bundle allowing real disaster-management officers to ingest PRALAYA simulation rasters directly into QGIS, ArcGIS, or Google Earth. Georeferenced in EPSG:4326 with standard attribute tables for field deployment.',
  },
];

export default function SimulatePage({ onBackToHome }) {
  const [selectedDamId, setSelectedDamId] = useState(INDIAN_DAMS[0].id);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const outcomesRef = useRef(null);

  const selectedDam = INDIAN_DAMS.find((d) => d.id === selectedDamId) || INDIAN_DAMS[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredDams = INDIAN_DAMS.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.river.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectDam = (damId) => {
    setSelectedDamId(damId);
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  const scrollToOutcomes = () => {
    outcomesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="pralaya-subpage sim-results-page">
      {/* ═══════════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════════ */}
      <div className="sim-results-hero">
        <div className="container">
          <div className="subpage-top-nav">
            <button type="button" className="back-to-home-btn" onClick={onBackToHome}>
              ← RETURN TO HOME
            </button>
            <span className="subpage-meta-tag">
              SIMULATION OUTCOME ENGINE // SOLVER ACTIVE
            </span>
          </div>

          <div className="sim-hero-content">
            <SectionLabel
              directive="HYDRODYNAMIC RESULTS"
              label="SIMULATE // OUTCOME DASHBOARD"
              variant="cyan"
            />
            <h1 className="sim-hero-title">
              Dam Breach <em>Simulation Results.</em>
            </h1>
            <p className="sim-hero-lede">
              Select a dam from the dropdown below to view pre-computed hydrodynamic breach
              simulation outcomes, including peak discharge, inundation mapping, evacuation
              corridors, and multi-agency decision support metrics.
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          DAM SELECTOR PANEL
      ═══════════════════════════════════════════ */}
      <div className="container">
        <div className="dam-selector-panel">
          {/* Left: Dropdown + Dam Details */}
          <div className="dam-selector-left">
            {/* Custom Searchable Dropdown */}
            <div className="dam-dropdown-wrapper" ref={dropdownRef}>
              <label className="dam-dropdown-label">SELECT DAM</label>
              <button
                type="button"
                className={`dam-dropdown-trigger ${isDropdownOpen ? 'open' : ''}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className="dam-dropdown-selected-name">{selectedDam.name}</span>
                <span className="dam-dropdown-selected-state">{selectedDam.state}</span>
                <svg
                  className="dam-dropdown-chevron"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M4 6L8 10L12 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className="dam-dropdown-menu">
                  <div className="dam-dropdown-search-box">
                    <input
                      type="text"
                      placeholder="Search dam, state, or river..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      className="dam-dropdown-search"
                    />
                  </div>
                  <div className="dam-dropdown-list">
                    {filteredDams.map((dam) => (
                      <button
                        key={dam.id}
                        type="button"
                        className={`dam-dropdown-item ${dam.id === selectedDamId ? 'active' : ''}`}
                        onClick={() => handleSelectDam(dam.id)}
                      >
                        <div className="dam-item-name">{dam.name}</div>
                        <div className="dam-item-meta">
                          {dam.state} · {dam.river}
                        </div>
                      </button>
                    ))}
                    {filteredDams.length === 0 && (
                      <div className="dam-dropdown-empty">No dams match your search.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Dam Details Card */}
            <div className="dam-details-card">
              <div className="dam-details-grid">
                <div className="dam-detail-item">
                  <span className="dam-detail-label">STATE</span>
                  <span className="dam-detail-value">{selectedDam.state}</span>
                </div>
                <div className="dam-detail-item">
                  <span className="dam-detail-label">DISTRICT</span>
                  <span className="dam-detail-value">{selectedDam.district}</span>
                </div>
                <div className="dam-detail-item">
                  <span className="dam-detail-label">RIVER</span>
                  <span className="dam-detail-value">{selectedDam.river}</span>
                </div>
                <div className="dam-detail-item">
                  <span className="dam-detail-label">DAM TYPE</span>
                  <span className="dam-detail-value">{selectedDam.type}</span>
                </div>
                <div className="dam-detail-item">
                  <span className="dam-detail-label">HEIGHT</span>
                  <span className="dam-detail-value highlight">{selectedDam.height}</span>
                </div>
                <div className="dam-detail-item">
                  <span className="dam-detail-label">CAPACITY</span>
                  <span className="dam-detail-value highlight">{selectedDam.capacity}</span>
                </div>
                <div className="dam-detail-item">
                  <span className="dam-detail-label">COORDINATES</span>
                  <span className="dam-detail-value coord">
                    {selectedDam.lat.toFixed(2)}°N, {selectedDam.lng.toFixed(2)}°E
                  </span>
                </div>
                <div className="dam-detail-item">
                  <span className="dam-detail-label">OPERATOR</span>
                  <span className="dam-detail-value">{selectedDam.operator}</span>
                </div>
              </div>

              {/* Risk Level Badge */}
              <div className={`dam-risk-badge risk-${selectedDam.simulation.riskLevel.toLowerCase()}`}>
                <span className="risk-dot" />
                RISK LEVEL: {selectedDam.simulation.riskLevel}
              </div>
            </div>

            {/* Scroll to outcomes CTA & Direct 3D Twin Launcher */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
              <button type="button" className="scroll-outcomes-btn" onClick={scrollToOutcomes}>
                <span>VIEW SIMULATION OUTCOMES</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2L7 12M7 12L3 8M7 12L11 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                className="scroll-outcomes-btn"
                style={{
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(14, 165, 233, 0.12) 100%)',
                  borderColor: '#38bdf8',
                  color: '#7dd3fc',
                }}
                onClick={() => {
                  outcomesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  window.dispatchEvent(new CustomEvent('pralaya_switch_raster_mode', { detail: 'twin3d' }));
                }}
                title="Launch 3D Engineering Twin & Delft3D Flexible Mesh"
              >
                <span>🎮 3D TWIN &amp; DELFT3D-FM</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 11L11 3M11 3H5M11 3V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right: India Map */}
          <div className="dam-selector-right">
            <div className="india-map-container">
              <div className="map-header">
                <div>
                  <span className="map-title">GEOSPATIAL POSITION</span>
                  <span className="map-badge-live">LIVE TELEMETRY</span>
                </div>
                <span className="map-subtitle">INDIA · SURVEY OF INDIA / WGS84</span>
              </div>
              <IndiaMapSVG
                selectedDam={selectedDam}
                allDams={INDIAN_DAMS}
                onSelectDam={(dam) => setSelectedDamId(dam.id)}
                width="100%"
                height="auto"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          QUICK STATS BAR
      ═══════════════════════════════════════════ */}
      <div className="container">
        <div className="sim-quick-stats-bar">
          <div className="quick-stat">
            <span className="quick-stat-label">PEAK DISCHARGE</span>
            <span className="quick-stat-value">{selectedDam.simulation.peakDischarge.toLocaleString()} m³/s</span>
          </div>
          <div className="quick-stat-divider" />
          <div className="quick-stat">
            <span className="quick-stat-label">WAVE ARRIVAL</span>
            <span className="quick-stat-value">{selectedDam.simulation.waveArrivalMin} min</span>
          </div>
          <div className="quick-stat-divider" />
          <div className="quick-stat">
            <span className="quick-stat-label">INUNDATED AREA</span>
            <span className="quick-stat-value">{selectedDam.simulation.inundatedAreaKm2} km²</span>
          </div>
          <div className="quick-stat-divider" />
          <div className="quick-stat">
            <span className="quick-stat-label">AFFECTED POP.</span>
            <span className="quick-stat-value">{selectedDam.simulation.affectedPopulation.toLocaleString()}</span>
          </div>
          <div className="quick-stat-divider" />
          <div className="quick-stat">
            <span className="quick-stat-label">DOWNSTREAM</span>
            <span className="quick-stat-value sm">{selectedDam.simulation.downstreamCheckpoint}</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SCROLLABLE OUTCOME SECTIONS
      ═══════════════════════════════════════════ */}
      <div className="container" ref={outcomesRef}>
        <div className="sim-outcomes-header">
          <SectionLabel
            directive="ENGINE OUTPUTS"
            label={`${selectedDam.name.toUpperCase()} // 8 OUTPUT LAYERS`}
            variant="cyan"
          />
          <h2 className="sim-outcomes-title">Hydrodynamic Simulation Outputs</h2>
          <p className="sim-outcomes-subtitle">
            Scroll through all 8 output layers generated by the PRALAYA breach simulation engine
            for <strong>{selectedDam.name}</strong>.
          </p>
        </div>

        <div className="sim-outcomes-list">
          {OUTCOME_SECTIONS.map((section, idx) => {
            const outcomeData = selectedDam.outcomes?.[section.id] || {
              geojson: 'Vector Polygons',
              kml: 'Google Earth 3D',
              shp: 'ESRI / QGIS Pack',
              crs: 'EPSG:4326 WGS84',
            };
            const IconComp = section.icon;

            return (
              <div
                key={section.id}
                className="sim-outcome-card"
                style={{ '--accent': section.accentColor }}
              >
                {/* Card Header */}
                <div className="outcome-card-header">
                  <div className="outcome-icon-box">
                    <IconComp size={22} color={section.accentColor} />
                  </div>
                  <div className="outcome-header-text">
                    <span className="outcome-badge" style={{ color: section.accentColor }}>
                      {section.badge}
                    </span>
                    <h3 className="outcome-card-title">{section.title}</h3>
                    <p className="outcome-card-subtitle">{section.subtitle}</p>
                  </div>
                  <div className="outcome-pill-label">
                    {section.pillLabel}
                  </div>
                </div>

                {/* Card Body */}
                <div className="outcome-card-body">
                  {/* KPI Grid */}
                  <div className="outcome-kpi-grid">
                    {section.fields.map((field, fi) => (
                      <div key={field} className="outcome-kpi-item">
                        <span className="outcome-kpi-label">{section.fieldLabels[fi]}</span>
                        <span
                          className="outcome-kpi-value"
                          style={{ color: section.accentColor }}
                        >
                          {outcomeData[field] ?? '—'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Description */}
                  <div className="outcome-description">
                    <p>{section.description}</p>
                  </div>

                  {/* Rich Generated Output Visualization & GIS Artifacts */}
                  <div className="outcome-viz">
                    <OutcomeVisualization section={section} dam={selectedDam} onOpenPlot={setSelectedPlot} />
                  </div>

                  {/* Button to view authentic high-resolution GIS pipeline plot */}
                  {section.plotId && (selectedDam.id === 'machhu-2' || selectedDam.id === 'machhu-ii') && (
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="view-plot-btn"
                        onClick={() => setSelectedPlot(SCIENTIFIC_PLOTS.find((p) => p.id === section.plotId))}
                        title={`Inspect authentic high-resolution ${section.plotTitle}`}
                      >
                        <span>INSPECT {section.plotTitle} (HI-RES)</span>
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                          <path d="M3 11L11 3M11 3H5M11 3V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          BOTTOM CTA
      ═══════════════════════════════════════════ */}
      <div className="container">
        <div className="sim-bottom-cta">
          <div>
            <h4>Select another dam to compare outcomes</h4>
            <p>
              Change the dam selection above to re-render all 7 output layers with
              new hydrodynamic parameters.
            </p>
          </div>
          <button
            type="button"
            className="subpage-cta-btn"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            BACK TO TOP
          </button>
        </div>
      </div>

      {/* High-Resolution Scientific GIS Plot Modal */}
      {selectedPlot && (
        <ScientificPlotModal
          plot={selectedPlot}
          onClose={() => setSelectedPlot(null)}
        />
      )}
    </div>
  );
}

/**
 * OutcomeVisualization — Renders authentic generated scientific plots,
 * 3D digital twin telemetry, and validation metrics from SIH-2026 pipeline.
 */
function OutcomeVisualization({ section, dam, onOpenPlot }) {
  const isMachhu = dam.id === 'machhu-2' || dam.id === 'machhu-ii';
  const [rasterMode, setRasterMode] = useState('raster'); // 'raster' | 'map2d' | 'twin3d'
  const [isMapMaximized, setIsMapMaximized] = useState(false);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [hydrographMode, setHydrographMode] = useState('recharts'); // 'recharts' | 'cartographic'
  const [morbiMode, setMorbiMode] = useState('recharts'); // 'recharts' | 'cartographic'
  const [damageMode, setDamageMode] = useState('recharts'); // 'recharts' | 'cartographic'
  const [decisionMode, setDecisionMode] = useState('recharts'); // 'recharts' | 'cartographic'

  // Listen to quick-launch event from upper dam selector
  useEffect(() => {
    const handleSwitch = (e) => {
      if (e.detail) setRasterMode(e.detail);
    };
    window.addEventListener('pralaya_switch_raster_mode', handleSwitch);
    return () => window.removeEventListener('pralaya_switch_raster_mode', handleSwitch);
  }, []);

  // If not Machhu Dam, render generic clean telemetry
  if (!isMachhu) {
    return (
      <div className="outcome-generic-panel">
        <div className="outcome-kpi-banner">
          <span>PIPELINE TARGET: {dam.name.toUpperCase()}</span>
          <span>ESTIMATED PEAK DISCHARGE: {dam.simulation.peakDischarge.toLocaleString()} m³/s</span>
        </div>
        <p className="outcome-note">
          Detailed 2D hydrodynamic simulation and orbital SAR ground-truth calibration
          are currently loaded for the primary demo target: <strong>Machhu-II Dam (Gujarat)</strong>.
          Select Machhu-II Dam from the dropdown above to inspect all 8 verified deliverable rasters and plots.
        </p>
      </div>
    );
  }

  // 1. SIMULATION SUMMARY
  if (section.id === 'summary') {
    return (
      <div className="outcome-rich-container">
        {/* Top: 3D Twin Telemetry Bar */}
        <div className="outcome-telemetry-hud">
          <div className="hud-metric-box">
            <span className="hud-label">DAM STATE</span>
            <span className="hud-value val-danger">BREACHED // CASCADING</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">PEAK OUTFLOW</span>
            <span className="hud-value val-cyan">6,647 m³/s (t=2.50h)</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">MORBI PEAK DEPTH</span>
            <span className="hud-value val-danger">8.38 m (Simulated) / 6.1m (Hist.)</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">FLOOD EXTENT</span>
            <span className="hud-value val-emerald">73.43 km² Alluvial Valley</span>
          </div>
        </div>

        {/* Dynamic Mode Switcher: Recharts vs Matplotlib PNG */}
        <div className="raster-toggle-row" style={{ margin: '14px 0 10px' }}>
          <button
            type="button"
            className={`raster-mode-btn ${hydrographMode === 'recharts' ? 'active' : ''}`}
            onClick={() => setHydrographMode('recharts')}
          >
            <span>📊 INTERACTIVE TIME-SERIES HYDROGRAPH</span>
          </button>
          <button
            type="button"
            className={`raster-mode-btn ${hydrographMode === 'cartographic' ? 'active' : ''}`}
            onClick={() => setHydrographMode('cartographic')}
          >
            <span>📈 AUTHENTIC PUBLICATION PLOT (PNG)</span>
          </button>
        </div>

        {hydrographMode === 'recharts' ? (
          <InteractiveHydrograph
            onOpenModal={() => onOpenPlot && onOpenPlot(SCIENTIFIC_PLOTS.find((p) => p.id === 'inflow_hydrograph'))}
          />
        ) : (
          <div
            className="outcome-plot-card"
            onClick={() => onOpenPlot && onOpenPlot(SCIENTIFIC_PLOTS.find((p) => p.id === 'inflow_hydrograph'))}
            title="Click to view full-screen high-resolution hydrograph"
          >
            <div className="plot-header-bar">
              <span>FIGURE 01: CATCHMENT INFLOW & HISTORICAL CWC BENCHMARK (AUGUST 5–15, 1979)</span>
              <span className="plot-badge-hi-res">CLICK TO INSPECT (HI-RES) ↗</span>
            </div>
            <img
              src="/images/outputs/inflow_hydrograph.png"
              alt="Machhu-II Catchment Inflow Hydrograph (August 5–15, 1979)"
              className="outcome-plot-image"
            />
            <div className="plot-caption">
              Physically derived inflow hydrograph via SCS-CN (Area: 2,049.8 km², PRF: 484) peaking at 3,078.3 m³/s, benchmarked against CWC peak design discharge (5,600 m³/s) and rainfall hyetograph bars.
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. HYDRO RASTERS
  if (section.id === 'rasters') {
    return (
      <div className="outcome-rich-container">
        <div className="raster-toggle-row">
          <button
            type="button"
            className={`raster-mode-btn ${rasterMode === 'raster' ? 'active' : ''}`}
            onClick={() => {
              setRasterMode('raster');
              setIsMapMaximized(false);
            }}
          >
            <span>VIEW 2D INUNDATION DEPTH RASTER (.PNG)</span>
          </button>
          <button
            type="button"
            className={`raster-mode-btn ${rasterMode === 'map2d' && !isMapMaximized ? 'active' : ''}`}
            onClick={() => {
              setRasterMode('map2d');
              setIsMapMaximized(false);
            }}
          >
            <span>LAUNCH INTERACTIVE LEAFLET 2D GIS MAP</span>
          </button>
          <button
            type="button"
            className={`raster-mode-btn ${rasterMode === 'twin3d' ? 'active' : ''}`}
            onClick={() => {
              setRasterMode('twin3d');
              setIsMapMaximized(false);
            }}
            style={{
              borderColor: rasterMode === 'twin3d' ? '#38bdf8' : 'rgba(56, 189, 248, 0.4)',
              color: rasterMode === 'twin3d' ? '#38bdf8' : '#7dd3fc',
              background: rasterMode === 'twin3d' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              fontWeight: 700,
            }}
            title="Launch 3D Engineering Twin with 18 Spillway Gates & Delft3D-FM Flexible Mesh"
          >
            <span>🎮 3D ENGINEERING TWIN &amp; DELFT3D-FM</span>
          </button>
          {rasterMode === 'map2d' && (
            <button
              type="button"
              className={`raster-mode-btn ${isMapMaximized ? 'active' : ''}`}
              onClick={() => setIsMapMaximized(!isMapMaximized)}
              style={{
                borderColor: isMapMaximized ? '#5eead4' : 'rgba(94, 234, 212, 0.45)',
                color: '#5eead4',
              }}
              title={isMapMaximized ? 'Restore map to page view (Esc)' : 'Maximize interactive 2D GIS map across whole screen'}
            >
              <span>{isMapMaximized ? '⤓ RESTORE MAP' : '⛶ MAXIMIZE 2D GIS MAP FULLSCREEN'}</span>
            </button>
          )}
        </div>

        {rasterMode === 'raster' && (
          <div className="outcome-dual-plots">
            <div
              className="outcome-plot-card"
              onClick={() => onOpenPlot && onOpenPlot(SCIENTIFIC_PLOTS.find((p) => p.id === 'inundation_depth_map'))}
              title="Click to inspect high-resolution depth raster"
            >
              <div className="plot-header-bar">
                <span>MAXIMUM INUNDATION DEPTH MAP (depth_max.tif)</span>
                <span className="plot-badge-hi-res">HI-RES RASTER ↗</span>
              </div>
              <img
                src="/images/outputs/inundation_depth_map.png"
                alt="Downstream Maximum Flood Inundation Depth Grid"
                className="outcome-plot-image"
              />
              <div className="plot-caption">
                30m Copernicus DEM conditioned raster. Depths range from 22.56m at the Machhu-II dam toe plunge pool to 8.38m through Morbi city center and 7.09m in northern alluvial plains.
              </div>
            </div>

            <div
              className="outcome-plot-card"
              onClick={() => onOpenPlot && onOpenPlot({
                id: 'flood_velocity_map',
                title: 'Downstream Flood Wave Velocity Field',
                subtitle: 'Saint-Venant 2D Diffusive Wave Vector Mesh',
                image: '/images/outputs/flood_velocity_map.png',
              })}
              title="Click to inspect velocity field raster"
            >
              <div className="plot-header-bar">
                <span>MAXIMUM FLOW VELOCITY MAP (velocity_max.tif)</span>
                <span className="plot-badge-hi-res">HI-RES RASTER ↗</span>
              </div>
              <img
                src="/images/outputs/flood_velocity_map.png"
                alt="Flood Wave Flow Velocity Field Map"
                className="outcome-plot-image"
              />
              <div className="plot-caption">
                Simulated flow velocities reaching 12.0 m/s in the high-gradient gorge canyon (0–5 km), dissipating to 2.5–4.5 m/s across the wide Morbi floodplain.
              </div>
            </div>
          </div>
        )}

        {rasterMode === 'map2d' && (
          <div style={{ width: '100%', marginTop: '10px' }}>
            <GisMap2D
              height="580px"
              isMaximized={isMapMaximized}
              onToggleMaximize={setIsMapMaximized}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              flexWrap: 'wrap',
              gap: '10px',
            }}>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: '#94a3b8' }}>
                Tip: Press <kbd style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '4px', padding: '2px 6px', color: '#5eead4' }}>Esc</kbd> anytime to exit fullscreen.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="outcome-inspect-link-btn"
                  onClick={() => setIsMapMaximized(!isMapMaximized)}
                  style={{
                    borderColor: '#5eead4',
                    color: '#5eead4',
                    background: 'rgba(94, 234, 212, 0.12)',
                    fontWeight: 700,
                  }}
                  title={isMapMaximized ? 'Restore to page view' : 'Maximize interactive 2D GIS map across whole screen'}
                >
                  {isMapMaximized ? '⤓ RESTORE MAP TO PAGE' : '⛶ MAXIMIZE MAP FULLSCREEN'}
                </button>
                <button
                  type="button"
                  className="outcome-inspect-link-btn"
                  onClick={() => onOpenPlot && onOpenPlot(SCIENTIFIC_PLOTS.find((p) => p.id === 'inundation_depth_map'))}
                  title="Inspect raw 30m depth_max.tif conditioned raster plot"
                >
                  INSPECT 2D INUNDATION DEPTH MAP (HI-RES) ↗
                </button>
              </div>
            </div>
          </div>
        )}

        {rasterMode === 'twin3d' && (
          <div style={{ width: '100%', marginTop: '10px' }}>
            <EngineeringTwin3D height="680px" initialTab="delft3d" />
          </div>
        )}
      </div>
    );
  }

  // 3. GEE SATELLITE
  if (section.id === 'satellite') {
    return (
      <div className="outcome-rich-container">
        <div
          className="outcome-plot-card"
          onClick={() => onOpenPlot && onOpenPlot(SCIENTIFIC_PLOTS.find((p) => p.id === 'satellite_validation_plot'))}
          title="Click to inspect Sentinel-1 SAR orbital validation"
        >
          <div className="plot-header-bar">
            <span>FIGURE 03: SENTINEL-1 SAR BACKSCATTER INTENSITY VS GEE OTSU THRESHOLD INUNDATION</span>
            <span className="plot-badge-hi-res">ORBITAL GROUND TRUTH ↗</span>
          </div>
          <img
            src="/images/outputs/satellite_validation_plot.png"
            alt="Sentinel-1 SAR Backscatter intensity vs GEE Satellite Inundation Extent"
            className="outcome-plot-image"
          />
          <div className="plot-caption">
            Left: Sentinel-1 C-band SAR VV/VH cross-section showing low backscatter (dark plume) of smooth floodwater. Right: Automated Otsu dual-thresholded water mask computed via Google Earth Engine with 99.91% pixel accuracy.
          </div>
        </div>

        {/* Validation Telemetry Matrix */}
        <div className="outcome-telemetry-hud" style={{ marginTop: '14px' }}>
          <div className="hud-metric-box">
            <span className="hud-label">SAR MISSION</span>
            <span className="hud-value val-cyan">Copernicus Sentinel-1 GRD</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">GEE ALGORITHM</span>
            <span className="hud-value val-emerald">Otsu Threshold (σ₀ ≤ -15.5 dB)</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">CRITICAL SUCCESS INDEX</span>
            <span className="hud-value val-cyan">CSI = 0.8435 (84.4%)</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">F1-SCORE</span>
            <span className="hud-value val-emerald">0.9151 // OVERALL: 99.91%</span>
          </div>
        </div>
      </div>
    );
  }

  // 4. TIMESERIES HYDROGRAPH
  if (section.id === 'timeseries') {
    return (
      <div className="outcome-rich-container">
        {/* Top: 3D Twin Telemetry Bar matching Section 1 */}
        <div className="outcome-telemetry-hud">
          <div className="hud-metric-box">
            <span className="hud-label">BREACH REGIME</span>
            <span className="hud-value val-danger">OVERTOPPING // CASCADING</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">PEAK BREACH DISCHARGE</span>
            <span className="hud-value val-cyan">6,647 m³/s @ T+2.50h</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">MORBI CITY PEAK STAGE</span>
            <span className="hud-value val-danger">8.38 m (Arrival T+1.57h)</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">HISTORICAL FLOOD ERROR</span>
            <span className="hud-value val-emerald">3.61% Rel. Error (Pass ✓)</span>
          </div>
        </div>

        {/* Dynamic Mode Switcher: Recharts vs Matplotlib PNG */}
        <div className="raster-toggle-row" style={{ margin: '14px 0 10px' }}>
          <button
            type="button"
            className={`raster-mode-btn ${morbiMode === 'recharts' ? 'active' : ''}`}
            onClick={() => setMorbiMode('recharts')}
          >
            <span>📊 INTERACTIVE TIME-SERIES HYDROGRAPH</span>
          </button>
          <button
            type="button"
            className={`raster-mode-btn ${morbiMode === 'cartographic' ? 'active' : ''}`}
            onClick={() => setMorbiMode('cartographic')}
          >
            <span>📈 AUTHENTIC PUBLICATION PLOT (PNG)</span>
          </button>
        </div>

        {morbiMode === 'recharts' ? (
          <InteractiveMorbiHydrograph
            onInspectPlot={() => onOpenPlot && onOpenPlot(SCIENTIFIC_PLOTS.find((p) => p.id === 'morbi_hydrograph'))}
          />
        ) : (
          <div
            className="outcome-plot-card"
            onClick={() => onOpenPlot && onOpenPlot(SCIENTIFIC_PLOTS.find((p) => p.id === 'morbi_hydrograph'))}
            title="Click to view full-screen high-resolution hydrograph"
          >
            <div className="plot-header-bar">
              <span>FIGURE 02: MACHHU-II DAM BREACH HYDROGRAPH &amp; DOWNSTREAM STAGE PROPAGATION</span>
              <span className="plot-badge-hi-res">CLICK TO INSPECT (HI-RES) ↗</span>
            </div>
            <img
              src="/images/outputs/morbi_hydrograph.png"
              alt="Machhu-II Dam Breach Hydrograph &amp; Downstream Stage Propagation"
              className="outcome-plot-image"
            />
            <div className="plot-caption">
              Hydrodynamic stage-discharge evolution at Morbi City Center (7.5 km) and Machhu-II Dam Toe (0 km). Initial wave arrival at T+1.57h (94 min), surging to maximum depth of 8.38m during peak canyon discharge. Calibrated against 1979 ground marks with 3.61% relative depth error.
            </div>
          </div>
        )}
      </div>
    );
  }

  // 5. STRUCTURAL IMPACT & ECONOMIC LOSS
  if (section.id === 'structural') {
    return (
      <div className="outcome-rich-container">
        {/* Top: 3D Twin Telemetry Bar matching Section 1 and Section 4 */}
        <div className="outcome-telemetry-hud">
          <div className="hud-metric-box">
            <span className="hud-label">TOTAL ECONOMIC LOSS</span>
            <span className="hud-value val-danger">₹3,629.14 Crores</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">TOTAL EXPOSED POPULATION</span>
            <span className="hud-value val-cyan">214,559 Persons</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">EXTREME LIFE THREAT (&gt;3.0m)</span>
            <span className="hud-value val-danger">118,514 (55.2%)</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">LIFELINE INFRASTRUCTURE</span>
            <span className="hud-value val-emerald">44,699 Bldgs · 395 km Roads</span>
          </div>
        </div>

        {/* Dynamic Mode Switcher: Recharts vs Matplotlib PNG */}
        <div className="raster-toggle-row" style={{ margin: '14px 0 10px' }}>
          <button
            type="button"
            className={`raster-mode-btn ${damageMode === 'recharts' ? 'active' : ''}`}
            onClick={() => setDamageMode('recharts')}
          >
            <span>📊 INTERACTIVE DAMAGE ANALYTICS</span>
          </button>
          <button
            type="button"
            className={`raster-mode-btn ${damageMode === 'cartographic' ? 'active' : ''}`}
            onClick={() => setDamageMode('cartographic')}
          >
            <span>📈 AUTHENTIC PUBLICATION PLOT (PNG)</span>
          </button>
        </div>

        {damageMode === 'recharts' ? (
          <InteractiveDamageAnalytics
            onInspectPlot={() => onOpenPlot && onOpenPlot(SCIENTIFIC_PLOTS.find((p) => p.id === 'economic_loss_summary'))}
          />
        ) : (
          <>
            <div className="outcome-dual-plots">
              <div
                className="outcome-plot-card"
                onClick={() => onOpenPlot && onOpenPlot(SCIENTIFIC_PLOTS.find((p) => p.id === 'economic_loss_summary'))}
                title="Inspect economic loss distribution"
              >
                <div className="plot-header-bar">
                  <span>FIGURE 03: MULTI-SECTOR SOCIO-ECONOMIC DAMAGE (₹3,629 CR)</span>
                  <span className="plot-badge-hi-res">DAMAGE CADASTRE ↗</span>
                </div>
                <img
                  src="/images/outputs/economic_loss_summary.png"
                  alt="Economic Loss Summary"
                  className="outcome-plot-image"
                />
                <div className="plot-caption">
                  USACE / NDMA depth-damage function results: Residential housing ₹2,346.7 Cr (64.7%), Commercial/Industrial ₹1,048.7 Cr (28.9%), Roads &amp; Bridges ₹201.7 Cr, and Cropland devastation.
                </div>
              </div>

              <div
                className="outcome-plot-card"
                onClick={() => onOpenPlot && onOpenPlot({
                  id: 'damage_hazard_map',
                  title: 'Downstream Structural Damage Hazard Map',
                  subtitle: 'Multi-Tier Building & Road Scour Vulnerability',
                  image: '/images/outputs/damage_hazard_map.png',
                })}
                title="Inspect structural hazard map"
              >
                <div className="plot-header-bar">
                  <span>FIGURE 04: STRUCTURAL DAMAGE HAZARD MAP</span>
                  <span className="plot-badge-hi-res">HAZARD TIERS ↗</span>
                </div>
                <img
                  src="/images/outputs/damage_hazard_map.png"
                  alt="Structural Damage Hazard Map"
                  className="outcome-plot-image"
                />
                <div className="plot-caption">
                  Spatial cross-reference between hydrodynamic kinetic energy ($v \cdot h$) and building footprints across Morbi Urban Core and rural agricultural hamlets.
                </div>
              </div>
            </div>

            {/* Live Damage Progress Bars (From outputs/3d/index.html) */}
            <div className="outcome-damage-breakdown-card">
              <div className="damage-bar-row">
                <div className="damage-bar-header">
                  <span>Severe Structural Damage (&gt;2.0m Depth)</span>
                  <span className="val-danger">62% (High Risk)</span>
                </div>
                <div className="damage-track">
                  <div className="damage-fill" style={{ width: '62%', background: '#e63946' }} />
                </div>
              </div>

              <div className="damage-bar-row">
                <div className="damage-bar-header">
                  <span>Moderate Inundation (0.5 – 2.0m Depth)</span>
                  <span className="val-warning">28% (Medium Risk)</span>
                </div>
                <div className="damage-track">
                  <div className="damage-fill" style={{ width: '28%', background: '#f4a261' }} />
                </div>
              </div>

              <div className="damage-bar-row">
                <div className="damage-bar-header">
                  <span>Critical Bridges Submerged</span>
                  <span className="val-danger">4 / 4 Bridges (100% Closed)</span>
                </div>
                <div className="damage-track">
                  <div className="damage-fill" style={{ width: '100%', background: '#d62828' }} />
                </div>
              </div>

              <div className="damage-bar-row">
                <div className="damage-bar-header">
                  <span>Agricultural Cropland Submerged</span>
                  <span className="val-emerald">1,820 Hectares (75% Inundated)</span>
                </div>
                <div className="damage-track">
                  <div className="damage-fill" style={{ width: '75%', background: '#06d6a0' }} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // 6. EVACUATION CORRIDORS
  if (section.id === 'evacuation') {
    return (
      <div className="outcome-rich-container">
        <div
          className="outcome-plot-card"
          onClick={() => onOpenPlot && onOpenPlot(SCIENTIFIC_PLOTS.find((p) => p.id === 'risk_evacuation_map'))}
          title="Inspect topographic risk and evacuation routing map"
        >
          <div className="plot-header-bar">
            <span>TOPOGRAPHIC RISK ZONES & SAFE EVACUATION CORRIDORS</span>
            <span className="plot-badge-hi-res">TACTICAL ROUTING ↗</span>
          </div>
          <img
            src="/images/outputs/risk_evacuation_map.png"
            alt="Topographic Risk Zones & Safe Evacuation Map"
            className="outcome-plot-image"
          />
          <div className="plot-caption">
            Topographic buffer routing identifying safe high-ground ridges (&gt;52.0m to 68.5m MSL) along the eastern basin rim. Dynamically routes 73,200 exposed civilians to 5 designated safe shelters.
          </div>
        </div>
      </div>
    );
  }

  // 7. DECISION SUPPORT & VALIDATION
  if (section.id === 'decision') {
    return (
      <div className="outcome-rich-container">
        {/* Top: 3D Twin Telemetry Bar matching other sections */}
        <div className="outcome-telemetry-hud">
          <div className="hud-metric-box">
            <span className="hud-label">CRITICAL SUCCESS INDEX</span>
            <span className="hud-value val-cyan">CSI = 84.35% (Pass ✓)</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">F1-SCORE (HARMONIC MEAN)</span>
            <span className="hud-value val-emerald">0.9151 // 91.5%</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">MORBI HISTORICAL ERROR</span>
            <span className="hud-value val-warning">3.61% Rel. Error</span>
          </div>
          <div className="hud-metric-box">
            <span className="hud-label">SENSITIVITY ENVELOPE</span>
            <span className="hud-value val-cyan">3,324 – 10,500 m³/s</span>
          </div>
        </div>

        {/* Dynamic Mode Switcher: Recharts vs Matplotlib PNG */}
        <div className="raster-toggle-row" style={{ margin: '14px 0 10px' }}>
          <button
            type="button"
            className={`raster-mode-btn ${decisionMode === 'recharts' ? 'active' : ''}`}
            onClick={() => setDecisionMode('recharts')}
          >
            <span>📊 INTERACTIVE SENSITIVITY MATRIX</span>
          </button>
          <button
            type="button"
            className={`raster-mode-btn ${decisionMode === 'cartographic' ? 'active' : ''}`}
            onClick={() => setDecisionMode('cartographic')}
          >
            <span>📈 AUTHENTIC PUBLICATION PLOT (PNG)</span>
          </button>
        </div>

        {decisionMode === 'recharts' ? (
          <InteractiveSensitivityScenarios
            onInspectPlot={() => onOpenPlot && onOpenPlot(SCIENTIFIC_PLOTS.find((p) => p.id === 'sensitivity_scenarios_plot'))}
          />
        ) : (
          <>
            <div className="outcome-dual-plots">
              <div
                className="outcome-plot-card"
                onClick={() => onOpenPlot && onOpenPlot(SCIENTIFIC_PLOTS.find((p) => p.id === 'accuracy_comparison_map'))}
                title="Inspect GIS accuracy comparison map"
              >
                <div className="plot-header-bar">
                  <span>FIGURE 05: GIS ACCURACY COMPARISON MAP (OBSERVED VS MODEL)</span>
                  <span className="plot-badge-hi-res">BENCHMARK ↗</span>
                </div>
                <img
                  src="/images/outputs/accuracy_comparison_map.png"
                  alt="GIS Accuracy Comparison Map"
                  className="outcome-plot-image"
                />
                <div className="plot-caption">
                  Pixel-by-pixel contingency matrix comparing simulated 2D flood boundaries against historical 1979 survey records and Sentinel-1 SAR observations.
                </div>
              </div>

              <div
                className="outcome-plot-card"
                onClick={() => onOpenPlot && onOpenPlot(SCIENTIFIC_PLOTS.find((p) => p.id === 'sensitivity_scenarios_plot'))}
                title="Inspect sensitivity scenario comparisons"
              >
                <div className="plot-header-bar">
                  <span>FIGURE 06: PARAMETRIC UNCERTAINTY &amp; SENSITIVITY SCENARIOS</span>
                  <span className="plot-badge-hi-res">WHAT-IF ENVELOPE ↗</span>
                </div>
                <img
                  src="/images/outputs/sensitivity_scenarios_plot.png"
                  alt="Sensitivity Scenarios Plot"
                  className="outcome-plot-image"
                />
                <div className="plot-caption">
                  Uncertainty analysis bounding peak breach outflow between 3,324 m³/s (-50% breach width) and 10,500 m³/s (+50% extreme overtopping), verifying solver numerical stability.
                </div>
              </div>
            </div>

            {/* Validation Scorecard */}
            <div className="outcome-validation-scorecard">
              <div className="scorecard-title">
                <span>OFFICIAL VALIDATION REPORT &amp; GROUND-TRUTH CALIBRATION</span>
                <span className="scorecard-badge">VERIFIED PASS ✓</span>
              </div>
              <div className="scorecard-grid">
                <div className="scorecard-item">
                  <span className="sc-lbl">CRITICAL SUCCESS INDEX (CSI)</span>
                  <span className="sc-val val-cyan">84.35% (0.8435)</span>
                  <span className="sc-sub">Global benchmark threshold &gt;70%</span>
                </div>
                <div className="scorecard-item">
                  <span className="sc-lbl">F1-SCORE (HARMONIC MEAN)</span>
                  <span className="sc-val val-emerald">0.9151 (91.5%)</span>
                  <span className="sc-sub">High precision &amp; high recall</span>
                </div>
                <div className="scorecard-item">
                  <span className="sc-lbl">HIT RATE / SENSITIVITY</span>
                  <span className="sc-val val-emerald">97.74% (Recall)</span>
                  <span className="sc-sub">68,389 True Positive pixels</span>
                </div>
                <div className="scorecard-item">
                  <span className="sc-lbl">HISTORICAL MORBI DEPTH ERROR</span>
                  <span className="sc-val val-warning">3.61% Relative Error</span>
                  <span className="sc-sub">Historical: ~6.10m vs Model: 6.32m</span>
                </div>
              </div>
              <div className="scorecard-footer">
                <span>Benchmarked against Sandesara &amp; Wooten (2011, ISBN 978-1616144319) and Central Water Commission (CWC) Machhu-II Post-Disaster Commission Records.</span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // 8. GIS EXPORT PACK (DOWNLOADABLE DELIVERABLES)
  if (section.id === 'gis') {
    return (
      <div className="outcome-rich-container">
        <div className="outcome-gis-export-card">
          <div className="gis-export-top-bar">
            <span className="gis-tag-pill">OUTPUT: .GEOJSON · .KML · .SHP · .TIF · .CSV // OPEN GEOSPATIAL VECTOR &amp; RASTER SUITE</span>
            <span className="gis-dest-note">UNIVERSAL INTEROPERABILITY · QGIS / ARCGIS / GOOGLE EARTH / NDMA</span>
          </div>

          <div className="gis-hero-showcase">
            <div className="gis-isometric-graphic">
              <svg viewBox="0 0 340 220" className="gis-layer-stack-svg">
                <defs>
                  <linearGradient id="stackGrad1" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3fa89b" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#081014" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                <polygon points="60,140 170,90 280,140 170,190" fill="rgba(63, 168, 155, 0.2)" stroke="#3fa89b" strokeWidth="1.5" />
                <polygon points="60,110 170,60 280,110 170,160" fill="rgba(94, 234, 212, 0.25)" stroke="#5eead4" strokeWidth="1.5" />
                <polygon points="60,80 170,30 280,80 170,130" fill="rgba(253, 224, 71, 0.2)" stroke="#fde047" strokeWidth="1.5" />
                <text x="170" y="55" fill="#fde047" fontFamily="var(--font-mono)" fontSize="10" textAnchor="middle" fontWeight="700">TIER 1: HIGH HAZARD POLYGONS</text>
                <text x="170" y="105" fill="#5eead4" fontFamily="var(--font-mono)" fontSize="10" textAnchor="middle" fontWeight="700">TIER 2: FLOOD INUNDATION MESH</text>
                <text x="170" y="155" fill="#3fa89b" fontFamily="var(--font-mono)" fontSize="10" textAnchor="middle" fontWeight="700">TIER 3: COPERNICUS 30M DEM</text>
              </svg>
            </div>

            <div className="gis-content-body">
              <h3 className="gis-title">Interoperable GIS Datasets for QGIS &amp; Google Earth</h3>
              <div className="gis-subtitle">Universal spatial file formats ready for external command centers</div>
              <p className="gis-desc">
                The export bundle allowing real disaster-management officers to ingest PRALAYA simulation rasters directly into QGIS, ArcGIS, or Google Earth. Georeferenced in EPSG:4326 with standard attribute tables for field deployment.
              </p>

              <div className="gis-format-badges">
                <div className="gis-format-badge">
                  <span className="badge-lbl">ESRI SHAPEFILE</span>
                  <span className="badge-val">.shp / .dbf (2.76 KB)</span>
                </div>
                <div className="gis-format-badge">
                  <span className="badge-lbl">GOOGLE EARTH</span>
                  <span className="badge-val">.kml (4.54 KB)</span>
                </div>
                <div className="gis-format-badge">
                  <span className="badge-lbl">OPEN GEOSPATIAL</span>
                  <span className="badge-val">.geojson (11.2 KB)</span>
                </div>
                <div className="gis-format-badge">
                  <span className="badge-lbl">DEPTH RASTER</span>
                  <span className="badge-val">depth_max.tif (2.21 MB)</span>
                </div>
                <div className="gis-format-badge">
                  <span className="badge-lbl">VELOCITY FIELD</span>
                  <span className="badge-val">velocity_max.tif (2.18 MB)</span>
                </div>
                <div className="gis-format-badge">
                  <span className="badge-lbl">TIME SERIES CSV</span>
                  <span className="badge-val">hydrograph.csv (20.8 KB)</span>
                </div>
              </div>

              <div className="gis-engine-wire">
                CRITICAL VALUE: <span>EPSG:4326</span> · ATTRIBUTES: <span>[hazard_tier, depth_max_m, arrival_hr, evac_priority, assigned_shelter]</span>
              </div>

              <div className="gis-actions-row">
                <a
                  href="/exports/machhu_flood_extent_shp.zip"
                  download="machhu_flood_extent_shp.zip"
                  className="gis-btn primary"
                  title="Download ESRI Shapefile Bundle"
                >
                  <span>📦 DOWNLOAD SHP (.ZIP)</span>
                </a>
                <a
                  href="/exports/machhu_flood_extent.kml"
                  download="machhu_flood_extent.kml"
                  className="gis-btn secondary"
                  title="Download Google Earth KML"
                >
                  <span>🌍 DOWNLOAD KML</span>
                </a>
                <a
                  href="/exports/machhu_flood_extent.geojson"
                  download="machhu_flood_extent.geojson"
                  className="gis-btn secondary"
                  title="Download Open GeoJSON"
                >
                  <span>🌐 DOWNLOAD GEOJSON</span>
                </a>
                <a
                  href="/exports/depth_max.tif"
                  download="depth_max.tif"
                  className="gis-btn secondary"
                  title="Download 30m Copernicus Max Depth GeoTIFF"
                >
                  <span>🌊 DEPTH TIF</span>
                </a>
                <a
                  href="/exports/hydrograph.csv"
                  download="hydrograph.csv"
                  className="gis-btn secondary"
                  title="Download Inflow &amp; Runoff Hydrograph CSV"
                >
                  <span>📊 HYDROGRAPH CSV</span>
                </a>
                <button
                  type="button"
                  className="gis-btn inspect"
                  onClick={() => setShowSchemaModal(!showSchemaModal)}
                >
                  <span>{showSchemaModal ? 'HIDE ATTRIBUTE SCHEMA ▲' : 'INSPECT ATTRIBUTE SCHEMA ▼'}</span>
                </button>
              </div>

              {showSchemaModal && (
                <div className="gis-schema-inspect-box">
                  <div className="schema-header">
                    <span>GEOJSON / SHAPEFILE ATTRIBUTE SCHEMA SPECIFICATION</span>
                    <button type="button" onClick={() => setShowSchemaModal(false)}>✕</button>
                  </div>
                  <pre className="schema-pre">
{JSON.stringify({
  "$schema": "https://geojson.org/schema/FeatureCollection.json",
  "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" } },
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "MultiPolygon", "coordinates": "[[[70.812, 22.754], ...]]" },
      "properties": {
        "zone_id": "ZONE_MORBI_URBAN_CORE",
        "hazard_tier": "EXTREME_DANGER",
        "max_depth_m": 8.38,
        "arrival_hr": 1.57,
        "peak_velocity_ms": 4.5,
        "evac_priority": 1,
        "assigned_shelter": "Morbi South-East Relief Center (>54.2m MSL)",
        "population_at_risk": 73200
      }
    }
  ]
}, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
