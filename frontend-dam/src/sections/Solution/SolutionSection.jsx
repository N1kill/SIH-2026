import React from 'react';
import SectionLabel from '../../components/SectionLabel';
import CTAButton from '../../components/CTAButton';
import './solution.css';

/**
 * Scene 05 — PRALAYA Digital Twin Pipeline
 */
export default function SolutionSection() {
  const directives = [
    {
      dir: 'DIRECTIVE 1',
      title: 'Data Acquisition',
      desc: 'Automatic extraction of SRTM/Copernicus DEM, monsoon rainfall rasters, LULC classifications, and CWC dam specifications.',
    },
    {
      dir: 'DIRECTIVE 2',
      title: 'Catchment Delineation',
      desc: 'Topographic D8 flow-routing traces the upstream basin boundary (1,924 km²) draining into the reservoir axis.',
    },
    {
      dir: 'DIRECTIVE 3',
      title: 'Rainfall → Inflow',
      desc: 'SCS-CN unit hydrograph modeling converts precipitation time-series into continuous dynamic reservoir inflow curves.',
    },
    {
      dir: 'DIRECTIVE 4',
      title: 'Breach Parameters',
      desc: 'Triangulated regression equations (Froehlich, Wahl, Von Thun & Gillette) predict breach width, side slopes, and formation times.',
    },
    {
      dir: 'DIRECTIVE 5A',
      title: '2D Flood Routing',
      desc: 'High-resolution hydrodynamic propagation computing hour-by-hour flood depth, flow velocity, and arrival timestamps.',
    },
    {
      dir: 'DIRECTIVE 5B & 6',
      title: 'Validation Engine',
      desc: 'Spatial cross-validation against Sentinel-1 SAR flood footprints and documented high-water marks from the 1979 disaster.',
    },
    {
      dir: 'DIRECTIVE 7',
      title: 'Damage & Exposure',
      desc: 'Overlay of building footprints, road networks, and population density to quantify structural loss and economic exposure.',
    },
    {
      dir: 'DIRECTIVE 8',
      title: 'Evacuation Sequencing',
      desc: 'Automated ranking of downstream wards and villages, generating time-stamped evacuation priority sequences.',
    },
  ];

  return (
    <section id="solution" className="solution-section">
      <div className="container">
        <div className="solution-header">
          <SectionLabel
            directive="DIRECTIVES 01 — 08"
            label="THE PRALAYA PLATFORM // DIGITAL TWIN"
            variant="moss"
          />
          <h2 className="h2" style={{ marginTop: '16px', marginBottom: '20px' }}>
            Coordinates in. <em>Decision support out.</em>
          </h2>
          <p className="lede">
            An unbroken eight-stage pipeline transforming raw geospatial coordinates
            into actionable flood routing, evacuation timelines, and GIS-standard decision maps.
          </p>
        </div>

        {/* 8-Directive Cards Grid */}
        <div className="pipeline-grid">
          {directives.map((item, idx) => (
            <div key={idx} className="directive-card">
              <span className="directive-badge">{item.dir}</span>
              <h3 className="directive-title">{item.title}</h3>
              <p className="directive-desc">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* GIS Export Banner */}
        <div className="pipeline-export-banner">
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--accent-moss-light)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}
            >
              MULTI-FORMAT INTEROPERABILITY
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-bright)' }}>
              GeoJSON · KML · ESRI Shapefile · GeoTIFF RASTER
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Instantly compatible with QGIS, ArcGIS, and state disaster response command centers.
            </div>
          </div>

          <CTAButton
            variant="primary"
            onClick={() => alert('Exporting GIS GeoJSON Layers (Machhu-II Downstream Inundation)...')}
          >
            EXPORT GIS PACK
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
