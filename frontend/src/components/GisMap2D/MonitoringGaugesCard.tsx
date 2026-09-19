import React from 'react';
import type { SimulationSummary } from '../../types/simulation';

interface MonitoringGaugesCardProps {
  summary: SimulationSummary;
}

export const MonitoringGaugesCard: React.FC<MonitoringGaugesCardProps> = ({ summary }) => {
  const hr = summary.hydrodynamic_results;

  const gauges = [
    {
      location: 'Dam Toe',
      depth: `${hr.max_depths.dam_toe_m.toFixed(1)}m`,
      time: `T+0`,
    },
    {
      location: 'Morbi',
      depth: `${hr.max_depths.morbi_city_m.toFixed(1)}m`,
      time: `T+4.5h`,
    },
    {
      location: 'Lilapar',
      depth: `${hr.max_depths.lilapar_m.toFixed(1)}m`,
      time: `T+9h`,
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
