import React, { useState, useRef, useEffect } from 'react';

/**
 * WaterPathConnector — Minimalist Dot Connector & Animation Recorder
 * 
 * - Lets you freely zoom, pan, and orbit the 3D dam yourself
 * - Lets you drop small, sleek dots and connects them with a glowing water line
 * - Lets you drag dots around to fit the dam's channel exactly
 * - Lets you save a Start Position and an End Position
 * - Lets you scrub or animate between them
 * - Exports exact coordinate data to clipboard
 */
export default function WaterPathConnector({ children }) {
  // Interaction mode: 'orbit' (interact with 3D model) or 'draw' (place/move dots)
  const [mode, setMode] = useState('orbit'); // Default to 3D orbit so user can zoom/position dam themselves!

  // Active dots on screen: [{ id, x, y }] (in % of viewport)
  const [dots, setDots] = useState(() => {
    try {
      const saved = localStorage.getItem('pralaya_water_dots');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 1, x: 48.5, y: 12.0 },
      { id: 2, x: 48.6, y: 32.5 },
      { id: 3, x: 48.4, y: 47.0 },
      { id: 4, x: 38.0, y: 64.0 },
      { id: 5, x: 48.5, y: 64.0 },
      { id: 6, x: 42.0, y: 76.0 },
    ];
  });

  // Recorded Start & End Positions
  const [startDots, setStartDots] = useState(null);
  const [endDots, setEndDots] = useState(null);
  const [animProgress, setAnimProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [draggingId, setDraggingId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const containerRef = useRef(null);
  const animFrameRef = useRef(null);

  // Save dots to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pralaya_water_dots', JSON.stringify(dots));
    } catch {}
  }, [dots]);

  // Click container to place a new small dot (only in 'draw' mode)
  const handleContainerClick = (e) => {
    if (mode !== 'draw') return;
    if (e.target.closest('.water-dot') || e.target.closest('.path-toolbar')) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

    const newDot = { id: Date.now(), x, y };
    setDots([...dots, newDot]);
  };

  // Dragging a dot
  const handlePointerMove = (e) => {
    if (!draggingId || mode !== 'draw') return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = parseFloat(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)).toFixed(2));
    const y = parseFloat(Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)).toFixed(2));

    setDots((prev) => prev.map((d) => (d.id === draggingId ? { ...d, x, y } : d)));
  };

  const handlePointerUp = () => {
    setDraggingId(null);
  };

  // Delete dot (e.g. right click)
  const handleDeleteDot = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDots(dots.filter((d) => d.id !== id));
  };

  // Record Start Position
  const handleSaveStart = () => {
    setStartDots(JSON.parse(JSON.stringify(dots)));
    alert(`Saved ${dots.length} points as START POSITION!`);
  };

  // Record End Position
  const handleSaveEnd = () => {
    setEndDots(JSON.parse(JSON.stringify(dots)));
    alert(`Saved ${dots.length} points as END POSITION!`);
  };

  // Animation interpolation between startDots and endDots
  useEffect(() => {
    if (!startDots || !endDots) return;
    if (startDots.length !== endDots.length) return;

    const t = animProgress;
    const interpolated = startDots.map((sDot, idx) => {
      const eDot = endDots[idx];
      return {
        id: sDot.id,
        x: parseFloat((sDot.x + (eDot.x - sDot.x) * t).toFixed(2)),
        y: parseFloat((sDot.y + (eDot.y - sDot.y) * t).toFixed(2)),
      };
    });
    setDots(interpolated);
  }, [animProgress, startDots, endDots]);

  // Play / Loop animation
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    let forward = true;
    let p = animProgress;

    const loop = () => {
      if (forward) {
        p += 0.008;
        if (p >= 1) {
          p = 1;
          forward = false;
        }
      } else {
        p -= 0.008;
        if (p <= 0) {
          p = 0;
          forward = true;
        }
      }
      setAnimProgress(p);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying]);

  // Copy coordinates JSON to clipboard
  const handleCopyCode = () => {
    const payload = {
      currentPoints: dots,
      startPosition: startDots,
      endPosition: endDots,
    };
    const json = JSON.stringify(payload, null, 2);
    navigator.clipboard.writeText(json);
    alert('Point coordinates copied to clipboard!\n\n' + json);
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* 3D Dam Model Container (Free interaction when mode is 'orbit') */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: mode === 'orbit' ? 'auto' : 'none',
        }}
      >
        {children}
      </div>

      {/* SVG Connecting Line between Small Dots */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 15,
        }}
      >
        <defs>
          <linearGradient id="waterFlowLine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4ecdc4" />
            <stop offset="50%" stopColor="#2ee0c4" />
            <stop offset="100%" stopColor="#00b4d8" />
          </linearGradient>
          <filter id="subtleGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer soft flow ribbon */}
        {dots.length >= 2 && (
          <path
            d={dots.map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${d.x}% ${d.y}%`).join(' ')}
            fill="none"
            stroke="rgba(78, 205, 196, 0.22)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Crisp connected flow line */}
        {dots.length >= 2 && (
          <path
            d={dots.map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${d.x}% ${d.y}%`).join(' ')}
            fill="none"
            stroke="url(#waterFlowLine)"
            strokeWidth="2.5"
            strokeDasharray="6, 4"
            filter="url(#subtleGlow)"
            style={{ animation: 'flowDash 1.2s linear infinite' }}
          />
        )}
      </svg>

      {/* Small Connected Dots */}
      {dots.map((dot, idx) => {
        const isHovered = hoveredId === dot.id;
        const isDragging = draggingId === dot.id;

        return (
          <div
            key={dot.id}
            className="water-dot"
            onPointerDown={(e) => {
              if (mode !== 'draw') return;
              e.stopPropagation();
              setDraggingId(dot.id);
            }}
            onMouseEnter={() => setHoveredId(dot.id)}
            onMouseLeave={() => setHoveredId(null)}
            onContextMenu={(e) => handleDeleteDot(dot.id, e)}
            style={{
              position: 'absolute',
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 25,
              cursor: mode === 'draw' ? (isDragging ? 'grabbing' : 'grab') : 'default',
              pointerEvents: mode === 'draw' ? 'auto' : 'none',
            }}
          >
            {/* Small minimalist glowing dot */}
            <div
              style={{
                width: isHovered || isDragging ? '12px' : '8px',
                height: isHovered || isDragging ? '12px' : '8px',
                borderRadius: '50%',
                backgroundColor: idx === 0 ? '#2ed573' : idx === dots.length - 1 ? '#00b4d8' : '#4ecdc4',
                border: '1.5px solid #ffffff',
                boxShadow: `0 0 10px ${idx === 0 ? '#2ed573' : '#4ecdc4'}`,
                transition: 'width 0.15s ease, height 0.15s ease',
              }}
            />

            {/* Subtle index tooltip on hover */}
            {isHovered && (
              <div
                style={{
                  position: 'absolute',
                  top: '-22px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  background: 'rgba(10, 20, 22, 0.9)',
                  border: '1px solid #4ecdc4',
                  fontFamily: 'monospace',
                  fontSize: '9px',
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                Dot #{idx + 1} ({dot.x}%, {dot.y}%) · Right-click to remove
              </div>
            )}
          </div>
        );
      })}

      {/* ========================================== */}
      {/* SLEEK MINIMAL FLOATING CONTROLLER BAR */}
      {/* ========================================== */}
      <div
        className="path-toolbar"
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 16px',
          borderRadius: '999px',
          background: 'rgba(12, 22, 24, 0.88)',
          border: '1px solid rgba(78, 205, 196, 0.35)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#f0f4ef',
        }}
      >
        {/* Mode Toggle Button: 3D Orbit vs Draw Dots */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '999px', padding: '2px' }}>
          <button
            type="button"
            onClick={() => setMode('orbit')}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: mode === 'orbit' ? '#4ecdc4' : 'transparent',
              color: mode === 'orbit' ? '#081719' : '#a7b6a9',
              fontWeight: 700,
              fontSize: '10.5px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            🕹 3D DAM (ZOOM & ORBIT)
          </button>

          <button
            type="button"
            onClick={() => setMode('draw')}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: mode === 'draw' ? '#2ed573' : 'transparent',
              color: mode === 'draw' ? '#081719' : '#a7b6a9',
              fontWeight: 700,
              fontSize: '10.5px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            ✏ CONNECT WATER DOTS ({dots.length})
          </button>
        </div>

        <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>

        {/* Dot Controls */}
        <button
          type="button"
          onClick={() => setDots(dots.slice(0, -1))}
          disabled={dots.length === 0}
          style={{
            background: 'none',
            border: 'none',
            color: dots.length > 0 ? '#fff' : 'rgba(255,255,255,0.2)',
            cursor: dots.length > 0 ? 'pointer' : 'default',
            fontSize: '10.5px',
            padding: '4px 6px',
          }}
          title="Undo last dot"
        >
          UNDO
        </button>

        <button
          type="button"
          onClick={() => {
            if (window.confirm('Clear all dots?')) setDots([]);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#ff4757',
            cursor: 'pointer',
            fontSize: '10.5px',
            padding: '4px 6px',
          }}
          title="Clear all dots"
        >
          CLEAR
        </button>

        <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>

        {/* Start / End Position Recording */}
        <button
          type="button"
          onClick={handleSaveStart}
          style={{
            background: startDots ? 'rgba(78, 205, 196, 0.25)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${startDots ? '#4ecdc4' : 'rgba(255,255,255,0.2)'}`,
            color: startDots ? '#4ecdc4' : '#fff',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '10px',
            cursor: 'pointer',
          }}
        >
          {startDots ? '✓ START SAVED' : 'SAVE START'}
        </button>

        <button
          type="button"
          onClick={handleSaveEnd}
          style={{
            background: endDots ? 'rgba(0, 180, 216, 0.25)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${endDots ? '#00b4d8' : 'rgba(255,255,255,0.2)'}`,
            color: endDots ? '#00b4d8' : '#fff',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '10px',
            cursor: 'pointer',
          }}
        >
          {endDots ? '✓ END SAVED' : 'SAVE END'}
        </button>

        {/* Animation Scrubber (active if both Start and End exist) */}
        {startDots && endDots && (
          <>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={animProgress}
              onChange={(e) => {
                setIsPlaying(false);
                setAnimProgress(parseFloat(e.target.value));
              }}
              style={{ width: '80px', cursor: 'pointer' }}
              title="Scrub between Start and End positions"
            />
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                background: isPlaying ? '#ff4757' : '#2ed573',
                border: 'none',
                color: '#081719',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isPlaying ? 'PAUSE' : 'PLAY'}
            </button>
          </>
        )}

        <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>

        {/* Copy Coordinates Code */}
        <button
          type="button"
          onClick={handleCopyCode}
          style={{
            background: 'linear-gradient(135deg, #4ecdc4, #2ee0c4)',
            border: 'none',
            color: '#081719',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '10px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          📋 COPY POINTS
        </button>
      </div>

      {/* Floating tip helper */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '6px 14px',
          borderRadius: '999px',
          background: 'rgba(10, 20, 22, 0.8)',
          border: '1px solid rgba(78, 205, 196, 0.2)',
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#a7b6a9',
          pointerEvents: 'none',
          backdropFilter: 'blur(8px)',
        }}
      >
        {mode === 'orbit' ? (
          <span>🖱 <strong>3D DAM MODE</strong>: Drag to orbit, right-click to pan, scroll wheel to zoom in/out! Switch to <strong>CONNECT WATER DOTS</strong> when ready.</span>
        ) : (
          <span>✏ <strong>DOTS MODE</strong>: Click on dam to place small dots · Drag dots to adjust · Right-click dot to delete</span>
        )}
      </div>

      <style>{`
        @keyframes flowDash {
          to {
            stroke-dashoffset: -20;
          }
        }
      `}</style>
    </div>
  );
}
