import React from 'react';
import type { SimulationSummary } from '../../types/simulation';

interface MonitoringGaugesCardProps {
  summary: SimulationSummary;
}

export const MonitoringGaugesCard: React.FC<MonitoringGaugesCardProps> = ({ summary }) => {
  const hr = summary.hydrodynamic_results;

  const depth = (value: number | null) => value == null ? 'Not sampled' : `${value.toFixed(1)}m`;
  const arrival = (value: number | null) => value == null ? 'Not sampled' : `T+${value.toFixed(2)}h`;

  const gauges = [
    {
      location: 'Dam Toe',
      depth: depth(hr.max_depths.dam_toe_m),
      time: arrival(hr.flood_arrival_times.dam_toe_hrs),
    },
    {
      location: 'Morbi',
      depth: depth(hr.max_depths.morbi_city_m),
      time: arrival(hr.flood_arrival_times.morbi_city_hrs),
    },
    {
      location: 'Lilapar',
      depth: depth(hr.max_depths.lilapar_m),
      time: arrival(hr.flood_arrival_times.lilapar_hrs),
    },
  ];

  return (
    <div className="hud-card" id="card-gauges">
      <div className="card-header">
        <div className="card-title">Monitoring Gauges</div>
      </div>
      <table className="hud-table">
        <thead>
          <tr>
            <th style={{ width: '40%' }}></th>
            <th style={{ textAlign: 'right', width: '30%' }}>Depth</th>
            <th style={{ textAlign: 'right', width: '30%' }}>Arrival Time</th>
          </tr>
        </thead>
        <tbody>
          {gauges.map((g) => (
            <tr key={g.location}>
              <td className="loc-name">{g.location}</td>
              <td className="depth-val" style={{ textAlign: 'right' }}>{g.depth}</td>
              <td className="time-val" style={{ textAlign: 'right' }}>{g.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
