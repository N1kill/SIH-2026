import React, { useState, useRef } from 'react';
import SectionLabel from '../../components/SectionLabel';
import { HISTORICAL_CASES } from '../../data/historicalCases';
import { CalendarIcon, LocationIcon, BuildingIcon, AlertIcon } from '../../components/Icons';
import './breach.css';

/**
 * Scene 02 — Historical Dam Breaches & High-Impact Flood Case Studies
 * 
 * Features an interactive horizontal slideshow / left-scroll carousel
 * highlighting 4 major dam breach disasters and 2 high-impact regional flood events.
 */
export default function BreachSection() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTabByCard, setActiveTabByCard] = useState({});
  const [openDropdowns, setOpenDropdowns] = useState({});
  const carouselRef = useRef(null);

  // Filter cases based on active category
  const filteredCases = HISTORICAL_CASES.filter((item) => {
    if (activeCategory === 'all') return true;
    return item.category === activeCategory;
  });

  // Track horizontal scroll position to update active index
  const handleScroll = () => {
    if (!carouselRef.current) return;
    const { scrollLeft, clientWidth } = carouselRef.current;
    if (clientWidth === 0) return;
    const index = Math.round(scrollLeft / (clientWidth * 0.85 + 24));
    const clamped = Math.max(0, Math.min(index, filteredCases.length - 1));
    setActiveIndex(clamped);
  };

  // Scroll to a specific card index
  const scrollToIndex = (index) => {
    if (!carouselRef.current) return;
    const cards = carouselRef.current.querySelectorAll('.case-slide-card');
    if (cards[index]) {
      cards[index].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
      setActiveIndex(index);
    }
  };

  // Next / Previous navigation
  const handlePrev = () => {
    const nextIdx = Math.max(0, activeIndex - 1);
    scrollToIndex(nextIdx);
  };

  const handleNext = () => {
    const nextIdx = Math.min(filteredCases.length - 1, activeIndex + 1);
    scrollToIndex(nextIdx);
  };

  // Reset index when category changes
  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setActiveIndex(0);
    if (carouselRef.current) {
      carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  // Toggle active tab within an individual card
  const getActiveTab = (cardId) => activeTabByCard[cardId] || 'overview';
  const setCardTab = (cardId, tabKey) => {
    setActiveTabByCard((prev) => ({ ...prev, [cardId]: tabKey }));
  };

  // Toggle dropdown expansion for a specific card
  const toggleDropdown = (cardId) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  return (
    <section id="breach" className="breach-section">
      <div className="breach-glow-ambient" />

      <div className="container">
        {/* Section Header */}
        <div className="breach-header">
          <SectionLabel
            directive="SCENE 02 // HISTORICAL PRECEDENTS"
            label="WHY PRALAYA IS BUILT // DAM BREACH BENCHMARKS"
            variant="clay"
          />

          <h2 className="breach-heading">
            Why is <em>PRALAYA built.</em>
          </h2>

          <p className="lede">
            India manages over 6,000 large dams. Yet catastrophic failures — from Machhu-II to Teesta-III — 
            demonstrate that flood surges arrive in minutes, long before manual emergency response can mobilize. 
            PRALAYA is engineered to transform historical failure physics into instantaneous, coordinate-driven digital twins.
          </p>
        </div>

        {/* Carousel Filter & Controls Toolbar */}
        <div className="cases-toolbar">
          {/* Category Filter Pills */}
          <div className="category-filters">
            <button
              type="button"
              className={`filter-btn ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('all')}
            >
              ALL CASES ({HISTORICAL_CASES.length})
            </button>
            <button
              type="button"
              className={`filter-btn ${activeCategory === 'dam-breach' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('dam-breach')}
            >
              DAM BREACHES (4)
            </button>
            <button
              type="button"
              className={`filter-btn ${activeCategory === 'flood-event' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('flood-event')}
            >
              HIGH-IMPACT FLOOD EVENTS (2)
            </button>
          </div>

          {/* Carousel Arrow Navigation & Counter */}
          <div className="carousel-nav-controls">
            <div className="case-counter">
              <span className="current-num">0{activeIndex + 1}</span>
              <span className="sep">/</span>
              <span className="total-num">0{filteredCases.length}</span>
              <span className="active-name-preview">
                · {filteredCases[activeIndex]?.name || ''}
              </span>
            </div>

            <div className="nav-arrow-btns">
              <button
                type="button"
                className="arrow-btn"
                onClick={handlePrev}
                disabled={activeIndex === 0}
                title="Previous case study"
              >
                ←
              </button>
              <button
                type="button"
                className="arrow-btn"
                onClick={handleNext}
                disabled={activeIndex === filteredCases.length - 1}
                title="Next case study"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Slideshow Carousel Container */}
        <div
          ref={carouselRef}
          className="cases-slideshow-track"
          onScroll={handleScroll}
        >
          {filteredCases.map((item, idx) => {
            const currentTab = getActiveTab(item.id);
            const isDamBreach = item.category === 'dam-breach';
            const isExpanded = !!openDropdowns[item.id];

            return (
              <article
                key={item.id}
                className={`case-slide-card ${idx === activeIndex ? 'is-active' : ''}`}
              >
                {/* 1. Media Showcase Banner */}
                <div className="card-media-banner">
                  <img
                    src={item.image}
                    alt={`${item.name} disaster aftermath photograph`}
                    className="case-cover-image"
                    loading="lazy"
                  />
                  <div className="media-gradient-overlay" />

                  {/* Top-Left Category Badge */}
                  <div className="media-top-left">
                    <span className={`event-type-badge ${isDamBreach ? 'breach' : 'flood'}`}>
                      <span className="pulse-dot" />
                      {item.categoryLabel}
                    </span>
                    <span className="event-tag-badge">{item.tag}</span>
                  </div>

                  {/* Top-Right Event Date */}
                  <div className="media-top-right">
                    <span className="date-badge">
                      <CalendarIcon size={12} color="currentColor" /> {item.date}
                    </span>
                  </div>

                  {/* Bottom Location & Specs Strip */}
                  <div className="media-bottom-strip">
                    <div className="loc-info">
                      <span className="loc-pin">
                        <LocationIcon size={13} color="var(--accent-cyan)" />
                      </span>
                      <span className="loc-text">{item.location}</span>
                      <span className="coord-chip">{item.coordinates}</span>
                    </div>
                    <div className="dam-spec-badge">
                      <span>{item.damType}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Card Content Body */}
                <div className="card-body">
                  {/* Title & River Basin */}
                  <div className="card-title-row">
                    <div>
                      <h3 className="card-title">{item.name}</h3>
                      <p className="card-subtitle">{item.subtitle}</p>
                    </div>
                    <div className="river-badge">
                      <span>RIVER BASIN</span>
                      <strong>{item.river}</strong>
                    </div>
                  </div>

                  {/* Key Metrics / Telemetry Strip */}
                  <div className="card-kpi-grid">
                    {item.stats.map((stat, sIdx) => (
                      <div
                        key={sIdx}
                        className={`kpi-cell ${stat.alert ? 'kpi-danger' : ''}`}
                      >
                        <div className="kpi-label">{stat.label}</div>
                        <div className="kpi-val">{stat.value}</div>
                        {stat.sub && <div className="kpi-sub">{stat.sub}</div>}
                      </div>
                    ))}
                  </div>

                  {/* Dropdown Toggle: Collapsible Incident Data */}
                  <div className="incident-dropdown-wrap">
                    <button
                      type="button"
                      className={`incident-dropdown-btn ${isExpanded ? 'active' : ''}`}
                      onClick={() => toggleDropdown(item.id)}
                    >
                      <span className="dropdown-btn-left">
                        <span className="dropdown-caret">{isExpanded ? '▾' : '▸'}</span>
                        <span className="dropdown-btn-title">INCIDENT DATA & FORENSIC BREAKDOWN</span>
                        <span className="dropdown-hint">(Timeline · Impact · Failure Mode)</span>
                      </span>
                      <span className="dropdown-status-chip">
                        {isExpanded ? 'Hide Data ▲' : 'Open Dropdown ▼'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="incident-dropdown-content">
                        {/* Tab Selector Inside Dropdown */}
                        <div className="dropdown-tabs">
                          <button
                            type="button"
                            className={`dropdown-tab ${currentTab === 'overview' ? 'active' : ''}`}
                            onClick={() => setCardTab(item.id, 'overview')}
                          >
                            WHAT HAPPENED
                          </button>
                          <button
                            type="button"
                            className={`dropdown-tab ${currentTab === 'impact' ? 'active' : ''}`}
                            onClick={() => setCardTab(item.id, 'impact')}
                          >
                            HUMAN & INFRA IMPACT
                          </button>
                          <button
                            type="button"
                            className={`dropdown-tab ${currentTab === 'cause' ? 'active' : ''}`}
                            onClick={() => setCardTab(item.id, 'cause')}
                          >
                            ROOT CAUSE
                          </button>
                        </div>

                        {/* Content Pane */}
                        <div className="dropdown-pane">
                          {currentTab === 'overview' && (
                            <div className="tab-pane-content">
                              <div className="content-lead-icon">🌊</div>
                              <div>
                                <h4>Event Timeline & Hydrodynamics</h4>
                                <p>{item.whatHappened}</p>
                              </div>
                            </div>
                          )}

                          {currentTab === 'impact' && (
                            <div className="tab-pane-content">
                              <div className="impact-grid-inner">
                                <div className="impact-box">
                                  <div className="impact-title">HUMAN CASUALTIES & DISPLACEMENT</div>
                                  <p>{item.humanImpact}</p>
                                </div>
                                <div className="impact-box">
                                  <div className="impact-title">INFRASTRUCTURE & ECONOMIC LOSS</div>
                                  <p>{item.infraImpact}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {currentTab === 'cause' && (
                            <div className="tab-pane-content">
                              <div className="cause-box">
                                <div className="cause-header">
                                  <AlertIcon size={16} color="var(--accent-amber)" />
                                  <h4>Primary Failure Mechanism</h4>
                                </div>
                                <p className="cause-desc">{item.cause}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Carousel Pagination Dots */}
        <div className="carousel-dots-wrapper">
          {filteredCases.map((_, dIdx) => (
            <button
              key={dIdx}
              type="button"
              className={`carousel-dot ${dIdx === activeIndex ? 'active' : ''}`}
              onClick={() => scrollToIndex(dIdx)}
              title={`Jump to slide ${dIdx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
