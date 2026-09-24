import React from 'react';
import type { SimulationSummary } from '../../types/simulation';

interface FloodStatsCardProps {
  summary: SimulationSummary;
}

export const FloodStatsCard: React.FC<FloodStatsCardProps> = ({ summary }) => {
  const hr = summary.hydrodynamic_results;

  return (
    <div className="hud-card" id="card-flood-stats">
      <div className="card-header">
        <div className="card-title">Flood Statistics</div>
      </div>
      <div className="stat-row">
        <span className="stat-name">Inundated Area:</span>
        <span className="stat-val stat-cyan">{hr.inundated_area_km2.toFixed(2)} km²</span>
      </div>
      <div className="stat-row">
        <span className="stat-name">Max Depth:</span>
        <span className="stat-val">{hr.max_flood_depth_m.toFixed(2)}m</span>
      </div>
      <div className="stat-row">
        <span className="stat-name">Peak Velocity:</span>
        <span className="stat-val">{hr.peak_velocity_ms.toFixed(1)} m/s</span>
      </div>
      {summary.boundary_reached && (
        <div className="evac-notice" role="status">
          <div className="evac-notice-title">EXTENT TRUNCATED AT MODEL BOUNDARY</div>
          <div className="evac-notice-desc">
            Floodwater reached the simulation edge. Area and downstream extent are minimum estimates.
          </div>
        </div>
      )}
    </div>
  );
};
