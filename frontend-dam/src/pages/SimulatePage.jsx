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
import './pages.css';

/**
 * SimulatePage — PRALAYA Simulation Outcome Dashboard
 * User selects a dam → sees location on India map → scrolls through 7 outcome sections.
 * Premium glassmorphic dark UI with hydrodynamic cyan palette.
 */

/** Icons for the 7 outcome sections */
const OUTCOME_SECTIONS = [
  {
    id: 'summary',
    badge: 'KPI ENGINE',
    pillLabel: 'SIMULATION SUMMARY',
    title: 'Headline KPI Stat Cards & Breach Timeline',
    subtitle: 'Primary dashboard metrics derived from hydrodynamic solver output',
    icon: BoltIcon,
    accentColor: '#3fa89b',
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
    fields: ['alertLevel', 'responseTime', 'agenciesCoordinated'],
    fieldLabels: ['ALERT LEVEL', 'RESPONSE TIME', 'AGENCIES'],
    description:
      'Unifies all upstream output layers into a single command center dashboard. Dispatches automated alerts, coordinates multi-agency response, and tracks real-time shelter capacity and evacuation progress.',
  },
];

export default function SimulatePage({ onBackToHome, onViewSimulation }) {
  const [selectedDamId, setSelectedDamId] = useState('machhu-ii');
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

            {/* Open the operational 2D/3D simulation dashboard */}
            <button 
              type="button" 
              className={`scroll-outcomes-btn ${selectedDam.id !== 'machhu-ii' ? 'disabled' : ''}`}
              onClick={onViewSimulation}
              disabled={selectedDam.id !== 'machhu-ii'}
              style={{ opacity: selectedDam.id !== 'machhu-ii' ? 0.5 : 1, cursor: selectedDam.id !== 'machhu-ii' ? 'not-allowed' : 'pointer' }}
            >
              <span>{selectedDam.id === 'machhu-ii' ? 'VIEW SIMULATION OUTCOMES' : 'SIMULATION NOT AVAILABLE'}</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2L7 12M7 12L3 8M7 12L11 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
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
            label={`${selectedDam.name.toUpperCase()} // 7 OUTPUT LAYERS`}
            variant="cyan"
          />
          <h2 className="sim-outcomes-title">Hydrodynamic Simulation Outputs</h2>
          <p className="sim-outcomes-subtitle">
            Scroll through all 7 output layers generated by the PRALAYA breach simulation engine
            for <strong>{selectedDam.name}</strong>.
          </p>
        </div>

        <div className="sim-outcomes-list">
          {OUTCOME_SECTIONS.map((section, idx) => {
            const outcomeData = selectedDam.outcomes[section.id];
            const IconComp = section.icon;

            return (
              <div
                key={section.id}
                className="sim-outcome-card"
                style={{ '--accent': section.accentColor }}
              >
                {/* Card Header */}
                <div className="outcome-card-header">
                  <div className="outcome-index-badge">
                    <span>{String(idx + 1).padStart(2, '0')}</span>
                  </div>
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

                  {/* Inline SVG Visualization */}
                  <div className="outcome-viz">
                    <OutcomeVisualization section={section} dam={selectedDam} />
                  </div>
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
    </div>
  );
}

/**
 * OutcomeVisualization — Renders a unique SVG visual per outcome section
 */
function OutcomeVisualization({ section, dam }) {
  const sim = dam.simulation;

  const vizMap = {
    summary: (
      <svg viewBox="0 0 700 200" className="outcome-svg">
        <defs>
          <linearGradient id="gSum2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3fa89b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0d1b18" stopOpacity="0.05" />
          </linearGradient>
          <pattern id="gs2" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(63, 168, 155, 0.1)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gs2)" />
        <path d="M 30 160 Q 150 155 240 60 T 450 140 L 670 160 L 670 190 L 30 190 Z" fill="url(#gSum2)" />
        <path d="M 30 160 Q 150 155 240 60 T 450 140 L 670 160" fill="none" stroke="#3fa89b" strokeWidth="2.5" />
        <circle cx="240" cy="60" r="6" fill="#fde047" stroke="#0a1110" strokeWidth="2" />
        <text x="255" y="56" fill="#fde047" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">
          PEAK: {sim.peakDischarge.toLocaleString()} m³/s (t={sim.waveArrivalMin}min)
        </text>
        <line x1="240" y1="60" x2="240" y2="185" stroke="rgba(253, 224, 71, 0.3)" strokeDasharray="3 3" />
        <text x="35" y="25" fill="#3fa89b" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">
          OUTPUT: simulation_summary.json // {dam.name.toUpperCase()}
        </text>
      </svg>
    ),
    rasters: (
      <svg viewBox="0 0 700 200" className="outcome-svg">
        <defs>
          <pattern id="gr2" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M 22 0 L 0 0 0 22" fill="none" stroke="rgba(56, 189, 248, 0.1)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gr2)" />
        <path d="M 60 60 Q 200 40 340 80 T 600 90 L 580 170 Q 400 185 240 160 Z" fill="rgba(56, 189, 248, 0.1)" stroke="#38bdf8" strokeWidth="1.5" />
        <path d="M 120 80 Q 250 65 350 100 T 520 110 L 500 155 Q 370 165 240 140 Z" fill="rgba(63, 168, 155, 0.15)" stroke="#3fa89b" strokeWidth="1.5" />
        <path d="M 190 95 Q 280 85 360 110 T 440 125 L 420 148 Q 340 155 240 128 Z" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="1.5" />
        <text x="35" y="25" fill="#38bdf8" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">
          OUTPUT: depth_max.tif // RASTER GRID {dam.outcomes.rasters.gridRes}
        </text>
      </svg>
    ),
    satellite: (
      <svg viewBox="0 0 700 200" className="outcome-svg">
        <defs>
          <pattern id="gsat2" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M 26 0 L 0 0 0 26" fill="none" stroke="rgba(192, 132, 252, 0.08)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gsat2)" />
        <line x1="350" y1="0" x2="350" y2="200" stroke="rgba(192, 132, 252, 0.3)" strokeWidth="2" strokeDasharray="6 4" />
        <path d="M 50 70 Q 140 55 230 90 T 330 160 L 60 170 Z" fill="rgba(63, 168, 155, 0.2)" stroke="#3fa89b" strokeWidth="1.5" />
        <path d="M 370 72 Q 460 58 550 92 T 650 162 L 380 172 Z" fill="rgba(192, 132, 252, 0.2)" stroke="#c084fc" strokeWidth="1.5" />
        <text x="100" y="180" fill="#3fa89b" fontFamily="var(--font-mono)" fontSize="10" fontWeight="600" textAnchor="middle">SENTINEL-1 SAR</text>
        <text x="510" y="180" fill="#c084fc" fontFamily="var(--font-mono)" fontSize="10" fontWeight="600" textAnchor="middle">SIMULATED</text>
        <text x="35" y="25" fill="#c084fc" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">
          OUTPUT: gee_flood_extent.tif // ORBITAL VALIDATION
        </text>
      </svg>
    ),
    timeseries: (
      <svg viewBox="0 0 700 200" className="outcome-svg">
        <defs>
          <pattern id="gts2" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(251, 191, 36, 0.08)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gts2)" />
        <polyline points="30,170 80,168 130,160 180,145 220,100 260,55 300,48 340,52 380,65 420,82 460,100 500,118 540,132 580,145 620,155 660,162" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
        <circle cx="300" cy="48" r="5" fill="#fbbf24" stroke="#0a1110" strokeWidth="2" />
        <text x="315" y="44" fill="#fbbf24" fontFamily="var(--font-mono)" fontSize="10" fontWeight="700">PEAK t={sim.waveArrivalMin}min</text>
        <text x="35" y="25" fill="#fbbf24" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">
          OUTPUT: outflow_hydrograph.csv // {dam.outcomes.timeseries.intervals} STEPS
        </text>
      </svg>
    ),
    structural: (
      <svg viewBox="0 0 700 200" className="outcome-svg">
        <defs>
          <pattern id="gst2" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(239, 68, 68, 0.08)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gst2)" />
        {/* Building silhouettes */}
        {[80, 160, 240, 340, 440, 520, 600].map((x, i) => (
          <rect key={i} x={x} y={100 - (i % 3) * 20} width={28} height={70 + (i % 3) * 20} fill="rgba(239, 68, 68, 0.15)" stroke="#ef4444" strokeWidth="1" rx="2" />
        ))}
        {/* Wave line */}
        <path d="M 30 140 Q 150 120 280 135 T 500 125 L 670 138" fill="none" stroke="rgba(56, 189, 248, 0.5)" strokeWidth="2" strokeDasharray="5 5" />
        <text x="35" y="25" fill="#ef4444" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">
          OUTPUT: structural_exposure.geojson // {dam.outcomes.structural.buildingsExposed} BUILDINGS
        </text>
      </svg>
    ),
    evacuation: (
      <svg viewBox="0 0 700 200" className="outcome-svg">
        <defs>
          <pattern id="gev2" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(134, 239, 172, 0.06)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gev2)" />
        {/* Route paths */}
        <path d="M 100 170 Q 180 120 280 100 L 380 80" fill="none" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 100 170 Q 200 150 320 130 L 450 110" fill="none" stroke="rgba(134, 239, 172, 0.5)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" />
        <path d="M 100 170 Q 150 140 250 160 L 360 140" fill="none" stroke="rgba(134, 239, 172, 0.3)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" />
        {/* Shelter markers */}
        <circle cx="380" cy="80" r="8" fill="rgba(134, 239, 172, 0.2)" stroke="#86efac" strokeWidth="1.5" />
        <text x="394" y="84" fill="#86efac" fontFamily="var(--font-mono)" fontSize="9" fontWeight="700">SHELTER A</text>
        <circle cx="450" cy="110" r="6" fill="rgba(134, 239, 172, 0.15)" stroke="#86efac" strokeWidth="1" />
        {/* Source */}
        <circle cx="100" cy="170" r="7" fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" strokeWidth="1.5" />
        <text x="35" y="25" fill="#86efac" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">
          OUTPUT: evacuation_routes.geojson // {dam.outcomes.evacuation.corridors} CORRIDORS
        </text>
      </svg>
    ),
    decision: (
      <svg viewBox="0 0 700 200" className="outcome-svg">
        <defs>
          <pattern id="gdc2" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(249, 115, 22, 0.06)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gdc2)" />
        {/* Central hub */}
        <circle cx="350" cy="100" r="30" fill="rgba(249, 115, 22, 0.12)" stroke="#f97316" strokeWidth="2" />
        <text x="350" y="95" textAnchor="middle" fill="#f97316" fontFamily="var(--font-mono)" fontSize="9" fontWeight="700">COMMAND</text>
        <text x="350" y="108" textAnchor="middle" fill="#f97316" fontFamily="var(--font-mono)" fontSize="9" fontWeight="700">CENTER</text>
        {/* Spokes */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const x2 = 350 + Math.cos(rad) * 80;
          const y2 = 100 + Math.sin(rad) * 70;
          return (
            <g key={i}>
              <line x1="350" y1="100" x2={x2} y2={y2} stroke="rgba(249, 115, 22, 0.3)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={x2} cy={y2} r="5" fill="rgba(249, 115, 22, 0.2)" stroke="#f97316" strokeWidth="1" />
            </g>
          );
        })}
        <text x="35" y="25" fill="#f97316" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700">
          OUTPUT: command_dashboard.json // {dam.outcomes.decision.agenciesCoordinated} AGENCIES
        </text>
      </svg>
    ),
  };

  return vizMap[section.id] || null;
}
