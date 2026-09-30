import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
} from 'recharts';
import validationReport from '../data/outputs/validation_report.json';

const SCENARIOS_DATA = [
  {
    id: 'extreme_minus50',
    name: '-50% Choke',
    fullName: '-50% Controlled Choke Scenario',
    Q_p: 3324,
    morbi_depth: 3.51,
    inund_area: 42.9,
    width_m: 78.0,
    time_hr: 4.0,
    color: '#06d6a0',
    description: 'Narrow erosion channel with slower headcut rate; maximum mitigation benchmark',
  },
  {
    id: 'width_minus25',
    name: '-25% Width',
    fullName: '-25% Breach Width Scenario',
    Q_p: 4985,
    morbi_depth: 4.93,
    inund_area: 58.6,
    width_m: 117.0,
    time_hr: 3.12,
    color: '#38bdf8',
    description: 'Conservative embankment failure model under partial spillway gate relief',
  },
  {
    id: 'base',
    name: 'Base Case',
    fullName: 'Base Physical Case (Froehlich 2008)',
    Q_p: 6647,
    morbi_depth: 6.32,
    inund_area: 71.5,
    width_m: 156.0,
    time_hr: 2.5,
    color: '#fbbf24',
    description: 'Calibrated historical baseline matching Machhu-II actual embankment geometry',
  },
  {
    id: 'width_plus25',
    name: '+25% Width',
    fullName: '+25% Breach Width Scenario',
    Q_p: 8309,
    morbi_depth: 7.58,
    inund_area: 84.4,
    width_m: 195.0,
    time_hr: 2.0,
    color: '#fb923c',
    description: 'Rapid lateral erosion with compromised earthen flank abutments',
  },
  {
    id: 'extreme_plus50',
    name: '+50% Overtopping',
    fullName: '+50% Extreme Overtopping Deluge',
    Q_p: 10500,
    morbi_depth: 9.16,
    inund_area: 100.1,
    width_m: 234.0,
    time_hr: 1.5,
    color: '#ef4444',
    description: 'Maximum credible disaster envelope with instantaneous cascade of both flanks',
  },
];

const ACCURACY_METRICS = [
  { metric: 'Critical Success Index (CSI)', value: 84.35, target: 70.0, unit: '%', status: 'PASS ✓', color: '#5eead4' },
  { metric: 'F1-Score (Harmonic Mean)', value: 91.51, target: 80.0, unit: '%', status: 'PASS ✓', color: '#38bdf8' },
  { metric: 'Hit Rate / Recall (Sensitivity)', value: 97.74, target: 85.0, unit: '%', status: 'PASS ✓', color: '#34d399' },
  { metric: 'Overall Contingency Accuracy', value: 99.91, target: 95.0, unit: '%', status: 'PASS ✓', color: '#a78bfa' },
  { metric: 'Historical Morbi Depth Error', value: 3.61, target: 10.0, unit: '%', status: 'PASS ✓ (Low Error)', color: '#10b981' },
];

function ScenarioTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div
      style={{
        background: '#091316',
        border: `1.5px solid ${data.color}`,
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.9)',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '11px',
        minWidth: '270px',
      }}
    >
      <div
        style={{
          color: data.color,
          fontWeight: 700,
          fontSize: '12px',
          marginBottom: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          paddingBottom: '5px',
        }}
      >
        {data.fullName.toUpperCase()}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f1faee', marginBottom: '4px' }}>
        <span>Peak Breach Discharge Q_p:</span>
        <strong style={{ color: data.color, fontSize: '13px' }}>{data.Q_p.toLocaleString()} m³/s</strong>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8d99ae', marginBottom: '4px' }}>
        <span>Morbi Flood Stage Depth:</span>
        <span style={{ color: '#5eead4', fontWeight: 700 }}>{data.morbi_depth.toFixed(2)} m</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8d99ae', marginBottom: '4px' }}>
        <span>Inundation Footprint:</span>
        <span style={{ color: '#fbbf24', fontWeight: 700 }}>{data.inund_area.toFixed(1)} km²</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8d99ae', marginBottom: '6px' }}>
        <span>Breach Width / Formation:</span>
        <span>{data.width_m}m / {data.time_hr}h</span>
      </div>

      <div
        style={{
          marginTop: '6px',
          paddingTop: '6px',
          borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
          color: '#cbd5e1',
          fontSize: '10px',
          lineHeight: '1.4',
        }}
      >
        {data.description}
      </div>
    </div>
  );
}

