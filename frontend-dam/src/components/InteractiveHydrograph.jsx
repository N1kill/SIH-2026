import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  Area,
} from 'recharts';
import rawData from '../data/outputs/inflowHydrographData.json';

/**
 * InteractiveHydrograph — Recharts-Powered Hydrograph & Hyetograph Engine
 * Visualizes the 264-hour physically derived SCS-CN inflow hydrograph
 * paired with inverted rainfall hyetograph bars and CWC peak benchmark.
 */
export default function InteractiveHydrograph({ onOpenModal }) {
  const [activeRange, setActiveRange] = useState('all'); // 'all' | 'peak'

  // Format data with readable labels
  const formattedData = useMemo(() => {
    return rawData.map((d) => {
      // Parse '1979-08-13 03:00:00' -> '08-13 03h'
      const parts = d.datetime.split(' ');
      const datePart = parts[0] ? parts[0].slice(5) : '';
      const hourPart = parts[1] ? parts[1].slice(0, 2) + 'h' : '';
      const label = `${datePart} ${hourPart}`;

      return {
        ...d,
        displayDate: label,
      };
    });
  }, []);

  const chartData = useMemo(() => {
    if (activeRange === 'peak') {
      // Focus on Aug 11 to Aug 15 (Hour 140 to 240)
      return formattedData.filter((d) => d.hour >= 140 && d.hour <= 240);
    }
    // Downsample slightly for 'all' (every 2nd point) to keep rendering ultra smooth
    return formattedData.filter((_, idx) => idx % 2 === 0);
  }, [activeRange, formattedData]);

  return (
    <div className="interactive-hydrograph-container" style={{
      background: 'linear-gradient(180deg, rgba(8, 16, 24, 0.95) 0%, rgba(5, 10, 16, 0.98) 100%)',
      border: '1px solid rgba(63, 168, 155, 0.35)',
      borderRadius: '12px',
      padding: '20px 24px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#5eead4',
              boxShadow: '0 0 10px #5eead4',
            }} />
            <h4 style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: '#f1faee',
              fontFamily: 'var(--font-mono, monospace)',
            }}>
              MACHHU-II DAM CATCHMENT INFLOW HYDROGRAPH
            </h4>
          </div>
          <span style={{
            fontSize: '11px',
            color: '#8d99ae',
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            Physical SCS-CN Runoff Model (Area: 2,049.8 km², PRF: 484) · August 5–16, 1979
          </span>
        </div>

        {/* Range Selector & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveRange('all')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeRange === 'all' ? '#5eead4' : 'rgba(255, 255, 255, 0.15)',
              background: activeRange === 'all' ? 'rgba(94, 234, 212, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: activeRange === 'all' ? '#5eead4' : '#8d99ae',
              transition: 'all 0.2s',
            }}
          >
            FULL 11 DAYS
          </button>
          <button
            type="button"
            onClick={() => setActiveRange('peak')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeRange === 'peak' ? '#ef4444' : 'rgba(255, 255, 255, 0.15)',
              background: activeRange === 'peak' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: activeRange === 'peak' ? '#f87171' : '#8d99ae',
              transition: 'all 0.2s',
            }}
          >
            PEAK SURGE (AUG 11–15)
          </button>
          {onOpenModal && (
            <button
              type="button"
              onClick={onOpenModal}
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

      {/* Chart Canvas */}
      <div style={{ width: '100%', height: '340px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />

            {/* X Axis */}
            <XAxis
              dataKey="displayDate"
              stroke="#8d99ae"
              fontSize={10}
              tickLine={false}
              interval={activeRange === 'peak' ? 8 : 12}
              angle={-25}
              textAnchor="end"
              height={45}
            />

            {/* Left Y Axis: Discharge */}
            <YAxis
              yAxisId="left"
              stroke="#ef4444"
              fontSize={10}
              domain={[0, 6500]}
              tickFormatter={(v) => `${v} m³/s`}
              label={{
                value: 'Inflow Discharge (m³/s)',
                angle: -90,
                position: 'insideLeft',
                fill: '#f87171',
                fontSize: 11,
                offset: 0,
              }}
            />

            {/* Right Y Axis: Inverted Rainfall Hyetograph */}
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#10b981"
              fontSize={10}
              domain={[0, 160]}
              reversed={true}
              tickFormatter={(v) => `${v} mm`}
              label={{
                value: 'Hourly Rainfall (mm)',
                angle: 90,
                position: 'insideRight',
                fill: '#34d399',
                fontSize: 11,
                offset: 0,
              }}
            />

            {/* Custom Tooltip */}
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div style={{
                      backgroundColor: 'rgba(5, 12, 20, 0.95)',
                      border: '1px solid rgba(63, 168, 155, 0.6)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.8)',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '11px',
                    }}>
                      <div style={{ color: '#5eead4', fontWeight: 700, marginBottom: '6px' }}>
                        {data.datetime} (Hour {data.hour})
                      </div>
                      <div style={{ color: '#f87171', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span>Inflow Discharge:</span>
                        <strong>{data.inflow_m3s.toLocaleString()} m³/s</strong>
                      </div>
                      <div style={{ color: '#34d399', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span>Rainfall:</span>
                        <strong>{data.rainfall_mm} mm</strong>
                      </div>
                      <div style={{ color: '#60a5fa', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span>Runoff Depth:</span>
                        <strong>{data.runoff_mm} mm</strong>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
            />

            {/* Rainfall Hyetograph Bars */}
            <Bar
              yAxisId="right"
              dataKey="rainfall_mm"
              name="Precipitation (mm)"
              fill="#10b981"
              opacity={0.45}
              barSize={8}
            />

            {/* Inflow Runoff Area/Line */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="inflow_m3s"
              name="Inflow Q (m³/s)"
              stroke="#ef4444"
              strokeWidth={2.5}
              fill="rgba(239, 68, 68, 0.25)"
              dot={false}
              activeDot={{ r: 6, fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2 }}
            />

            {/* Historical CWC Peak Reference Line */}
            <ReferenceLine
              yAxisId="left"
              y={5600}
              stroke="#38bdf8"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: 'Historical CWC Peak Estimate (5,600 m³/s)',
                fill: '#38bdf8',
                fontSize: 10,
                position: 'insideTopLeft',
              }}
            />

            {/* Derived Peak Annotation Line */}
            <ReferenceLine
              yAxisId="left"
              y={3078.3}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{
                value: 'Derived Peak: 3,078.3 m³/s (Hour 195)',
                fill: '#f59e0b',
                fontSize: 10,
                position: 'insideBottomRight',
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Benchmark Notes */}
      <div style={{
        marginTop: '12px',
        paddingTop: '10px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '11px',
        color: '#8d99ae',
        fontFamily: 'var(--font-mono, monospace)',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <span>✓ Derived Peak Inflow: <strong>3,078.3 m³/s</strong> (Aug 13, 03:00)</span>
        <span>✓ Cumulative Catchment Rainfall: <strong>442.8 mm</strong></span>
        <span>✓ Breach Overtopping Trigger: <strong>Continuous Precipitation &gt;180mm/24h</strong></span>
      </div>
    </div>
  );
}
