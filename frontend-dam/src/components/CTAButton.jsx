import React, { useState } from 'react';

/**
 * Premium CTA button with luminous border, glass backdrop, and tactile hover
 */
export default function CTAButton({
  children,
  onClick,
  variant = 'primary',
  icon = null,
  href = null,
  className = '',
  size = 'md',
}) {
  const [isHovered, setIsHovered] = useState(false);

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    fontFamily: 'var(--font-mono)',
    fontSize: size === 'sm' ? '11px' : '12.5px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: size === 'sm' ? '8px 16px' : '12px 24px',
    borderRadius: '6px',
    transition: 'all 0.25s var(--ease-smooth)',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    textDecoration: 'none',
  };

  const variants = {
    primary: {
      background: isHovered
        ? 'linear-gradient(135deg, #3e5c45 0%, #4d7557 100%)'
        : 'linear-gradient(135deg, rgba(62, 92, 69, 0.85) 0%, rgba(45, 68, 51, 0.85) 100%)',
      color: '#ffffff',
      border: '1px solid rgba(140, 180, 150, 0.4)',
      boxShadow: isHovered
        ? '0 0 20px rgba(93, 138, 103, 0.45), 0 4px 16px rgba(0, 0, 0, 0.5)'
        : '0 2px 8px rgba(0, 0, 0, 0.3)',
      transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
    },
    ghost: {
      background: isHovered ? 'rgba(167, 182, 169, 0.12)' : 'rgba(22, 34, 32, 0.4)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-subtle)',
      backdropFilter: 'blur(10px)',
      boxShadow: isHovered ? '0 4px 12px rgba(0, 0, 0, 0.3)' : 'none',
      transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
    },
    alert: {
      background: isHovered
        ? 'linear-gradient(135deg, #b84c3e 0%, #943428 100%)'
        : 'linear-gradient(135deg, rgba(184, 76, 62, 0.85) 0%, rgba(138, 48, 38, 0.85) 100%)',
      color: '#ffffff',
      border: '1px solid rgba(220, 100, 85, 0.5)',
      boxShadow: isHovered
        ? '0 0 24px rgba(184, 76, 62, 0.5), 0 4px 16px rgba(0, 0, 0, 0.5)'
        : '0 2px 8px rgba(0, 0, 0, 0.3)',
      transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
    },
  };

  const computedStyle = {
    ...baseStyle,
    ...(variants[variant] || variants.primary),
  };

  if (href) {
    return (
      <a
        href={href}
        style={computedStyle}
        className={className}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}
        {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={computedStyle}
      className={className}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
    </button>
  );
}
