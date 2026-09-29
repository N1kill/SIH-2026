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
import damageData from '../data/outputs/damage_assessment.json';

const SECTOR_DATA = [
  {
    sector: 'Residential Housing',
    shortName: 'Residential',
    loss_cr: 2346.7,
    percent: 64.7,
    color: '#ef4444',
    structures: '28,920 housing units',
    desc: 'Single & multi-family masonry/concrete dwellings destroyed or severely scoured by the 8.38m wave',
  },
  {
    sector: 'Commercial / Industrial',
    shortName: 'Commercial',
    loss_cr: 1048.72,
    percent: 28.9,
    color: '#2dd4bf',
    structures: '12,918 factories & shops',
    desc: 'Ceramic tile manufacturing clusters, machinery inundation, and central marketplace inventory loss',
  },
  {
    sector: 'Infrastructure & Transport',
    shortName: 'Infrastructure',
    loss_cr: 201.66,
    percent: 5.6,
    color: '#38bdf8',
    structures: '394.8 km roads · 6 bridges',
    desc: 'Morbi causeway & railway bridge scour, electrical substation flooding, and water supply severance',
  },
  {
    sector: 'Agriculture & Crops',
    shortName: 'Agriculture',
    loss_cr: 32.06,
    percent: 0.9,
    color: '#f59e0b',
    structures: '4,274.7 hectares',
    desc: 'Standing cotton, groundnut, and millet crop deposits under heavy alluvial mud and gravel silt',
  },
];

const POPULATION_DATA = [
  {
    category: 'Low (<0.5m)',
    shortCategory: 'Low Risk',
    population: 20537,
    percent: 9.6,
    color: '#34d399',
    depth: '< 0.5 m',
    threat: 'Basement and floor flooding; pedestrian wading feasible; minimal structural threat',
  },
  {
    category: 'Moderate (0.5–1.5m)',
    shortCategory: 'Moderate',
    population: 32702,
    percent: 15.2,
    color: '#facc15',
    depth: '0.5 – 1.5 m',
    threat: 'Ground floor submerged; vehicles floating; evacuation requires boats or high ground',
  },
  {
    category: 'High (1.5–3.0m)',
    shortCategory: 'High Threat',
    population: 42806,
    percent: 19.9,
    color: '#fb923c',
    depth: '1.5 – 3.0 m',
    threat: 'Severe structural scour; escape on foot impossible; upper storey retreat required',
  },
  {
    category: 'Extreme (>3.0m)',
    shortCategory: 'Extreme Threat',
    population: 118514,
    percent: 55.2,
    color: '#ef4444',
    depth: '> 3.0 m',
    threat: 'Immediate danger to life; roof submergence; 12 m/s hydraulic wave kinetic destruction',
  },
];

const HAZARD_AREAS = [
  { level: 'Low (<0.5m)', area_km2: 45.64, percent: 37.0, color: '#34d399' },
  { level: 'Moderate (0.5–1.5m)', area_km2: 20.12, percent: 16.3, color: '#facc15' },
  { level: 'High (1.5–3.0m)', area_km2: 15.29, percent: 12.4, color: '#fb923c' },
  { level: 'Extreme (>3.0m)', area_km2: 42.33, percent: 34.3, color: '#ef4444' },
];

/**
 * Custom Tooltip for Sector Loss
 */
function SectorLossTooltip({ active, payload }) {
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
        minWidth: '260px',
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
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{data.sector.toUpperCase()}</span>
        <span>{data.percent}% OF TOTAL</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f1faee', marginBottom: '4px' }}>
        <span>Economic Loss:</span>
        <strong style={{ color: data.color, fontSize: '13px' }}>₹{data.loss_cr.toLocaleString()} Crores</strong>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8d99ae', marginBottom: '6px' }}>
        <span>Exposed Inventory:</span>
        <span style={{ color: '#5eead4', fontWeight: 600 }}>{data.structures}</span>
      </div>

      <div
        style={{
          marginTop: '6px',
          paddingTop: '6px',
          borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
          color: '#cbd5e1',
          fontSize: '10.5px',
          lineHeight: '1.4',
        }}
      >
        {data.desc}
      </div>
    </div>
  );
}

/**
 * Custom Tooltip for Population Exposure
 */
