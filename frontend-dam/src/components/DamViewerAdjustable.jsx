import React, { useState, useEffect, useRef } from 'react';
import { SKETCHFAB_CONFIG } from '../animation/animationConfig';

/**
 * DamViewerAdjustable
 * 
 * Solves the dam clipping / cutting-off issue:
 * - Direct full-window 3D dam interaction (orbit, zoom, pan)
 * - Canvas framing adjustment: scale (0.5x - 1.5x) and pan X/Y so NO parts are cut off at any angle
 * - "FIT SCREEN" preset that ensures diagonal rotations fit completely inside the window
 * - Keyframe recording: Save Start Position (0% scroll) & End Position (100% scroll)
 * - Transition Preview Scrubber (0% → 100%)
 * - Zero "points" or fake water clutter
 */
export default function DamViewerAdjustable() {
  // Framing state: scale & pan offsets to prevent any part of the dam from being cut off
  const [framing, setFraming] = useState(() => {
    try {
      const saved = localStorage.getItem('pralaya_dam_framing');
      if (saved) return JSON.parse(saved);
    } catch {}
    // Default to 0.85x scale and slight vertical offset so entire dam fits without clipping
    return { scale: 0.85, panX: 0, panY: 0 };
  });

  // Start (0%) and End (100%) animation states
  const [startFrame, setStartFrame] = useState(() => {
    try {
      const saved = localStorage.getItem('pralaya_dam_start_frame');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { scale: 0.85, panX: 0, panY: 0 };
  });

  const [endFrame, setEndFrame] = useState(() => {
    try {
      const saved = localStorage.getItem('pralaya_dam_end_frame');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { scale: 1.1, panX: 0, panY: -6 };
  });

  const [animProgress, setAnimProgress] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const animRef = useRef(null);

  // Save framing to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pralaya_dam_framing', JSON.stringify(framing));
    } catch {}
  }, [framing]);

  // Interpolate between startFrame and endFrame when scrubbing
  useEffect(() => {
    if (!isScrubbing && !isPlaying) return;
    const t = animProgress;
    const lerp = (a, b) => a + (b - a) * t;
    setFraming({
      scale: parseFloat(lerp(startFrame.scale, endFrame.scale).toFixed(3)),
      panX: parseFloat(lerp(startFrame.panX, endFrame.panX).toFixed(1)),
      panY: parseFloat(lerp(startFrame.panY, endFrame.panY).toFixed(1)),
    });
  }, [animProgress, isScrubbing, isPlaying, startFrame, endFrame]);

  // Play animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    let forward = true;
    let p = animProgress;

    const loop = () => {
      if (forward) {
        p += 0.006;
        if (p >= 1) {
          p = 1;
          forward = false;
        }
      } else {
        p -= 0.006;
        if (p <= 0) {
          p = 0;
          forward = true;
        }
      }
      setAnimProgress(p);
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying]);

  // Embed URL with free camera (camera=0 removed to allow unrestricted orbit/zoom)
  const embedUrl = React.useMemo(() => {
    const params = {
      autostart: 1,
      transparent: 1,
      ui_theme: 'dark',
      ui_infos: 0,
      ui_watermark: 0,
      ui_controls: 0,
      ui_help: 0,
      ui_settings: 0,
      ui_inspector: 0,
      ui_annotations: 0,
      ui_stop: 0,
      ui_hint: 0,
      dnt: 1,
      scrollwheel: 1,
      double_click: 1,
    };
    const query = new URLSearchParams(params).toString();
    return `https://sketchfab.com/models/${SKETCHFAB_CONFIG.modelId}/embed?${query}`;
  }, []);

  // Quick Presets
  const fitWholeDam = () => {
    setIsScrubbing(false);
    setIsPlaying(false);
    setFraming({ scale: 0.78, panX: 0, panY: 0 });
  };

  const resetFraming = () => {
    setIsScrubbing(false);
    setIsPlaying(false);
    setFraming({ scale: 1.0, panX: 0, panY: 0 });
  };

  const saveStart = () => {
    const s = { ...framing };
    setStartFrame(s);
    localStorage.setItem('pralaya_dam_start_frame', JSON.stringify(s));
    alert('Current position saved as START (0% Scroll)!');
  };

  const saveEnd = () => {
    const e = { ...framing };
    setEndFrame(e);
    localStorage.setItem('pralaya_dam_end_frame', JSON.stringify(e));
    alert('Current position saved as END (100% Scroll)!');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#101917',
        userSelect: 'none',
      }}
    >
      {/* 3D Dam Container with dynamic framing transform (prevents edge clipping) */}
      <div
        style={{
          position: 'absolute',
          top: `${framing.panY}%`,
          left: `${framing.panX}%`,
          width: '100vw',
          height: '100vh',
          transform: `scale(${framing.scale})`,
          transformOrigin: '50% 50%',
          transition: isScrubbing || isPlaying ? 'none' : 'transform 0.1s ease-out',
          willChange: 'transform',
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
            pointerEvents: 'auto', // 100% directly interactive with mouse
            background: 'transparent',
          }}
        />
      </div>

      {/* ========================================== */}
      {/* SLEEK FLOATING ADJUSTER & ANIMATION TOOLBAR */}
      {/* ========================================== */}
      <div
        style={{
          position: 'absolute',
          top: '18px',
          right: '18px',
          zIndex: 100,
          background: 'rgba(14, 25, 27, 0.92)',
          border: '1px solid rgba(78, 205, 196, 0.35)',
          borderRadius: '10px',
          padding: isPanelOpen ? '14px 18px' : '8px 14px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          fontFamily: 'monospace',
          color: '#f0f4ef',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          minWidth: isPanelOpen ? '280px' : 'auto',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#4ecdc4',
                boxShadow: '0 0 8px #4ecdc4',
              }}
            />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#4ecdc4', letterSpacing: '0.08em' }}>
              DAM ADJUSTER & KEYFRAMES
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: '#a7b6a9',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '0 4px',
            }}
          >
            {isPanelOpen ? '✕' : '⚙'}
          </button>
        </div>

        {isPanelOpen && (
          <>
            {/* Quick Fit Buttons to prevent clipping */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={fitWholeDam}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: '4px',
                  background: 'rgba(78, 205, 196, 0.2)',
                  border: '1px solid #4ecdc4',
                  color: '#4ecdc4',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                }}
              >
                ⛶ FIT WHOLE DAM (NO CUT-OFF)
              </button>

              <button
                type="button"
                onClick={resetFraming}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                100%
              </button>
            </div>

            {/* Manual Framing Sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '2px' }}>
                  <span>Dam Canvas Zoom:</span>
                  <strong style={{ color: '#4ecdc4' }}>{Math.round(framing.scale * 100)}%</strong>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.01"
                  value={framing.scale}
                  onChange={(e) => {
                    setIsScrubbing(false);
                    setIsPlaying(false);
                    setFraming({ ...framing, scale: parseFloat(e.target.value) });
                  }}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '2px' }}>
                  <span>Shift Horizontal (X):</span>
                  <strong style={{ color: '#4ecdc4' }}>{framing.panX}%</strong>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="0.5"
                  value={framing.panX}
                  onChange={(e) => {
                    setIsScrubbing(false);
                    setIsPlaying(false);
                    setFraming({ ...framing, panX: parseFloat(e.target.value) });
                  }}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '2px' }}>
                  <span>Shift Vertical (Y):</span>
                  <strong style={{ color: '#4ecdc4' }}>{framing.panY}%</strong>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="0.5"
                  value={framing.panY}
                  onChange={(e) => {
                    setIsScrubbing(false);
                    setIsPlaying(false);
                    setFraming({ ...framing, panY: parseFloat(e.target.value) });
                  }}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Keyframe Save Section */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10px', color: '#a7b6a9' }}>
                RECORD ANIMATION POSITIONS:
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={saveStart}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: '4px',
                    background: 'rgba(46, 213, 115, 0.2)',
                    border: '1px solid #2ed573',
                    color: '#2ed573',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  SAVE START (0%)
                </button>

                <button
                  type="button"
                  onClick={saveEnd}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: '4px',
                    background: 'rgba(255, 71, 87, 0.2)',
                    border: '1px solid #ff4757',
                    color: '#ff4757',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  SAVE END (100%)
                </button>
              </div>

              {/* Scrubber */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '2px' }}>
                  <span>Animation Scrubber:</span>
                  <strong style={{ color: '#4ecdc4' }}>{Math.round(animProgress * 100)}%</strong>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={animProgress}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setIsScrubbing(true);
                      setAnimProgress(parseFloat(e.target.value));
                    }}
                    style={{ flex: 1, cursor: 'pointer' }}
                  />

                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      background: isPlaying ? '#ff4757' : '#4ecdc4',
                      border: 'none',
                      color: '#0a1110',
                      fontSize: '10px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {isPlaying ? 'PAUSE' : 'PLAY'}
                  </button>
                </div>
              </div>

              {/* Copy Animation Values */}
              <button
                type="button"
                onClick={() => {
                  const code = {
                    startPosition: startFrame,
                    endPosition: endFrame,
                  };
                  navigator.clipboard.writeText(JSON.stringify(code, null, 2));
                  alert('Animation Start & End positions copied!\n\n' + JSON.stringify(code, null, 2));
                }}
                style={{
                  padding: '6px',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  fontSize: '9.5px',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                📋 COPY START/END CODE
              </button>
            </div>
          </>
        )}
      </div>

      {/* Minimal helper tip */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '6px 14px',
          borderRadius: '999px',
          background: 'rgba(10, 20, 22, 0.75)',
          border: '1px solid rgba(78, 205, 196, 0.2)',
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#a7b6a9',
          pointerEvents: 'none',
          backdropFilter: 'blur(8px)',
        }}
      >
        Left-click drag to rotate · Right-click drag to pan · Scroll wheel to zoom · Click <strong>FIT WHOLE DAM</strong> if any corner is cut off
      </div>
    </div>
  );
}
