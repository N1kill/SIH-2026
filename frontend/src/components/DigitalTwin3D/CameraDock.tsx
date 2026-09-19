import React from 'react';
import type { CameraPreset } from '../../types/simulation';

interface CameraDockProps {
  activePreset: CameraPreset;
  onSelect: (preset: CameraPreset) => void;
  breachActive: boolean;
  onToggleBreach: (active: boolean) => void;
}

export const CameraDock: React.FC<CameraDockProps> = ({
  activePreset,
  onSelect,
  breachActive,
  onToggleBreach,
}) => {
  const presets: { id: CameraPreset; label: string; icon: string }[] = [
    { id: 'spillway', label: 'Spillway Front', icon: '🏛️' },
    { id: 'dam-walk', label: 'Crest Roadway', icon: '🛣️' },
    { id: 'reservoir', label: 'Upstream Reservoir', icon: '💧' },
    { id: 'downstream', label: 'Downstream River', icon: '🌊' },
    { id: 'overview', label: 'Aerial Overview', icon: '🦅' },
    { id: 'breach', label: 'Breach Zone', icon: '💥' },
  ];

  return (
    <div className="camera-dock">
      <button
        className={`cam-btn ${!breachActive ? 'active' : ''}`}
        style={{
          borderColor: !breachActive ? '#10b981' : 'rgba(255,255,255,0.15)',
          background: !breachActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.85)',
          color: !breachActive ? '#34d399' : '#94a3b8',
        }}
        onClick={() => onToggleBreach(!breachActive)}
      >
        <span>{!breachActive ? '🛡️' : '💥'}</span>
        <span>{!breachActive ? 'Intact Dam' : 'Breached Dam'}</span>
      </button>

      <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />

      {presets.map((p) => (
        <button
          key={p.id}
          className={`cam-btn ${activePreset === p.id ? 'active' : ''}`}
          onClick={() => onSelect(p.id)}
        >
          <span>{p.icon}</span>
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  );
};
