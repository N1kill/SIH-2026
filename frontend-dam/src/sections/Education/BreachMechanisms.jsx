import React from 'react';
import SectionLabel from '../../components/SectionLabel';
import './education.css';

/**
 * Scene 04 — Breach Mechanisms & Historical Analysis
 */
export default function BreachMechanisms() {
  const mechanisms = [
    {
      num: 'MECHANISM 01',
      title: 'Hydraulic Overtopping',
      desc: 'Occurs when reservoir inflow vastly exceeds spillway discharge capacity. Water spills over non-overflow crests, eroding downstream embankment slope rapidly.',
      highlight: 'Primary cause of the 1979 Machhu-II disaster (218% inflow exceedance).',
    },
    {
      num: 'MECHANISM 02',
      title: 'Internal Erosion & Piping',
      desc: 'Subsurface seepage paths transport fine foundation particles, forming progressive voids beneath or through earthfill abutments until crest collapse.',
      highlight: 'Responsible for over 46% of embankment dam failures globally.',
    },
    {
      num: 'MECHANISM 03',
      title: 'Structural Foundation Sliding',
      desc: 'High pore-water uplift pressures or geological shear faults reduce base friction, causing monolithic concrete or masonry blocks to displace downriver.',
      highlight: 'Governed by Mohr-Coulomb shear failure criteria in digital twin simulations.',
    },
  ];

  return (
    <section id="education" className="education-section">
      <div className="container">
        <div className="education-header">
          <SectionLabel
            directive="DIRECTIVE 03 & 04"
            label="SCIENTIFIC FOUNDATIONS // FAILURE MECHANISMS"
            variant="amber"
          />
          <h2 className="h2" style={{ marginTop: '16px', marginBottom: '20px' }}>
            Physics of failure. <em>Validated against reality.</em>
          </h2>
          <p className="lede">
            Every simulation in PRALAYA is grounded in empirical peer-reviewed
            hydrologic and hydrodynamic equations — tested against real recorded
            disaster outcomes rather than unvalidated approximations.
          </p>
        </div>

        {/* 3 Failure Mechanisms Grid */}
        <div className="education-mechanisms-grid">
          {mechanisms.map((item, idx) => (
            <div key={idx} className="mechanism-card">
              <div className="mechanism-number">{item.num}</div>
              <h3 className="mechanism-title">{item.title}</h3>
              <p className="mechanism-desc">{item.desc}</p>
              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--border-faint)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--accent-amber)',
                  lineHeight: '1.5',
                }}
              >
                {item.highlight}
              </div>
            </div>
          ))}
        </div>

        {/* Historical case comparison */}
        <div className="history-callout">
          <div className="history-callout-header">
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.12em',
                  color: 'var(--accent-amber)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                HISTORICAL BENCHMARK GROUND TRUTH
              </span>
              <h3 style={{ fontSize: '20px', color: 'var(--text-bright)', marginTop: '4px' }}>
                Machhu-II Dam (11 August 1979, Morbi)
              </h3>
            </div>

            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                padding: '4px 10px',
                background: 'rgba(184, 141, 42, 0.2)',
                border: '1px solid var(--accent-amber)',
                borderRadius: '4px',
                color: 'var(--text-bright)',
              }}
            >
              NTRO BENCHMARK
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', lineHeight: '1.7' }}>
            India manages over 6,000 large dams on the National Register. PRALAYA
            empowers disaster management authorities with instantaneous,
            coordinate-driven inundation timelines before floodwaters reach
            downstream settlements.
          </p>
        </div>
      </div>
    </section>
  );
}
