import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DamCameraDirector from './components/DamCameraDirector';
import BreachSection from './sections/Breach/BreachSection';
import TheorySection from './sections/Theory/TheorySection';
import OutputsAccordion from './sections/Outputs/OutputsAccordion';
import HydroComparisonSection from './sections/Scenarios/HydroComparisonSection';
import FeaturesSection from './sections/Features/FeaturesSection';

// Dedicated Sub-Pages
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import SimulatePage from './pages/SimulatePage';
import DocsPage from './pages/DocsPage';

/**
 * Determine initial page from URL pathname or hash
 */
function getInitialPage() {
  const path = window.location.pathname.replace(/^\//, '').toLowerCase();
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  const validPages = ['simulate', 'about', 'contact', 'docs'];
  if (validPages.includes(path)) return path;
  if (validPages.includes(hash)) return hash;
  return 'home';
}

/**
 * PRALAYA — Dam Breach 3D Digital Twin & Inundation Simulation
 * 
 * Multi-Page & Multi-Scene Experience:
 * - Navbar: Home | Simulate | About | Contact Us | Docs
 * - Scene 01: The Calm // 3D Dam Camera Director with Photorealistic WebGL Water Simulation
 * - Scene 02: Why is PRALAYA built // Historical Dam Breaches & Failure Case Archives
 * - Scene 03: Solving In Theory // 2D Saint-Venant Equations & Digital Elevation Meshes
 * - Scene 04: Engine Outputs & Deliverables (Horizontal Expanding Accordion Cards)
 * - Scene 05: Models & Scenarios (Delft3D vs SPH, What-If Sandbox, Evacuation Tracking)
 * - Scene 06: Decision Support (Command Center & Footer)
 */
export default function App() {
  const [currentPage, setCurrentPage] = useState(getInitialPage);

  // Sync URL history when page changes
  const handleNavigate = (page) => {
    setCurrentPage(page);
    const targetPath = page === 'home' ? '/' : `/${page}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ page }, '', targetPath);
    }
  };

  // Listen to browser forward/back buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(getInitialPage());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
      <Navbar currentPage={currentPage} onNavigate={handleNavigate} />

      {/* 2. Main Page Router / View Switcher */}
      {currentPage === 'home' && (
        <main>
          {/* Scene 01: The Calm (3D Photogrammetry Dam Model — Water Simulation OFF by default, toggleable via UI) */}
          <DamCameraDirector id="hero" initialWater={false} />

          {/* Scene 02: Why is PRALAYA built (Historical Dam Breaches & Case Archives) */}
          <BreachSection />

          {/* Scene 03: How We Solve It In Theory (2D Saint-Venant & DEM Mesh Physics + AI Visual) */}
          <TheorySection />

          {/* Scene 04: Engine Deliverable Outputs (Horizontal Expanding Accordion Deck with 7 outputs) */}
          <OutputsAccordion />

          {/* Scene 05: Hydrodynamic Models, What-If Sandbox & Nearest Evacuation Routing */}
          <HydroComparisonSection />

          {/* Scene 06: Decision Support & Evacuation Sequencing (Command Center & Footer) */}
          <FeaturesSection />
        </main>
      )}

      {currentPage === 'simulate' && (
        <SimulatePage onBackToHome={() => handleNavigate('home')} />
      )}

      {currentPage === 'about' && (
        <AboutPage onBackToHome={() => handleNavigate('home')} />
      )}

      {currentPage === 'contact' && (
        <ContactPage onBackToHome={() => handleNavigate('home')} />
      )}

      {currentPage === 'docs' && (
        <DocsPage onBackToHome={() => handleNavigate('home')} />
      )}
    </div>
  );
}