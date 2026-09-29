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
}

interface RunSummary extends Record<string, any> {
  simulation_id: string;
  status: string;
  started_at: string;
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
  const [state, setState] = useState<LoadedSimulationState>({
    terrain: null,
    flood: null,
    summary: null,
    hydraulics: null,
    mapData: null,
    loading: true,
    error: null,
  });

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
          throw new Error('No completed Machhu-II simulation exists. Run a scenario to populate the 2D map.');
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
          });
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
  }, []);

  return state;
}
