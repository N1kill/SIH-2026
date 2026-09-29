import React, { useState } from 'react';
import { useSimulationData } from './hooks/useSimulationData';
import { useTimelineController } from './hooks/useTimelineController';
import { TopHeader } from './components/Navigation/TopHeader';
import { GisMap2D } from './components/GisMap2D/GisMap2D';
import { TimelinePlayer } from './components/TimelinePlayer/TimelinePlayer';

export const App: React.FC = () => {
  const { flood, summary, mapData, loading, error } = useSimulationData();
  const timeline = useTimelineController(flood?.max_time_hours ?? 1);

  const [layers, setLayers] = useState({
    flood: true,
    evacuation: true,
    shelters: true,
    routes: false,
  });

  const handleToggleLayer = (layer: 'flood' | 'evacuation' | 'shelters' | 'routes') => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  if (loading) {
    return (
      <div className="loading-fullscreen">
        <div className="loader-spinner" />
        <div className="loader-msg">Loading hydrodynamic GIS & terrain data…</div>
      </div>
    );
  }

  if (error || !flood || !summary || !mapData) {
    return (
      <div className="loading-fullscreen">
        <div className="loader-msg" style={{ color: '#ef4444' }}>
          Failed to load simulation: {error || 'Missing datasets'}
        </div>
      </div>
    );
  }

  return (
    <div className="app-viewport">
      {/* Top Header Navigation */}
      <TopHeader
        layers={layers}
        onToggleLayer={handleToggleLayer}
        routesAvailable={mapData.evacuationRoutes.features.length > 0}
      />

      {/* Main View Area */}
      <main className="view-viewport">
        <GisMap2D
          floodData={flood}
          summary={summary}
          currentTime={timeline.currentTime}
          layers={layers}
          mapData={mapData}
        />
      </main>

      {/* Floating Bottom Timeline Player (Matches Image 1 & 2) */}
      <TimelinePlayer controller={timeline} />
    </div>
  );
};

export default App;
