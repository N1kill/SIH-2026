import React from 'react';
import {
  Eye,
  Landmark,
  Map,
  Route,
  TriangleAlert,
  Waves,
} from 'lucide-react';
import type { CameraPreset } from '../../types/simulation';

interface CameraDockProps {
  activePreset: CameraPreset;
  onSelect: (preset: CameraPreset) => void;
}

export const CameraDock: React.FC<CameraDockProps> = ({
  activePreset,
  onSelect,
}) => {
  const presets = [
    { id: 'spillway' as const, label: 'Gate Array · 18', Icon: Landmark },
    { id: 'dam-walk' as const, label: 'Crest Roadway', Icon: Route },
    { id: 'reservoir' as const, label: 'Upstream Reservoir', Icon: Waves },
    { id: 'downstream' as const, label: 'Downstream River', Icon: Map },
    { id: 'overview' as const, label: 'Aerial Overview', Icon: Eye },
    { id: 'breach' as const, label: 'Breach Zone', Icon: TriangleAlert },
  ];

  return (
    <div className="camera-dock">
      {presets.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`cam-btn ${activePreset === id ? 'active' : ''}`}
          onClick={() => onSelect(id)}
          aria-pressed={activePreset === id}
        >
          <Icon size={14} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};
