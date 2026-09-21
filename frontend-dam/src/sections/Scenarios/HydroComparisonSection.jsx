import React, { useState, useEffect, useRef } from 'react';
import SectionLabel from '../../components/SectionLabel';
import BubbleOverlay from '../../components/BubbleOverlay';
import {
  SlidersIcon,
  ScaleIcon,
  TargetIcon,
  RunnerIcon,
  AlertIcon,
  SchoolIcon,
  StadiumIcon,
  MonumentIcon,
} from '../../components/Icons';
import './scenarios.css';

/**
 * Scene 05 — Hydrodynamic Models, What-If Scenarios & Evacuation Routing
 * Docked Left-Corner Semicircle with Center Info Display & Floating Water Bubbles.
 * Screen freezes until 4th module is scrolled through too.
 */

const SCENE_ITEMS = [
  {
    id: 'whatif',
    idxStr: '01',
    category: 'HYDRAULIC SANDBOX',
    pillLabel: 'WHAT-IF HYDRAULIC SANDBOX',
    title: 'Interactive Dam Failure & Inflow Parameters',
    subtitle: 'Simulate alternate catastrophe outcomes in real-time',
    desc: 'Drag parameters to dynamically recalculate breach hydrograph peak discharge, downstream wave arrival timestamps, and total inundation footprint.',
    icon: SlidersIcon,
  },
  {
    id: 'delft-sph',
    idxStr: '02',
    category: 'CONTINUUM & PARTICLE SOLVERS',
    pillLabel: 'DELFT3D VS SPH SOLVERS',
    title: 'Eulerian SWE vs Lagrangian Particle Solvers',
    subtitle: 'Macroscopic basin routing vs microscopic structural impact',
    desc: 'How PRALAYA seamlessly bridges Delft3D 2D shallow water equations with SPH particle hydrodynamics for structural pier cavitation.',
    icon: ScaleIcon,
  },
  {
    id: 'actual-sim',
    idxStr: '03',
    category: 'GROUND TRUTH CALIBRATION',
    pillLabel: 'ACTUAL VS SIMULATED MATCH',
    title: '1979 Machhu-II Ground Truth Calibration',
    subtitle: 'F1-Score: 0.91 · Critical Success Index: 0.88',
    desc: 'Direct empirical validation against Government of Gujarat survey records, Sentinel-1 SAR flood boundaries, and 28 downstream gauge stations.',
    icon: TargetIcon,
  },
  {
    id: 'evacuation',
    idxStr: '04',
    category: 'TACTICAL RESCUE ROUTING',
    pillLabel: 'NEAREST EVACUATION ROUTING',
    title: 'Dynamic Safe Corridors & Shelter Allocation',
    subtitle: 'GIS network analysis cross-referencing live wavefront depths',
    desc: 'Prevents civilian convoys from traversing submerged roads, dynamically verifying topographic high-ground buffers (≥ +5m) and capacity balancing.',
    icon: RunnerIcon,
  },
];

