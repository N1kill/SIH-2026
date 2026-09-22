import React, { useState } from 'react';
import { INDIA_STATES } from '../data/indiaStatesData';
import { latLngToSVG } from '../data/damDatabase';

/**
 * IndiaMapSVG — High-Fidelity Interactive GIS Vector Map of India
 * 
 * Features:
 * - 36 authentic Survey of India / WGS-84 state & UT administrative boundaries.
 * - Dynamic host state detection & luminescent highlight when dam is selected.
 * - Multi-tier pulsing radar beacon on selected dam with tactical leader lines.
 * - Interactive clickable dam markers across India allowing direct map-based selection.
 * - Cartographic graticule (lat/long parallels & meridians), oceanic labels & scale bar.
 * - Cybernetic telemetry HUD styling matching PRALAYA's hydrodynamic interface.
 */
export default function IndiaMapSVG({
  selectedDam,
  allDams = [],
  onSelectDam,
  width = '100%',
  height = '100%',
}) {
  const [hoveredState, setHoveredState] = useState(null);
  const [hoveredDam, setHoveredDam] = useState(null);

  // Selected dam position in 612x696 SVG coordinates
  const activePos = selectedDam ? latLngToSVG(selectedDam.lat, selectedDam.lng) : null;

  // Normalized host state name for matching
  const hostStateName = selectedDam?.state?.toLowerCase().trim();

  // Graticule line coordinates (lat parallels & lng meridians)
  const parallels = [
    { lat: 10, label: '10°N', y: latLngToSVG(10, 80).y },
    { lat: 15, label: '15°N', y: latLngToSVG(15, 80).y },
    { lat: 20, label: '20°N', y: latLngToSVG(20, 80).y },
    { lat: 25, label: '25°N', y: latLngToSVG(25, 80).y },
    { lat: 30, label: '30°N', y: latLngToSVG(30, 80).y },
    { lat: 35, label: '35°N', y: latLngToSVG(35, 80).y },
  ];

  const meridians = [
    { lng: 72, label: '72°E', x: latLngToSVG(20, 72).x },
    { lng: 76, label: '76°E', x: latLngToSVG(20, 76).x },
    { lng: 80, label: '80°E', x: latLngToSVG(20, 80).x },
    { lng: 84, label: '84°E', x: latLngToSVG(20, 84).x },
    { lng: 88, label: '88°E', x: latLngToSVG(20, 88).x },
    { lng: 92, label: '92°E', x: latLngToSVG(20, 92).x },
  ];

  return (
    <div
      className="india-map-wrapper"
      style={{
        width,
        height,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        viewBox="0 0 612 696"
        width="100%"
        height="100%"
        style={{
          overflow: 'visible',
          maxWidth: '430px',
          filter: 'drop-shadow(0 12px 36px rgba(0, 0, 0, 0.6))',
        }}
      >
        <defs>
          {/* Default state gradient */}
          <linearGradient id="stateDefaultGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#142622" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0c1815" stopOpacity="0.95" />
          </linearGradient>

          {/* Host state active gradient */}
          <linearGradient id="stateActiveGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(63, 168, 155, 0.35)" />
            <stop offset="100%" stopColor="rgba(16, 45, 40, 0.7)" />
          </linearGradient>

          {/* Hover state gradient */}
          <linearGradient id="stateHoverGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(63, 168, 155, 0.22)" />
            <stop offset="100%" stopColor="rgba(20, 40, 36, 0.8)" />
          </linearGradient>

          {/* Ocean background vignette */}
          <radialGradient id="oceanGlow" cx="45%" cy="60%" r="55%">
            <stop offset="0%" stopColor="rgba(14, 30, 27, 0.4)" />
            <stop offset="70%" stopColor="rgba(8, 16, 14, 0.85)" />
            <stop offset="100%" stopColor="rgba(5, 10, 9, 0.95)" />
          </radialGradient>

          {/* Radar ripple rings */}
          <radialGradient id="radarPulse">
            <stop offset="0%" stopColor="#3fa89b" stopOpacity="0.8" />
            <stop offset="40%" stopColor="#3fa89b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3fa89b" stopOpacity="0" />
          </radialGradient>

          {/* Intense beacon glow filter */}
          <filter id="beaconGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Host state boundary glow */}
          <filter id="activeBorderGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Backdrop Ocean Canvas */}
        <rect
          x="0"
          y="0"
          width="612"
          height="696"
          rx="12"
          fill="url(#oceanGlow)"
          stroke="rgba(63, 168, 155, 0.12)"
          strokeWidth="1"
        />

        {/* 2. Graticule Lat / Long Grid */}
        <g className="map-graticule" opacity="0.35">
          {parallels.map((p) => (
            <g key={p.label}>
              <line
                x1="20"
                y1={p.y}
                x2="592"
                y2={p.y}
                stroke="rgba(63, 168, 155, 0.15)"
                strokeDasharray="2 4"
                strokeWidth="0.8"
              />
              <text
                x="24"
                y={p.y - 3}
                fill="rgba(167, 182, 169, 0.45)"
                fontFamily="var(--font-mono, monospace)"
                fontSize="7.5"
                letterSpacing="0.05em"
              >
                {p.label}
              </text>
            </g>
          ))}
          {meridians.map((m) => (
            <g key={m.label}>
              <line
                x1={m.x}
                y1="20"
                x2={m.x}
                y2="676"
                stroke="rgba(63, 168, 155, 0.15)"
                strokeDasharray="2 4"
                strokeWidth="0.8"
              />
              <text
                x={m.x + 3}
                y="684"
                fill="rgba(167, 182, 169, 0.45)"
                fontFamily="var(--font-mono, monospace)"
                fontSize="7.5"
                letterSpacing="0.05em"
              >
                {m.label}
              </text>
            </g>
          ))}
        </g>

        {/* 3. Oceanic Water Body Callouts */}
        <g className="ocean-labels" opacity="0.4">
          <text
            x="48"
            y="520"
            fill="#3fa89b"
            fontFamily="var(--font-mono, monospace)"
            fontSize="8.5"
            fontWeight="600"
            letterSpacing="0.25em"
            transform="rotate(-25 48 520)"
          >
            ARABIAN SEA
          </text>
          <text
            x="395"
            y="545"
            fill="#3fa89b"
            fontFamily="var(--font-mono, monospace)"
            fontSize="8.5"
            fontWeight="600"
            letterSpacing="0.25em"
            transform="rotate(18 395 545)"
          >
            BAY OF BENGAL
          </text>
          <text
            x="245"
            y="680"
            fill="#3fa89b"
            fontFamily="var(--font-mono, monospace)"
            fontSize="8"
            fontWeight="600"
            letterSpacing="0.28em"
            textAnchor="middle"
          >
            INDIAN OCEAN
          </text>
        </g>

        {/* 4. Real State Outlines (Survey of India Geometry) */}
        <g className="india-states-layer">
          {INDIA_STATES.map((st) => {
            const isHost =
              hostStateName &&
              (st.name.toLowerCase() === hostStateName ||
                st.name.toLowerCase().includes(hostStateName) ||
                hostStateName.includes(st.name.toLowerCase()));
            const isHovered = hoveredState?.id === st.id;

            return (
              <path
                key={st.id}
                id={`state-${st.id}`}
                d={st.d}
                fill={
                  isHost
                    ? 'url(#stateActiveGrad)'
                    : isHovered
                    ? 'url(#stateHoverGrad)'
                    : 'url(#stateDefaultGrad)'
                }
                stroke={
                  isHost
                    ? '#3fa89b'
                    : isHovered
                    ? '#81e6d9'
                    : 'rgba(63, 168, 155, 0.28)'
                }
                strokeWidth={isHost ? '1.8' : isHovered ? '1.4' : '0.75'}
                strokeLinejoin="round"
                strokeLinecap="round"
                filter={isHost ? 'url(#activeBorderGlow)' : undefined}
                style={{
                  transition: 'fill 0.25s ease, stroke 0.25s ease, stroke-width 0.25s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredState(st)}
                onMouseLeave={() => setHoveredState(null)}
              />
            );
          })}
        </g>

        {/* 5. Dam Network Markers (all dams faint, active highlighted) */}
        <g className="dams-layer">
          {allDams.map((dam) => {
            const isSelected = dam.id === selectedDam?.id;
            const pos = latLngToSVG(dam.lat, dam.lng);
            if (!pos) return null;

            if (isSelected) return null; // Rendered on top in active beacon section

            return (
              <g
                key={dam.id}
                className="dam-marker-item"
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectDam && onSelectDam(dam)}
                onMouseEnter={() => setHoveredDam(dam)}
                onMouseLeave={() => setHoveredDam(null)}
              >
                {/* Hit target */}
                <circle cx={pos.x} cy={pos.y} r="10" fill="transparent" />
                {/* Secondary ring */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="4"
                  fill="none"
                  stroke="rgba(63, 168, 155, 0.4)"
                  strokeWidth="0.8"
                />
                {/* Core dot */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="2.2"
                  fill="rgba(129, 230, 217, 0.75)"
                />
              </g>
            );
          })}
        </g>

        {/* 6. Active Selected Dam Beacon & Tactical HUD Reticle */}
        {activePos && selectedDam && (
          <g className="active-dam-beacon" pointerEvents="none">
            {/* Pulsing radar waves */}
            <circle
              cx={activePos.x}
              cy={activePos.y}
              r="34"
              fill="url(#radarPulse)"
              className="map-marker-pulse"
              style={{ transformOrigin: `${activePos.x}px ${activePos.y}px` }}
            />
            <circle
              cx={activePos.x}
              cy={activePos.y}
              r="20"
              fill="none"
              stroke="#3fa89b"
              strokeWidth="1"
              opacity="0.4"
              strokeDasharray="3 3"
              className="beacon-spin"
              style={{ transformOrigin: `${activePos.x}px ${activePos.y}px` }}
            />
            <circle
              cx={activePos.x}
              cy={activePos.y}
              r="10"
              fill="none"
              stroke="#81e6d9"
              strokeWidth="1.2"
              opacity="0.75"
            />

            {/* Target Reticle Crosshairs */}
            <line
              x1={activePos.x - 14}
              y1={activePos.y}
              x2={activePos.x - 5}
              y2={activePos.y}
              stroke="#81e6d9"
              strokeWidth="1.2"
            />
            <line
              x1={activePos.x + 5}
              y1={activePos.y}
              x2={activePos.x + 14}
              y2={activePos.y}
              stroke="#81e6d9"
              strokeWidth="1.2"
            />
            <line
              x1={activePos.x}
              y1={activePos.y - 14}
              x2={activePos.x}
              y2={activePos.y - 5}
              stroke="#81e6d9"
              strokeWidth="1.2"
            />
            <line
              x1={activePos.x}
              y1={activePos.y + 5}
              x2={activePos.x}
              y2={activePos.y + 14}
              stroke="#81e6d9"
              strokeWidth="1.2"
            />

            {/* Core glowing beacon pin */}
            <circle
              cx={activePos.x}
              cy={activePos.y}
              r="4.5"
              fill="#ffffff"
              stroke="#0a1210"
              strokeWidth="1.5"
              filter="url(#beaconGlow)"
            />

            {/* Leader line to tactical floating callout */}
            {(() => {
              // Calculate smart callout offset based on location in India
              // If dam is in northern/eastern India, offset downwards/leftwards to avoid clipping
              const offsetX = activePos.x > 380 ? -155 : 22;
              const offsetY = activePos.y < 200 ? 18 : activePos.y > 500 ? -48 : -22;
              const tagX = activePos.x + offsetX;
              const tagY = activePos.y + offsetY;

              return (
                <g className="tactical-callout">
                  {/* Elbow connector line */}
                  <polyline
                    points={`
                      ${activePos.x + (offsetX > 0 ? 8 : -8)},${activePos.y}
                      ${tagX + (offsetX > 0 ? 0 : 130)},${tagY + 16}
                    `}
                    fill="none"
                    stroke="#3fa89b"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                    opacity="0.8"
                  />

                  {/* Callout box backdrop */}
                  <rect
                    x={tagX}
                    y={tagY}
                    width="142"
                    height="44"
                    rx="5"
                    fill="rgba(9, 18, 16, 0.94)"
                    stroke="rgba(63, 168, 155, 0.6)"
                    strokeWidth="1"
                    filter="drop-shadow(0 4px 14px rgba(0, 0, 0, 0.7))"
                  />

                  {/* Dam name header */}
                  <text
                    x={tagX + 8}
                    y={tagY + 14}
                    fill="#ffffff"
                    fontFamily="var(--font-sans, sans-serif)"
                    fontSize="10"
                    fontWeight="700"
                    letterSpacing="0.04em"
                  >
                    {selectedDam.name.length > 17
                      ? selectedDam.name.slice(0, 15) + '…'
                      : selectedDam.name}
                  </text>

                  {/* State & River */}
                  <text
                    x={tagX + 8}
                    y={tagY + 26}
                    fill="#81e6d9"
                    fontFamily="var(--font-mono, monospace)"
                    fontSize="8"
                    fontWeight="600"
                  >
                    {selectedDam.state.toUpperCase()} · {selectedDam.river.replace(' River', '')}
                  </text>

                  {/* Coordinates & Risk badge */}
                  <text
                    x={tagX + 8}
                    y={tagY + 37}
                    fill="rgba(167, 182, 169, 0.75)"
                    fontFamily="var(--font-mono, monospace)"
                    fontSize="7.5"
                  >
                    {selectedDam.lat.toFixed(2)}°N, {selectedDam.lng.toFixed(2)}°E
                  </text>

                  {/* Mini risk status pill */}
                  <rect
                    x={tagX + 96}
                    y={tagY + 27}
                    width="38"
                    height="12"
                    rx="3"
                    fill={
                      selectedDam.simulation.riskLevel === 'EXTREME'
                        ? 'rgba(239, 68, 68, 0.25)'
                        : 'rgba(251, 191, 36, 0.25)'
                    }
                    stroke={
                      selectedDam.simulation.riskLevel === 'EXTREME'
                        ? '#ef4444'
                        : '#fbbf24'
                    }
                    strokeWidth="0.75"
                  />
                  <text
                    x={tagX + 115}
                    y={tagY + 36}
                    fill={
                      selectedDam.simulation.riskLevel === 'EXTREME'
                        ? '#fca5a5'
                        : '#fde047'
                    }
                    fontFamily="var(--font-mono, monospace)"
                    fontSize="6.5"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {selectedDam.simulation.riskLevel}
                  </text>
                </g>
              );
            })()}
          </g>
        )}

        {/* 7. Hover Tooltip for States & Dams */}
        {hoveredDam && (
          <g transform={`translate(${latLngToSVG(hoveredDam.lat, hoveredDam.lng).x}, ${latLngToSVG(hoveredDam.lat, hoveredDam.lng).y - 18})`}>
            <rect
              x="-60"
              y="-18"
              width="120"
              height="18"
              rx="4"
              fill="rgba(11, 22, 20, 0.95)"
              stroke="#3fa89b"
              strokeWidth="0.8"
            />
            <text
              x="0"
              y="-6"
              fill="#81e6d9"
              fontFamily="var(--font-mono, monospace)"
              fontSize="7.5"
              fontWeight="700"
              textAnchor="middle"
            >
              CLICK: {hoveredDam.name.toUpperCase()}
            </text>
          </g>
        )}

        {hoveredState && !hoveredDam && (
          <g transform="translate(30, 48)">
            <rect
              x="0"
              y="0"
              width={hoveredState.name.length * 7.5 + 24}
              height="20"
              rx="4"
              fill="rgba(9, 18, 16, 0.92)"
              stroke="rgba(63, 168, 155, 0.45)"
              strokeWidth="0.8"
            />
            <circle cx="8" cy="10" r="3" fill="#3fa89b" />
            <text
              x="16"
              y="14"
              fill="#d1fae5"
              fontFamily="var(--font-mono, monospace)"
              fontSize="8.5"
              fontWeight="600"
              letterSpacing="0.06em"
            >
              {hoveredState.name.toUpperCase()}
            </text>
          </g>
        )}

        {/* 8. Compass Rose (North Arrow) */}
        <g transform="translate(562, 38)">
          <circle
            r="16"
            fill="rgba(12, 24, 21, 0.9)"
            stroke="rgba(63, 168, 155, 0.35)"
            strokeWidth="1"
          />
          {/* North needle */}
          <polygon points="0,-12 4,0 0,4" fill="#3fa89b" />
          <polygon points="0,-12 -4,0 0,4" fill="#81e6d9" />
          {/* South needle */}
          <polygon points="0,12 4,0 0,-4" fill="rgba(63, 168, 155, 0.3)" />
          <polygon points="0,12 -4,0 0,-4" fill="rgba(63, 168, 155, 0.15)" />
          <text
            textAnchor="middle"
            y="-15"
            fill="#81e6d9"
            fontFamily="var(--font-mono, monospace)"
            fontSize="8"
            fontWeight="800"
          >
            N
          </text>
        </g>

        {/* 9. Scale Bar & Geodetic Datum */}
        <g transform="translate(30, 660)">
          <line
            x1="0"
            y1="0"
            x2="60"
            y2="0"
            stroke="rgba(167, 182, 169, 0.6)"
            strokeWidth="1.5"
          />
          <line x1="0" y1="-3" x2="0" y2="3" stroke="rgba(167, 182, 169, 0.6)" strokeWidth="1.5" />
          <line x1="60" y1="-3" x2="60" y2="3" stroke="rgba(167, 182, 169, 0.6)" strokeWidth="1.5" />
          <text
            x="30"
            y="-5"
            textAnchor="middle"
            fill="rgba(167, 182, 169, 0.75)"
            fontFamily="var(--font-mono, monospace)"
            fontSize="7.5"
            fontWeight="600"
          >
            500 KM
          </text>
          <text
            x="0"
            y="12"
            fill="rgba(63, 168, 155, 0.6)"
            fontFamily="var(--font-mono, monospace)"
            fontSize="6.5"
            letterSpacing="0.08em"
          >
            DATUM: WGS-84 · EPSG:4326 · SURVEY OF INDIA GEOMETRY
          </text>
        </g>
      </svg>
    </div>
  );
}
