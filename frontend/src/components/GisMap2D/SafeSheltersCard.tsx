import React from 'react';
import type { ShelterInfo } from '../../types/simulation';

interface SafeSheltersCardProps {
  facilities: ShelterInfo[];
  zoneStatus?: string;
  setbackM?: number;
  routeStatus?: string;
  onSelectShelter?: (shelter: ShelterInfo) => void;
}

function measurement(value: number | null, unit: string) {
  return value == null ? 'not available' : `${value.toFixed(1)} ${unit}`;
}

export const SafeSheltersCard: React.FC<SafeSheltersCardProps> = ({
  facilities,
  zoneStatus,
  setbackM,
  routeStatus,
  onSelectShelter,
}) => {
  const candidates = facilities.filter((facility) => facility.status === 'CANDIDATE');
  return (
    <div className="hud-card" id="card-shelters">
      <div className="card-header">
        <div className="card-title">Screened Zones & Facilities</div>
        <span className="card-badge" style={{
          background: 'rgba(16,185,129,0.18)',
          color: '#34d399',
          borderColor: 'rgba(16,185,129,0.4)',
        }}>
          {setbackM ? `≥${Math.round(setbackM)} m setback` : 'simulation-screened'}
        </span>
      </div>

      {candidates.length ? candidates.slice(0, 3).map((facility) => (
        <button
          type="button"
          key={facility.id}
          className="shelter-item"
          onClick={() => onSelectShelter?.(facility)}
          style={{ cursor: 'pointer', width: '100%', textAlign: 'left' }}
        >
          <div className="shelter-info">
            <h4>{facility.name}</h4>
            <p>{facility.type} · elevation {measurement(facility.elevation_m, 'm')}</p>
          </div>
          <div className="shelter-cap">
            {measurement(facility.distance_to_flood_m, 'm')}
            <br />
            <span style={{ fontSize: '9px', color: '#94a3b8' }}>from modeled flood</span>
          </div>
        </button>
      )) : (
        <p className="evac-notice-desc">No supplied facility passes the simulated flood-setback screen.</p>
      )}

      <div className="evac-notice">
        <div className="evac-notice-title">CANDIDATES — NOT DESIGNATED SHELTERS</div>
        <div className="evac-notice-desc">
          {zoneStatus || 'Dry-zone screening is unavailable.'} Capacity, access, structural safety,
          and official designation still require field verification.
        </div>
      </div>
      <div className="evac-notice">
        <div className="evac-notice-title">EVACUATION ROUTES</div>
        <div className="evac-notice-desc">
          {routeStatus || 'Route status is unavailable.'} Priority zones are hazards, not routes.
        </div>
      </div>
    </div>
  );
};