export default function HydroComparisonSection() {
  const sectionRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFrozen, setIsFrozen] = useState(false);

  // Live state refs to guarantee event handlers always see current values without teardown
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;

  const isFrozenRef = useRef(false);
  isFrozenRef.current = isFrozen;

  const cooldownRef = useRef(false);
  const targetScrollYRef = useRef(0);
  const unlockCooldownUntilRef = useRef(0);

  // What-If Scenario Sandbox State
  const [reservoirLevel, setReservoirLevel] = useState(115); // % (80 to 135)
  const [breachWidth, setBreachWidth] = useState(180); // meters (50 to 260)
  const [inflowMultiplier, setInflowMultiplier] = useState(2.18); // x multiplier (1.0 to 3.5)
  const [failureMode, setFailureMode] = useState('overtopping'); // 'overtopping' | 'piping' | 'sliding'

  // Dynamic calculations based on What-If parameters
  const calculatedPeakQ = Math.round(
    14850 *
      (reservoirLevel / 100) *
      (breachWidth / 180) *
      (inflowMultiplier / 2.18) *
      (failureMode === 'overtopping' ? 1.0 : failureMode === 'piping' ? 0.82 : 1.18)
  );

  const calculatedArrivalTimeMin = Math.max(
    45,
    Math.round(165 / Math.sqrt((reservoirLevel / 100) * (inflowMultiplier / 2.18)))
  );

  const calculatedAreaKm2 = (
    68.4 *
    Math.pow(reservoirLevel / 100, 0.7) *
    Math.pow(breachWidth / 180, 0.5) *
    (inflowMultiplier / 2.18)
  ).toFixed(1);

  const formatHours = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
  };

  // TRUE SCREEN FREEZE CONTROLLER:
  // Catches scroll into Scene 05, completely freezes the window in place,
  // and routes downward scroll gestures exclusively to stepping through slides 01 -> 04.
  // The screen strictly freezes UNTIL the 4th module is scrolled past too!
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const updateTargetScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      targetScrollYRef.current = window.pageYOffset + rect.top;
    };

    updateTargetScroll();
    window.addEventListener('resize', updateTargetScroll);

    // Scroll listener: enforces absolute position lock while frozen,
    // and catches the page when scrolling into Scene 05.
    const onScroll = () => {
      if (!sectionRef.current) return;

      // If user recently deliberately unlocked (scrolling past slide 4 or back to slide 1),
      // respect the transition cooldown so we do NOT instantly re-lock!
      if (Date.now() < unlockCooldownUntilRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();

      // If frozen, strictly enforce that window does not move a single pixel
      if (isFrozenRef.current) {
        const diff = Math.abs(window.pageYOffset - targetScrollYRef.current);
        if (diff > 1) {
          window.scrollTo(0, targetScrollYRef.current);
        }
        return;
      }

      // If not yet frozen, check if user has scrolled near Scene 05 top
      const isEntering = rect.top <= 60 && rect.top >= -80;
      if (isEntering && !isFrozenRef.current) {
        targetScrollYRef.current = window.pageYOffset + rect.top;
        window.scrollTo(0, targetScrollYRef.current);
        isFrozenRef.current = true;
        setIsFrozen(true);
      }
    };

    // Wheel listener: intercepts all wheel input while frozen
    const onWheel = (e) => {
      if (!sectionRef.current) return;

      // Allow native slider interaction
      if (e.target && e.target.tagName === 'INPUT') return;

      // If unlock cooldown active, let user smoothly pass through
      if (Date.now() < unlockCooldownUntilRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const isApproachingDown = rect.top > 0 && rect.top < 160 && e.deltaY > 0;
      const isApproachingUp =
        rect.bottom < window.innerHeight &&
        rect.bottom > window.innerHeight - 160 &&
        e.deltaY < 0;
      const isOverSection = rect.top <= 50 && rect.bottom >= window.innerHeight * 0.45;

      // Catch user scrolling down into Scene 05 from Scene 04
      if (isApproachingDown && !isFrozenRef.current) {
        e.preventDefault();
        e.stopPropagation();
        targetScrollYRef.current = window.pageYOffset + rect.top;
        window.scrollTo(0, targetScrollYRef.current);
        isFrozenRef.current = true;
        setIsFrozen(true);
        activeIndexRef.current = 0;
        setActiveIndex(0);
        return;
      }

      // Catch user scrolling up into Scene 05 from Scene 06
      if (isApproachingUp && !isFrozenRef.current) {
        e.preventDefault();
        e.stopPropagation();
        targetScrollYRef.current = window.pageYOffset + rect.top;
        window.scrollTo(0, targetScrollYRef.current);
        isFrozenRef.current = true;
        setIsFrozen(true);
        activeIndexRef.current = 3;
        setActiveIndex(3);
        return;
      }

      // If over section and not frozen, freeze immediately
      if (isOverSection && !isFrozenRef.current) {
        targetScrollYRef.current = window.pageYOffset + rect.top;
        window.scrollTo(0, targetScrollYRef.current);
        isFrozenRef.current = true;
        setIsFrozen(true);
      }

      // If not frozen, allow normal scroll
      if (!isFrozenRef.current) return;

      // UNBREAKABLE FREEZE: Prevent all native window movement while on Scene 05
      e.preventDefault();
      e.stopPropagation();
      window.scrollTo(0, targetScrollYRef.current);

      if (cooldownRef.current) return;

      const currentIdx = activeIndexRef.current;

      if (e.deltaY > 15) {
        // User scrolling DOWN:
        if (currentIdx < SCENE_ITEMS.length - 1) {
          // Slide 0 -> 1 -> 2 -> 3
          // Freeze stays 100% active, dial rolls UP by 90°
          cooldownRef.current = true;
          const nextIdx = currentIdx + 1;
          activeIndexRef.current = nextIdx;
          setActiveIndex(nextIdx);
          setTimeout(() => {
            cooldownRef.current = false;
          }, 420);
        } else {
          // USER IS ON SLIDE 04 AND SCROLLED DOWN AGAIN!
          // Only now does the window unfreeze and proceed down to Scene 06!
          cooldownRef.current = true;
          unlockCooldownUntilRef.current = Date.now() + 1200;
          isFrozenRef.current = false;
          setIsFrozen(false);
          window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
          setTimeout(() => {
            cooldownRef.current = false;
          }, 600);
        }
      } else if (e.deltaY < -15) {
        // User scrolling UP:
        if (currentIdx > 0) {
          // Slide 3 -> 2 -> 1 -> 0
          // Freeze stays 100% active, dial rolls DOWN by 90°
          cooldownRef.current = true;
          const prevIdx = currentIdx - 1;
          activeIndexRef.current = prevIdx;
          setActiveIndex(prevIdx);
          setTimeout(() => {
            cooldownRef.current = false;
          }, 420);
        } else {
          // User is on first slide (01) and scrolled UP again!
          // Unfreeze to scroll back up to Scene 04!
          cooldownRef.current = true;
          unlockCooldownUntilRef.current = Date.now() + 1200;
          isFrozenRef.current = false;
          setIsFrozen(false);
          window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
          setTimeout(() => {
            cooldownRef.current = false;
          }, 600);
        }
      }
    };

    let touchStartY = 0;
    const onTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (!isFrozenRef.current) return;
      if (Date.now() < unlockCooldownUntilRef.current) return;

      const touchEndY = e.touches[0].clientY;
      const deltaY = touchStartY - touchEndY;

      if (Math.abs(deltaY) > 25) {
        e.preventDefault();
        e.stopPropagation();

        if (cooldownRef.current) return;

        const currentIdx = activeIndexRef.current;
        if (deltaY > 0) {
          // Swipe up (scroll down)
          if (currentIdx < SCENE_ITEMS.length - 1) {
            cooldownRef.current = true;
            touchStartY = touchEndY;
            const nextIdx = currentIdx + 1;
            activeIndexRef.current = nextIdx;
            setActiveIndex(nextIdx);
            setTimeout(() => {
              cooldownRef.current = false;
            }, 420);
          } else {
            cooldownRef.current = true;
            unlockCooldownUntilRef.current = Date.now() + 1200;
            isFrozenRef.current = false;
            setIsFrozen(false);
            window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
            setTimeout(() => {
              cooldownRef.current = false;
            }, 600);
          }
        } else {
          // Swipe down (scroll up)
          if (currentIdx > 0) {
            cooldownRef.current = true;
            touchStartY = touchEndY;
            const prevIdx = currentIdx - 1;
            activeIndexRef.current = prevIdx;
            setActiveIndex(prevIdx);
            setTimeout(() => {
              cooldownRef.current = false;
            }, 420);
          } else {
            cooldownRef.current = true;
            unlockCooldownUntilRef.current = Date.now() + 1200;
            isFrozenRef.current = false;
            setIsFrozen(false);
            window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
            setTimeout(() => {
              cooldownRef.current = false;
            }, 600);
          }
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      window.removeEventListener('resize', updateTargetScroll);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  const goToSlide = (idx) => {
    activeIndexRef.current = idx;
    setActiveIndex(idx);
    if (sectionRef.current) {
      const rect = sectionRef.current.getBoundingClientRect();
      targetScrollYRef.current = window.pageYOffset + rect.top;
      window.scrollTo({ top: targetScrollYRef.current, behavior: 'smooth' });
      isFrozenRef.current = true;
      setIsFrozen(true);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) goToSlide(activeIndex - 1);
  };

  const handleNext = () => {
    if (activeIndex < SCENE_ITEMS.length - 1) goToSlide(activeIndex + 1);
  };

  const currentItem = SCENE_ITEMS[activeIndex];

  // Semicircle geometry docked flush to the left window edge:
  // Compact precision scale: cx = 0, cy = 210, radius = 120
  const cx = 0;
  const cy = 210;
  const radius = 120;

  // The wheel physically rolls/rotates by -90° on each scroll step:
  const wheelRotation = -activeIndex * 90;

  return (
    <section id="scenarios" ref={sectionRef} className="scenarios-section">
      {/* Dynamic Water Bubble Particle Emitter */}
      <BubbleOverlay intensity={1.6} />

      {/* Background Matrix Watermark */}
      <div className="orbital-bg-watermark">
        <div className="watermark-row">PRALAYA AI · DIGITAL TWIN · HYDRODYNAMICS</div>
        <div className="watermark-row secondary">SAINT-VENANT 2D · SPH PARTICLES · DELFT3D</div>
      </div>

      {/* Top Header Bar — Perfectly Centered in Viewport */}
      <div className="orbital-top-header">
        <div className="orbital-header-center">
          <SectionLabel
            directive="DIRECTIVE 05 & 08"
            label="SCENE 05 // DYNAMIC PHYSICS & EVACUATION"
            variant="amber"
          />
          <h1 className="orbital-main-title">
            Predictive physics. <em>What-if scenarios & smart evacuation.</em>
          </h1>
        </div>
      </div>

      {/* Main Split Row: Semicircle Docked to Window Border on Left, Info Centered in Middle */}
      <div className="orbital-main-row">
        {/* ========================================================================= */}
        {/* LEFT WINDOW BORDER: DOCKED SEMICIRCLE DIAL (ONLY SEMICIRCLE VISIBLE)      */}
        {/* ========================================================================= */}
        <div className="orbit-left-col">
          {/* SVG Rotating Semicircle & Turbine Mechanics (Zero Angle Numbers) */}
          <svg className="orbit-track-svg" width="160" height="420" viewBox="0 0 160 420">
            <defs>
              <linearGradient id="semicircleGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3fa89b" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#81e6d9" stopOpacity="0.3" />
              </linearGradient>
              <radialGradient id="centerHubGrad" cx="0%" cy="50%" r="100%">
                <stop offset="0%" stopColor="rgba(24, 52, 46, 0.98)" />
                <stop offset="85%" stopColor="rgba(8, 18, 16, 0.98)" />
                <stop offset="100%" stopColor="rgba(63, 168, 155, 0.5)" />
              </radialGradient>
            </defs>

            {/* Outer faint calibration arc boundary flush to window */}
            <path
              d={`M ${cx} ${cy - radius - 18} A ${radius + 18} ${radius + 18} 0 0 1 ${cx} ${cy + radius + 18}`}
              fill="none"
              stroke="rgba(63, 168, 155, 0.14)"
              strokeWidth="1"
              strokeDasharray="4 5"
            />

            {/* ROTATING WHEEL GROUP: Physically rolls by -90° on each scroll step */}
            <g
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                transformOrigin: `${cx}px ${cy}px`,
                transition: 'transform 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Mechanical Gear Teeth along perimeter (all 360° so rotation is seamless) */}
              {Array.from({ length: 36 }).map((_, i) => {
                const deg = i * 10;
                const rad = (deg * Math.PI) / 180;
                const rInner = radius + 6;
                const rOuter = radius + 12;
                const isCardinal = deg % 90 === 0;
                return (
                  <line
                    key={`tooth-${deg}`}
                    x1={cx + rInner * Math.cos(rad)}
                    y1={cy + rInner * Math.sin(rad)}
                    x2={cx + rOuter * Math.cos(rad)}
                    y2={cy + rOuter * Math.sin(rad)}
                    stroke={isCardinal ? '#5eead4' : 'rgba(63, 168, 155, 0.4)'}
                    strokeWidth={isCardinal ? '2.2' : '1.1'}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* Main circular perimeter track */}
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke="rgba(63, 168, 155, 0.5)"
                strokeWidth="1.8"
              />

              {/* Inner concentric particle orbit */}
              <circle
                cx={cx}
                cy={cy}
                r={radius - 24}
                fill="none"
                stroke="rgba(94, 234, 212, 0.2)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* 4 Structural Spokes connecting Hub to the 4 Stations */}
              <line x1={cx + 32} y1={cy} x2={cx + radius} y2={cy} stroke="#5eead4" strokeWidth="2" />
              <line x1={cx} y1={cy + 32} x2={cx} y2={cy + radius} stroke="#3fa89b" strokeWidth="2" />
              <line x1={cx - 32} y1={cy} x2={cx - radius} y2={cy} stroke="rgba(63, 168, 155, 0.3)" strokeWidth="1.5" />
              <line x1={cx} y1={cy - 32} x2={cx} y2={cy - radius} stroke="#3fa89b" strokeWidth="2" />

              {/* 4 Station Anchor Rings */}
              <circle cx={cx + radius} cy={cy} r="7" fill="rgba(10, 24, 21, 0.95)" stroke="#5eead4" strokeWidth="1.8" />
              <circle cx={cx} cy={cy + radius} r="7" fill="rgba(10, 24, 21, 0.95)" stroke="#3fa89b" strokeWidth="1.4" />
              <circle cx={cx - radius} cy={cy} r="7" fill="rgba(10, 24, 21, 0.95)" stroke="rgba(63, 168, 155, 0.3)" strokeWidth="1" />
              <circle cx={cx} cy={cy - radius} r="7" fill="rgba(10, 24, 21, 0.95)" stroke="#3fa89b" strokeWidth="1.4" />
            </g>

            {/* STATIONARY DOCKED CENTER TELEMETRY HUB FLUSH TO WINDOW */}
            <path
              d={`M ${cx} ${cy - 34} A 34 34 0 0 1 ${cx} ${cy + 34} Z`}
              fill="url(#centerHubGrad)"
              stroke="#5eead4"
              strokeWidth="2"
              style={{ filter: 'drop-shadow(0 0 12px rgba(94, 234, 212, 0.4))' }}
            />
            <path
              d={`M ${cx} ${cy - 25} A 25 25 0 0 1 ${cx} ${cy + 25}`}
              fill="none"
              stroke="rgba(94, 234, 212, 0.35)"
              strokeDasharray="2.5 2.5"
            />
            <text
              x={cx + 14}
              y={cy - 9}
              textAnchor="middle"
              fill="#5eead4"
              fontSize="6.5"
              fontWeight="800"
              letterSpacing="0.1em"
              fontFamily="var(--font-mono)"
            >
              MODULE
            </text>
            <text
              x={cx + 14}
              y={cy + 5}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="13"
              fontWeight="900"
              fontFamily="var(--font-mono)"
            >
              0{activeIndex + 1}
            </text>
            <text
              x={cx + 14}
              y={cy + 16}
              textAnchor="middle"
              fill="#81e6d9"
              fontSize="6.5"
              fontWeight="700"
              letterSpacing="0.08em"
              fontFamily="var(--font-mono)"
            >
              / 04
            </text>

            {/* Stationary Aiming Pointer on Right of Semicircle Apex pointing to Active Badge */}
            <path
              d={`M ${cx + radius + 3} ${cy - 7} L ${cx + radius + 11} ${cy} L ${cx + radius + 3} ${cy + 7}`}
              fill="none"
              stroke="#5eead4"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 5px #5eead4)' }}
            />
          </svg>

          {/* STATIONS MOUNTED ON THE SEMICIRCLE */}
          {/* ONLY the active module at the horizontal apex shows its full topic name! */}
          {/* Inactive nodes show only clean icon discs without topic names or angle numbers! */}
          <div className="dial-nodes-layer">
            {SCENE_ITEMS.map((item, idx) => {
              const isActive = idx === activeIndex;
              const NodeIcon = item.icon;

              // Relative step distance from current activeIndex (-1: Top, 0: Apex, +1: Bottom, others: Hidden)
              const diff = idx - activeIndex;

              let nodeLeft = 0;
              let nodeTop = cy;
              let isVisible = false;

              if (diff === 0) {
                // ACTIVE: EXACTLY AT HORIZONTAL APEX (Level, pointing directly to center info)
                nodeLeft = radius + 16;
                nodeTop = cy;
                isVisible = true;
              } else if (diff === 1 || diff === -3) {
                // NEXT MODULE: AT BOTTOM OF SEMICIRCLE
                nodeLeft = 8;
                nodeTop = cy + radius - 8;
                isVisible = true;
              } else if (diff === -1 || diff === 3) {
                // PREVIOUS MODULE: AT TOP OF SEMICIRCLE
                nodeLeft = 8;
                nodeTop = cy - radius + 8;
                isVisible = true;
              } else {
                // OPPOSITE / OFF-SCREEN REAR
                nodeLeft = -100;
                nodeTop = cy;
                isVisible = false;
              }

              return (
                <div
                  key={item.id}
                  className={`dial-station-wrapper ${isActive ? 'is-active-apex' : 'is-inactive-node'}`}
                  style={{
                    left: `${nodeLeft}px`,
                    top: `${nodeTop}px`,
                    opacity: isVisible ? 1 : 0,
                    pointerEvents: isVisible ? 'auto' : 'none',
                    transition: 'all 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <button
                    type="button"
                    className={`dial-node-btn ${isActive ? 'is-active' : ''}`}
                    onClick={() => goToSlide(idx)}
                    title={item.pillLabel}
                  >
                    {isActive ? (
                      /* ACTIVE MODULE: HORIZONTALLY LEVEL COMPACT PILL SHOWING TOPIC NAME AT APEX */
                      <div className="semicircle-active-pill">
                        <div className="active-pill-icon-box">
                          <NodeIcon size={14} color="#81e6d9" />
                        </div>
                        <div className="active-pill-text-col">
                          <span className="active-pill-idx">0{idx + 1}</span>
                          <span className="active-pill-title">{item.pillLabel}</span>
                        </div>
                        <span className="active-pill-glow-dot" />
                      </div>
                    ) : (
                      /* INACTIVE MODULE: MINIMAL ICON DISC (NO TOPIC NAME, ZERO ANGLE NUMBERS!) */
                      <div className="semicircle-node-disc">
                        <div className="node-disc-icon">
                          <NodeIcon size={12} color="#81e6d9" />
                        </div>
                        <span className="node-disc-idx">0{idx + 1}</span>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* CENTER COLUMN: PROMINENT CENTERED INFORMATION CARD       */}
        {/* ======================================================== */}
        <div className="orbital-content-wrapper">
          <div key={currentItem.id} className="orbital-content-card fade-in">
            {/* Category & Title Header */}
            <div className="orbital-card-header">
              <div className="header-meta-row">
                <span className="category-pill">{currentItem.category}</span>
                <span className="status-live-pill">LIVE COMPUTATION</span>
              </div>
              <h3 className="card-headline">{currentItem.title}</h3>
              <p className="card-sub-desc">{currentItem.desc}</p>
            </div>

            {/* MODULE 01: INTERACTIVE WHAT-IF SCENARIOS */}
            {activeIndex === 0 && (
              <div className="whatif-module-view">
                <div className="whatif-grid-layout">
                  {/* Controls Panel */}
                  <div className="whatif-controls-panel">
                    <div className="panel-badge-row">
                      <span className="panel-badge">HYDRAULIC SANDBOX PARAMETERS</span>
                      <span className="panel-status">LIVE RECALCULATION</span>
                    </div>

                    {/* Slider 1: Reservoir Level */}
                    <div className="control-slider-group">
                      <div className="slider-header">
                        <span className="slider-name">Reservoir Storage Level</span>
                        <span className="slider-val-badge">{reservoirLevel}% Capacity</span>
                      </div>
                      <input
                        type="range"
                        min="80"
                        max="135"
                        step="1"
                        value={reservoirLevel}
                        onChange={(e) => setReservoirLevel(Number(e.target.value))}
                        className="pralaya-range-slider"
                      />
                      <div className="slider-ticks">
                        <span>80% (Conservation)</span>
                        <span>100% (Full Crest)</span>
                        <span>135% (Extreme Surcharge)</span>
                      </div>
                    </div>

                    {/* Slider 2: Breach Width */}
                    <div className="control-slider-group">
                      <div className="slider-header">
                        <span className="slider-name">Breach Width (W_b)</span>
                        <span className="slider-val-badge">{breachWidth} meters</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="260"
                        step="5"
                        value={breachWidth}
                        onChange={(e) => setBreachWidth(Number(e.target.value))}
                        className="pralaya-range-slider"
                      />
                      <div className="slider-ticks">
                        <span>50m (Partial Slump)</span>
                        <span>180m (Machhu-II 1979)</span>
                        <span>260m (Flank Collapse)</span>
                      </div>
                    </div>

                    {/* Slider 3: Inflow Multiplier */}
                    <div className="control-slider-group">
                      <div className="slider-header">
                        <span className="slider-name">Monsoon Cloudburst Multiplier</span>
                        <span className="slider-val-badge">{inflowMultiplier}x Inflow</span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="3.5"
                        step="0.1"
                        value={inflowMultiplier}
                        onChange={(e) => setInflowMultiplier(Number(e.target.value))}
                        className="pralaya-range-slider"
                      />
                      <div className="slider-ticks">
                        <span>1.0x (100-Yr Flood)</span>
                        <span>2.18x (August 1979 Storm)</span>
                        <span>3.5x (Probable Max PMF)</span>
                      </div>
                    </div>

                    {/* Failure Mode Selector */}
                    <div className="mode-toggle-group">
                      <span className="mode-label">Failure Initiation Mode:</span>
                      <div className="mode-btn-row">
                        {['overtopping', 'piping', 'sliding'].map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={`mode-pill-btn ${failureMode === mode ? 'active' : ''}`}
                            onClick={() => setFailureMode(mode)}
                          >
                            {mode === 'overtopping' && 'Overtopping Wave'}
                            {mode === 'piping' && 'Internal Piping'}
                            {mode === 'sliding' && 'Foundation Sliding'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Live Results Panel */}
                  <div className="whatif-results-panel">
                    <div className="results-header-row">
                      <span className="results-badge">DYNAMIC MODEL PREDICTION</span>
                      <span className="solver-tag">2D FVM SOLVER SYNCED</span>
                    </div>

                    <div className="live-metrics-grid">
                      <div className="live-metric-card highlight-cyan">
                        <span className="m-label">PEAK OUTFLOW DISCHARGE (Q_peak)</span>
                        <div className="m-val-row">
                          <span className="m-number">{calculatedPeakQ.toLocaleString()}</span>
                          <span className="m-unit">m³/s</span>
                        </div>
                        <span className="m-sub">
                          {(calculatedPeakQ / 14850).toFixed(2)}x design spillway capacity
                        </span>
                      </div>

                      <div className="live-metric-card highlight-amber">
                        <span className="m-label">FIRST ARRIVAL AT MORBI (18 KM)</span>
                        <div className="m-val-row">
                          <span className="m-number">{formatHours(calculatedArrivalTimeMin)}</span>
                          <span className="m-unit">elapsed</span>
                        </div>
                        <span className="m-sub">
                          Evacuation action window available before primary crest arrival
                        </span>
                      </div>

                      <div className="live-metric-card">
                        <span className="m-label">DOWNSTREAM INUNDATION FOOTPRINT</span>
                        <div className="m-val-row">
                          <span className="m-number">{calculatedAreaKm2}</span>
                          <span className="m-unit">km²</span>
                        </div>
                        <span className="m-sub">Total valley area experiencing water depth &gt; 0.5m</span>
                      </div>

                      <div className="live-metric-card">
                        <span className="m-label">MAX WAVE HEIGHT AT CITY CENTER</span>
                        <div className="m-val-row">
                          <span className="m-number">
                            {(8.4 + (reservoirLevel - 100) * 0.12 + (breachWidth - 100) * 0.02).toFixed(1)}
                          </span>
                            <span className="m-unit">meters</span>
                        </div>
                        <span className="m-sub">Overtopping municipal flood barriers by +4.2m</span>
                      </div>
                    </div>

                    {/* Hydrograph Mini Preview */}
                    <div className="hydrograph-mini-preview">
                      <div className="h-preview-header">
                        <span>DYNAMIC BREACH OUTFLOW CURVE [HYDROGRAPH]</span>
                        <span className="h-peak-point">
                          Peak @ T+{formatHours(Math.round(calculatedArrivalTimeMin * 0.7))}
                        </span>
                      </div>
                      <div className="h-curve-visual">
                        <svg viewBox="0 0 400 120" className="hydrograph-svg">
                          <defs>
                            <linearGradient id="qGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#3fa89b" stopOpacity="0.5" />
                              <stop offset="100%" stopColor="#3fa89b" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          <path
                            d={`M 20,105 Q 120,${105 - (calculatedPeakQ / 24000) * 90} 180,${110 - (calculatedPeakQ / 20000) * 95} T 380,105 L 380,110 L 20,110 Z`}
                            fill="url(#qGrad)"
                          />
                          <path
                            d={`M 20,105 Q 120,${105 - (calculatedPeakQ / 24000) * 90} 180,${110 - (calculatedPeakQ / 20000) * 95} T 380,105`}
                            fill="none"
                            stroke="#81e6d9"
                            strokeWidth="3"
                          />
                          <circle
                            cx="180"
                            cy={110 - (calculatedPeakQ / 20000) * 95}
                            r="5"
                            fill="#fde047"
                            stroke="#0a1110"
                            strokeWidth="2"
                          />
                        </svg>
                      </div>
                      <div className="h-curve-footer">
                        <span>T=0h Breach Initiation</span>
                        <span>T=3h Peak Wave</span>
                        <span>T=8h Receding Flow</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODULE 02: DELFT3D VS SPH SOLVERS */}
            {activeIndex === 1 && (
              <div className="delft-sph-module-view">
                <div className="comparison-cards-grid">
                  {/* Delft3D Card */}
                  <div className="model-compare-card">
                    <div className="card-top-tag eulerian">EULERIAN CONTINUUM SOLVER</div>
                    <h3 className="model-name">Delft3D / 2D Shallow Water Equations</h3>
                    <div className="model-role">Macroscopic Regional Basin Routing (10 km — 150 km)</div>
                    <p className="model-summary">
                      Solves the depth-averaged Saint-Venant shallow water equations across a fixed 2D grid.
                      Optimized for extensive regional topography, valley friction dissipation, and continuous
                      inundation mapping.
                    </p>

                    <div className="model-specs-table">
                      <div className="spec-row">
                        <span className="spec-label">Computational Grid</span>
                        <span className="spec-value">Structured / Flexible Mesh (25m cells)</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Governing Equations</span>
                        <span className="spec-value">2D Depth-Averaged Navier-Stokes (SWE)</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Primary Output</span>
                        <span className="spec-value">depth_max.tif, velocity_max.tif Rasters</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Computation Time</span>
                        <span className="spec-value">2.4 mins for 24h basin simulation</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Best Suited For</span>
                        <span className="spec-value">Downstream city evacuation timelines & area extent</span>
                      </div>
                    </div>

                    <div className="model-badge-footer">
                      <span className="check-tag">✓ Macro Watershed Routing</span>
                      <span className="check-tag">✓ GIS GeoTIFF Compatibility</span>
                    </div>
                  </div>

                  {/* SPH Card */}
                  <div className="model-compare-card">
                    <div className="card-top-tag lagrangian">LAGRANGIAN PARTICLE SOLVER</div>
                    <h3 className="model-name">SPH (Smoothed Particle Hydrodynamics)</h3>
                    <div className="model-role">Microscopic Near-Field Dam Collapse (0 m — 2 km)</div>
                    <p className="model-summary">
                      Meshless Lagrangian computational fluid dynamics treating water as millions of discrete interacting particles.
                      Captures violent turbulent wave overtopping, fluid impact pressure on concrete piers, and structural cavitation.
                    </p>

                    <div className="model-specs-table">
                      <div className="spec-row">
                        <span className="spec-label">Computational Grid</span>
                        <span className="spec-value">Meshless Discrete Particle Domain (5M+ pts)</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Governing Equations</span>
                        <span className="spec-value">Particle Navier-Stokes with Kernel Density</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Primary Output</span>
                        <span className="spec-value">Point Clouds, Impact Forces (kN/m²), 3D Spray</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Computation Time</span>
                        <span className="spec-value">4.2 hours on multi-GPU compute node</span>
                      </div>
                      <div className="spec-row">
                        <span className="spec-label">Best Suited For</span>
                        <span className="spec-value">Near-crest hydraulic jump & structural failure forces</span>
                      </div>
                    </div>

                    <div className="model-badge-footer">
                      <span className="check-tag">✓ 3D Turbulence & Pier Impact</span>
                      <span className="check-tag">✓ High-Fidelity Twin Visuals</span>
                    </div>
                  </div>
                </div>

                {/* Hybrid Coupling Banner */}
                <div className="hybrid-synergy-banner">
                  <span className="synergy-badge">PRALAYA DUAL-SOLVER COUPLING</span>
                  <h4>How PRALAYA Bridges Both Solvers Seamlessly</h4>
                  <p>
                    PRALAYA leverages <strong>SPH particle hydrodynamics</strong> at the localized dam axis (0-2 km)
                    to calculate exact dynamic breach enlargement and violent outflow discharge, then transfers the resulting
                    hydrograph into the <strong>Delft3D/FVM shallow water solver</strong> to route the flood wave across 80+ km
                    of downstream digital elevation terrain in real-time.
                  </p>
                </div>
              </div>
            )}

            {/* MODULE 03: ACTUAL VS SIMULATED GROUND TRUTH */}
            {activeIndex === 2 && (
              <div className="actual-sim-module-view">
                <div className="actual-sim-container">
                  <div className="actual-sim-header">
                    <div>
                      <span className="panel-badge">EMPIRICAL BENCHMARK GROUND TRUTH</span>
                      <h4 style={{ fontSize: '20px', color: '#fff', marginTop: '4px' }}>
                        1979 Machhu-II Disaster: Actual Survey Records vs PRALAYA Simulation
                      </h4>
                    </div>
                    <span className="f1-badge">F1-SCORE: 0.91 · CSI: 0.88</span>
                  </div>

                  <div className="actual-sim-metrics-row">
                    <div className="sim-metric-card">
                      <span className="sim-lbl">HISTORICAL REPORTED FLOOD AREA</span>
                      <span className="sim-val">65.2 km²</span>
                      <span className="sim-sub">Government of Gujarat Commission Records (1980)</span>
                    </div>
                    <div className="sim-metric-card">
                      <span className="sim-lbl">PRALAYA SIMULATED FLOOD AREA</span>
                      <span className="sim-val highlight-cyan">68.4 km²</span>
                      <span className="sim-sub">Coupled 30m DEM + 2D Saint-Venant Solver</span>
                    </div>
                    <div className="sim-metric-card">
                      <span className="sim-lbl">SPATIAL OVERLAP CONCORDANCE</span>
                      <span className="sim-val highlight-green">92.4%</span>
                      <span className="sim-sub">Verified via Sentinel-1 SAR & historical contours</span>
                    </div>
                    <div className="sim-metric-card">
                      <span className="sim-lbl">ARRIVAL TIME VARIANCE</span>
                      <span className="sim-val highlight-amber">-12 mins</span>
                      <span className="sim-sub">Historical record: 2h 55m | Simulated: 2h 45m</span>
                    </div>
                  </div>

                  {/* Station Calibration Table */}
                  <div className="station-table-wrapper">
                    <div className="table-title">DOWNSTREAM GAUGE STATION CALIBRATION (28 SITES)</div>
                    <table className="calibration-table">
                      <thead>
                        <tr>
                          <th>STATION ID</th>
                          <th>LOCATION</th>
                          <th>DISTANCE (KM)</th>
                          <th>RECORDED HIGH WATER (M)</th>
                          <th>SIMULATED DEPTH (M)</th>
                          <th>RESIDUAL ERROR (Δ)</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>G-01</td>
                          <td>Dam Toe (Spillway Stilling Basin)</td>
                          <td>0.5 km</td>
                          <td>16.8 m</td>
                          <td>16.5 m</td>
                          <td>-0.3 m</td>
                          <td><span className="tag-ok">PASS (98.2%)</span></td>
                        </tr>
                        <tr>
                          <td>G-04</td>
                          <td>Jiva Para Lowland Bridge</td>
                          <td>7.2 km</td>
                          <td>12.4 m</td>
                          <td>12.8 m</td>
                          <td>+0.4 m</td>
                          <td><span className="tag-ok">PASS (96.8%)</span></td>
                        </tr>
                        <tr>
                          <td>G-09</td>
                          <td>Morbi Mani Mandir Monument</td>
                          <td>17.8 km</td>
                          <td>8.6 m</td>
                          <td>8.9 m</td>
                          <td>+0.3 m</td>
                          <td><span className="tag-ok">PASS (96.5%)</span></td>
                        </tr>
                        <tr>
                          <td>G-14</td>
                          <td>Morbi Railway Suspension Bridge</td>
                          <td>18.4 km</td>
                          <td>9.2 m</td>
                          <td>8.8 m</td>
                          <td>-0.4 m</td>
                          <td><span className="tag-ok">PASS (95.7%)</span></td>
                        </tr>
                        <tr>
                          <td>G-22</td>
                          <td>Maliya Miyana Coastal Flats</td>
                          <td>42.0 km</td>
                          <td>3.8 m</td>
                          <td>3.5 m</td>
                          <td>-0.3 m</td>
                          <td><span className="tag-ok">PASS (92.1%)</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* MODULE 04: NEAREST EVACUATION CENTRES & SAFE ROUTING */}
            {activeIndex === 3 && (
              <div className="evacuation-module-view">
                <div className="evac-grid-layout">
                  {/* Left Column: Evacuation Rules */}
                  <div className="evac-info-card">
                    <div className="panel-badge-row">
                      <span className="panel-badge">DYNAMIC RESCUE ROUTING</span>
                      <span className="panel-status">GIS NETWORK ANALYSIS</span>
                    </div>

                    <h4 className="panel-title">How PRALAYA Dynamically Tracks Nearest Safe Zones</h4>
                    <p className="panel-desc">
                      Unlike traditional distance-only routing, PRALAYA continuously cross-references live flood wavefront
                      depths against road network digital elevation profiles to ensure civilian convoys are never directed
                      into submerging roads.
                    </p>

                    <div className="evac-rules-list">
                      <div className="evac-rule-item">
                        <div className="rule-badge">CRITERIA 01</div>
                        <div className="rule-content">
                          <strong>Topographic High-Ground Buffer (≥ +5m):</strong>
                          <p>
                            Evacuation centers are automatically qualified only if their elevation is at least 5 meters
                            higher than the local maximum Water Surface Elevation (WSEL_max).
                          </p>
                        </div>
                      </div>

                      <div className="evac-rule-item">
                        <div className="rule-badge">CRITERIA 02</div>
                        <div className="rule-content">
                          <strong>Road Traversability & Cut-Off Prevention:</strong>
                          <p>
                            If water depth on any connecting roadway segment exceeds 0.3m (vehicular washout limit),
                            that route is marked <code>SEVERED</code> in real-time and civilian routing dynamically switches
                            to elevated ridgelines.
                          </p>
                        </div>
                      </div>

                      <div className="evac-rule-item">
                        <div className="rule-badge">CRITERIA 03</div>
                        <div className="rule-content">
                          <strong>Dynamic Capacity Balancing:</strong>
                          <p>
                            As shelters reach their rated capacity, incoming village convoys are automatically sequenced
                            to secondary tier shelters before overcrowding can create bottleneck delays.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live Evacuation Shelter Matrix */}
                  <div className="evac-matrix-card">
                    <div className="matrix-header">
                      <span className="matrix-title">LIVE EVACUATION SHELTER MATRIX</span>
                      <span className="active-shelter-count">3 OF 4 SHELTERS ACTIVE</span>
                    </div>

                    <div className="shelters-list">
                      {/* Shelter 1 */}
                      <div className="shelter-item safe">
                        <div className="shelter-top">
                          <div className="shelter-name-row">
                            <span className="shelter-icon">
                              <SchoolIcon size={18} color="#86efac" />
                            </span>
                            <div>
                              <strong>Morbi East Higher Secondary School</strong>
                              <span className="shelter-coords">22.812°N, 70.854°E</span>
                            </div>
                          </div>
                          <span className="shelter-status-badge safe">SAFE (ACTIVE)</span>
                        </div>
                        <div className="shelter-stats-grid">
                          <div><span>DISTANCE:</span> <strong>2.1 km</strong></div>
                          <div><span>ELEVATION:</span> <strong>+18.4 m</strong> (Safe buffer)</div>
                          <div><span>CAPACITY:</span> <strong>4,500 people</strong></div>
                          <div><span>ROUTE:</span> <strong>Ridge Road (Unsubmerged)</strong></div>
                        </div>
                      </div>

                      {/* Shelter 2 */}
                      <div className="shelter-item safe">
                        <div className="shelter-top">
                          <div className="shelter-name-row">
                            <span className="shelter-icon">
                              <StadiumIcon size={18} color="#86efac" />
                            </span>
                            <div>
                              <strong>District Sports Stadium & Gymnasium</strong>
                              <span className="shelter-coords">22.825°N, 70.868°E</span>
                            </div>
                          </div>
                          <span className="shelter-status-badge safe">SAFE (ACTIVE)</span>
                        </div>
                        <div className="shelter-stats-grid">
                          <div><span>DISTANCE:</span> <strong>3.4 km</strong></div>
                          <div><span>ELEVATION:</span> <strong>+26.1 m</strong> (Safe buffer)</div>
                          <div><span>CAPACITY:</span> <strong>8,000 people</strong></div>
                          <div><span>ROUTE:</span> <strong>Highway 8A Bypass</strong></div>
                        </div>
                      </div>

                      {/* Shelter 3 */}
                      <div className="shelter-item safe">
                        <div className="shelter-top">
                          <div className="shelter-name-row">
                            <span className="shelter-icon">
                              <MonumentIcon size={18} color="#86efac" />
                            </span>
                            <div>
                              <strong>Navlakhi Hill Community Center</strong>
                              <span className="shelter-coords">22.839°N, 70.880°E</span>
                            </div>
                          </div>
                          <span className="shelter-status-badge safe">SAFE (ACTIVE)</span>
                        </div>
                        <div className="shelter-stats-grid">
                          <div><span>DISTANCE:</span> <strong>4.8 km</strong></div>
                          <div><span>ELEVATION:</span> <strong>+32.0 m</strong> (Plateau peak)</div>
                          <div><span>CAPACITY:</span> <strong>5,500 people</strong></div>
                          <div><span>ROUTE:</span> <strong>Plateau Arterial Corridor</strong></div>
                        </div>
                      </div>

                      {/* Shelter 4 - Inundated Alert */}
                      <div className="shelter-item danger">
                        <div className="shelter-top">
                          <div className="shelter-name-row">
                            <span className="shelter-icon">
                              <AlertIcon size={18} color="#ef4444" />
                            </span>
                            <div>
                              <strong>Riverbank Community Hall (Lowland)</strong>
                              <span className="shelter-coords">22.818°N, 70.838°E</span>
                            </div>
                          </div>
                          <span className="shelter-status-badge danger">INUNDATION RISK (CUT OFF)</span>
                        </div>
                        <div className="shelter-stats-grid">
                          <div><span>DISTANCE:</span> <strong>1.2 km</strong></div>
                          <div><span>PREDICTED DEPTH:</span> <strong style={{ color: '#ef4444' }}>3.2 m at T+1h 15m</strong></div>
                          <div><span>ACTION:</span> <strong style={{ color: '#ef4444' }}>DE-LISTED FROM ROUTING</strong></div>
                          <div><span>REROUTED TO:</span> <strong>Morbi East School (+0.9 km)</strong></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar: Step Counter (01 / 04), Dots, & Prev/Next Actions */}
      <div className="orbital-bottom-bar">
        <div className="orbital-step-counter">
          <span className="step-current">{currentItem.idxStr}</span>
          <span className="step-sep">/</span>
          <span className="step-total">04</span>
        </div>

        <div className="orbital-dots">
          {SCENE_ITEMS.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`orbital-dot-btn ${i === activeIndex ? 'active' : ''}`}
              onClick={() => goToSlide(i)}
              aria-label={`Jump to ${item.pillLabel}`}
            >
              <span className="dot-inner" />
            </button>
          ))}
        </div>

        <div className="orbital-nav-actions">
          <button
            type="button"
            className="orbital-nav-btn"
            onClick={handlePrev}
            disabled={activeIndex === 0}
            title="Previous Module"
          >
            <span>↑ PREV</span>
          </button>
          <button
            type="button"
            className="orbital-nav-btn primary"
            onClick={handleNext}
            disabled={activeIndex === SCENE_ITEMS.length - 1}
            title="Next Module"
          >
            <span>NEXT ↓</span>
          </button>
          <span className="orbital-scroll-hint">
            {activeIndex === 3
              ? 'SCROLL DOWN AGAIN TO ADVANCE TO SCENE 06 ↓'
              : `SCROLL DOWN TO ROLL UP (STEP 0${activeIndex + 1}/04)`}
          </span>
        </div>
      </div>
    </section>
  );
}
