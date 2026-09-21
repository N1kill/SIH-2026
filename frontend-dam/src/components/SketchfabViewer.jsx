import React, { useState, useRef, useMemo } from 'react';
import { SKETCHFAB_CONFIG, getDamWrapperStyle } from '../animation/animationConfig';
import { useMediaQuery } from '../hooks/useMediaQuery';

/**
 * High-fidelity, zero-chrome Sketchfab Dam 3D Viewer.
 * Blends into the atmospheric background using edge feathering masks.
 * Dynamic transforms are driven by normalized scroll progress and centralized animation config.
 */
export default function SketchfabViewer({ progress = 0 }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isInteractive, setIsInteractive] = useState(false);
  const wrapperRef = useRef(null);

  // Compute transform styles from centralized config
  const wrapperDynamicStyle = useMemo(() => {
    return getDamWrapperStyle(progress, isMobile);
  }, [progress, isMobile]);

  const embedUrl = useMemo(() => {
    return SKETCHFAB_CONFIG.getEmbedUrl();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="sketchfab-dam-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        transformOrigin: '50% 50%',
        zIndex: 'var(--z-dam-scene, 1)',
        pointerEvents: 'auto',
        overflow: 'hidden',
        ...wrapperDynamicStyle,
      }}
    >
      {/* 3D Model Iframe expanded to full window dimensions */}
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <iframe
          title="Machhu-II Dam 3D Model"
          src={embedUrl}
          frameBorder="0"
          allow="autoplay; fullscreen; xr-spatial-tracking"
          allowFullScreen
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            pointerEvents: 'auto',
            background: 'transparent',
          }}
        />
      </div>
    </div>
  );
}
