-- ==========================================================================
-- PostGIS Spatial Schema for Machhu-II Dam Failure Flood Inundation (SIH-2026)
-- Coordinate Reference System: EPSG:32642 (WGS 84 / UTM Zone 42N)
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;

-- 1. Monitoring Station Gauges Table
CREATE TABLE IF NOT EXISTS monitoring_stations (
    station_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    distance_downstream_km NUMERIC(6,2),
    elevation_m NUMERIC(6,2),
    peak_depth_simulated_m NUMERIC(6,2),
    historical_benchmark_m NUMERIC(6,2),
    geom GEOMETRY(Point, 32642)
);

-- 2. Flood Hazard Inundation Polygons Table
CREATE TABLE IF NOT EXISTS flood_hazard_zones (
    id SERIAL PRIMARY KEY,
    scenario_id VARCHAR(32) NOT NULL,
    hazard_level VARCHAR(32) NOT NULL, -- Low, Moderate, High, Extreme
    min_depth_m NUMERIC(5,2),
    max_depth_m NUMERIC(5,2),
    area_km2 NUMERIC(8,2),
    geom GEOMETRY(MultiPolygon, 32642)
);

-- 3. Composite Risk & Evacuation Shelters Table
CREATE TABLE IF NOT EXISTS emergency_shelters (
    shelter_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    shelter_type VARCHAR(64) NOT NULL,
    elevation_m NUMERIC(6,2),
    capacity_persons INTEGER,
    status VARCHAR(32) DEFAULT 'DESIGNATED_SAFE',
    geom GEOMETRY(Point, 32642)
);

-- 4. Evacuation Routes Table
CREATE TABLE IF NOT EXISTS evacuation_corridors (
    route_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    corridor_type VARCHAR(64),
    clearance_status VARCHAR(32),
    geom GEOMETRY(MultiLineString, 32642)
);

-- Insert Monitoring Station Records
INSERT INTO monitoring_stations (station_id, name, distance_downstream_km, elevation_m, peak_depth_simulated_m, historical_benchmark_m, geom)
VALUES 
    ('ST_DAM', 'Machhu-II Dam Toe', 0.0, 33.94, 2.28, NULL, ST_SetSRID(ST_MakePoint(688825.8, 2525267.6), 32642)),
    ('ST_MORBI', 'Morbi City Center', 5.2, 26.50, 3.02, 3.00, ST_SetSRID(ST_MakePoint(687025.0, 2530167.0), 32642)),
    ('ST_LILAPAR', 'Lilapar Bridge', 12.0, 19.80, 1.85, NULL, ST_SetSRID(ST_MakePoint(685325.0, 2536767.0), 32642)),
    ('ST_MALIA', 'Malia Miyana', 32.0, 6.20, 0.95, NULL, ST_SetSRID(ST_MakePoint(681825.0, 2556267.0), 32642))
ON CONFLICT (station_id) DO NOTHING;

-- Insert Emergency High-Ground Shelters
INSERT INTO emergency_shelters (shelter_id, name, shelter_type, elevation_m, capacity_persons, geom)
VALUES
    ('SH_EAST_1', 'Morbi East High Ground Shelter 1', 'Elevation Ridge (>55m)', 56.4, 25000, ST_SetSRID(ST_MakePoint(693500.0, 2531000.0), 32642)),
    ('SH_SOUTH_2', 'Morbi South-East Relief Complex', 'Government Administrative Complex', 54.2, 18000, ST_SetSRID(ST_MakePoint(692000.0, 2527000.0), 32642))
ON CONFLICT (shelter_id) DO NOTHING;
