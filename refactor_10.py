import sys

with open("scripts/10_hydrodynamic_simulation.py", "r") as f:
    content = f.read()

# 1. Add argparse and json to imports
content = content.replace("import sys\nfrom datetime import datetime, timezone", "import argparse\nimport sys\nfrom datetime import datetime, timezone")

# 2. Update run_2d_hydrodynamic_simulation signature and remove STATION_COORDS_WGS84
old_stations_block = """# Real geographic coordinates for monitoring stations along downstream Machhu channel (WGS84)
STATION_COORDS_WGS84 = {
    "dam_toe": {"name": "Machhu-II Dam Toe (0 km)", "lat": 22.8212, "lon": 70.8414},
    "morbi":   {"name": "Morbi City Center (5.2 km)", "lat": 22.8684, "lon": 70.8117},
    "lilapar": {"name": "Lilapar / Dhuva (12 km)", "lat": 22.9161, "lon": 70.7853},
    "malia":   {"name": "Malia Miyana (25 km)", "lat": 22.9802, "lon": 70.7675},
}


def run_2d_hydrodynamic_simulation(dem_path, breach_hydrograph_tuple, breach_params):"""

new_stations_block = """def run_2d_hydrodynamic_simulation(dem_path, breach_hydrograph_tuple, breach_params, dam_config):"""
content = content.replace(old_stations_block, new_stations_block)

# 3. Update geo_to_grid and dam/station loading
old_dam_station_block = """    # Use real dam toe coordinates (immediately downstream of dam axis)
    dam_station = STATION_COORDS_WGS84["dam_toe"]
    r_dam, c_dam = geo_to_grid(dam_station["lat"], dam_station["lon"], snap_radius=5)
    logging.info(f"Dam toe source cell in grid: row={r_dam}, col={c_dam}, elev={dem[r_dam, c_dam]:.2f}m")

    # Build monitoring stations from real coordinates
    stations = {}
    for key, info in STATION_COORDS_WGS84.items():
        if key == "dam_toe":
            sr, sc = geo_to_grid(info["lat"], info["lon"], snap_radius=5)
        else:
            sr, sc = geo_to_grid(info["lat"], info["lon"], snap_radius=15)
        stations[key] = {"name": info["name"], "r": sr, "c": sc, "depth": []}"""

new_dam_station_block = """    # Use real dam coordinates from config
    r_dam, c_dam = geo_to_grid(dam_config["lat"], dam_config["lon"], snap_radius=5)
    logging.info(f"Dam toe source cell in grid: row={r_dam}, col={c_dam}, elev={dem[r_dam, c_dam]:.2f}m")

    # Build monitoring stations from config
    stations = {}
    for info in dam_config["downstream_stations"]:
        key = info["key"]
        snap = 5 if key == "dam_toe" else 15
        sr, sc = geo_to_grid(info["lat"], info["lon"], snap_radius=snap)
        stations[key] = {"name": info["name"], "r": sr, "c": sc, "depth": []}"""
content = content.replace(old_dam_station_block, new_dam_station_block)

# 4. Ingest PySPH output
old_injection_block = """        # 1. Exact Physical Breach Mass Injection: V_in = Q_in * dt_sim
        v_in = q_in * dt_sim
        d_h_in = (v_in / float(n_src)) / cell_area
        for (sr, sc) in src_cells:
            sub_depth[sr, sc] += d_h_in"""

new_injection_block = """        # 1. Exact Physical Breach Mass Injection (with PySPH fallback)
        import os
        pysph_file = OUTPUTS_SIM / f"pysph_hydrograph_{step}.txt"
        if pysph_file.is_file():
            # Ingest PySPH boundary condition
            with open(pysph_file, "r") as pf:
                val = float(pf.read().strip())
                v_in = val * dt_sim
        else:
            v_in = q_in * dt_sim
        d_h_in = (v_in / float(n_src)) / cell_area
        for (sr, sc) in src_cells:
            sub_depth[sr, sc] += d_h_in"""
content = content.replace(old_injection_block, new_injection_block)

# 5. Fix hardcoded morbi references
content = content.replace('morbi_depth = stations["morbi"]["depth"][-1]', 'morbi_depth = stations.get("morbi", list(stations.values())[-1])["depth"][-1]')
content = content.replace('color="blue" if key != "morbi" else "black"', 'color="black" if key == "morbi" else "blue"')
content = content.replace('morbi_peak = float(max(stations["morbi"]["depth"]))', 'morbi_peak = float(max(stations.get("morbi", list(stations.values())[-1])["depth"]))')
content = content.replace('morbi_depths = np.array(stations["morbi"]["depth"])', 'morbi_depths = np.array(stations.get("morbi", list(stations.values())[-1])["depth"])')

# 6. Update main function
old_main_start = """def main():
    print("=" * 70)
    print("  Directive 5A: 2D Hydrodynamic Dam Breach Flood Simulation")
    print("  Machhu-II Dam Failure, Morbi Floodplain, Gujarat")
    print("=" * 70)

    # 1. Load breach parameters
    breach_params = load_breach_parameters()"""

new_main_start = """def main():
    parser = argparse.ArgumentParser(description="Run 2D Hydrodynamic Dam Breach Flood Simulation")
    parser.add_argument("--dam_config", type=str, default="machhu-ii", help="Key of the dam configuration in config.json")
    args = parser.parse_args()

    config_path = PROJECT_ROOT / "config.json"
    if config_path.is_file():
        with open(config_path, "r") as f:
            all_configs = json.load(f)
            dam_config = all_configs.get(args.dam_config, all_configs["machhu-ii"])
    else:
        dam_config = None
        
    print("=" * 70)
    print("  Directive 5A: 2D Hydrodynamic Dam Breach Flood Simulation")
    print(f"  {dam_config['dam_name']} Failure, {dam_config['state']}")
    print("=" * 70)

    # 1. Load breach parameters
    breach_params = load_breach_parameters()
    if dam_config and dam_config.get("reservoir_volume_m3"):
        breach_params["V_reservoir_m3"] = dam_config["reservoir_volume_m3"]
    if dam_config and dam_config.get("dam_height_m"):
        breach_params["H_dam_m"] = dam_config["dam_height_m"]"""
content = content.replace(old_main_start, new_main_start)

# Update run_2d_hydrodynamic_simulation call in main
content = content.replace('sim_results = run_2d_hydrodynamic_simulation(DEM_FILE, hydrograph_tuple, breach_params)', 'sim_results = run_2d_hydrodynamic_simulation(DEM_FILE, hydrograph_tuple, breach_params, dam_config)')

content = content.replace("summary['monitoring_gauges']['morbi']", "summary['monitoring_gauges'].get('morbi', list(summary['monitoring_gauges'].values())[-1])")

with open("scripts/10_hydrodynamic_simulation.py", "w") as f:
    f.write(content)

print("Refactored 10_hydrodynamic_simulation.py successfully.")
