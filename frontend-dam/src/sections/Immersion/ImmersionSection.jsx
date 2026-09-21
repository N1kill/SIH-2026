import React, { useRef } from 'react';
import SectionLabel from '../../components/SectionLabel';
import BubbleOverlay from '../../components/BubbleOverlay';
import CTAButton from '../../components/CTAButton';
import { useScrollProgress } from '../../hooks/useScrollProgress';
import './immersion.css';

/**
 * Scene 03 — The Immersion
 * Simulates the underwater vantage point following the breach:
 * rising bubble dynamics, depth fog, light refractions, and transition to aerial perspective.
 */
export default function ImmersionSection() {
  const sectionRef = useRef(null);
  const { progress } = useScrollProgress(sectionRef);

  const scrollToEducation = () => {
    const el = document.getElementById('education');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="immersion" ref={sectionRef} className="immersion-section">
      {/* Dynamic underwater fog and light caustics */}
      <div className="immersion-depth-fog" />
      <div className="immersion-caustics" />
      <div className="immersion-light-rays" />

      {/* HTML5 Canvas Rising Bubble Particle Emitter */}
      <BubbleOverlay intensity={1.1} />

      <div className="container immersion-container">
        <div className="immersion-content">
          <SectionLabel
            directive="DIRECTIVE 05A"
            label="SCENE 03 // THE IMMERSION"
            variant="moss"
          />

          <h2 className="immersion-heading">
            Plunged into the surge.
            <br />
            <em>Rising to aerial perspective.</em>
          </h2>

          <p className="immersion-lede">
            As floodwaters breach the masonry crest, hydrodynamic cavitation
            and turbulent eddies engulf the downstream river valley. PRALAYA’s
            digital twin transitions from underwater turbulence to high-resolution
            aerial inundation mapping.
          </p>

          {/* Underwater Hydrodynamic Telemetry Gauges */}
          <div className="immersion-gauges-grid">
            <div className="immersion-gauge-card">
              <div className="gauge-label">SUBMERGED DEPTH</div>
              <div className="gauge-value">-24.4 <span style={{ fontSize: '15px' }}>m</span></div>
              <div className="gauge-subtext">MAX HYDRAULIC HEAD</div>
            </div>

            <div className="immersion-gauge-card">
              <div className="gauge-label">HYDROSTATIC PRESSURE</div>
              <div className="gauge-value">2.39 <span style={{ fontSize: '15px' }}>bar</span></div>
              <div className="gauge-subtext">FOUNDATION TOE UPLIFT</div>
            </div>

            <div className="immersion-gauge-card">
              <div className="gauge-label">FLOW VELOCITY</div>
              <div className="gauge-value">8.2 <span style={{ fontSize: '15px' }}>m/s</span></div>
              <div className="gauge-subtext">CRITICAL SCOUR THRESHOLD</div>
            </div>

            <div className="immersion-gauge-card">
              <div className="gauge-label">TURBIDITY / SEDIMENT</div>
              <div className="gauge-value">3,400 <span style={{ fontSize: '15px' }}>ppm</span></div>
              <div className="gauge-subtext">SUSPENDED ALLUVIAL LOAD</div>
            </div>
          </div>

          {/* Transition to Aerial Topography Callout */}
          <div className="aerial-transition-card">
            <div className="aerial-info">
              <h4>Transition: Subsurface Hydrodynamics → Aerial GIS Mapping</h4>
              <p>
                From the underwater cavitation layer to macroscopic watershed routing.
                Inspect the 2D Saint-Venant shallow water equations and terrain elevation rasters.
              </p>
            </div>

            <CTAButton
              variant="primary"
              size="sm"
              onClick={scrollToEducation}
            >
              ASCEND TO AERIAL GIS ↓
            </CTAButton>
          </div>
        </div>
      </div>
    </section>
  );
}
