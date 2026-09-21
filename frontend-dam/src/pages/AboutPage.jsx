import React from 'react';
import SectionLabel from '../components/SectionLabel';
import { ShieldCheckIcon, ChartIcon, MapIcon, WaveIcon } from '../components/Icons';
import './pages.css';

/**
 * About PRALAYA — Dedicated Mission & Architecture Page
 * Zero emojis, 100% SVG iconography, deep technical context.
 */
export default function AboutPage({ onBackToHome }) {
  return (
    <div className="pralaya-subpage">
      <div className="container subpage-container">
        {/* Top Breadcrumb / Return */}
        <div className="subpage-top-nav">
          <button type="button" className="back-to-home-btn" onClick={onBackToHome}>
            ← RETURN TO HOME
          </button>
          <span className="subpage-meta-tag">NATIONAL DAM SAFETY ARCHITECTURE</span>
        </div>

        {/* Page Header */}
        <div className="subpage-header">
          <SectionLabel
            directive="MISSION BRIEFING"
            label="ABOUT PRALAYA // DIGITAL TWIN"
            variant="cyan"
          />
          <h1 className="subpage-title">
            Physics over guesswork. <em>Seconds over hours.</em>
          </h1>
          <p className="subpage-lede">
            India stewards over 6,000 large dams registered on the National Dam Safety Register.
            PRALAYA was engineered to replace slow empirical estimates with real-time 2D hydrodynamic
            shallow-water equations, digital elevation terrain twins, and automated evacuation routing.
          </p>
        </div>

        {/* 3 Core Mission Pillars */}
        <div className="about-pillars-grid">
          <div className="about-pillar-card">
            <div className="pillar-icon-box">
              <WaveIcon size={24} color="#3fa89b" />
            </div>
            <h3>Rigorous Hydrodynamic Physics</h3>
            <p>
              Rather than generic circular flood buffers, PRALAYA integrates the conservative 2D Saint-Venant
              shallow water equations with GPU-accelerated finite-volume Riemann shock-capturing, accurately
              predicting supersonic hydraulic jumps and valley wave propagation.
            </p>
          </div>

          <div className="about-pillar-card">
            <div className="pillar-icon-box">
              <ChartIcon size={24} color="#a855f7" />
            </div>
            <h3>Empirical Disaster Grounding</h3>
            <p>
              Every equation in PRALAYA is calibrated against documented historical catastrophes: the 1979 Machhu-II
              overtopping surge, the 2023 Teesta III GLOF, the 2019 Tiware piping collapse, and the 2018 Kerala
              multi-dam cascading releases, verified via Sentinel-1 SAR satellite observations.
            </p>
          </div>

          <div className="about-pillar-card">
            <div className="pillar-icon-box">
              <MapIcon size={24} color="#fde047" />
            </div>
            <h3>Direct Interoperability for Field Officers</h3>
            <p>
              PRALAYA generates standard GeoTIFF rasters, ESRI Shapefiles, GeoJSON polygons, and Google Earth KMLs
              georeferenced in EPSG:4326. State Disaster Management Authorities can ingest simulation outputs directly
              into QGIS and mobile field command centers.
            </p>
          </div>
        </div>

        {/* Deep Scientific Backstory Section */}
        <div className="about-deep-story-card">
          <div className="story-badge">HISTORICAL ORIGIN // 11 AUGUST 1979</div>
          <h2>The Catalyst: Machhu-II Dam, Morbi</h2>
          <p>
            On August 11, 1979, an unprecedented cloudburst dropped over 700 mm of rain within 24 hours across
            the Machhu basin. Inflow reached 13,570 m³/s — more than 218% of the spillway design discharge.
            As floodwaters overtopped the earthen embankment by 0.6 meters, rapid erosive cavitation severed
            the non-overflow section.
          </p>
          <p>
            Within 2 hours, a 9-meter wavefront slammed into Morbi city 18 kilometers downstream, sweeping away
            thousands of structures and claiming an estimated 2,000 to 5,000 human lives. The disaster revealed
            the deadly gap in dam safety: authorities had no numerical tools to predict wavefront arrival timestamps
            or model safe evacuation corridors.
          </p>
          <p>
            PRALAYA exists so that disaster management authorities never again operate in the dark.
          </p>

          <div className="about-stats-strip">
            <div className="about-stat-item">
              <span className="stat-label">REGISTERED LARGE DAMS</span>
              <span className="stat-val">6,000+</span>
            </div>
            <div className="about-stat-item">
              <span className="stat-label">POPULATION IN VALLEY FLOODPLAINS</span>
              <span className="stat-val">42 Million</span>
            </div>
            <div className="about-stat-item">
              <span className="stat-label">MODEL CONVERGENCE (CSI)</span>
              <span className="stat-val">0.88</span>
            </div>
            <div className="about-stat-item">
              <span className="stat-label">WARNING LEAD TIME GAIN</span>
              <span className="stat-val">+1h 45m</span>
            </div>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="subpage-bottom-cta">
          <div>
            <h4>Experience the Hydrodynamic Digital Twin</h4>
            <p>Test real-time flood wavefront routing and what-if failure scenarios in our simulation engine.</p>
          </div>
          <button type="button" className="subpage-cta-btn" onClick={onBackToHome}>
            LAUNCH DIGITAL TWIN →
          </button>
        </div>
      </div>
    </div>
  );
}
