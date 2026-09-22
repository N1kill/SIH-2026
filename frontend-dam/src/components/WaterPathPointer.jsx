import React, { useState, useEffect, useRef } from 'react';
import {
  USER_WATER_SET_POS1,
  USER_WATER_SET_POS2,
  USER_WATER_SET_POS3,
  ALL_USER_WATER_SETS,
} from '../animation/userWaterCoordinates';

/**
 * Catmull-Rom spline interpolation through a list of points
 */
function computeSplinePoints(points, samplesPerSegment = 16) {
  if (!points || points.length < 2) return [];

  const result = [];
  const n = points.length;

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];

    for (let s = 0; s <= samplesPerSegment; s++) {
      if (i > 0 && s === 0) continue;
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;

      const f1 = -0.5 * t3 + t2 - 0.5 * t;
      const f2 = 1.5 * t3 - 2.5 * t2 + 1.0;
      const f3 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
      const f4 = 0.5 * t3 - 0.5 * t2;

      const x = p0.x * f1 + p1.x * f2 + p2.x * f3 + p3.x * f4;
      const y = p0.y * f1 + p1.y * f2 + p2.y * f3 + p3.y * f4;

      const tx =
        (-1.5 * t2 + 2 * t - 0.5) * p0.x +
        (4.5 * t2 - 5 * t) * p1.x +
        (-4.5 * t2 + 4 * t + 0.5) * p2.x +
        (1.5 * t2 - t) * p3.x;
      const ty =
        (-1.5 * t2 + 2 * t - 0.5) * p0.y +
        (4.5 * t2 - 5 * t) * p1.y +
        (-4.5 * t2 + 4 * t + 0.5) * p2.y +
        (1.5 * t2 - t) * p3.y;

      const len = Math.sqrt(tx * tx + ty * ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;

      result.push({ x, y, nx, ny });
    }
  }

  return result;
}

/**
 * Linear interpolation between two arrays of points of arbitrary lengths
 */
function interpolatePointSets(arrA, arrB, t) {
  if (!arrA || arrA.length === 0) return arrB || [];
  if (!arrB || arrB.length === 0) return arrA || [];

  const maxLen = Math.max(arrA.length, arrB.length);
  const res = [];
  for (let i = 0; i < maxLen; i++) {
    const a = arrA[Math.min(i, arrA.length - 1)];
    const b = arrB[Math.min(i, arrB.length - 1)];
    res.push({
      id: a.id || i + 1,
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    });
  }
  return res;
}

