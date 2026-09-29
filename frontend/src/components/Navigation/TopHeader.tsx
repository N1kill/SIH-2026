import React from 'react';
import { LayerToggles } from './LayerToggles';

interface TopHeaderProps {
  layers: {
    flood: boolean;
    evacuation: boolean;
    shelters: boolean;
    routes: boolean;
  };
  onToggleLayer: (layer: 'flood' | 'evacuation' | 'shelters' | 'routes') => void;
  routesAvailable: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  layers,
  onToggleLayer,
  routesAvailable,
}) => {
  return (
    <div className="floating-top-nav">
      {/* Brand Identity */}
      <div className="brand-chip">
        <span className="brand-chip-dot" />
        <span className="brand-chip-title">PRALAYA</span>
        <span className="brand-chip-tag">HYDRO TWIN</span>
      </div>

      <LayerToggles layers={layers} onToggle={onToggleLayer} routesAvailable={routesAvailable} />

      {/* View Switcher Pill */}
      <div className="tab-switch-pill">
        <a className="tab-pill-btn" href="/twin/twin.html">3D Twin</a>
        <span className="tab-pill-btn active" aria-current="page">2D Operations</span>
      </div>
      <a className="tab-pill-btn" href="/">Frontend</a>
    </div>
  );
};
