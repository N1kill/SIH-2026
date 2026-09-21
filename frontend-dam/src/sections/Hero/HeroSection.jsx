import React, { useRef } from 'react';
import HeroContent from './HeroContent';
import SketchfabViewer from '../../components/SketchfabViewer';
import WebGLDamWater from '../../components/WebGLDamWater';
import ScrollIndicator from '../../components/ScrollIndicator';
import { useScrollProgress } from '../../hooks/useScrollProgress';
import {
  getScrollIndicatorStyle,
  getBreachTransitionAtmosphere,
} from '../../animation/animationConfig';
import './hero.css';

/**
 * Scene 01 — The Calm (Hero)
 * Orchestrates normalized scroll progress through a 240vh track.
 * Features 100% full-viewport 3D dam model and interactive WebGL water flowing down the spillway.
 */
export default function HeroSection() {
  const containerRef = useRef(null);
  const { progress } = useScrollProgress(containerRef);

  // Transition overlay style as scroll approaches Scene 02 (The Breach)
  const breachAtmosphereStyle = getBreachTransitionAtmosphere(progress);
  const scrollIndicatorStyle = getScrollIndicatorStyle(progress);

  return (
    <section id="hero" ref={containerRef} className="hero-scene-container">
      <div className="hero-scene-sticky">
        {/* Atmospheric mist layer & gradient backdrop */}
        <div className="hero-atmosphere" />

        {/* 3D Sketchfab Dam Model expanded to full window size */}
        <SketchfabViewer progress={progress} />

        {/* WebGL Water Simulation flowing directly from the dam spillway into the plunge basin */}
        <WebGLDamWater flowRate="normal" mode="spillway" />

        {/* Left Editorial Narrative Content */}
        <HeroContent progress={progress} />

        {/* Telemetry Scroll Indicator (Fades out as user scrolls) */}
        <ScrollIndicator progress={progress} style={scrollIndicatorStyle} />

        {/* Breach Transition Veil: rises at progress > 75% to prepare Scene 02 */}
        <div
          className="hero-breach-transition-veil"
          style={breachAtmosphereStyle}
        />
      </div>
    </section>
  );
}
