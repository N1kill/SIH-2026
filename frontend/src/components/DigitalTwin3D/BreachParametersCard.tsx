import React from 'react';
import type { BreachParameters } from '../../types/simulation';

interface BreachParametersCardProps {
  params: BreachParameters;
  onChange: (newParams: Partial<BreachParameters>) => void;
}

export const BreachParametersCard: React.FC<BreachParametersCardProps> = ({
  params,
  onChange,
}) => {
  const widthPct = Math.max(0, Math.min(100, ((params.breachWidth - 50) / (300 - 50)) * 100));
  const qPct = Math.max(0, Math.min(100, ((params.peakDischarge - 2000) / (10000 - 2000)) * 100));
  const hPct = Math.max(0, Math.min(100, ((params.damHeight - 10) / (32 - 10)) * 100));

  return (
    <div className="breach-params-card">
      <div className="card-header">
        <div className="card-title">Breach Parameters</div>
      </div>

      {/* Breach Width Slider */}
      <div className="param-control">
        <div className="param-label-row">
          <span className="param-name">Breach Width:</span>
          <span className="param-val">{Math.round(params.breachWidth)}m</span>
        </div>
        <input
          type="range"
          className="hud-slider"
          min={50}
          max={300}
          step={1}
          value={params.breachWidth}
          style={{ '--slider-pct': `${widthPct}%` } as React.CSSProperties}
          onChange={(e) => onChange({ breachWidth: parseFloat(e.target.value) })}
        />
      </div>

      {/* Peak Discharge Slider */}
      <div className="param-control">
        <div className="param-label-row">
          <span className="param-name">Peak Discharge:</span>
          <span className="param-val">
            {Math.round(params.peakDischarge).toLocaleString()} m³/s
          </span>
        </div>
        <input
          type="range"
          className="hud-slider"
          min={2000}
          max={10000}
          step={50}
          value={params.peakDischarge}
          style={{ '--slider-pct': `${qPct}%` } as React.CSSProperties}
          onChange={(e) => onChange({ peakDischarge: parseFloat(e.target.value) })}
        />
      </div>

      {/* Dam Height Slider */}
      <div className="param-control">
        <div className="param-label-row">
          <span className="param-name">Dam Height:</span>
          <span className="param-val">{params.damHeight.toFixed(2)}m</span>
        </div>
        <input
          type="range"
          className="hud-slider"
          min={10}
          max={32}
          step={0.1}
          value={params.damHeight}
          style={{ '--slider-pct': `${hPct}%` } as React.CSSProperties}
          onChange={(e) => onChange({ damHeight: parseFloat(e.target.value) })}
        />
      </div>
    </div>
  );
};
