import React, { useState, useEffect } from 'react';
import CTAButton from './CTAButton';
import { NAV_PAGES, SYSTEM_META } from '../data/navigation';

/**
 * Floating glassmorphic HUD navigation bar for PRALAYA
 * Supports multi-page view switching (Home, Simulate, About, Contact Us, Docs)
 * Zero emojis, 100% clean SVG icons.
 */
export default function Navbar({ currentPage = 'home', onNavigate }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e, pageId) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(pageId);
    }
    if (pageId === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 99999,
        transition: 'all 0.3s ease',
        padding: scrolled ? '12px 0' : '18px 0',
        background: scrolled
          ? 'rgba(10, 18, 17, 0.94)'
          : 'rgba(10, 18, 17, 0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(78, 205, 196, 0.22)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65)',
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left: Brand & Coordinates */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <button
            type="button"
            onClick={(e) => handleNavClick(e, 'home')}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              textDecoration: 'none',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '22px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--text-bright)',
              }}
            >
              PRALAYA
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9.5px',
                letterSpacing: '0.16em',
                color: 'var(--accent-moss-light)',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              DIGITAL TWIN
            </span>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 10px',
              borderRadius: '4px',
              background: 'rgba(22, 34, 32, 0.6)',
              border: '1px solid rgba(167, 182, 169, 0.1)',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
            }}
            className="navbar-coords"
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#5d8a67',
                boxShadow: '0 0 8px #5d8a67',
                display: 'inline-block',
              }}
            />
            <span>{SYSTEM_META.coordinates}</span>
          </div>
        </div>

        {/* Center: Navigation Pages (Home, Simulate, About, Contact Us, Docs) */}
        <nav
          className="navbar-nav-links"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          {NAV_PAGES.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={(e) => handleNavClick(e, item.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '0.08em',
                  color: isActive ? '#81e6d9' : 'var(--text-secondary)',
                  borderBottom: isActive ? '2px solid #3fa89b' : '2px solid transparent',
                  padding: '4px 2px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'var(--text-bright)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Simulation Launch CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <CTAButton
            size="sm"
            variant="primary"
            onClick={() => {
              if (onNavigate) onNavigate('simulate');
            }}
          >
            SIMULATE
          </CTAButton>
        </div>
      </div>
    </header>
  );
}
