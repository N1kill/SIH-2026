import React from 'react';
import SectionLabel from '../components/SectionLabel';
import { ChartIcon, WaveIcon, MapIcon, ShieldCheckIcon } from '../components/Icons';
import './pages.css';

/**
 * DocsPage — PRALAYA Technical Documentation & Methodology
 * Details governing equations, GIS standards, and API specs. Zero emojis.
 */
export default function DocsPage({ onBackToHome }) {
  return (
    <div className="pralaya-subpage">
      <div className="container subpage-container">
        {/* Top Breadcrumb */}
        <div className="subpage-top-nav">
          <button type="button" className="back-to-home-btn" onClick={onBackToHome}>
            ← RETURN TO HOME
          </button>
          <span className="subpage-meta-tag">TECHNICAL SPECIFICATION V1.4</span>
        </div>

        {/* Page Header */}
        <div className="subpage-header">
          <SectionLabel
            directive="ENGINEERING SPECIFICATION"
            label="DOCS // HYDRODYNAMIC METHODOLOGY"
            variant="purple"
          />
          <h1 className="subpage-title">
            Mathematical Formulation <em>& System Architecture.</em>
          </h1>
          <p className="subpage-lede">
            Complete technical documentation of the governing fluid equations, digital elevation raster coupling,
            and machine-readable GIS output specifications powering the PRALAYA engine.
          </p>
        </div>

        <div className="docs-sections-container">
          {/* Section 1: Governing Equations */}
          <div className="doc-block-card">
            <div className="doc-block-header">
              <WaveIcon size={20} color="#3fa89b" />
              <h3>1. 2D Shallow Water Equations (SWE)</h3>
            </div>
            <p>
              The conservative differential formulation of the 2D depth-averaged shallow water equations is defined as:
            </p>
            <div className="code-formula-block">
              <code>∂U/∂t + ∂F(U)/∂x + ∂G(U)/∂y = S</code>
            </div>
            <p>Where the conservative conserved state variable vector U and directional flux vectors F, G are given by:</p>
            <div className="code-formula-block">
              <code>U = [h, hu, hv]ᵀ</code><br />
              <code>F(U) = [hu, hu² + ½gh², huv]ᵀ</code><br />
              <code>G(U) = [hv, huv, hv² + ½gh²]ᵀ</code>
            </div>
            <p>
              Source terms S account for bottom bed slope elevation gradients (-gh ∂z_b/∂x) and anisotropic bed shear
              stresses derived from Manning's empirical roughness coefficients.
            </p>
          </div>

          {/* Section 2: Breach Hydrograph Formulation */}
          <div className="doc-block-card">
            <div className="doc-block-header">
              <ChartIcon size={20} color="#a855f7" />
              <h3>2. Parametric Dam Breach Outflow (Froehlich 2008)</h3>
            </div>
            <p>
              Average breach width (B_avg) and breach formation duration (t_f) are governed by empirical non-linear
              regressions calibrated across 74 historical dam failures:
            </p>
            <div className="code-formula-block">
              <code>B_avg = 0.1803 · K_o · V_w^0.32 · h_b^0.19  (meters)</code><br />
              <code>t_f = 0.00254 · V_w^0.53 · h_b^(-0.90)  (hours)</code>
            </div>
            <p>
              Where K_o = 1.4 for overtopping and 1.0 for piping, V_w is reservoir storage volume at breach in m³,
              and h_b is the hydraulic head above the breach invert.
            </p>
          </div>

          {/* Section 3: GIS Export Standards */}
          <div className="doc-block-card">
            <div className="doc-block-header">
              <MapIcon size={20} color="#fde047" />
              <h3>3. Spatial Reference & File Standards</h3>
            </div>
            <p>
              All computational rasters and vector shapefiles are projected in standardized global coordinates:
            </p>
            <div className="specs-list">
              <div><strong>Coordinate Reference System (CRS):</strong> EPSG:4326 (WGS84 Ellipsoid)</div>
              <div><strong>Digital Elevation Model:</strong> Copernicus 30m Global DEM (Fused with ALOS PALSAR 12.5m)</div>
              <div><strong>Raster Outputs:</strong> 32-bit floating point GeoTIFF (depth_max.tif, velocity_max.tif)</div>
              <div><strong>Vector Polygons:</strong> OGC compliant GeoJSON & ESRI Shapefile with ISO 19115 metadata</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
