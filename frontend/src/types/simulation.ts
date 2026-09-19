/**
 * simulation.ts
 * TypeScript type definitions for the Machhu-II Dam Flood Simulation & Digital Twin
 */

export interface Terrain3DData {
  elevation_grid: number[][];
  resolution_m: number;
  extent_m: {
    width: number;
    depth: number;
  };
  dam_location?: {
    x: number;
    z: number;
    elevation: number;
  };
}

export interface FloodStep {
  step: number;
  time_hours: number;
  reach_name: string;
  water_depth_dam_toe_m: number;
  water_depth_morbi_m: number;
  lead_distance_km: number;
  inundated_area_km2: number;
  peak_discharge_m3s: number;
  polygon?: [number, number][][];
  lead_coords?: [number, number] | { lat: number; lng: number };
}

export interface FloodProgressionData {
  steps: FloodStep[];
  total_steps: number;
  max_time_hours: number;
}

export interface SimulationSummary {
  metadata?: {
    dam_name: string;
    river: string;
    event_date: string;
  };
  breach_parameters_used: {
    B_w_m: number;
    Q_peak_m3s: number;
    t_f_hours: number;
    dam_height_m: number;
  };
  hydrodynamic_results: {
    inundated_area_km2: number;
    max_flood_depth_m: number;
    peak_velocity_ms: number;
    flood_arrival_times: {
      dam_toe_hrs: number;
      morbi_city_hrs: number;
      lilapar_hrs: number;
    };
    max_depths: {
      dam_toe_m: number;
      morbi_city_m: number;
      lilapar_m: number;
    };
  };
}

export interface ShelterInfo {
  id: number;
  name: string;
  type: string;
  coords: [number, number];
  elevation_m: number;
  capacity: number;
  status: 'SAFE' | 'CRITICAL' | 'MONITORED';
}

export interface BreachParameters {
  breachWidth: number;
  peakDischarge: number;
  damHeight: number;
}

export type ViewMode = '3d' | '2d';

export type CameraPreset = 'spillway' | 'overview' | 'breach' | 'downstream' | 'dam-walk' | 'reservoir';
