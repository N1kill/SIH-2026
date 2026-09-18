import sys

with open("scripts/12_validation_and_sensitivity.py", "r") as f:
    content = f.read()

# Add import for simulation functions
content = content.replace('from rasterio.crs import CRS\n', 'from rasterio.crs import CRS\nimport importlib.util\nsys.path.append(str(PROJECT_ROOT / "scripts"))\nimport importlib\nmod10 = importlib.import_module("10_hydrodynamic_simulation")\ngenerate_unsteady_breach_hydrograph = mod10.generate_unsteady_breach_hydrograph\nrun_2d_hydrodynamic_simulation = mod10.run_2d_hydrodynamic_simulation\nDEM_FILE = PROJECT_ROOT / "data" / "processed" / "dem_conditioned.tif"\nif not DEM_FILE.is_file():\n    DEM_FILE = PROJECT_ROOT / "data" / "processed" / "dem_utm42.tif"\n')

# Rewrite compute_sensitivity_scenarios
old_func_start = """def compute_sensitivity_scenarios():
    \"\"\"Run parametric sensitivity variations on breach width and formation time.\"\"\""""
old_func_end = """    ]
    return scenarios"""

old_func_full = content[content.find(old_func_start):content.find(old_func_end) + len(old_func_end)]

new_func = """def compute_sensitivity_scenarios():
    \"\"\"Run genuine physics-based simulation for each scenario.\"\"\"
    base_morbi_peak = 3.85
    base_inund_area = 71.49
    
    with open(PROJECT_ROOT / "config.json", "r") as f:
        config = json.load(f)["machhu-ii"]

    # Base parameters
    scenarios = [
        {"id": "base", "name": "Base Case", "B_avg": 156.0, "t_f": 2.50, "Q_p": 6647.0},
        {"id": "width_plus25", "name": "+25% Width", "B_avg": 195.0, "t_f": 2.00, "Q_p": 8309.0},
        {"id": "width_minus25", "name": "-25% Width", "B_avg": 117.0, "t_f": 3.12, "Q_p": 4985.0},
        {"id": "extreme_plus50", "name": "+50% Extreme", "B_avg": 234.0, "t_f": 1.50, "Q_p": 10500.0},
        {"id": "conservative_minus50", "name": "-50% Conservative", "B_avg": 78.0, "t_f": 4.00, "Q_p": 3324.0},
    ]

    for sc in scenarios:
        breach_params = {
            "B_avg_m": sc["B_avg"],
            "Z_HV": 1.4,
            "t_f_hours": sc["t_f"],
            "Q_peak_m3s": sc["Q_p"],
            "V_reservoir_m3": config["reservoir_volume_m3"],
            "H_dam_m": config["dam_height_m"],
        }
        
        logging.info(f"Running physics scenario: {sc['name']}")
        hydro_tuple = generate_unsteady_breach_hydrograph(breach_params, duration_hours=24.0, dt_seconds=120.0)
        
        # Simulate (shortened loop in test environment if we want, but we do the full run here as per requirement)
        # We can pass a shorter time if we wanted to save time, but physics requires it.
        # Run the full 2D solver
        res = run_2d_hydrodynamic_simulation(DEM_FILE, hydro_tuple, breach_params, config)
        
        # Calculate real area and depth
        morbi_st = res["stations"].get("morbi", list(res["stations"].values())[-1])
        sc["peak_depth_morbi"] = round(float(np.max(morbi_st["depth"])), 2)
        cell_area = res["cell_size"] ** 2
        sc["inund_area_km2"] = round(float(np.sum(res["max_depth"] >= 0.1) * (cell_area / 1e6)), 1)
        logging.info(f"Scenario {sc['name']} completed: Peak={sc['peak_depth_morbi']}m, Area={sc['inund_area_km2']}km2")
        
    return scenarios"""

content = content.replace(old_func_full, new_func)

with open("scripts/12_validation_and_sensitivity.py", "w") as f:
    f.write(content)
print("Refactored 12_validation_and_sensitivity.py")
