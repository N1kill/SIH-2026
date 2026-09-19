import React from 'react';
import type { ShelterInfo } from '../../types/simulation';

export const SHELTERS: ShelterInfo[] = [
  {
    id: 1,
    name: 'Morbi East Ridge Shelter 1',
    type: 'Safe High Ground',
    coords: [22.868, 70.875],
    elevation_m: 56.4,
    capacity: 25000,
    status: 'SAFE',
  },
  {
    id: 2,
    name: 'Morbi South-East Relief Complex',
    type: 'Govt Complex',
    coords: [22.845, 70.865],
    elevation_m: 54.2,
    capacity: 18000,
    status: 'SAFE',
  },
  {
    id: 3,
    name: 'Liliya Ridge Transit Hub',
    type: 'High Ground Transit',
    coords: [22.895, 70.885],
    elevation_m: 58.1,
    capacity: 12000,
    status: 'SAFE',
  },
];

interface SafeSheltersCardProps {
  onSelectShelter?: (shelter: ShelterInfo) => void;
}

export const SafeSheltersCard: React.FC<SafeSheltersCardProps> = ({ onSelectShelter }) => {
  return (
    <div className="hud-card" id="card-shelters">
      <div className="card-header">
        <div className="card-title">Safe Zones & Shelters</div>
        <span
          className="card-badge"
          style={{
            background: 'rgba(16,185,129,0.18)',
            color: '#34d399',
            borderColor: 'rgba(16,185,129,0.4)',
          }}
        >
          &gt;52m MSL
        </span>
      </div>

      {SHELTERS.map((s) => (
        <div
          key={s.id}
          className="shelter-item"
          onClick={() => onSelectShelter?.(s)}
          style={{ cursor: 'pointer' }}
        >
          <div className="shelter-info">
            <h4>{s.name}</h4>
            <p>Elevation {s.elevation_m}m · {s.type}</p>
          </div>
          <div className="shelter-cap">
            {s.capacity.toLocaleString()}
            <br />
            <span style={{ fontSize: '9px', color: '#94a3b8' }}>capacity</span>
          </div>
        </div>
      ))}

      {/* Priority Evacuation Notice */}
      <div className="evac-notice">
        <div className="evac-notice-title">
          <span>🚨</span> CRITICAL EVACUATION ZONE
        </div>
        <div className="evac-notice-desc">
          Morbi Urban Core & Riverbanks: <strong>6.82 km²</strong> at immediate risk. Evacuate via
          East Bypass Corridor to High Ground Shelter 1 before T+4.5h.
        </div>
      </div>
    </div>
  );
};
