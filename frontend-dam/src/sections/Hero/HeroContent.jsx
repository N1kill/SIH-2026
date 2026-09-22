import React, { useMemo } from 'react';
import SectionLabel from '../../components/SectionLabel';
import CTAButton from '../../components/CTAButton';
import { getHeroContentStyle } from '../../animation/animationConfig';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MACHHU_II_CASE } from '../../data/historicalCases';

/**
 * Editorial Content overlay for Scene 01 — The Calm
 */
export default function HeroContent({ progress = 0 }) {
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Centralized animation style for content fade, drift & blur
  const dynamicStyle = useMemo(() => {
    return getHeroContentStyle(progress, isMobile);
  }, [progress, isMobile]);

  const scrollToBreach = () => {
    const breachElem = document.getElementById('breach');
    if (breachElem) {
      breachElem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="hero-content-wrapper" style={dynamicStyle}>
      {/* Eyebrow Label */}
      <div>
        <SectionLabel
          directive="DIRECTIVE 01"
          label="THE CALM // RESERVOIR"
          variant="moss"
        />
      </div>

      {/* Main Headline */}
      <h1 className="hero-title">
        Understand
        <br />
        <em>the Breach.</em>
      </h1>

      {/* Narrative Lede */}
      <p className="hero-lede">
        Explore dam-breach flooding through coordinate-driven 3D visualization
        and terrain-based hydrodynamic modeling. Validated against the
        historic 1979 Machhu-II dam failure.
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '4px' }}>
        <CTAButton variant="primary" onClick={scrollToBreach}>
          EXPLORE FLOOD MODEL
        </CTAButton>
        <CTAButton
          variant="ghost"
          href="#education"
        >
          HISTORICAL RECORD
        </CTAButton>
      </div>

      {/* Telemetry metadata grid */}
      <div className="hero-metadata-grid">
        <div className="hero-meta-item">
          <span className="meta-k">LOCATION</span>
          <span className="meta-v">{MACHHU_II_CASE.location}</span>
        </div>
        <div className="hero-meta-item">
          <span className="meta-k">COORDINATES</span>
          <span className="meta-v">{MACHHU_II_CASE.coordinates}</span>
        </div>
        <div className="hero-meta-item">
          <span className="meta-k">HISTORICAL EVENT</span>
          <span className="meta-v">{MACHHU_II_CASE.eventDate}</span>
        </div>
        <div className="hero-meta-item">
          <span className="meta-k">INUNDATION SCALE</span>
          <span className="meta-v">8–10m Flood Wave</span>
        </div>
      </div>
    </div>
  );
}
