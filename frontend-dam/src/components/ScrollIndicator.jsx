import React from 'react';

/**
 * HUD-style scroll telemetry indicator with animated pulse
 */
export default function ScrollIndicator({ progress = 0, style = {} }) {
  const percentage = Math.round(progress * 100);

  return (
    <div
      className="scroll-indicator-hud"
      style={{
        position: 'absolute',
        bottom: '36px',
        right: 'var(--container-gutter, 48px)',
        zIndex: 'var(--z-hud-overlay, 20)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '6px',
        userSelect: 'none',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.14em',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ color: 'var(--accent-moss-light)', fontWeight: 600 }}>
          {percentage.toString().padStart(2, '0')}%
        </span>
        <span style={{ opacity: 0.4 }}>|</span>
        <span>SCROLL TO EXPLORE</span>
        <span
          className="scroll-bounce-arrow"
          style={{
            display: 'inline-block',
            color: 'var(--text-bright)',
            fontSize: '13px',
          }}
        >
          ↓
        </span>
      </div>

      <div
        style={{
          width: '120px',
          height: '2px',
          background: 'rgba(167, 182, 169, 0.15)',
          borderRadius: '1px',
          overflow: 'hidden',
          marginTop: '2px',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.max(percentage, 8)}%`,
            background: 'linear-gradient(90deg, var(--accent-moss-light), var(--text-bright))',
            transition: 'width 0.1s linear',
          }}
        />
      </div>
    </div>
  );
}