export default function WaterPathPointer({
  activeStage = 1,
  timelineProgress = 0,
  isCameraPlaying = false,
  onSelectStage,
  onNudge,
  currentOffset = { x: 0, y: 0 },
}) {
  // Stored thread sets (initialized with user's exact authored coordinates)
  const [threadsByStage, setThreadsByStage] = useState(() => {
    try {
      const saved = localStorage.getItem('pralaya_user_water_coords');
      if (saved) return JSON.parse(saved);
    } catch {}
    return ALL_USER_WATER_SETS;
  });

  // Current active dots on screen
  const [dots, setDots] = useState(USER_WATER_SET_POS1);
  const [activeSetId, setActiveSetId] = useState('pos1');

  // Display toggles
  const [isStringing, setIsStringing] = useState(false);
  const [showDots, setShowDots] = useState(true);
  const [isWaterFlowing, setIsWaterFlowing] = useState(true);
  const [showMeshFill, setShowMeshFill] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // Flow parameters
  const [threadWidth, setThreadWidth] = useState(14);
  const [flowVelocity, setFlowVelocity] = useState(1.6);
  const [threadGlow, setThreadGlow] = useState(0.88);

  const [mousePos, setMousePos] = useState(null);
  const [hoveredDotIndex, setHoveredDotIndex] = useState(null);
  const [selectedDotIndex, setSelectedDotIndex] = useState(null);

  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  // Sync dots when camera timeline scrubs (0% -> 50% -> 100%)
  useEffect(() => {
    const t1 = threadsByStage.pos1 || USER_WATER_SET_POS1;
    const t2 = threadsByStage.pos2 || USER_WATER_SET_POS2;
    const t3 = threadsByStage.pos3 || USER_WATER_SET_POS3;

    if (timelineProgress <= 0.5) {
      const t = timelineProgress / 0.5;
      setDots(interpolatePointSets(t1, t2, t));
      setActiveSetId('pos1');
    } else {
      const t = (timelineProgress - 0.5) / 0.5;
      setDots(interpolatePointSets(t2, t3, t));
      setActiveSetId('pos2');
    }
  }, [timelineProgress, threadsByStage]);

  // Sync with active camera stage when not scrubbing/playing
  useEffect(() => {
    if (isCameraPlaying) return;
    const key = `pos${activeStage}`;
    if (threadsByStage[key]) {
      setDots(threadsByStage[key]);
      setActiveSetId(key);
    }
  }, [activeStage, threadsByStage, isCameraPlaying]);

  // Switch between user sets AND command 3D camera to fly to that position!
  const selectStageAndSet = (stageNum) => {
    const key = `pos${stageNum}`;
    setActiveSetId(key);
    const target = threadsByStage[key] || ALL_USER_WATER_SETS[key];
    if (target) {
      setDots(target);
    }
    // Fly the 3D camera to this stage!
    if (onSelectStage) {
      onSelectStage(stageNum);
    }
  };

  // Save changes to current position
  const saveCurrentSet = () => {
    const updated = {
      ...threadsByStage,
      [activeSetId]: dots,
    };
    setThreadsByStage(updated);
    try {
      localStorage.setItem('pralaya_user_water_coords', JSON.stringify(updated));
    } catch {}
    alert(`Saved ${dots.length} water coordinates for ${activeSetId.toUpperCase()}!`);
  };

  // Reset to initial authored coordinates
  const resetToAuthoredCoords = () => {
    const original = ALL_USER_WATER_SETS[activeSetId] || USER_WATER_SET_POS1;
    setDots(original);
    const updated = {
      ...threadsByStage,
      [activeSetId]: original,
    };
    setThreadsByStage(updated);
    try {
      localStorage.setItem('pralaya_user_water_coords', JSON.stringify(updated));
    } catch {}
  };

  // Drag dot to adjust
  const handleDotMouseDown = (index, e) => {
    e.stopPropagation();
    setSelectedDotIndex(index);
    dragRef.current = {
      index,
      hasDragged: false,
    };

    const onMove = (moveEvt) => {
      if (!dragRef.current) return;
      dragRef.current.hasDragged = true;

      const rect = svgRef.current.getBoundingClientRect();
      const nx = Math.max(0, Math.min(1, (moveEvt.clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, (moveEvt.clientY - rect.top) / rect.height));

      setDots((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          x: parseFloat(nx.toFixed(3)),
          y: parseFloat(ny.toFixed(3)),
        };
        return next;
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setTimeout(() => {
        if (dragRef.current) dragRef.current = null;
      }, 50);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Delete dot
  const handleDotContextMenu = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDots((prev) => prev.filter((_, i) => i !== index));
    setSelectedDotIndex(null);
  };

  // Add new dot onto thread
  const handleSvgClick = (e) => {
    if (!isStringing) return;
    if (dragRef.current?.hasDragged) return;

    const rect = svgRef.current.getBoundingClientRect();
    const nx = parseFloat(((e.clientX - rect.left) / rect.width).toFixed(3));
    const ny = parseFloat(((e.clientY - rect.top) / rect.height).toFixed(3));

    const newDot = {
      id: Date.now(),
      x: nx,
      y: ny,
    };

    setDots((prev) => [...prev, newDot]);
  };

  // ========================================================
  // RENDER FLOWING WATER THREAD SIMULATION (CANVAS)
  // ========================================================
  useEffect(() => {
    if (!isWaterFlowing || dots.length < 2) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let time = 0;

    const particles = [];
    for (let i = 0; i < 90; i++) {
      particles.push({
        t: Math.random(),
        speed: 0.003 + Math.random() * 0.007,
        lateralOffset: (Math.random() - 0.5) * 0.8,
        size: 1.5 + Math.random() * 3.5,
        alpha: 0.35 + Math.random() * 0.65,
      });
    }

    const render = () => {
      time += 0.024 * flowVelocity;

      const w = (canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1));
      const h = (canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1));
      ctx.clearRect(0, 0, w, h);

      if (dots.length < 2) {
        animId = requestAnimationFrame(render);
        return;
      }

      const pixelDots = dots.map((d) => ({
        x: d.x * w,
        y: d.y * h,
      }));

      const spline = computeSplinePoints(pixelDots, 16);
      if (spline.length < 2) {
        animId = requestAnimationFrame(render);
        return;
      }

      const baseWidth = threadWidth * (w / 1920);

      // 1. Soft liquid pool fill in basin
      if (showMeshFill && pixelDots.length >= 6) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pixelDots[0].x, pixelDots[0].y);
        for (let i = 1; i < pixelDots.length; i++) {
          ctx.lineTo(pixelDots[i].x, pixelDots[i].y);
        }
        ctx.closePath();

        const grad = ctx.createRadialGradient(
          pixelDots[Math.floor(pixelDots.length / 2)].x,
          pixelDots[Math.floor(pixelDots.length / 2)].y,
          10,
          pixelDots[Math.floor(pixelDots.length / 2)].x,
          pixelDots[Math.floor(pixelDots.length / 2)].y,
          300 * (w / 1920)
        );
        grad.addColorStop(0, `rgba(32, 160, 175, ${0.18 * threadGlow})`);
        grad.addColorStop(1, `rgba(16, 90, 100, ${0.05 * threadGlow})`);

        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }

      // 2. Translucent Core Fluid Body
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(spline[0].x, spline[0].y);
      for (let i = 1; i < spline.length; i++) {
        ctx.lineTo(spline[i].x, spline[i].y);
      }
      ctx.lineWidth = baseWidth * 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(30, 140, 150, ${0.25 * threadGlow})`;
      ctx.stroke();

      ctx.lineWidth = baseWidth;
      ctx.strokeStyle = `rgba(22, 120, 130, ${0.75 * threadGlow})`;
      ctx.stroke();

      // 3. Central Luminous Core Filament
      ctx.lineWidth = Math.max(2, baseWidth * 0.3);
      ctx.strokeStyle = `rgba(90, 240, 230, ${0.95 * threadGlow})`;
      ctx.stroke();
      ctx.restore();

      // 4. Flowing Internal Streamlines
      ctx.save();
      const strandCount = 5;
      for (let s = 0; s < strandCount; s++) {
        const offsetRatio = (s / (strandCount - 1) - 0.5) * 0.75;
        ctx.beginPath();
        let started = false;

        for (let i = 0; i < spline.length; i += 2) {
          const pt = spline[i];
          const wave = Math.sin((i / spline.length) * 26 + time * 5 + s * 1.6) * (baseWidth * 0.15);
          const px = pt.x + pt.nx * (baseWidth * 0.5 * offsetRatio + wave);
          const py = pt.y + pt.ny * (baseWidth * 0.5 * offsetRatio + wave);

          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }

        ctx.lineWidth = 1.4 * (w / 1920);
        ctx.strokeStyle = `rgba(210, 255, 252, ${
          0.3 + (Math.sin(time * 3 + s) * 0.5 + 0.5) * 0.35
        })`;
        ctx.stroke();
      }
      ctx.restore();

      // 5. Rushing Foam Particles & Bubble Droplets
      ctx.save();
      particles.forEach((p) => {
        p.t += p.speed * flowVelocity;
        if (p.t > 1) p.t = 0;

        const idx = Math.floor(p.t * (spline.length - 1));
        const pt = spline[idx] || spline[0];

        const wave = Math.sin(p.t * 30 + time * 6) * (baseWidth * 0.1);
        const px = pt.x + pt.nx * (baseWidth * 0.45 * p.lateralOffset + wave);
        const py = pt.y + pt.ny * (baseWidth * 0.45 * p.lateralOffset + wave);

        ctx.beginPath();
        ctx.arc(px, py, p.size * (w / 1920), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240, 255, 252, ${p.alpha * threadGlow})`;
        ctx.fill();
      });
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isWaterFlowing, dots, threadWidth, flowVelocity, threadGlow, showMeshFill]);

  // Compute SVG Catmull-Rom path string
  const svgThreadPath = React.useMemo(() => {
    if (dots.length < 2) return '';
    const pixelPts = dots.map((d) => ({
      x: d.x * window.innerWidth,
      y: d.y * window.innerHeight,
    }));
    const spline = computeSplinePoints(pixelPts, 16);
    if (spline.length < 2) return '';
    return (
      `M ${spline[0].x} ${spline[0].y} ` +
      spline
        .slice(1)
        .map((p) => `L ${p.x} ${p.y}`)
        .join(' ')
    );
  }, [dots]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 15,
      }}
    >
      {/* 1. Animated Flowing Liquid Canvas along the Thread */}
      {isWaterFlowing && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 2. Interactive SVG Thread and Dots Overlay */}
      <svg
        ref={svgRef}
        onClick={handleSvgClick}
        onMouseMove={(e) => {
          if (!isStringing) return;
          const rect = svgRef.current.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: isStringing || showDots ? 'auto' : 'none',
          cursor: isStringing ? 'crosshair' : 'default',
        }}
      >
        <defs>
          <filter id="thread-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.0" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* The Smooth Continuous Thread Path */}
        {showDots && svgThreadPath && (
          <>
            <path
              d={svgThreadPath}
              fill="none"
              stroke="rgba(78, 205, 196, 0.45)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#thread-glow)"
            />
            <path
              d={svgThreadPath}
              fill="none"
              stroke="#4ecdc4"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* Rubberband thread preview to mouse during stringing */}
        {isStringing && dots.length > 0 && mousePos && (
          <line
            x1={dots[dots.length - 1].x * window.innerWidth}
            y1={dots[dots.length - 1].y * window.innerHeight}
            x2={mousePos.x}
            y2={mousePos.y}
            stroke="#4ecdc4"
            strokeWidth="1.8"
            strokeDasharray="4 4"
            opacity="0.85"
          />
        )}

        {/* Minimal Anchor Dots */}
        {showDots &&
          dots.map((d, idx) => {
            const px = d.x * window.innerWidth;
            const py = d.y * window.innerHeight;
            const isHovered = hoveredDotIndex === idx;
            const isSelected = selectedDotIndex === idx;

            return (
              <g
                key={d.id || idx}
                transform={`translate(${px}, ${py})`}
                onMouseEnter={() => setHoveredDotIndex(idx)}
                onMouseLeave={() => setHoveredDotIndex(null)}
                onMouseDown={(e) => handleDotMouseDown(idx, e)}
                onContextMenu={(e) => handleDotContextMenu(idx, e)}
                style={{ cursor: 'grab', pointerEvents: 'auto' }}
              >
                <circle
                  r={isHovered || isSelected ? 10 : 6.5}
                  fill={isHovered || isSelected ? 'rgba(78, 205, 196, 0.4)' : 'rgba(78, 205, 196, 0.15)'}
                  stroke={isHovered || isSelected ? '#ffffff' : '#4ecdc4'}
                  strokeWidth="1"
                />
                <circle
                  r={isHovered || isSelected ? 4 : 2.8}
                  fill={isHovered || isSelected ? '#ffffff' : '#4ecdc4'}
                  filter="url(#thread-glow)"
                />
              </g>
            );
          })}
      </svg>

      {/* ==================================================== */}
      {/* THREAD-TYPE WATER TOOLBAR */}
      {/* ==================================================== */}
      <div
        style={{
          position: 'absolute',
          top: '18px',
          left: '18px',
          zIndex: 100,
          background: 'rgba(12, 22, 24, 0.94)',
          border: '1px solid rgba(78, 205, 196, 0.45)',
          borderRadius: '12px',
          padding: isPanelOpen ? '14px 18px' : '8px 14px',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 12px 36px rgba(0,0,0,0.8)',
          fontFamily: "'IBM Plex Mono', monospace",
          color: '#f0f4ef',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          width: isPanelOpen ? '340px' : 'auto',
          maxWidth: 'calc(100vw - 36px)',
          transition: 'all 0.2s ease',
          pointerEvents: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#4ecdc4',
                boxShadow: '0 0 8px #4ecdc4',
              }}
            />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#4ecdc4', letterSpacing: '0.08em' }}>
              WATER & OUTLET ALIGNMENT ({dots.length} PTS)
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
              fontSize: '13px',
              padding: '0 4px',
            }}
          >
            {isPanelOpen ? '✕' : '💧'}
          </button>
        </div>

        {isPanelOpen && (
          <>
            {/* THREE POSITION TABS (SYNCS 3D CAMERA + WATER TOGETHER) */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => selectStageAndSet(1)}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: '4px',
                  background: activeSetId === 'pos1' ? 'rgba(78, 205, 196, 0.25)' : 'rgba(255,255,255,0.04)',
                  border: activeSetId === 'pos1' ? '1px solid #4ecdc4' : '1px solid rgba(255,255,255,0.1)',
                  color: activeSetId === 'pos1' ? '#4ecdc4' : '#a7b6a9',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                POS 1 (Frontal)
              </button>

              <button
                type="button"
                onClick={() => selectStageAndSet(2)}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: '4px',
                  background: activeSetId === 'pos2' ? 'rgba(78, 205, 196, 0.25)' : 'rgba(255,255,255,0.04)',
                  border: activeSetId === 'pos2' ? '1px solid #4ecdc4' : '1px solid rgba(255,255,255,0.1)',
                  color: activeSetId === 'pos2' ? '#4ecdc4' : '#a7b6a9',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                POS 2 (Chute)
              </button>

              <button
                type="button"
                onClick={() => selectStageAndSet(3)}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: '4px',
                  background: activeSetId === 'pos3' ? 'rgba(78, 205, 196, 0.25)' : 'rgba(255,255,255,0.04)',
                  border: activeSetId === 'pos3' ? '1px solid #4ecdc4' : '1px solid rgba(255,255,255,0.1)',
                  color: activeSetId === 'pos3' ? '#4ecdc4' : '#a7b6a9',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                POS 3 (Plunge)
              </button>
            </div>

            {/* FINE ALIGNMENT NUDGE BUTTONS (PER-MONITOR PRECISION) */}
            <div
              style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '8px 10px',
                borderRadius: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px' }}>
                <span>Dam Outlet Nudge:</span>
                <strong style={{ color: '#4ecdc4' }}>
                  X: {currentOffset.x}%, Y: {currentOffset.y}%
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => onNudge && onNudge(-1.0, 0)}
                  style={{
                    flex: 1,
                    padding: '4px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#f0f4ef',
                    fontSize: '9px',
                    cursor: 'pointer',
                  }}
                  title="Shift Dam Left 1%"
                >
                  ◀ LEFT
                </button>
                <button
                  type="button"
                  onClick={() => onNudge && onNudge(1.0, 0)}
                  style={{
                    flex: 1,
                    padding: '4px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#f0f4ef',
                    fontSize: '9px',
                    cursor: 'pointer',
                  }}
                  title="Shift Dam Right 1%"
                >
                  RIGHT ▶
                </button>
                <button
                  type="button"
                  onClick={() => onNudge && onNudge(0, -1.0)}
                  style={{
                    flex: 1,
                    padding: '4px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#f0f4ef',
                    fontSize: '9px',
                    cursor: 'pointer',
                  }}
                  title="Shift Dam Up 1%"
                >
                  ▲ UP
                </button>
                <button
                  type="button"
                  onClick={() => onNudge && onNudge(0, 1.0)}
                  style={{
                    flex: 1,
                    padding: '4px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#f0f4ef',
                    fontSize: '9px',
                    cursor: 'pointer',
                  }}
                  title="Shift Dam Down 1%"
                >
                  DOWN ▼
                </button>
              </div>
            </div>

            {/* Toggle Buttons: Dots ON/OFF & Mesh Fill */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setShowDots(!showDots)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: '5px',
                  background: showDots ? 'rgba(78, 205, 196, 0.2)' : 'rgba(255,255,255,0.06)',
                  border: showDots ? '1px solid #4ecdc4' : '1px solid rgba(255,255,255,0.15)',
                  color: showDots ? '#4ecdc4' : '#a7b6a9',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {showDots ? '● DOTS: VISIBLE' : '○ DOTS: HIDDEN'}
              </button>

              <button
                type="button"
                onClick={() => setShowMeshFill(!showMeshFill)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: '5px',
                  background: showMeshFill ? 'rgba(46, 213, 115, 0.2)' : 'rgba(255,255,255,0.06)',
                  border: showMeshFill ? '1px solid #2ed573' : '1px solid rgba(255,255,255,0.15)',
                  color: showMeshFill ? '#2ed573' : '#a7b6a9',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {showMeshFill ? 'POOL FILL: ON' : 'POOL FILL: OFF'}
              </button>
            </div>

            {/* Sliders: Thread Width & Flow Velocity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                  <span>Thread / Water Width:</span>
                  <strong style={{ color: '#4ecdc4' }}>{threadWidth}px</strong>
                </div>
                <input
                  type="range"
                  min="4"
                  max="45"
                  step="1"
                  value={threadWidth}
                  onChange={(e) => setThreadWidth(parseInt(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                  <span>Water Rush Velocity:</span>
                  <strong style={{ color: '#4ecdc4' }}>{flowVelocity.toFixed(1)}x</strong>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="3.0"
                  step="0.1"
                  value={flowVelocity}
                  onChange={(e) => setFlowVelocity(parseFloat(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Save & Reset Actions */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px', display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={saveCurrentSet}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: '4px',
                  background: 'rgba(78, 205, 196, 0.2)',
                  border: '1px solid #4ecdc4',
                  color: '#4ecdc4',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                SAVE CHANGES
              </button>

              <button
                type="button"
                onClick={resetToAuthoredCoords}
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#f0f4ef',
                  fontSize: '9.5px',
                  cursor: 'pointer',
                }}
                title="Reset to initial coordinates"
              >
                ↺ RESET
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
