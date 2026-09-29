import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DamCameraDirector from './components/DamCameraDirector';
import BreachSection from './sections/Breach/BreachSection';
import TheorySection from './sections/Theory/TheorySection';
import OutputsAccordion from './sections/Outputs/OutputsAccordion';
import HydroComparisonSection from './sections/Scenarios/HydroComparisonSection';
import FeaturesSection from './sections/Features/FeaturesSection';
import BubbleOverlay from './components/BubbleOverlay';

// Dedicated Sub-Pages
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import SimulatePage from './pages/SimulatePage';
import DocsPage from './pages/DocsPage';

/**
 * PRALAYA — Dam Breach 3D Digital Twin & Inundation Simulation
 * 
 * Multi-Page & Multi-Scene Experience:
 * - Navbar: Home | Simulate | About | Contact Us | Docs
 * - Scene 01: The Calm // 3D Dam Camera Director (#hero)
 * - Scene 02: Why is PRALAYA built // Historical Dam Breaches & Failure Case Archives (#breach)
 * - Scene 03: Solving In Theory // 2D Saint-Venant Equations & Digital Elevation Meshes (#theory)
 * - Scene 04 to 06: Water Particles Continuum (Continuous BubbleOverlay through Scenes 04, 05, 06)
 *   - Scene 04: Engine Outputs & Deliverables (Horizontal Expanding Accordion Cards)
 *   - Scene 05: Models & Scenarios (Delft3D vs SPH, What-If Sandbox, Evacuation Tracking)
 *   - Scene 06: Decision Support (Command Center & Footer)
 */
export default function App() {
  const [currentPage, setCurrentPage] = useState('home');

  // Scroll to top whenever switching sub-pages
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  return (
    <div
      className="pralaya-app"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        background: 'var(--bg-canvas, #101917)',
        color: 'var(--text-primary, #f0f4ef)',
        overflowX: 'clip',
      }}
    >
      {/* 1. Global Floating Glassmorphic HUD Navbar */}
      <Navbar currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* 2. Main Page Router / View Switcher */}
      {currentPage === 'home' && (
        <main>
          {/* Scene 01: The Calm (3D Dam with calibrated camera director) */}
          <DamCameraDirector id="hero" showWater={false} />

          {/* Scene 02: Why is PRALAYA built (Historical Dam Breaches & Case Archives) */}
          <BreachSection />

          {/* Scene 03: How We Solve It In Theory (2D Saint-Venant & DEM Mesh Physics + AI Visual) */}
          <TheorySection />

          {/* Scene 04 to End: CONTINUOUS WATER PARTICLES EMITTER */}
          <div
            className="water-particles-continuum"
            style={{
              position: 'relative',
              width: '100%',
              overflow: 'visible',
            }}
          >
            {/* HTML5 Canvas Underwater Particle Emitter running continuously across Scenes 04-06 */}
            <BubbleOverlay intensity={1.8} />

            {/* Scene 04: Engine Deliverable Outputs (Horizontal Expanding Accordion Deck with 7 outputs) */}
            <OutputsAccordion />

            {/* Scene 05: Hydrodynamic Models, What-If Sandbox & Nearest Evacuation Routing */}
            <HydroComparisonSection />

            {/* Scene 06: Decision Support & Evacuation Sequencing (Command Center & Footer) */}
            <FeaturesSection />
          </div>
        </main>
      )}

      {currentPage === 'simulate' && (
        <SimulatePage
          onBackToHome={() => setCurrentPage('home')}
          onViewSimulation={() => window.location.assign('/simulation/')}
        />
      )}

      {currentPage === 'about' && (
        <AboutPage onBackToHome={() => setCurrentPage('home')} />
      )}

      {currentPage === 'contact' && (
        <ContactPage onBackToHome={() => setCurrentPage('home')} />
      )}

      {currentPage === 'docs' && (
        <DocsPage onBackToHome={() => setCurrentPage('home')} />
      )}
    </div>
  );
}
