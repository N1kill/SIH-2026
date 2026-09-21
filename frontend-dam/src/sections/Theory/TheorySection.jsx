import React, { useState } from 'react';
import SectionLabel from '../../components/SectionLabel';
import CTAButton from '../../components/CTAButton';
import { BoltIcon } from '../../components/Icons';
import './theory.css';

/**
 * Scene 03 — Solving In Theory
 * Explains PRALAYA's computational hydrodynamic physics engine:
 * 2D Saint-Venant equations, parametric breach hydrographs, DEM coupling,
 * and finite-volume Riemann shock capturing, paired with high-tech simulation telemetry.
 */
export default function TheorySection() {
  const [activePillar, setActivePillar] = useState(0);

  const pillars = [
    {
      id: 'swe',
      title: '2D Saint-Venant Equations',
      badge: 'GOVERNING FLUID DYNAMICS',
      formula: '∂U/∂t + ∂F(U)/∂x + ∂G(U)/∂y = S',
      desc: 'Depth-averaged 2D Shallow Water Equations (SWE) governing mass and momentum conservation across arbitrary 3D topography.',
      points: [
        'Conservatively tracks water depth h(x,y,t) and directional velocity vector fields (u, v).',
        'Captures supercritical hydraulic jumps and turbulent wave fronts without numerical dispersion.',
        'Well-balanced scheme ensures exact preservation of lake-at-rest hydrostatic equilibrium.',
      ],
      params: 'Variables: h = water depth (m), u,v = velocity (m/s), z_b = bed elevation (m)',
    },
    {
      id: 'breach',
      title: 'Parametric Breach Hydrograph',
      badge: 'BREACH OUTFLOW PHYSICS',
      formula: 'B_avg = 0.1803 · K_o · V_w^0.32 · h_b^0.19',
      desc: 'Empirically validated Froehlich (2008) and MacDonald-Langridge equations calculate breach enlargement and peak outflow discharge.',
      points: [
        'Predicts time-dependent trapezoidal breach width growth B(t) from initial piping or overtopping.',
        'Calculates breach formation time t_f and side slope ratios Z based on dam embankment volume.',
        'Feeds the dynamic inflow discharge hydrograph directly into the downstream 2D solver boundary.',
      ],
      params: 'Parameters: V_w = reservoir volume (m³), h_b = breach height (m), K_o = overtopping factor (1.4)',
    },
    {
      id: 'dem',
      title: 'DEM & Manning Roughness Coupling',
      badge: 'TERRAIN HYDRAULICS',
      formula: 'S_fx = (n² · u · √(u² + v²)) / (h^(4/3))',
      desc: 'Seamless fusion of 30m Copernicus and 12.5m ALOS PALSAR digital elevation models with spatially-varying Manning roughness matrices.',
      points: [
        'Assigns friction values: n = 0.028 (natural riverbed) to n = 0.120 (dense urban infrastructure).',
        'Models topographic energy dissipation and backwater wave reflections at river bends.',
        'Enables sub-meter vertical precision for downstream settlements and bridge piers.',
      ],
      params: 'Resolution: 30m Global DEM · Friction range: n ∈ [0.025, 0.140] · CRS: EPSG:4326',
    },
    {
      id: 'fvm',
      title: 'GPU Finite-Volume Riemann Solver',
      badge: 'NUMERICAL ACCELERATION',
      formula: 'U_i^(n+1) = U_i^n - (Δt/A_i) · ∑ F*_ij · L_ij + Δt · S_i',
      desc: 'Second-order Godunov-type finite volume method utilizing HLLC Riemann shock-capturing schemes accelerated on GPU parallel grids.',
      points: [
        'Handles complex wet/dry moving boundaries with sub-millimeter water depth thresholds.',
        'Adaptive time-stepping strictly enforced via Courant-Friedrichs-Lewy (CFL ≤ 0.85) stability criteria.',
        'Executes 100x faster than real-time flood propagation for instantaneous early warning.',
      ],
      params: 'CFL: 0.85 · Solver: HLLC Riemann with Minmod slope limiter · Execution: Parallel GPU',
    },
  ];

  const current = pillars[activePillar];

  return (
    <section id="theory" className="theory-section">
      {/* Background ambient grid overlay */}
      <div className="theory-bg-grid" />

      <div className="container">
        {/* Section Header */}
        <div className="theory-header">
          <SectionLabel
            directive="DIRECTIVE 03 & 04"
            label="SCENE 03 // HOW WE SOLVE IT IN THEORY"
            variant="cyan"
          />
          <h2 className="h2" style={{ marginTop: '16px', marginBottom: '16px' }}>
            Solving in theory. <em>2D Saint-Venant equations & high-res terrain meshes.</em>
          </h2>
          <p className="lede" style={{ maxWidth: '840px' }}>
            Predicting catastrophic dam failure requires rigorous computational physics, not empirical guesswork.
            PRALAYA couples depth-averaged hydrodynamic shallow water equations with satellite digital elevation models
            and GPU-accelerated Riemann shock-capturing solvers.
          </p>
        </div>

        {/* 2-Column Main Showcase */}
        <div className="theory-grid-layout">
          {/* Left Column: Theoretical Framework & Equations */}
          <div className="theory-left-column">
            {/* Interactive Pillar Selector Tabs */}
            <div className="theory-pillar-tabs">
              {pillars.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  className={`pillar-tab-btn ${idx === activePillar ? 'is-active' : ''}`}
                  onClick={() => setActivePillar(idx)}
                >
                  <span className="tab-idx">0{idx + 1}</span>
                  <span className="tab-title">{p.title}</span>
                </button>
              ))}
            </div>

            {/* Active Pillar Card */}
            <div className="theory-active-card">
              <div className="pillar-badge-row">
                <span className="pillar-type-badge">{current.badge}</span>
                <span className="pillar-cfl-badge">CFL CONVERGED</span>
              </div>

              <h3 className="pillar-active-title">{current.title}</h3>
              <p className="pillar-active-desc">{current.desc}</p>

              {/* Formula Callout Box */}
              <div className="formula-callout-box">
                <div className="formula-header">
                  <span className="formula-tag">GOVERNING RELATION</span>
                  <span className="formula-status">MATHEMATICALLY PROVEN</span>
                </div>
                <div className="formula-math-display">{current.formula}</div>
                <div className="formula-params-note">{current.params}</div>
              </div>

              {/* Key Scientific Points */}
              <div className="pillar-points-list">
                {current.points.map((pt, pIdx) => (
                  <div key={pIdx} className="point-item">
                    <span className="point-bullet">▹</span>
                    <span className="point-text">{pt}</span>
                  </div>
                ))}
              </div>

              {/* Scene Navigation Trigger */}
              <div className="theory-action-row">
                <a href="#outputs" className="theory-next-cta">
                  EXPLORE DELIVERABLE OUTPUTS (SCENE 04) →
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: High-Res Simulation Visual Showcase */}
          <div className="theory-right-column">
            <div className="theory-image-container">
              {/* Generated scientific visualization */}
              <img
                src="/images/theory/pralaya_theory_solving_engine.jpg"
                alt="PRALAYA 2D Hydrodynamic Saint-Venant Simulation Engine"
                className="theory-engine-visual"
                loading="lazy"
              />

              {/* Glowing gradient framing */}
              <div className="theory-image-overlay" />

              {/* Floating Live Telemetry Overlay HUD */}
              <div className="theory-hud-header">
                <div className="hud-live-tag">
                  <span className="hud-live-dot" />
                  HYDRODYNAMIC SOLVER: ACTIVE
                </div>
                <div className="hud-timetag">t = 03h 22m [CONVERGED]</div>
              </div>

              {/* HUD Stat Badges along bottom */}
              <div className="theory-hud-metrics">
                <div className="hud-stat-pill">
                  <span className="hud-stat-lbl">PEAK INFLOW</span>
                  <span className="hud-stat-val">14,850 m³/s</span>
                </div>
                <div className="hud-stat-pill">
                  <span className="hud-stat-lbl">MAX DEPTH</span>
                  <span className="hud-stat-val">14.5 m</span>
                </div>
                <div className="hud-stat-pill">
                  <span className="hud-stat-lbl">FLOOD AREA</span>
                  <span className="hud-stat-val">68.4 km²</span>
                </div>
                <div className="hud-stat-pill highlight">
                  <span className="hud-stat-lbl">DEM GRID</span>
                  <span className="hud-stat-val">8K TOPO MESH</span>
                </div>
              </div>

              {/* Floating equation tag */}
              <div className="floating-equation-badge">
                <BoltIcon size={14} color="#81e6d9" />
                <span className="badge-text">Saint-Venant 2D FVM // Roe-HLLC Riemann Solver</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
