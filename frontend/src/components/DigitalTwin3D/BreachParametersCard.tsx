import React from 'react';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import type { BreachParameters } from '../../types/simulation';

interface BreachParametersCardProps {
  params: BreachParameters;
  waterLevelMinM: number;
  waterLevelMaxM: number;
  overtoppingLevelM: number;
  waterLevelM: number;
  onChange: (newParams: Partial<BreachParameters>) => void;
}

const types: Array<{ value: BreachParameters['type']; label: string }> = [
  { value: 'earthen', label: 'Earthen breach' },
  { value: 'full', label: 'Gate failure' },
  { value: 'partial', label: 'Gate hole' },
  { value: 'crack', label: 'Minor cracks' },
];

interface RangeControlProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  threshold?: number;
  onChange: (value: number) => void;
}

const RangeControl: React.FC<RangeControlProps> = ({
  id, label, value, min, max, step, display, threshold, onChange,
}) => {
  const percentage = Math.max(0, Math.min(100, (value - min) / (max - min) * 100));
  const thresholdPercentage = threshold === undefined
    ? undefined
    : Math.max(0, Math.min(100, (threshold - min) / (max - min) * 100));
  return (
    <div className="param-control">
      <div className="param-label-row">
        <label className="param-name" htmlFor={id}>{label}</label>
        <output className="param-val" htmlFor={id}>{display}</output>
      </div>
      <div className="range-with-threshold">
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
        {thresholdPercentage !== undefined && (
          <span
            className="water-level-threshold"
            style={{ '--threshold-pct': `${thresholdPercentage}%` } as React.CSSProperties}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
};

export const BreachParametersCard: React.FC<BreachParametersCardProps> = ({
  params, waterLevelMinM, waterLevelMaxM, overtoppingLevelM, waterLevelM, onChange,
}) => {
  const updateWaterLevel = (nextLevel: number) => onChange({
    waterLevelM: nextLevel,
    state: nextLevel > overtoppingLevelM ? 'breached' : 'intact',
    // High water exits through the central spillway gate array, never through a
    // side embankment breach. Gate 9 is the centre gate of the 18-gate model.
    ...(nextLevel > overtoppingLevelM ? { type: 'full' as const, gateIndex: 9, failedGateCount: 1 } : {}),
  });
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

      <RangeControl
        id="reservoir-water-level"
        label="Reservoir water level"
        min={waterLevelMinM}
        max={waterLevelMaxM}
        step={0.05}
        value={waterLevelM}
        display={`${waterLevelM.toFixed(2)} m`}
        threshold={overtoppingLevelM}
        onChange={updateWaterLevel}
      />
      <p className="breach-location-note">
        Yellow mark: dam elevation from the loaded terrain ({overtoppingLevelM.toFixed(2)} m). Above it the scenario breaches and releases downstream; returning to or below it restores the intact state.
      </p>

      <div className={`breach-controls-body ${params.state === 'intact' ? 'is-disabled' : ''}`}>
        <fieldset disabled={params.state === 'intact'}>
          <legend>Breach type</legend>
          <div className="breach-type-switch">
            {types.map((item) => (
              <button
                key={item.value}
                type="button"
                className={(params.type || 'earthen') === item.value ? 'active' : ''}
                aria-pressed={(params.type || 'earthen') === item.value}
                onClick={() => selectType(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {(params.type === 'earthen' || !params.type) && (
            <>
              <p className="breach-location-note">
                Earthen dam embankment erodes dynamically into a 3D trapezoidal breach notch.
              </p>
              <RangeControl
                id="initial-breach-width"
                label="Initial breach width"
                min={5}
                max={50}
                step={1}
                value={params.initialBreachWidthM ?? 20}
                display={`${params.initialBreachWidthM ?? 20} m`}
                onChange={(initialBreachWidthM) => onChange({ initialBreachWidthM })}
              />
              <RangeControl
                id="final-breach-width"
                label="Final breach width"
                min={50}
                max={300}
                step={5}
                value={params.finalBreachWidthM ?? 150}
                display={`${params.finalBreachWidthM ?? 150} m`}
                onChange={(finalBreachWidthM) => onChange({ finalBreachWidthM })}
              />
              <RangeControl
                id="breach-depth"
                label="Breach floor depth"
                min={2}
                max={params.damHeight}
                step={0.5}
                value={params.breachDepthM ?? (params.damHeight * 0.8)}
                display={`${(params.breachDepthM ?? (params.damHeight * 0.8)).toFixed(1)} m`}
                onChange={(breachDepthM) => onChange({ breachDepthM })}
              />
            </>
          )}

          {params.type !== 'earthen' && (
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
          )}

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
