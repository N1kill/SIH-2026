import React, { useState } from 'react';
import type { ViewMode, BreachParameters } from './types/simulation';
import { useSimulationData } from './hooks/useSimulationData';
import { useTimelineController } from './hooks/useTimelineController';
import { TopHeader } from './components/Navigation/TopHeader';
import { DigitalTwin3D } from './components/DigitalTwin3D/DigitalTwin3D';
import { GisMap2D } from './components/GisMap2D/GisMap2D';
import { TimelinePlayer } from './components/TimelinePlayer/TimelinePlayer';

export const App: React.FC = () => {
  const { terrain, flood, summary, hydraulics, mapData, loading, error } = useSimulationData();
  const timeline = useTimelineController(flood?.max_time_hours ?? 1);

  const [activeTab, setActiveTab] = useState<ViewMode>('3d');

  const [breachParams, setBreachParams] = useState<BreachParameters>({
    state: 'intact',
    type: 'full',
    gateIndex: 9,
    crackSizeM: 3,
    leakOpeningMm: 12,
    holeWidthM: 6,
    holeHeightM: 5,
    failedGateCount: 1,
    formationTimeHours: 2.5,
    peakDischarge: 6647,
    damHeight: 22.56,
  });

  const [layers, setLayers] = useState({
    flood: true,
    evacuation: true,
    shelters: true,
    routes: false,
  });

  const handleToggleLayer = (layer: 'flood' | 'evacuation' | 'shelters' | 'routes') => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleBreachParamsChange = (newParams: Partial<BreachParameters>) => {
    setBreachParams((prev) => ({ ...prev, ...newParams }));
  };

  if (loading) {
    return (
      <div className="loading-fullscreen">
        <div className="loader-spinner" />
        <div className="loader-msg">Loading hydrodynamic GIS & terrain data…</div>
      </div>
    );
  }

  if (error || !terrain || !flood || !summary || !hydraulics || !mapData) {
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
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        layers={layers}
        onToggleLayer={handleToggleLayer}
        routesAvailable={mapData.evacuationRoutes.features.length > 0}
      />

      {/* Main View Area */}
      <main className="view-viewport">
        {activeTab === '3d' ? (
          <DigitalTwin3D
            terrainData={terrain}
            breachParams={breachParams}
            onBreachParamsChange={handleBreachParamsChange}
            currentTime={timeline.currentTime}
            hydraulics={hydraulics}
          />
        ) : (
          <GisMap2D
            floodData={flood}
            summary={summary}
            currentTime={timeline.currentTime}
            layers={layers}
            mapData={mapData}
          />
        )}
      </main>

      {/* Floating Bottom Timeline Player (Matches Image 1 & 2) */}
      <TimelinePlayer controller={timeline} />
    </div>
  );
};

export default App;
