import { useState, useEffect } from 'react';
import type {
  Terrain3DData,
  FloodProgressionData,
  SimulationSummary,
  ProjectHydraulics,
  SimulationMapData,
  GeoJsonFeatureCollection,
} from '../types/simulation';

export interface LoadedSimulationState {
  terrain: Terrain3DData | null;
  flood: FloodProgressionData | null;
  summary: SimulationSummary | null;
  hydraulics: ProjectHydraulics | null;
  mapData: SimulationMapData | null;
  loading: boolean;
  error: string | null;
  empty: boolean;
  generation: RunStatus | null;
  generationError: string | null;
  startSimulation: () => Promise<void>;
}

interface RunStatus {
  simulation_id?: string;
  status: string;
  progress?: number;
  frame_count?: number;
  error?: string | null;
}

interface RunSummary extends Record<string, any> {
  simulation_id: string;
  status: string;
  started_at: string;
}

interface ProjectConfig {
  dam_id: string;
  dam_height_m: number;
}

async function jsonResponse<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) throw new Error(`${label} unavailable (${response.status})`);
  return response.json() as Promise<T>;
}

function adaptSummary(raw: RunSummary): SimulationSummary {
  const scenario = raw.scenario ?? {};
  const project = raw.project ?? {};
  const metrics = raw.metrics ?? {};
  return {
    ...raw,
    breach_parameters_used: {
      B_w_m: scenario.max_breach_width_m ?? scenario.breach_width_m,
      Q_peak_m3s: raw.peak_discharge_m3s,
      t_f_hours: (scenario.formation_time_s ?? 0) / 3600,
      dam_height_m: project.dam_height_m,
      V_reservoir_m3: project.reservoir_capacity_m3,
    },
    hydrodynamic_results: {
      inundated_area_km2: metrics.inundated_area_km2,
      max_flood_depth_m: metrics.max_depth_m,
      peak_velocity_ms: metrics.max_velocity_ms,
      // No city gauges exist in this run contract. Never substitute legacy demo values.
      max_depths: { dam_toe_m: null, morbi_city_m: null, lilapar_m: null },
      flood_arrival_times: { dam_toe_hrs: null, morbi_city_hrs: null, lilapar_hrs: null },
    },
  };
}

export function useSimulationData(): LoadedSimulationState {
  const [state, setState] = useState<Pick<LoadedSimulationState,
    'terrain' | 'flood' | 'summary' | 'hydraulics' | 'mapData' | 'loading' | 'error' | 'empty'>>({
    terrain: null,
    flood: null,
    summary: null,
    hydraulics: null,
    mapData: null,
    loading: true,
    error: null,
    empty: false,
  });
  const [generation, setGeneration] = useState<RunStatus | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const dataUrl = (name: string) => `${import.meta.env.BASE_URL}data/${name}`;
    async function loadData() {
      try {
        const [terrain, hydraulics, runs] = await Promise.all([
          fetch(dataUrl('terrain_3d_data.json')).then((r) => jsonResponse<Terrain3DData>(r, 'Terrain')),
          fetch(dataUrl('project_hydraulics.json')).then((r) => jsonResponse<ProjectHydraulics>(r, 'Hydraulics')),
          fetch('/api/simulation/results').then((r) => jsonResponse<RunSummary[]>(r, 'Simulation results')),
        ]);
        const completed = runs
          .filter((run) => run.status === 'COMPLETE' && run.project?.dam_id === 'machhu-ii')
          .sort((a, b) => b.started_at.localeCompare(a.started_at));
        if (!completed.length) {
          const active = await fetch('/api/simulation/status').then((r) =>
            jsonResponse<RunStatus>(r, 'Simulation status'));
          if (isMounted) {
            if (active.simulation_id && !['COMPLETE', 'FAILED', 'CANCELLED'].includes(active.status)) {
              setGeneration(active);
            }
            setState((prev) => ({ ...prev, loading: false, empty: true, error: null }));
          }
          return;
        }
        const selected = completed[0];
        const id = selected.simulation_id;
        const [flood, riskZones, safeZones, facilities, evacuationRoutes] = await Promise.all([
          fetch(`/api/simulation/results/${id}/flood-progression`).then((r) =>
            jsonResponse<FloodProgressionData>(r, 'Simulated flood progression')),
          fetch(`/api/risk/zones?simulation_id=${id}`).then((r) =>
            jsonResponse<GeoJsonFeatureCollection>(r, 'Risk zones')),
          fetch(`/api/safe-zones?simulation_id=${id}`).then((r) =>
            jsonResponse<GeoJsonFeatureCollection>(r, 'Screened dry zones')),
          fetch(`/api/shelters?simulation_id=${id}`).then((r) =>
            jsonResponse<GeoJsonFeatureCollection>(r, 'Facility screening')),
          fetch(`/api/evacuation-routes?simulation_id=${id}`).then((r) =>
            jsonResponse<GeoJsonFeatureCollection>(r, 'Evacuation-route status')),
        ]);
        if (isMounted) {
          setState({
            terrain,
            flood,
            summary: adaptSummary(selected),
            hydraulics,
            mapData: { riskZones, safeZones, facilities, evacuationRoutes },
            loading: false,
            error: null,
            empty: false,
          });
          setGeneration(null);
          setGenerationError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Unknown data loading error',
          }));
        }
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [reloadKey]);

  useEffect(() => {
    if (!generation?.simulation_id || ['COMPLETE', 'FAILED', 'CANCELLED'].includes(generation.status)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/simulation/results/${generation.simulation_id}`, {
          signal: controller.signal,
        });
        const current = await jsonResponse<RunStatus>(response, 'Simulation status');
        if (current.status === 'COMPLETE') {
          setGeneration(current);
          setState((prev) => ({ ...prev, loading: true }));
          setReloadKey((key) => key + 1);
        } else {
          setGeneration(current);
          if (current.status === 'FAILED' || current.status === 'CANCELLED') {
            setGenerationError(current.error || `Simulation ${current.status.toLowerCase()}.`);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setGenerationError(error instanceof Error ? error.message : 'Could not check simulation status.');
          setGeneration(null);
        }
      }
    }, 1500);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [generation]);

  async function startSimulation() {
    setGenerationError(null);
    setGeneration({ status: 'STARTING' });
    try {
      const projects = await fetch('/api/project').then((response) =>
        jsonResponse<ProjectConfig[]>(response, 'Project configuration'));
      const project = projects.find((item) => item.dam_id === 'machhu-ii');
      if (!project || !Number.isFinite(project.dam_height_m) || project.dam_height_m <= 0) {
        throw new Error('Machhu-II dam height is unavailable in the project configuration.');
      }
      const response = await fetch('/api/simulation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.dam_id,
          name: 'Full-height breach screening from 2D operations',
          breach_depth_m: project.dam_height_m,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || `Could not start simulation (${response.status})`);
      }
      setGeneration(await response.json() as RunStatus);
    } catch (error) {
      setGeneration(null);
      setGenerationError(error instanceof Error ? error.message : 'Could not start simulation.');
    }
  }

  return { ...state, generation, generationError, startSimulation };
}
