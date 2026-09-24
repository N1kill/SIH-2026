import React from 'react';
import type { ViewMode } from '../../types/simulation';
import { LayerToggles } from './LayerToggles';

interface TopHeaderProps {
  activeTab: ViewMode;
  onSelectTab: (tab: ViewMode) => void;
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
  activeTab,
  onSelectTab,
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

      {activeTab === '2d' && (
        <LayerToggles layers={layers} onToggle={onToggleLayer} routesAvailable={routesAvailable} />
      )}

      {/* View Switcher Pill */}
      <div className="tab-switch-pill">
        <button
          className={`tab-pill-btn ${activeTab === '3d' ? 'active' : ''}`}
          onClick={() => onSelectTab('3d')}
        >
          <span>🏗️</span> 3D Twin
        </button>
        <button
          className={`tab-pill-btn ${activeTab === '2d' ? 'active' : ''}`}
          onClick={() => onSelectTab('2d')}
        >
          <span>🗺️</span> 2D Operations
        </button>
      </div>
    </div>
  );
};
