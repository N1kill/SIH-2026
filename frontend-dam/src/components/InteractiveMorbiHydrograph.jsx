import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import stageData from '../data/outputs/morbiStageHydrographData.json';

// Clean numeric tick points every 2 hours from 0 to 24
const X_TICKS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

/**
 * Custom Tooltip for Synchronized Stage & Outflow Telemetry
 */
function StageTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const isOverHistorical = data.morbi >= 3.0;

  return (
    <div
      style={{
        background: '#091316',
        border: '1.5px solid rgba(94, 234, 212, 0.7)',
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.9)',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '11px',
        minWidth: '240px',
      }}
    >
      <div
        style={{
          color: '#38bdf8',
          fontWeight: 700,
          fontSize: '12px',
          marginBottom: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          paddingBottom: '5px',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>TIMESTEP: T+{data.time.toFixed(1)}h</span>
        <span style={{ color: data.time <= 2.5 ? '#f59e0b' : '#94a3b8' }}>
          {data.time <= 2.5 ? 'SURGE LIMB' : 'RECESSION LIMB'}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f87171', marginBottom: '4px' }}>
        <span>Breach Outflow Q:</span>
        <span style={{ fontWeight: 700 }}>{data.q_total.toLocaleString()} m³/s</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8', marginBottom: '4px' }}>
        <span>Dam Toe Depth (0 km):</span>
        <span style={{ fontWeight: 700 }}>{data.dam_toe.toFixed(2)} m</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24', marginBottom: '4px' }}>
        <span>Morbi City Depth (7.5 km):</span>
        <span style={{ fontWeight: 700 }}>{data.morbi.toFixed(2)} m</span>
      </div>

      {isOverHistorical ? (
        <div
          style={{
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '1px dashed rgba(239, 68, 68, 0.5)',
            color: '#fca5a5',
            fontSize: '10px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <span>⚠️</span>
          <span>EXCEEDS HISTORICAL FLOOD MARK (+{(data.morbi - 3.0).toFixed(2)}m)</span>
        </div>
      ) : data.morbi > 0.05 ? (
        <div style={{ marginTop: '6px', color: '#34d399', fontSize: '10px' }}>
          Wavefront in channel thalweg (&lt;3.0m bank capacity)
        </div>
      ) : (
        <div style={{ marginTop: '6px', color: '#94a3b8', fontSize: '10px' }}>
          Flood wave has not yet reached Morbi City Center
        </div>
      )}
    </div>
  );
}

/**
 * InteractiveMorbiHydrograph — Crystal-Clear Stage & Outflow Hydrograph Component
 * Matches the exact layout, typography, controls, and elegance of Section 1's InteractiveHydrograph.
 */
export default function InteractiveMorbiHydrograph({ onInspectPlot }) {
  const [activeView, setActiveView] = useState('stage'); // 'stage' | 'outflow' | 'composite'

  return (
    <div
      className="interactive-hydrograph-container"
      style={{
        background: 'linear-gradient(180deg, rgba(8, 16, 24, 0.95) 0%, rgba(5, 10, 16, 0.98) 100%)',
        border: '1px solid rgba(63, 168, 155, 0.35)',
        borderRadius: '12px',
        padding: '20px 24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {/* 1. Header Bar with Cyan Dot, Title, Subtitle, and View Toggles */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#5eead4',
                boxShadow: '0 0 10px #5eead4',
              }}
            />
            <h4
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: '#f1faee',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              MORBI STAGE &amp; BREACH PROPAGATION HYDROGRAPH
            </h4>
          </div>
          <span
            style={{
              fontSize: '11px',
              color: '#8d99ae',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            2D Diffusive-Wave Hydrodynamic Routing · Downstream Stage Telemetry (0 to 24 Hours)
          </span>
        </div>

        {/* View Mode Selector Tabs (Matching Section 1's Button Styling) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveView('stage')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeView === 'stage' ? '#5eead4' : 'rgba(255, 255, 255, 0.15)',
              background: activeView === 'stage' ? 'rgba(94, 234, 212, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: activeView === 'stage' ? '#5eead4' : '#8d99ae',
              transition: 'all 0.2s',
            }}
          >
            STAGE DEPTHS h(t)
          </button>
          <button
            type="button"
            onClick={() => setActiveView('outflow')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeView === 'outflow' ? '#ef4444' : 'rgba(255, 255, 255, 0.15)',
              background: activeView === 'outflow' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: activeView === 'outflow' ? '#f87171' : '#8d99ae',
              transition: 'all 0.2s',
            }}
          >
            BREACH OUTFLOW Q(t)
          </button>
          <button
            type="button"
            onClick={() => setActiveView('composite')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeView === 'composite' ? '#38bdf8' : 'rgba(255, 255, 255, 0.15)',
              background: activeView === 'composite' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: activeView === 'composite' ? '#38bdf8' : '#8d99ae',
              transition: 'all 0.2s',
            }}
          >
            DUAL COMPOSITE
          </button>
          {onInspectPlot && (
            <button
              type="button"
              onClick={onInspectPlot}
              style={{
                padding: '6px 14px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 700,
                borderRadius: '6px',
                cursor: 'pointer',
                border: '1px solid rgba(63, 168, 155, 0.4)',
                background: 'rgba(63, 168, 155, 0.15)',
                color: '#81e6d9',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Inspect publication-quality matplotlib plot"
            >
              <span>CARTOGRAPHIC PNG ↗</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. STAGE DEPTHS h(t) VIEW (Crystal-Clear Inundation Depth Graph) */}
      {activeView === 'stage' && (
        <div>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stageData} margin={{ top: 16, right: 30, left: 10, bottom: 25 }}>
                <defs>
                  <linearGradient id="damToeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="morbiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" />

                {/* Linear Continuous Numeric X-Axis */}
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[0, 24]}
                  ticks={X_TICKS}
                  tickFormatter={(v) => `T+${v}h`}
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }}
                  label={{
                    value: 'Time from Failure Initiation [hours]',
                    position: 'insideBottom',
                    offset: -16,
                    fill: '#8d99ae',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                  }}
                />

                {/* Clean Y-Axis for Depth */}
                <YAxis
                  stroke="#38bdf8"
                  tick={{ fontSize: 11, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }}
                  domain={[0, 25]}
                  ticks={[0, 5, 10, 15, 20, 25]}
                  tickFormatter={(v) => `${v} m`}
                  label={{
                    value: 'Inundation Depth [m]',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#38bdf8',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    style: { textAnchor: 'middle' },
                  }}
                />

                <Tooltip content={<StageTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{
                    paddingBottom: '12px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                />

                {/* Reference Line: Historical Morbi Flood Level at 3.0m */}
                <ReferenceLine
                  y={3.0}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  label={{
                    value: 'Historical Morbi Flood Level (~3.0m / 10ft)',
                    fill: '#f1faee',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    position: 'insideBottomLeft',
                  }}
                />

                {/* Reference Line: Morbi Crest Peak at 8.38m */}
                <ReferenceLine
                  y={8.38}
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  label={{
                    value: 'Morbi Peak Stage: 8.38 m',
                    fill: '#fde68a',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    position: 'insideTopRight',
                  }}
                />

                {/* Reference Line: Dam Toe Plunge Pool Peak at 22.56m */}
                <ReferenceLine
                  y={22.56}
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  label={{
                    value: 'Dam Toe Peak: 22.56 m',
                    fill: '#7dd3fc',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    position: 'insideTopLeft',
                  }}
                />

                {/* Vertical Milestone: Wave Arrival @ Morbi (T+1.57h / 94 min) */}
                <ReferenceLine
                  x={1.57}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Wave Arrival @ Morbi (94m)',
                    fill: '#fde68a',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    position: 'insideTopLeft',
                  }}
                />

                {/* Machhu-II Dam Toe Inundation Depth Curve */}
                <Area
                  type="monotone"
                  dataKey="dam_toe"
                  name="Machhu-II Dam Toe (0 km, Peak: 22.56m)"
                  stroke="#38bdf8"
                  strokeWidth={3}
                  fill="url(#damToeGrad)"
                  dot={false}
                  activeDot={{ r: 6, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2 }}
                />

                {/* Morbi City Center Inundation Wave Curve */}
                <Area
                  type="monotone"
                  dataKey="morbi"
                  name="Morbi City Center (7.5 km, Peak: 8.38m)"
                  stroke="#f59e0b"
                  strokeWidth={3.5}
                  fill="url(#morbiGrad)"
                  dot={false}
                  activeDot={{ r: 6, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '10.5px',
              fontFamily: 'var(--font-mono, monospace)',
              color: '#64748b',
              marginTop: '6px',
              padding: '0 8px',
            }}
          >
            <span>* Lilapar / Dhuva (15 km) &amp; Malia Miyana (28 km): Outside 24h inundation extent due to elevated natural terrain (&gt;52m MSL).</span>
            <span>Terrain Datum: Dam Toe 51.5m · Morbi 54.2m · Lilapar 58.1m MSL</span>
          </div>
        </div>
      )}

      {/* 3. BREACH OUTFLOW Q(t) VIEW */}
      {activeView === 'outflow' && (
        <div>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stageData} margin={{ top: 16, right: 30, left: 10, bottom: 25 }}>
                <defs>
                  <linearGradient id="morbiOutflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" />

                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[0, 24]}
                  ticks={X_TICKS}
                  tickFormatter={(v) => `T+${v}h`}
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }}
                  label={{
                    value: 'Time from Failure Initiation [hours]',
                    position: 'insideBottom',
                    offset: -16,
                    fill: '#8d99ae',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                  }}
                />

                <YAxis
                  stroke="#ef4444"
                  tick={{ fontSize: 11, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }}
                  domain={[0, 7500]}
                  ticks={[0, 1500, 3000, 4500, 6000, 7500]}
                  tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                  label={{
                    value: 'Discharge Q [m³/s]',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#f87171',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    style: { textAnchor: 'middle' },
                  }}
                />

                <Tooltip content={<StageTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{
                    paddingBottom: '12px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                />

                <ReferenceLine
                  y={6647}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Froehlich Peak Outflow: 6,647 m³/s',
                    fill: '#fca5a5',
                    fontSize: 10.5,
                    fontFamily: 'var(--font-mono)',
                    position: 'insideTopRight',
                  }}
                />

                <ReferenceLine
                  x={2.5}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Breach Formation Peak (T+2.5h)',
                    fill: '#fcd34d',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    position: 'insideTopLeft',
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="q_total"
                  name="Total Hydrodynamic Outflow Q"
                  stroke="#ef4444"
                  strokeWidth={3}
                  fill="url(#morbiOutflowGrad)"
                  dot={false}
                  activeDot={{ r: 6, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
                />

                <Line
                  type="monotone"
                  dataKey="q_breach"
                  name="Froehlich Breach Outflow Q_breach"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. DUAL COMPOSITE (STAGE + DISCHARGE) SYNCHRONIZED TIMELINE */}
      {activeView === 'composite' && (
        <div>
          <div style={{ width: '100%', height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stageData} margin={{ top: 16, right: 35, left: 10, bottom: 25 }}>
                <defs>
                  <linearGradient id="compOutflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" />

                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[0, 24]}
                  ticks={X_TICKS}
                  tickFormatter={(v) => `T+${v}h`}
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }}
                  label={{
                    value: 'Time from Failure Initiation [hours]',
                    position: 'insideBottom',
                    offset: -16,
                    fill: '#8d99ae',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                  }}
                />

                {/* Left Y Axis: Discharge */}
                <YAxis
                  yAxisId="left"
                  stroke="#ef4444"
                  tick={{ fontSize: 10.5, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }}
                  domain={[0, 7500]}
                  ticks={[0, 1500, 3000, 4500, 6000, 7500]}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  label={{
                    value: 'Discharge Q [m³/s]',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#f87171',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    style: { textAnchor: 'middle' },
                  }}
                />

                {/* Right Y Axis: Stage Depth */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#38bdf8"
                  tick={{ fontSize: 10.5, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }}
                  domain={[0, 25]}
                  ticks={[0, 5, 10, 15, 20, 25]}
                  tickFormatter={(v) => `${v}m`}
                  label={{
                    value: 'Inundation Depth [m]',
                    angle: 90,
                    position: 'insideRight',
                    fill: '#38bdf8',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    style: { textAnchor: 'middle' },
                  }}
                />

                <Tooltip content={<StageTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{
                    paddingBottom: '12px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                />

                {/* Reference Lines */}
                <ReferenceLine
                  yAxisId="left"
                  y={6647}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Peak Q: 6,647 m³/s',
                    fill: '#fca5a5',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    position: 'insideTopLeft',
                  }}
                />

                <ReferenceLine
                  yAxisId="right"
                  y={8.38}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Morbi Peak: 8.38m',
                    fill: '#fde68a',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    position: 'insideTopRight',
                  }}
                />

                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="q_total"
                  name="Total Outflow Q (m³/s)"
                  stroke="#ef4444"
                  strokeWidth={2.8}
                  fill="url(#compOutflowGrad)"
                  dot={false}
                />

                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="dam_toe"
                  name="Dam Toe Depth (m)"
                  stroke="#38bdf8"
                  strokeWidth={2.8}
                  dot={false}
                />

                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="morbi"
                  name="Morbi City Depth (m)"
                  stroke="#f59e0b"
                  strokeWidth={3.2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 5. Bottom Footer KPI Summary Strip (Exact Match to Section 1 Checklist) */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(63, 168, 155, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '11px',
          fontFamily: 'var(--font-mono, monospace)',
          color: '#8d99ae',
        }}
      >
        <span>
          ✓ Peak Breach Outflow: <strong style={{ color: '#f87171' }}>6,647 m³/s</strong> (t=2.50h)
        </span>
        <span>
          ✓ Dam Toe Max Plunge: <strong style={{ color: '#38bdf8' }}>22.56 m</strong> (Arrival T+0.07h)
        </span>
        <span>
          ✓ Morbi Peak Flood Stage: <strong style={{ color: '#fbbf24' }}>8.38 m</strong> (&gt;3.0m Historical)
        </span>
        <span>
          ✓ Historical Calibration Error: <strong style={{ color: '#34d399' }}>3.61%</strong> (Pass ✓)
        </span>
      </div>
    </div>
  );
}
