import React from 'react';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import type { BreachParameters } from '../../types/simulation';

interface BreachParametersCardProps {
  params: BreachParameters;
  onChange: (newParams: Partial<BreachParameters>) => void;
}

const types: Array<{ value: BreachParameters['type']; label: string }> = [
  { value: 'crack', label: 'Minor cracks' },
  { value: 'partial', label: 'Gate hole' },
  { value: 'full', label: 'Gate failure' },
];

interface RangeControlProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}

const RangeControl: React.FC<RangeControlProps> = ({
  id, label, value, min, max, step, display, onChange,
}) => {
  const percentage = Math.max(0, Math.min(100, (value - min) / (max - min) * 100));
  return (
    <div className="param-control">
      <div className="param-label-row">
        <label className="param-name" htmlFor={id}>{label}</label>
        <output className="param-val" htmlFor={id}>{display}</output>
      </div>
      <input
        id={id}
        type="range"
        className="hud-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--slider-pct': `${percentage}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
};

export const BreachParametersCard: React.FC<BreachParametersCardProps> = ({ params, onChange }) => {
  const selectType = (type: BreachParameters['type']) => {
    onChange({ type });
  };

  return (
    <section className="breach-params-card" aria-labelledby="breach-controls-title">
      <div className="card-header compact-card-header">
        <div>
          <span className="panel-eyebrow">SCENARIO CONTROL</span>
          <h2 className="card-title" id="breach-controls-title">Dam condition</h2>
        </div>
      </div>

      <div className="state-switch" role="group" aria-label="Dam condition">
        <button
          type="button"
          className={params.state === 'intact' ? 'active intact' : ''}
          aria-pressed={params.state === 'intact'}
          onClick={() => onChange({ state: 'intact' })}
        >
          <ShieldCheck size={15} aria-hidden="true" /> Intact
        </button>
        <button
          type="button"
          className={params.state === 'breached' ? 'active breached' : ''}
          aria-pressed={params.state === 'breached'}
          onClick={() => onChange({ state: 'breached' })}
        >
          <TriangleAlert size={15} aria-hidden="true" /> Breached
        </button>
      </div>

      <div className={`breach-controls-body ${params.state === 'intact' ? 'is-disabled' : ''}`}>
        <fieldset disabled={params.state === 'intact'}>
          <legend>Breach type</legend>
          <div className="breach-type-switch">
            {types.map((item) => (
              <button
                key={item.value}
                type="button"
                className={params.type === item.value ? 'active' : ''}
                aria-pressed={params.type === item.value}
                onClick={() => selectType(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="breach-location-note">
            Failures apply only to the numbered spillway gates. Both earthfill embankments remain intact.
          </p>

          <RangeControl
            id="breach-position"
            label="Affected gate"
            min={1}
            max={18}
            step={1}
            value={params.gateIndex}
            display={`Gate ${params.gateIndex} of 18`}
            onChange={(gateIndex) => onChange({
              gateIndex,
              failedGateCount: Math.min(params.failedGateCount, 19 - gateIndex),
            })}
          />

          {params.type === 'crack' && (
            <>
              <RangeControl
                id="crack-size"
                label="Crack spread"
                min={0.25}
                max={8}
                step={0.05}
                value={params.crackSizeM}
                display={`${params.crackSizeM.toFixed(2)} m`}
                onChange={(crackSizeM) => onChange({ crackSizeM })}
              />
              <RangeControl
                id="leak-opening"
                label="Mean crack opening"
                min={1}
                max={50}
                step={1}
                value={params.leakOpeningMm}
                display={`${Math.round(params.leakOpeningMm)} mm`}
                onChange={(leakOpeningMm) => onChange({ leakOpeningMm })}
              />
            </>
          )}

          {params.type === 'partial' && (
            <>
              <RangeControl
                id="hole-width"
                label="Hole width"
                min={0.5}
                max={14}
                step={0.1}
                value={params.holeWidthM}
                display={`${params.holeWidthM.toFixed(1)} m`}
                onChange={(holeWidthM) => onChange({ holeWidthM })}
              />
              <RangeControl
                id="hole-height"
                label="Hole height"
                min={0.5}
                max={18}
                step={0.1}
                value={params.holeHeightM}
                display={`${params.holeHeightM.toFixed(1)} m`}
                onChange={(holeHeightM) => onChange({ holeHeightM })}
              />
            </>
          )}

          {params.type === 'full' && (
            <RangeControl
              id="failed-gates"
              label="Consecutive gates failed"
              min={1}
              max={19 - params.gateIndex}
              step={1}
              value={Math.min(params.failedGateCount, 19 - params.gateIndex)}
              display={`${Math.min(params.failedGateCount, 19 - params.gateIndex)} gate${params.failedGateCount === 1 ? '' : 's'}`}
              onChange={(failedGateCount) => onChange({ failedGateCount })}
            />
          )}

          <details className="advanced-breach-controls">
            <summary>Hydraulic timing and limit</summary>
            <RangeControl
              id="formation-time"
              label="Formation time"
              min={0.05}
              max={12}
              step={0.05}
              value={params.formationTimeHours}
              display={`${params.formationTimeHours.toFixed(2)} h`}
              onChange={(formationTimeHours) => onChange({ formationTimeHours })}
            />
            <RangeControl
              id="peak-discharge"
              label="Discharge limit"
              min={0}
              max={15000}
              step={25}
              value={params.peakDischarge}
              display={`${Math.round(params.peakDischarge).toLocaleString()} m³/s`}
              onChange={(peakDischarge) => onChange({ peakDischarge })}
            />
          </details>
        </fieldset>
      </div>

      {params.state === 'intact' && (
        <p className="intact-helper">Breach geometry is retained but inactive. Select Breached to preview it.</p>
      )}
    </section>
  );
};
