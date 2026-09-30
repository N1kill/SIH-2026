import React, { useState } from 'react';
import { useSimulationData } from './hooks/useSimulationData';
import { useTimelineController } from './hooks/useTimelineController';
import { TopHeader } from './components/Navigation/TopHeader';
import { GisMap2D } from './components/GisMap2D/GisMap2D';
import { TimelinePlayer } from './components/TimelinePlayer/TimelinePlayer';

export const App: React.FC = () => {
  const { flood, summary, mapData, loading, error, empty, generation, generationError, startSimulation } = useSimulationData();
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

  if (empty) {
    const running = generation && !['FAILED', 'CANCELLED'].includes(generation.status);
    const progress = Math.round(Math.max(0, Math.min(1, generation?.progress ?? 0)) * 100);
    return (
      <main className="loading-fullscreen" aria-labelledby="empty-title">
        <section className="simulation-empty">
          <p className="simulation-empty-eyebrow">2D OPERATIONS · SIMULATED DATA</p>
          <h1 id="empty-title">No completed Machhu-II simulation</h1>
          <p>The flood map needs a completed solver run. Generate a baseline using the configured project inputs, then this view will load the new results.</p>
          {running ? (
            <div className="simulation-progress" role="status" aria-live="polite">
              <span>Simulation {generation.status.toLowerCase().replaceAll('_', ' ')} · {progress}% · {generation.frame_count ?? 0} frames</span>
              <progress value={progress} max={100} aria-label="Simulation progress" />
            </div>
          ) : (
            <button className="simulation-start" type="button" onClick={startSimulation}>Generate baseline simulation</button>
          )}
          {generationError && <p className="simulation-error" role="alert">{generationError}</p>}
          <a href="/twin/twin.html">Open 3D Twin for scenario controls</a>
        </section>
      </main>
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