export default function InteractiveSensitivityScenarios({ onInspectPlot }) {
  const [activeTab, setActiveTab] = useState('discharge'); // 'discharge' | 'depth' | 'accuracy'

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
      {/* 1. Header Bar with Indicator and Controls */}
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
              SENSITIVITY &amp; ACCURACY MATRIX
            </h4>
          </div>
          <span
            style={{
              fontSize: '11px',
              color: '#8d99ae',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            Multi-Scenario Parametric Uncertainty Bounds (3,324 to 10,500 m³/s) · CSI = 84.35% Orbital Validation
          </span>
        </div>

        {/* View Mode Selector Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('discharge')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeTab === 'discharge' ? '#5eead4' : 'rgba(255, 255, 255, 0.15)',
              background: activeTab === 'discharge' ? 'rgba(94, 234, 212, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: activeTab === 'discharge' ? '#5eead4' : '#8d99ae',
              transition: 'all 0.2s',
            }}
          >
            PEAK DISCHARGE Q_p
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('depth')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeTab === 'depth' ? '#fb923c' : 'rgba(255, 255, 255, 0.15)',
              background: activeTab === 'depth' ? 'rgba(251, 146, 60, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: activeTab === 'depth' ? '#fdba74' : '#8d99ae',
              transition: 'all 0.2s',
            }}
          >
            MORBI STAGE DEPTH
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('accuracy')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeTab === 'accuracy' ? '#a78bfa' : 'rgba(255, 255, 255, 0.15)',
              background: activeTab === 'accuracy' ? 'rgba(167, 139, 250, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: activeTab === 'accuracy' ? '#c4b5fd' : '#8d99ae',
              transition: 'all 0.2s',
            }}
          >
            ACCURACY SCORECARD
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
              title="Inspect publication plot"
            >
              <span>CARTOGRAPHIC PNG ↗</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. DISCHARGE VIEW */}
      {activeTab === 'discharge' && (
        <div>
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SCENARIOS_DATA} margin={{ top: 16, right: 30, left: 15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }} />
                <YAxis
                  stroke="#5eead4"
                  tick={{ fontSize: 11, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }}
                  domain={[0, 12000]}
                  ticks={[0, 2000, 4000, 6000, 8000, 10000, 12000]}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k m³/s`}
                  label={{
                    value: 'Peak Breach Outflow Q_p [m³/s]',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#5eead4',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    style: { textAnchor: 'middle' },
                  }}
                />
                <Tooltip content={<ScenarioTooltip />} />
                <ReferenceLine
                  y={6647}
                  stroke="#fbbf24"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Base Case Peak: 6,647 m³/s',
                    fill: '#fde68a',
                    fontSize: 10.5,
                    fontFamily: 'var(--font-mono)',
                    position: 'insideTopLeft',
                  }}
                />
                <Bar dataKey="Q_p" name="Peak Discharge Q_p" radius={[6, 6, 0, 0]}>
                  {SCENARIOS_DATA.map((entry, index) => (
                    <Cell key={`sc-cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 3. MORBI STAGE DEPTH VIEW */}
      {activeTab === 'depth' && (
        <div>
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SCENARIOS_DATA} margin={{ top: 16, right: 30, left: 15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }} />
                <YAxis
                  stroke="#fb923c"
                  tick={{ fontSize: 11, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }}
                  domain={[0, 12]}
                  ticks={[0, 2, 4, 6, 8, 10, 12]}
                  tickFormatter={(v) => `${v}m`}
                  label={{
                    value: 'Morbi City Flood Depth [m]',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#fdba74',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    style: { textAnchor: 'middle' },
                  }}
                />
                <Tooltip content={<ScenarioTooltip />} />
                <ReferenceLine
                  y={6.1}
                  stroke="#cbd5e1"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: '1979 Historical Benchmark (~6.1m)',
                    fill: '#f1faee',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    position: 'insideTopLeft',
                  }}
                />
                <Bar dataKey="morbi_depth" name="Morbi Peak Stage Depth" radius={[6, 6, 0, 0]}>
                  {SCENARIOS_DATA.map((entry, index) => (
                    <Cell key={`depth-cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. ACCURACY METRICS VIEW */}
      {activeTab === 'accuracy' && (
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {ACCURACY_METRICS.map((m, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${m.color}40`,
                  borderRadius: '8px',
                  padding: '14px 16px',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                <div style={{ color: '#8d99ae', fontSize: '11px', marginBottom: '4px' }}>{m.metric.toUpperCase()}</div>
                <div style={{ color: m.color, fontSize: '22px', fontWeight: 800, margin: '4px 0' }}>
                  {m.value}{m.unit}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#cbd5e1' }}>
                  <span>Benchmark Target: {m.target}{m.unit}</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>{m.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Bottom Checklist Strip */}
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
          ✓ Critical Success Index: <strong style={{ color: '#5eead4' }}>84.35% (0.8435)</strong>
        </span>
        <span>
          ✓ F1-Score: <strong style={{ color: '#38bdf8' }}>0.9151 (Pass ✓)</strong>
        </span>
        <span>
          ✓ Historical Ground-Truth Error: <strong style={{ color: '#34d399' }}>3.61%</strong>
        </span>
        <span>
          ✓ Sensitivity Stability Envelope: <strong style={{ color: '#fbbf24' }}>3,324 – 10,500 m³/s</strong>
        </span>
      </div>
    </div>
  );
}
