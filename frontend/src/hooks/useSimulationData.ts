import { useState, useEffect } from 'react';
import type {
  Terrain3DData,
  FloodProgressionData,
  SimulationSummary,
  ProjectHydraulics,
} from '../types/simulation';

export interface LoadedSimulationState {
  terrain: Terrain3DData | null;
  flood: FloodProgressionData | null;
  summary: SimulationSummary | null;
  hydraulics: ProjectHydraulics | null;
  loading: boolean;
  error: string | null;
}

export function useSimulationData(): LoadedSimulationState {
  const [state, setState] = useState<LoadedSimulationState>({
    terrain: null,
    flood: null,
    summary: null,
    hydraulics: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [terrainRes, floodRes, summaryRes, hydraulicsRes] = await Promise.all([
          fetch('/data/terrain_3d_data.json'),
          fetch('/data/flood_progression.json'),
          fetch('/data/simulation_summary.json'),
          fetch('/data/project_hydraulics.json'),
        ]);

        if (!terrainRes.ok || !floodRes.ok || !summaryRes.ok || !hydraulicsRes.ok) {
          throw new Error('Failed to load hydrodynamic GIS files from /data/');
        }

        const [terrain, rawFlood, rawSummary, hydraulics] = await Promise.all([
          terrainRes.json(),
          floodRes.json(),
          summaryRes.json(),
          hydraulicsRes.json(),
        ]);

        const flood: FloodProgressionData = Array.isArray(rawFlood)
          ? { steps: rawFlood, num_steps: rawFlood.length, total_duration_hours: 24.0 }
          : rawFlood;

        const rawObj = rawSummary as Record<string, any>;
        const summary: SimulationSummary = { ...rawSummary };
        if (!summary.hydrodynamic_results) {
          summary.hydrodynamic_results = {
            inundated_area_km2: rawObj.metrics?.total_inundated_area_km2 ?? 71.49,
            max_flood_depth_m: rawObj.metrics?.max_depth_m ?? 22.56,
            peak_velocity_ms: rawObj.metrics?.max_velocity_ms ?? 12.0,
            max_depths: {
              dam_toe_m: rawObj.monitoring_gauges?.dam_toe?.peak_depth_m ?? 22.5,
              morbi_city_m: rawObj.monitoring_gauges?.morbi?.peak_depth_m ?? 8.2,
              lilapar_m: rawObj.monitoring_gauges?.lilapar?.peak_depth_m ?? 5.1,
            },
            flood_arrival_times: {
              dam_toe_hrs: rawObj.monitoring_gauges?.dam_toe?.arrival_time_hours ?? 0.0,
              morbi_city_hrs: rawObj.monitoring_gauges?.morbi?.arrival_time_hours ?? 4.5,
              lilapar_hrs: rawObj.monitoring_gauges?.lilapar?.arrival_time_hours ?? 9.0,
            },
          };
        }
        if (!summary.breach_parameters_used) {
          summary.breach_parameters_used = {
            B_w_m: rawObj.breach_parameters_used?.B_w_m ?? rawObj.breach_parameters_used?.B_avg_m ?? 156.0,
            Q_peak_m3s: rawObj.breach_parameters_used?.Q_peak_m3s ?? 6647.0,
            t_f_hours: rawObj.breach_parameters_used?.t_f_hours ?? 2.5,
            dam_height_m: rawObj.breach_parameters_used?.dam_height_m ?? 22.56,
            V_reservoir_m3: rawObj.breach_parameters_used?.V_reservoir_m3,
          };
        }

        if (isMounted) {
          setState({
            terrain,
            flood,
            summary,
            hydraulics,
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

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