function PopulationTooltip({ active, payload }) {
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
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{data.category.toUpperCase()}</span>
        <span>{data.percent}% OF TOTAL</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f1faee', marginBottom: '4px' }}>
        <span>Exposed Population:</span>
        <strong style={{ color: data.color, fontSize: '13px' }}>{data.population.toLocaleString()} Persons</strong>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8d99ae', marginBottom: '6px' }}>
        <span>Inundation Depth Tier:</span>
        <span style={{ color: '#5eead4', fontWeight: 600 }}>{data.depth}</span>
      </div>

      <div
        style={{
          marginTop: '6px',
          paddingTop: '6px',
          borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
          color: '#cbd5e1',
          fontSize: '10.5px',
          lineHeight: '1.4',
        }}
      >
        <span style={{ color: data.color, fontWeight: 700 }}>Risk: </span>
        {data.threat}
      </div>
    </div>
  );
}

/**
 * InteractiveDamageAnalytics — Recharts Engine for Section 5
 * Matches Section 1 and Section 4 in design, aesthetics, typography, and controls.
 */
export default function InteractiveDamageAnalytics({ onInspectPlot }) {
  const [activeView, setActiveView] = useState('sector'); // 'sector' | 'population' | 'dual'

  return (
    <div
      className="interactive-hydrograph-container"
      style={{
        background: 'linear-gradient(180deg, rgba(8, 16, 24, 0.95) 0%, rgba(5, 10, 16, 0.98) 100%)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
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
                backgroundColor: '#ef4444',
                boxShadow: '0 0 10px #ef4444',
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
              MULTI-SECTOR DAMAGE &amp; EXPOSURE ANALYTICS
            </h4>
          </div>
          <span
            style={{
              fontSize: '11px',
              color: '#8d99ae',
              fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            NDMA / USACE Depth-Damage Vulnerability Functions · Total Loss: ₹3,629.14 Crores · 214,559 Persons Exposed
          </span>
        </div>

        {/* View Mode Selector Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveView('sector')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeView === 'sector' ? '#ef4444' : 'rgba(255, 255, 255, 0.15)',
              background: activeView === 'sector' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: activeView === 'sector' ? '#f87171' : '#8d99ae',
              transition: 'all 0.2s',
            }}
          >
            SECTOR DAMAGE (₹ CR)
          </button>
          <button
            type="button"
            onClick={() => setActiveView('population')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeView === 'population' ? '#fb923c' : 'rgba(255, 255, 255, 0.15)',
              background: activeView === 'population' ? 'rgba(251, 146, 60, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: activeView === 'population' ? '#fdba74' : '#8d99ae',
              transition: 'all 0.2s',
            }}
          >
            POPULATION EXPOSURE
          </button>
          <button
            type="button"
            onClick={() => setActiveView('dual')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeView === 'dual' ? '#5eead4' : 'rgba(255, 255, 255, 0.15)',
              background: activeView === 'dual' ? 'rgba(94, 234, 212, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: activeView === 'dual' ? '#5eead4' : '#8d99ae',
              transition: 'all 0.2s',
            }}
          >
            DUAL OVERVIEW
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
                border: '1px solid rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#fca5a5',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Inspect publication-quality matplotlib damage cadastre plot"
            >
              <span>CARTOGRAPHIC PNG ↗</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. SECTOR LOSS VIEW: Horizontal / Vertical Bar Chart */}
      {activeView === 'sector' && (
        <div>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={SECTOR_DATA}
                margin={{ top: 16, right: 30, left: 20, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" />
                <XAxis
                  dataKey="shortName"
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }}
                />
                <YAxis
                  stroke="#ef4444"
                  tick={{ fontSize: 11, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }}
                  domain={[0, 2600]}
                  ticks={[0, 500, 1000, 1500, 2000, 2500]}
                  tickFormatter={(v) => `₹${v} Cr`}
                  label={{
                    value: 'Economic Loss [₹ Crores]',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#f87171',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    style: { textAnchor: 'middle' },
                  }}
                />
                <Tooltip content={<SectorLossTooltip />} />
                <ReferenceLine
                  y={2346.7}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Residential Peak: ₹2,346.7 Cr (64.7%)',
                    fill: '#fca5a5',
                    fontSize: 10.5,
                    fontFamily: 'var(--font-mono)',
                    position: 'insideTopRight',
                  }}
                />
                <Bar
                  dataKey="loss_cr"
                  name="Estimated Economic Loss (₹ Cr)"
                  radius={[6, 6, 0, 0]}
                  animationDuration={1200}
                >
                  {SECTOR_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Sector Breakdown Badges */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '10px',
              marginTop: '12px',
            }}
          >
            {SECTOR_DATA.map((s, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${s.color}40`,
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '11px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: s.color, fontWeight: 700 }}>
                  <span>{s.shortName}</span>
                  <span>{s.percent}%</span>
                </div>
                <div style={{ color: '#f1faee', fontSize: '13px', fontWeight: 700, margin: '2px 0' }}>
                  ₹{s.loss_cr.toLocaleString()} Cr
                </div>
                <div style={{ color: '#8d99ae', fontSize: '10px' }}>{s.structures}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. POPULATION EXPOSURE VIEW */}
      {activeView === 'population' && (
        <div>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={POPULATION_DATA}
                margin={{ top: 16, right: 30, left: 20, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" />
                <XAxis
                  dataKey="category"
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }}
                />
                <YAxis
                  stroke="#fb923c"
                  tick={{ fontSize: 11, fill: '#8d99ae', fontFamily: 'var(--font-mono)' }}
                  domain={[0, 130000]}
                  ticks={[0, 25000, 50000, 75000, 100000, 125000]}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  label={{
                    value: 'Exposed Population [Persons]',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#fdba74',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    style: { textAnchor: 'middle' },
                  }}
                />
                <Tooltip content={<PopulationTooltip />} />
                <ReferenceLine
                  y={118514}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Extreme Danger to Life: 118,514 Persons (55.2%)',
                    fill: '#fca5a5',
                    fontSize: 10.5,
                    fontFamily: 'var(--font-mono)',
                    position: 'insideTopLeft',
                  }}
                />
                <Bar
                  dataKey="population"
                  name="Exposed Population"
                  radius={[6, 6, 0, 0]}
                  animationDuration={1200}
                >
                  {POPULATION_DATA.map((entry, index) => (
                    <Cell key={`pop-cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Risk Tier Badges */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '10px',
              marginTop: '12px',
            }}
          >
            {POPULATION_DATA.map((p, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${p.color}40`,
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '11px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: p.color, fontWeight: 700 }}>
                  <span>{p.shortCategory}</span>
                  <span>{p.percent}%</span>
                </div>
                <div style={{ color: '#f1faee', fontSize: '13px', fontWeight: 700, margin: '2px 0' }}>
                  {p.population.toLocaleString()} Persons
                </div>
                <div style={{ color: '#8d99ae', fontSize: '10px' }}>Depth: {p.depth}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. DUAL OVERVIEW (SECTOR LOSS + POPULATION RISK COMBINED) */}
      {activeView === 'dual' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          {/* Left: Sector Breakdown */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#f87171',
                fontFamily: 'var(--font-mono, monospace)',
                marginBottom: '12px',
              }}
            >
              ECONOMIC DAMAGE DISTRIBUTION (₹3,629.14 CR)
            </div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SECTOR_DATA} layout="vertical" margin={{ top: 5, right: 25, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
                  <XAxis type="number" stroke="#64748b" tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 10, fill: '#8d99ae' }} />
                  <YAxis type="category" dataKey="shortName" stroke="#64748b" tick={{ fontSize: 10, fill: '#8d99ae' }} width={85} />
                  <Tooltip content={<SectorLossTooltip />} />
                  <Bar dataKey="loss_cr" radius={[0, 4, 4, 0]}>
                    {SECTOR_DATA.map((entry, index) => (
                      <Cell key={`dual-sec-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Population Exposure */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#fdba74',
                fontFamily: 'var(--font-mono, monospace)',
                marginBottom: '12px',
              }}
            >
              POPULATION RISK BY DEPTH TIER (214,559 TOTAL)
            </div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={POPULATION_DATA} layout="vertical" margin={{ top: 5, right: 25, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
                  <XAxis type="number" stroke="#64748b" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#8d99ae' }} />
                  <YAxis type="category" dataKey="shortCategory" stroke="#64748b" tick={{ fontSize: 10, fill: '#8d99ae' }} width={85} />
                  <Tooltip content={<PopulationTooltip />} />
                  <Bar dataKey="population" radius={[0, 4, 4, 0]}>
                    {POPULATION_DATA.map((entry, index) => (
                      <Cell key={`dual-pop-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 5. Bottom Footer KPI Summary Strip (Exact Match to Section 1 & Section 4) */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(239, 68, 68, 0.2)',
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
          ✓ Total Economic Devastation: <strong style={{ color: '#ef4444' }}>₹3,629.14 Crores</strong>
        </span>
        <span>
          ✓ Dominant Sector: <strong style={{ color: '#f87171' }}>Residential Housing (64.7%)</strong>
        </span>
        <span>
          ✓ Severe Life Threat (&gt;3m): <strong style={{ color: '#fb923c' }}>118,514 Persons (55.2%)</strong>
        </span>
        <span>
          ✓ Transport Cutoff: <strong style={{ color: '#38bdf8' }}>394.8 km Roads · 6 Bridges</strong>
        </span>
      </div>
    </div>
  );
}
