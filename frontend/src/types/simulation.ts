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
  frame_index: number;
  time_s: number;
  time_hours: number;
  inundated_area_km2: number;
  max_depth_m: number;
  max_velocity_ms: number;
  discharge_m3s: number;
  features: GeoJsonFeature[];
}

export interface FloodProgressionData {
  simulation_id: string;
  data_status: 'simulated';
  model: string;
  crs: 'EPSG:4326';
  steps: FloodStep[];
  total_steps: number;
  max_time_hours: number;
}

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties: Record<string, unknown>;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
  status?: string;
  simulation_id?: string;
  setback_m?: number;
  screening_radius_m?: number;
  thresholds?: Record<string, unknown>;
}

export interface SimulationMapData {
  riskZones: GeoJsonFeatureCollection;
  safeZones: GeoJsonFeatureCollection;
  facilities: GeoJsonFeatureCollection;
  evacuationRoutes: GeoJsonFeatureCollection;
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
  simulation_id?: string;
  status?: string;
  solver?: string;
  boundary_reached?: boolean;
  boundary_condition?: string;
  project?: {
    dam_id: string;
    dam_name: string;
    latitude: number;
    longitude: number;
  };
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
      dam_toe_hrs: number | null;
      morbi_city_hrs: number | null;
      lilapar_hrs: number | null;
    };
    max_depths: {
      dam_toe_m: number | null;
      morbi_city_m: number | null;
      lilapar_m: number | null;
    };
  };
}

export interface ShelterInfo {
  id: string;
  name: string;
  type: string;
  coords: [number, number];
  elevation_m: number | null;
  distance_to_flood_m: number | null;
  depth_m: number | null;
  status: 'CANDIDATE' | 'BUFFER' | 'EXPOSED' | 'OUTSIDE_MODEL';
}

export interface BreachParameters {
  state: 'intact' | 'breached';
  type: 'earthen' | 'crack' | 'partial' | 'full';
  gateIndex: number;
  crackSizeM: number;
  leakOpeningMm: number;
  holeWidthM: number;
  holeHeightM: number;
  failedGateCount: number;
  formationTimeHours: number;
  peakDischarge: number;
  damHeight: number;
  initialBreachWidthM?: number;
  finalBreachWidthM?: number;
  breachDepthM?: number;
  breachSideSlope?: number;
}

export type ViewMode = '3d' | '2d';

export type CameraPreset = 'spillway' | 'overview' | 'breach' | 'downstream' | 'dam-walk' | 'reservoir';
