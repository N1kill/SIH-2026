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
          <p>The flood map needs a completed solver run. Generate a full-height breach screening scenario using the configured dam height, then this view will load the new results.</p>
          {running ? (
            <div className="simulation-progress" role="status" aria-live="polite">
              <span>Simulation {generation.status.toLowerCase().replaceAll('_', ' ')} · {progress}% · {generation.frame_count ?? 0} frames</span>
              <progress value={progress} max={100} aria-label="Simulation progress" />
            </div>
          ) : (
            <button className="simulation-start" type="button" onClick={startSimulation}>Generate breach simulation</button>
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

  const dryRun = flood.steps.every((step) => step.features.length === 0);
  const noDischarge = flood.steps.every((step) => step.discharge_m3s === 0);
  const generating = generation && !['FAILED', 'CANCELLED', 'COMPLETE'].includes(generation.status);

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

      {dryRun && (
        <section className="simulation-dry-notice" role="status" aria-label="No simulated flooding">
          <strong>No simulated flood extent in this run</strong>
          <p>{noDischarge
            ? 'The solver reported zero discharge. The configured breach may not reach the starting water level.'
            : 'No modeled cells reached the wet-depth threshold during this run.'}</p>
          {generating ? (
            <p>Generating a new scenario: {generation.status.toLowerCase().replaceAll('_', ' ')} · {Math.round((generation.progress ?? 0) * 100)}%</p>
          ) : (
            <button className="simulation-start" type="button" onClick={startSimulation}>Generate full-height breach screening</button>
          )}
          {generationError && <p className="simulation-error" role="alert">{generationError}</p>}
        </section>
      )}

      {/* Floating Bottom Timeline Player (Matches Image 1 & 2) */}
      <TimelinePlayer controller={timeline} />
    </div>
  );
};

export default App;
