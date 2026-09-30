import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface HydraulicSnapshot {
  breachActive: boolean;
  releaseActive: boolean;
  breachDischargeM3s: number;
  spillwayDischargeM3s: number;
  releasedVolumeM3: number;
  reservoirStorageM3: number;
  reservoirLevelM: number;
  storagePercent: number;
  massResidualM3: number;
}

interface HydraulicStatusPanelProps {
  snapshot: HydraulicSnapshot;
  currentTime: number;
  provenance: string;
}

const volume = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const flow = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

export const HydraulicStatusPanel: React.FC<HydraulicStatusPanelProps> = ({
  snapshot,
  currentTime,
  provenance,
}) => {
  const [expanded, setExpanded] = useState(false);
  const stateLabel = !snapshot.breachActive
    ? 'INTACT · CONTAINED'
    : snapshot.releaseActive
      ? 'BREACHED · RELEASING'
      : 'BREACHED · NO FLOW';

  return (
    <aside className={`hydraulic-status-panel ${expanded ? 'is-expanded' : ''}`} aria-label="Reservoir and flow accounting">
      <div className="hydraulic-summary-row">
        <div>
          <span className="hydraulic-eyebrow">HYDRAULIC STATE</span>
          <strong>{stateLabel}</strong>
        </div>
        <div className="hydraulic-quick-metrics" aria-label="Current hydraulic summary">
          <span><small>OUTFLOW</small>{flow.format(snapshot.breachDischargeM3s)} m³/s</span>
          <span><small>LEVEL</small>{snapshot.reservoirLevelM.toFixed(2)} m</span>
        </div>
        <button
          type="button"
          className="hydraulic-expand-button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronUp size={16} aria-hidden="true" />}
          {expanded ? 'Less' : 'Details'}
        </button>
      </div>

      {expanded && (
        <div className="hydraulic-details">
          <dl className="hydraulic-metrics">
            <div><dt>Simulation time</dt><dd>{currentTime.toFixed(2)} h</dd></div>
            <div><dt>Stored volume</dt><dd>{volume.format(snapshot.reservoirStorageM3)} m³</dd></div>
            <div><dt>Storage remaining</dt><dd>{snapshot.storagePercent.toFixed(1)}%</dd></div>
            <div><dt>Spillway outflow</dt><dd>{flow.format(snapshot.spillwayDischargeM3s)} m³/s</dd></div>
            <div><dt>Cumulative release</dt><dd>{volume.format(snapshot.releasedVolumeM3)} m³</dd></div>
            <div><dt>Mass residual</dt><dd>{snapshot.massResidualM3.toExponential(1)} m³</dd></div>
          </dl>
          <p className="hydraulic-provenance">
            <strong>Estimated static replay.</strong> {provenance}. Inflow and spillway are zero because neither is configured.
          </p>
        </div>
      )}
    </aside>
  );
};
