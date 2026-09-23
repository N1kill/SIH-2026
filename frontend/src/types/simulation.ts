/**
 * simulation.ts
 * TypeScript type definitions for the Machhu-II Dam Flood Simulation & Digital Twin
 */

export interface Terrain3DData {
  elevation_grid?: number[][];
  normalized_elev?: number[][];
  resolution_m?: number;
  grid_size?: number;
  elev_max_m?: number;
  elev_min_m?: number;
  dam_length_m?: number;
  reservoir_surface_area_m2?: number;
  reservoir_bounds_m?: {
    length: number;
    width: number;
  };
  extent_m?: {
    width: number;
    depth: number;
  };
  dam_location?: {
    x: number;
    z: number;
    elevation: number;
  };
  dam_position?: {
    x: number;
    y: number;
    z: number;
  };
  morbi_position?: {
    x: number;
    y: number;
    z: number;
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

export interface ProjectHydraulics {
  dam_longitude: number;
  dam_latitude: number;
  initial_water_level_m: number;
  maximum_water_level_m: number;
  reservoir_capacity_m3: number;
  reservoir_surface_area_m2: number;
  stage_storage: [number, number][];
  spillway_configured: boolean;
  provenance: string;
  data_status: 'approximate' | 'simulated' | 'measured';
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
    V_reservoir_m3?: number;
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
  state: 'intact' | 'breached';
  type: 'crack' | 'partial' | 'full';
  gateIndex: number;
  crackSizeM: number;
  leakOpeningMm: number;
  holeWidthM: number;
  holeHeightM: number;
  failedGateCount: number;
  formationTimeHours: number;
  peakDischarge: number;
  damHeight: number;
}

export type ViewMode = '3d' | '2d';

export type CameraPreset = 'spillway' | 'overview' | 'breach' | 'downstream' | 'dam-walk' | 'reservoir';
