import React from 'react';
import SectionLabel from '../../components/SectionLabel';
import CTAButton from '../../components/CTAButton';
import './features.css';

/**
 * Scene 06 — Features & Platform Launch CTA
 */
export default function FeaturesSection() {
  const scrollToHero = () => {
    const el = document.getElementById('hero');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="features" className="features-section">
      <div className="container">
        <div style={{ maxWidth: '780px', marginBottom: '40px' }}>
          <SectionLabel
            directive="DIRECTIVE 08"
            label="DECISION SUPPORT // EVACUATION SEQUENCING"
            variant="moss"
          />
          <h2 className="h2" style={{ marginTop: '16px', marginBottom: '16px' }}>
            Empowering authorities before the first wave crests.
          </h2>
          <p className="lede">
            PRALAYA generates priority action matrices for district disaster management
            authorities, ensuring early warning alerts reach critical vulnerable zones first.
          </p>
        </div>

        {/* Big Luminous CTA Box */}
        <div className="features-cta-box">
          <h2>Ready to explore the digital twin?</h2>
          <p>
            Experience coordinate-driven hydrodynamic flood modelling, test hypothetical breach
            volumes, and inspect downstream risk exposure in real time.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <CTAButton
              variant="primary"
              size="md"
              onClick={() => alert('Launching PRALAYA Digital Twin Full Simulation Mode...')}
            >
              LAUNCH INTERACTIVE SIMULATOR
            </CTAButton>
            <CTAButton
              variant="ghost"
              size="md"
              onClick={scrollToHero}
            >
              RETURN TO 3D DAM VIEW ↑
            </CTAButton>
          </div>
        </div>

        {/* Footer */}
        <footer className="pralaya-footer">
          <div>
            <span>PRALAYA DISASTER MANAGEMENT SYSTEM</span>
            <span style={{ margin: '0 8px', opacity: 0.3 }}>·</span>
            <span>TEAM MAVENS (SIH26161)</span>
          </div>

          <div>
            <span>NTRO BENCHMARK CASE STUDY: MACHHU-II DAM</span>
            <span style={{ margin: '0 8px', opacity: 0.3 }}>·</span>
            <span>22.82°N, 70.84°E</span>
          </div>
        </footer>
      </div>
    </section>
  );
}
