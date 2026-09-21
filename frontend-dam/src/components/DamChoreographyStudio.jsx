import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * DamChoreographyStudio — Interactive Director Tool
 * 
 * Empowers you to:
 * 1. Manually adjust Dam Zoom, Position X/Y, Tilt & Rotation
 * 2. Set Start (0%) & End (100%) Keyframes and preview smooth transition with a scrubber
 * 3. Point-and-Click Waypoint Tool: Click anywhere on the dam to drop pins
 * 4. Drag pins, connect them with a luminous flow path, and record/export coordinates
 * 5. Toggle between 3D Dam Orbit and Point Mapping
 */
export default function DamChoreographyStudio({ children, onTransformChange }) {
  // Mode: 'points' | 'orbit' | 'keyframes'
  const [activeTab, setActiveTab] = useState('transform');
  const [isPlacingPoints, setIsPlacingPoints] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  // Dam Transform State (Current)
  const [transform, setTransform] = useState({
    scale: 1.0,
    posX: 0,
    posY: 0,
    rotY: 0,
    rotX: 0,
  });

  // Keyframe A (Start) & Keyframe B (End)
  const [keyframeA, setKeyframeA] = useState({
    scale: 1.0,
    posX: 0,
    posY: 0,
    rotY: 0,
    rotX: 0,
  });

  const [keyframeB, setKeyframeB] = useState({
    scale: 1.25,
    posX: 0,
    posY: -8,
    rotY: 2,
    rotX: 3,
  });

  // Scrubber progress [0, 1]
  const [scrubberProgress, setScrubberProgress] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Water Waypoints: Array of { id, x, y, label } (in % of viewport)
  const [points, setPoints] = useState(() => {
    try {
      const saved = localStorage.getItem('pralaya_dam_waypoints');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 1, x: 48.5, y: 11.5, label: 'Radial Gates (Start)' },
      { id: 2, x: 48.6, y: 32.0, label: 'Chute Mid' },
      { id: 3, x: 48.4, y: 46.5, label: 'Hydraulic Jump' },
      { id: 4, x: 38.0, y: 64.0, label: 'Basin Left' },
      { id: 5, x: 48.5, y: 64.0, label: 'Basin Right' },
      { id: 6, x: 42.0, y: 76.0, label: 'Weir Overflow (End)' },
    ];
  });

  const [selectedPointId, setSelectedPointId] = useState(null);
  const [draggingPointId, setDraggingPointId] = useState(null);
  const [channelWidth, setChannelWidth] = useState(5.0); // in %

  const containerRef = useRef(null);

  // Save points to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pralaya_dam_waypoints', JSON.stringify(points));
    } catch {}
  }, [points]);

  // Interpolate transform when scrubbing keyframes
  useEffect(() => {
    if (!isScrubbing) return;
    const t = scrubberProgress;
    const lerp = (a, b) => a + (b - a) * t;
    setTransform({
      scale: lerp(keyframeA.scale, keyframeB.scale),
      posX: lerp(keyframeA.posX, keyframeB.posX),
      posY: lerp(keyframeA.posY, keyframeB.posY),
      rotY: lerp(keyframeA.rotY, keyframeB.rotY),
      rotX: lerp(keyframeA.rotX, keyframeB.rotX),
    });
  }, [scrubberProgress, isScrubbing, keyframeA, keyframeB]);

  // Notify parent of transform changes
  useEffect(() => {
    if (onTransformChange) {
      onTransformChange(transform);
    }
  }, [transform, onTransformChange]);

  // Click container to place new point
  const handleContainerClick = (e) => {
    if (!isPlacingPoints || draggingPointId) return;
    // If clicked on an existing point button, don't create a new one
    if (e.target.closest('.waypoint-pin') || e.target.closest('.studio-controls-panel')) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newPoint = {
      id: Date.now(),
      x: parseFloat(x.toFixed(2)),
      y: parseFloat(y.toFixed(2)),
      label: `Point ${points.length + 1}`,
    };

    setPoints([...points, newPoint]);
    setSelectedPointId(newPoint.id);
  };

  // Dragging a point pin
  const handlePointerMove = (e) => {
    if (!draggingPointId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    setPoints((prev) =>
      prev.map((p) => (p.id === draggingPointId ? { ...p, x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) } : p))
    );
  };

  const handlePointerUp = () => {
    setDraggingPointId(null);
  };

  // Delete selected point
  const deletePoint = (id) => {
    setPoints(points.filter((p) => p.id !== id));
    if (selectedPointId === id) setSelectedPointId(null);
  };

  // Clear all points
  const clearAllPoints = () => {
    if (window.confirm('Clear all points?')) {
      setPoints([]);
      setSelectedPointId(null);
    }
  };

  // Export points as JSON
  const copyPointsJSON = () => {
    const json = JSON.stringify(points, null, 2);
    navigator.clipboard.writeText(json);
    alert('Points copied to clipboard as JSON!\n\n' + json);
  };

  // Save current transform to Keyframe A or B
  const saveToKeyframeA = () => {
    setKeyframeA({ ...transform });
    alert('Current dam position saved as START KEYFRAME (0% Scroll)!');
  };

  const saveToKeyframeB = () => {
    setKeyframeB({ ...transform });
    alert('Current dam position saved as END KEYFRAME (100% Scroll)!');
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
        cursor: isPlacingPoints ? 'crosshair' : 'default',
        userSelect: 'none',
      }}
    >
      {/* 3D Dam Container receiving manual transform */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          transformOrigin: '50% 50%',
          transform: `translate3d(${transform.posX}%, ${transform.posY}%, 0) scale(${transform.scale}) rotateY(${transform.rotY}deg) rotateX(${transform.rotX}deg)`,
          transition: isScrubbing ? 'none' : 'transform 0.1s ease-out',
          willChange: 'transform',
          pointerEvents: isPlacingPoints ? 'none' : 'auto',
        }}
      >
        {children}
      </div>

      {/* SVG Connecting Spline between Points */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        <defs>
          <linearGradient id="pathGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4ecdc4" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#2ee0c4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#00b4d8" stopOpacity="0.9" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer water flow ribbon boundary */}
        {points.length >= 2 && (
          <path
            d={points
              .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x}% ${p.y}%`)
              .join(' ')}
            fill="none"
            stroke="rgba(78, 205, 196, 0.25)"
            strokeWidth={`${channelWidth * 1.8}%`}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Central glowing water path */}
        {points.length >= 2 && (
          <path
            d={points
              .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x}% ${p.y}%`)
              .join(' ')}
            fill="none"
            stroke="url(#pathGradient)"
            strokeWidth="3.5"
            strokeDasharray="8, 6"
            filter="url(#glow)"
            style={{ animation: 'dashAnim 1.5s linear infinite' }}
          />
        )}
      </svg>

      {/* Interactive Waypoint Pins Overlay */}
      {points.map((p, idx) => {
        const isSelected = selectedPointId === p.id;
        return (
          <div
            key={p.id}
            className="waypoint-pin"
            onPointerDown={(e) => {
              e.stopPropagation();
              setDraggingPointId(p.id);
              setSelectedPointId(p.id);
            }}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 30,
              cursor: 'grab',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {/* Glowing circular pin head */}
            <div
              style={{
                width: isSelected ? '26px' : '20px',
                height: isSelected ? '26px' : '20px',
                borderRadius: '50%',
                background: isSelected ? '#ff4757' : idx === 0 ? '#2ed573' : '#4ecdc4',
                border: '2.5px solid #ffffff',
                boxShadow: `0 0 16px ${isSelected ? '#ff4757' : '#4ecdc4'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0a1110',
                fontFamily: 'monospace',
                fontSize: '11px',
                fontWeight: 800,
                transition: 'transform 0.15s ease',
              }}
            >
              {idx + 1}
            </div>

            {/* Coordinate Pill Label */}
            <div
              style={{
                marginTop: '4px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(10, 20, 22, 0.85)',
                border: '1px solid rgba(78, 205, 196, 0.4)',
                fontFamily: 'monospace',
                fontSize: '9.5px',
                color: '#ffffff',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}
            >
              {p.label || `P${idx + 1}`} ({p.x}%, {p.y}%)
            </div>
          </div>
        );
      })}

      {/* ========================================== */}
      {/* FLOATING CHOREOGRAPHY STUDIO CONTROL PANEL */}
      {/* ========================================== */}
      <div
        className="studio-controls-panel"
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 100,
          width: collapsed ? 'auto' : '360px',
          background: 'rgba(12, 22, 24, 0.92)',
          border: '1px solid rgba(78, 205, 196, 0.4)',
          borderRadius: '10px',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(20px)',
          fontFamily: 'monospace',
          color: '#f0f4ef',
          overflow: 'hidden',
          transition: 'width 0.2s ease',
        }}
      >
        {/* Panel Header */}
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(20, 38, 40, 0.95)',
            borderBottom: '1px solid rgba(78, 205, 196, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#4ecdc4',
                boxShadow: '0 0 10px #4ecdc4',
              }}
            />
            <span style={{ fontWeight: 700, fontSize: '12px', color: '#4ecdc4', letterSpacing: '0.08em' }}>
              DAM & WATER STUDIO
            </span>
          </div>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px',
              color: '#fff',
              padding: '2px 8px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {collapsed ? 'EXPAND ⚙' : 'MINIMIZE _'}
          </button>
        </div>

        {!collapsed && (
          <div style={{ padding: '16px' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('transform');
                  setIsPlacingPoints(false);
                }}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: '5px',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === 'transform' ? 'rgba(78, 205, 196, 0.3)' : 'rgba(255,255,255,0.05)',
                  border: activeTab === 'transform' ? '1px solid #4ecdc4' : '1px solid rgba(255,255,255,0.1)',
                  color: activeTab === 'transform' ? '#fff' : '#a7b6a9',
                }}
              >
                1. ZOOM & POS
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('points');
                  setIsPlacingPoints(true);
                }}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: '5px',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === 'points' ? 'rgba(78, 205, 196, 0.3)' : 'rgba(255,255,255,0.05)',
                  border: activeTab === 'points' ? '1px solid #4ecdc4' : '1px solid rgba(255,255,255,0.1)',
                  color: activeTab === 'points' ? '#fff' : '#a7b6a9',
                }}
              >
                2. WATER POINTS
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('keyframes');
                  setIsPlacingPoints(false);
                }}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: '5px',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === 'keyframes' ? 'rgba(78, 205, 196, 0.3)' : 'rgba(255,255,255,0.05)',
                  border: activeTab === 'keyframes' ? '1px solid #4ecdc4' : '1px solid rgba(255,255,255,0.1)',
                  color: activeTab === 'keyframes' ? '#fff' : '#a7b6a9',
                }}
              >
                3. ANIMATION
              </button>
            </div>

            {/* TAB 1: DAM ZOOM & POSITION CONTROLS */}
            {activeTab === 'transform' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                    <span>Dam Zoom / Scale:</span>
                    <strong style={{ color: '#4ecdc4' }}>{transform.scale.toFixed(2)}x</strong>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="2.5"
                    step="0.02"
                    value={transform.scale}
                    onChange={(e) => {
                      setIsScrubbing(false);
                      setTransform({ ...transform, scale: parseFloat(e.target.value) });
                    }}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                    <span>Position X (Horizontal):</span>
                    <strong style={{ color: '#4ecdc4' }}>{transform.posX.toFixed(1)}%</strong>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="0.5"
                    value={transform.posX}
                    onChange={(e) => {
                      setIsScrubbing(false);
                      setTransform({ ...transform, posX: parseFloat(e.target.value) });
                    }}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                    <span>Position Y (Vertical):</span>
                    <strong style={{ color: '#4ecdc4' }}>{transform.posY.toFixed(1)}%</strong>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="0.5"
                    value={transform.posY}
                    onChange={(e) => {
                      setIsScrubbing(false);
                      setTransform({ ...transform, posY: parseFloat(e.target.value) });
                    }}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                    <span>Rotation Y (Yaw / Tilt):</span>
                    <strong style={{ color: '#4ecdc4' }}>{transform.rotY.toFixed(1)}°</strong>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    step="0.5"
                    value={transform.rotY}
                    onChange={(e) => {
                      setIsScrubbing(false);
                      setTransform({ ...transform, rotY: parseFloat(e.target.value) });
                    }}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                    <span>Rotation X (Pitch):</span>
                    <strong style={{ color: '#4ecdc4' }}>{transform.rotX.toFixed(1)}°</strong>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    step="0.5"
                    value={transform.rotX}
                    onChange={(e) => {
                      setIsScrubbing(false);
                      setTransform({ ...transform, rotX: parseFloat(e.target.value) });
                    }}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsScrubbing(false);
                      setTransform({ scale: 1.0, posX: 0, posY: 0, rotY: 0, rotX: 0 });
                    }}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    RESET POSITION
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: WATER WAYPOINT CONNECTOR */}
            {activeTab === 'points' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: isPlacingPoints ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isPlacingPoints ? '#2ed573' : 'rgba(255,255,255,0.1)'}`,
                    fontSize: '10px',
                    lineHeight: '1.4',
                  }}
                >
                  {isPlacingPoints
                    ? '● CLICK ANYWHERE on the dam to drop a point! DRAG pins to position them.'
                    : '○ Point placement paused. Toggle button below to add points.'}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsPlacingPoints(!isPlacingPoints)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: '4px',
                      background: isPlacingPoints ? 'rgba(46, 213, 115, 0.25)' : 'rgba(255,255,255,0.08)',
                      border: isPlacingPoints ? '1px solid #2ed573' : '1px solid rgba(255,255,255,0.2)',
                      color: isPlacingPoints ? '#2ed573' : '#fff',
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {isPlacingPoints ? 'CLICK-TO-ADD: ON' : 'CLICK-TO-ADD: OFF'}
                  </button>

                  <button
                    type="button"
                    onClick={clearAllPoints}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      background: 'rgba(255, 71, 87, 0.2)',
                      border: '1px solid #ff4757',
                      color: '#ff4757',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    CLEAR
                  </button>
                </div>

                {/* Channel width */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '2px' }}>
                    <span>Flow Ribbon Width:</span>
                    <strong style={{ color: '#4ecdc4' }}>{channelWidth}%</strong>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="0.5"
                    value={channelWidth}
                    onChange={(e) => setChannelWidth(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Points list */}
                <div
                  style={{
                    maxHeight: '130px',
                    overflowY: 'auto',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '4px',
                  }}
                >
                  {points.map((p, idx) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPointId(p.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 6px',
                        borderRadius: '3px',
                        background: selectedPointId === p.id ? 'rgba(78, 205, 196, 0.25)' : 'transparent',
                        fontSize: '9.5px',
                        cursor: 'pointer',
                      }}
                    >
                      <span>
                        #{idx + 1} {p.label || `P${idx + 1}`} ({p.x}%, {p.y}%)
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePoint(p.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ff4757',
                          cursor: 'pointer',
                          fontSize: '11px',
                          padding: '0 4px',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={copyPointsJSON}
                  style={{
                    padding: '8px',
                    borderRadius: '4px',
                    background: 'linear-gradient(135deg, #4ecdc4 0%, #2ee0c4 100%)',
                    border: 'none',
                    color: '#081719',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: '0.06em',
                  }}
                >
                  📋 COPY POINTS JSON (RECORD)
                </button>
              </div>
            )}

            {/* TAB 3: KEYFRAME TRANSITIONS & SCRUBBER */}
            {activeTab === 'keyframes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '10px', color: '#a7b6a9', lineHeight: '1.4' }}>
                  Position the dam in Tab 1, then save it as Keyframe A or B. Use the scrubber below to preview how the dam animates!
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={saveToKeyframeA}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '4px',
                      background: 'rgba(78, 205, 196, 0.2)',
                      border: '1px solid #4ecdc4',
                      color: '#4ecdc4',
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    SAVE START (0%)
                  </button>

                  <button
                    type="button"
                    onClick={saveToKeyframeB}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '4px',
                      background: 'rgba(255, 71, 87, 0.2)',
                      border: '1px solid #ff4757',
                      color: '#ff4757',
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    SAVE END (100%)
                  </button>
                </div>

                {/* Scrubber */}
                <div style={{ marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                    <span>Transition Scrubber:</span>
                    <strong style={{ color: '#4ecdc4' }}>{Math.round(scrubberProgress * 100)}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={scrubberProgress}
                    onChange={(e) => {
                      setIsScrubbing(true);
                      setScrubberProgress(parseFloat(e.target.value));
                    }}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Keyframe summaries */}
                <div
                  style={{
                    padding: '8px',
                    borderRadius: '4px',
                    background: 'rgba(0,0,0,0.3)',
                    fontSize: '9.5px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div>
                    <span style={{ color: '#4ecdc4' }}>START (0%):</span> Scale: {keyframeA.scale.toFixed(2)}x, PosX: {keyframeA.posX}%, PosY: {keyframeA.posY}%
                  </div>
                  <div>
                    <span style={{ color: '#ff4757' }}>END (100%):</span> Scale: {keyframeB.scale.toFixed(2)}x, PosX: {keyframeB.posX}%, PosY: {keyframeB.posY}%
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes dashAnim {
          to {
            stroke-dashoffset: -28;
          }
        }
      `}</style>
    </div>
  );
}
