import React from 'react';

interface LayerTogglesProps {
  layers: {
    flood: boolean;
    evacuation: boolean;
    shelters: boolean;
    routes: boolean;
  };
  onToggle: (layer: 'flood' | 'evacuation' | 'shelters' | 'routes') => void;
}

export const LayerToggles: React.FC<LayerTogglesProps> = ({ layers, onToggle }) => {
  return (
    <div className="layer-toggles">
      <button
        className={`toggle-chip ${layers.flood ? 'active' : ''}`}
        onClick={() => onToggle('flood')}
      >
        <span>🌊</span> Inundation
      </button>
      <button
        className={`toggle-chip ${layers.evacuation ? 'active' : ''}`}
        data-layer="evacuation"
        onClick={() => onToggle('evacuation')}
      >
        <span>🚨</span> Priority Zones
      </button>
      <button
        className={`toggle-chip ${layers.shelters ? 'active' : ''}`}
        data-layer="shelters"
        onClick={() => onToggle('shelters')}
      >
        <span>🛡️</span> Safe Shelters
      </button>
      <button
        className={`toggle-chip ${layers.routes ? 'active' : ''}`}
        data-layer="routes"
        onClick={() => onToggle('routes')}
      >
        <span>↗️</span> Evac Routes
      </button>
    </div>
  );
};
