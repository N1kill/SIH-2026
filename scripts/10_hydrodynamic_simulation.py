#!/usr/bin/env python3
"""
10_hydrodynamic_simulation.py
=============================
Directive 5A: 2D Hydrodynamic Flood Simulation Engine (Dam Break & Inundation)
Machhu-II Dam Failure & Morbi Floodplain Simulation

Features:
  1. Synthesizes total unsteady breach outflow hydrograph by coupling:
     - Upstream catchment inflow hydrograph (Directive 3 / hydrograph.csv)
     - Froehlich (2008) / Froehlich (1995) dynamic breach outflow hydrograph:
       Peak Q_p = 6,647 m³/s, formation time t_f = 2.50 h, reservoir volume V = 101 Mm³
  2. 2D Hydrodynamic Unsteady Flood Inundation Engine:
     - Solves 2D mass conservation and Manning's 2D kinematic/diffusive flood routing
     - High-resolution grid propagation over conditioned 30m DEM (UTM 42N)
     - Tracks maximum flood depth [m], maximum velocity [m/s], arrival time [h], duration [h]
  3. Gauge Hydrographs:
     - Machhu-II Dam Toe (0 km)
     - Morbi City Center (5.2 km downstream)
     - Lilapar (12.0 km downstream)
     - Malia (32.0 km downstream)
  4. Exports:
     - outputs/simulation/depth_max.tif
     - outputs/simulation/velocity_max.tif
     - outputs/simulation/arrival_time.tif
     - outputs/simulation/flood_duration.tif
     - outputs/simulation/simulation_summary.json
     - outputs/gis/inundation_depth_map.png
     - outputs/gis/flood_velocity_map.png
     - outputs/gis/arrival_time_map.png
     - outputs/gis/morbi_hydrograph.png
"""

import json
import logging
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
import matplotlib.colors as mcolors
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import rasterio
from rasterio.crs import CRS
from rasterio.transform import rowcol, xy
from scipy.ndimage import gaussian_filter

# Configure logging
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")

# Project directories
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
OUTPUTS_GIS = PROJECT_ROOT / "outputs" / "gis"
OUTPUTS_SIM = PROJECT_ROOT / "outputs" / "simulation"
DOCS_DIR = PROJECT_ROOT / "docs"

OUTPUTS_SIM.mkdir(parents=True, exist_ok=True)
OUTPUTS_GIS.mkdir(parents=True, exist_ok=True)

# File paths
DEM_FILE = DATA_PROCESSED / "dem_conditioned.tif"
if not DEM_FILE.is_file():
    DEM_FILE = DATA_PROCESSED / "dem_utm42.tif"

BREACH_PARAMS_FILE = DATA_PROCESSED / "breach_params.json"
INFLOW_CSV_FILE = OUTPUTS_GIS / "hydrograph.csv"
POUR_POINT_FILE = DATA_PROCESSED / "pour_point_snapped.shp"
WATERSHED_SHP = DATA_PROCESSED / "watershed.shp"

# ---------------------------------------------------------------------------
# 1. LOAD DAM & BREACH PARAMETERS
# ---------------------------------------------------------------------------
def load_breach_parameters():
    """Load Froehlich breach dimensions from Directive 4."""
    if BREACH_PARAMS_FILE.is_file():
        with open(BREACH_PARAMS_FILE, "r") as f:
            data = json.load(f)
        froehlich = data.get("froehlich_2008_geometry", {})
        peak = data.get("froehlich_1995_peak_flow", {})
        b_avg = froehlich.get("B_avg_m", 156.0)
        z_hv = froehlich.get("Z_HV", 1.4)
        t_f_hr = froehlich.get("t_f_hours", 2.497)
        q_peak = peak.get("Q_p_m3s", 6647.0)
        v_res = data.get("dam_parameters", {}).get("reservoir_volume_m3", 101.0e6)
        h_dam = data.get("dam_parameters", {}).get("embankment_height_m", 22.56)
    else:
        # Standard default fallback
        b_avg, z_hv, t_f_hr, q_peak, v_res, h_dam = 156.0, 1.4, 2.50, 6647.0, 101.0e6, 22.56

    return {
        "B_avg_m": b_avg,
        "Z_HV": z_hv,
        "t_f_hours": t_f_hr,
        "Q_peak_m3s": q_peak,
        "V_reservoir_m3": v_res,
        "H_dam_m": h_dam,
    }


# ---------------------------------------------------------------------------
# 2. SYNTHESIZE TOTAL BREACH & INFLOW HYDROGRAPH
# ---------------------------------------------------------------------------
def generate_unsteady_breach_hydrograph(breach_params, duration_hours=24.0, dt_seconds=60.0):
    """
    Generate unsteady dam-break outflow hydrograph Q(t).
    Combines:
      - Breach initiation and linear/polynomial growth to Q_peak at t_f
      - Exponential reservoir volume exhaustion drawdown
      - Base storm inflow component from watershed
    """
    t_f_sec = breach_params["t_f_hours"] * 3600.0
    q_p = breach_params["Q_peak_m3s"]
    v_total = breach_params["V_reservoir_m3"]
    
    total_steps = int((duration_hours * 3600.0) / dt_seconds) + 1
    times = np.linspace(0, duration_hours * 3600.0, total_steps)
    q_breach = np.zeros_like(times)
    
    # Rising limb: t in [0, t_f]
    # Q(t) = Q_p * (t / t_f)^1.8
    rise_mask = times <= t_f_sec
    q_breach[rise_mask] = q_p * (times[rise_mask] / t_f_sec) ** 1.8
    
    # Volume drained during rise:
    integrate_func = getattr(np, "trapezoid", getattr(np, "trapz", None))
    if integrate_func is not None:
        v_rise = float(integrate_func(q_breach[rise_mask], times[rise_mask]))
    else:
        v_rise = float(np.sum(0.5 * (q_breach[rise_mask][:-1] + q_breach[rise_mask][1:]) * np.diff(times[rise_mask])))
    v_remaining = max(v_total - v_rise, 0.2 * v_total)
    
    # Recession limb: exponential decay matching remaining volume
    # integral_{t_f}^{inf} Q_p * exp(-(t - t_f) / tau) dt = Q_p * tau = V_remaining  ==> tau = V_remaining / Q_p
    tau = v_remaining / q_p
    decay_mask = times > t_f_sec
    q_breach[decay_mask] = q_p * np.exp(-(times[decay_mask] - t_f_sec) / tau)
    
    # Add storm baseflow
    q_baseflow = 450.0  # background spillway and catchment discharge during peak monsoon
    q_total = q_breach + q_baseflow
    
    time_hours = times / 3600.0
    return time_hours, times, q_total, q_breach


# ---------------------------------------------------------------------------
# 3. 2D HYDRODYNAMIC FLOOD ROUTING SOLVER
# ---------------------------------------------------------------------------
def run_2d_hydrodynamic_simulation(dem_path, breach_hydrograph_tuple, breach_params):
    """
    2D Raster Hydrodynamic Flood Inundation Model.
    Downstream propagation from Machhu-II Dam (Morbi District, Gujarat).
    """
    time_hours, time_seconds, q_total, q_breach = breach_hydrograph_tuple
    
    logging.info(f"Opening conditioned DEM: {dem_path}")
    with rasterio.open(dem_path) as src:
        dem = src.read(1).astype(np.float32)
        transform = src.transform
        crs = src.crs
        nodata = src.nodata
        res_x = abs(transform[0])
        res_y = abs(transform[4])
        cell_size = (res_x + res_y) / 2.0
        nrows, ncols = dem.shape
        bounds = src.bounds

    # Handle nodata
    if nodata is not None:
        valid_mask = dem != nodata
        dem[~valid_mask] = np.nan
    else:
        valid_mask = np.isfinite(dem)

    # Fill NaNs with interpolation for stability
    min_elev = np.nanmin(dem[valid_mask])
    dem[np.isnan(dem)] = min_elev

    # Identify Dam Pour Point / Breach Source Cell
    dam_x = 688755.0  # Approx UTM 42N for 22.82°N, 70.84°E
    dam_y = 2524458.0
    if POUR_POINT_FILE.is_file():
        try:
            gdf_pt = gpd.read_file(POUR_POINT_FILE)
            if not gdf_pt.empty:
                pt_geom = gdf_pt.geometry.iloc[0]
                dam_x, dam_y = pt_geom.x, pt_geom.y
                logging.info(f"Using snapped pour point from shapefile: ({dam_x:.1f}, {dam_y:.1f})")
        except Exception as e:
            logging.warning(f"Could not read pour point shapefile: {e}")

    r_dam, c_dam = rowcol(transform, dam_x, dam_y)
    r_dam = np.clip(r_dam, 0, nrows - 1)
    c_dam = np.clip(c_dam, 0, ncols - 1)
    logging.info(f"Dam source cell in grid: row={r_dam}, col={c_dam}, elev={dem[r_dam, c_dam]:.2f}m")

    # Helper to snap gauge station coordinates to lowest elevation / stream channel in vicinity
    def snap_to_channel(r_center, c_center, radius=12):
        r_low, r_high = max(0, r_center - radius), min(nrows, r_center + radius + 1)
        c_low, c_high = max(0, c_center - radius), min(ncols, c_center + radius + 1)
        sub_elev = dem[r_low:r_high, c_low:c_high]
        min_idx = np.unravel_index(np.argmin(sub_elev), sub_elev.shape)
        return r_low + min_idx[0], c_low + min_idx[1]

    # Define key monitoring stations (snapped to channel thalweg)
    r_dam_snapped, c_dam_snapped = snap_to_channel(r_dam, c_dam, radius=5)
    r_morbi, c_morbi = snap_to_channel(r_dam - 173, c_dam - 30, radius=15)  # ~5.2 km downstream along river
    r_lilapar, c_lilapar = snap_to_channel(r_dam - 400, c_dam - 60, radius=20)  # ~12 km downstream
    r_malia, c_malia = snap_to_channel(r_dam - 1050, c_dam - 120, radius=30)  # ~32 km downstream

    stations = {
        "dam_toe": {"name": "Machhu-II Dam Toe (0 km)", "r": r_dam_snapped, "c": c_dam_snapped, "depth": []},
        "morbi": {"name": "Morbi City Center (5.2 km)", "r": r_morbi, "c": c_morbi, "depth": []},
        "lilapar": {"name": "Lilapar Bridge (12 km)", "r": r_lilapar, "c": c_lilapar, "depth": []},
        "malia": {"name": "Malia Miyana (32 km)", "r": r_malia, "c": c_malia, "depth": []},
    }

    logging.info(f"Monitoring stations snapped to river channel:")
    for k, v in stations.items():
        logging.info(f"  {v['name']}: row={v['r']}, col={v['c']}, elev={dem[v['r'], v['c']]:.2f}m")

    # Simulation arrays
    depth_grid = np.zeros((nrows, ncols), dtype=np.float32)
    max_depth_grid = np.zeros((nrows, ncols), dtype=np.float32)
    max_velocity_grid = np.zeros((nrows, ncols), dtype=np.float32)
    arrival_time_grid = np.full((nrows, ncols), np.nan, dtype=np.float32)
    duration_grid = np.zeros((nrows, ncols), dtype=np.float32)

    # Downstream slope and flow direction tensor
    grad_y, grad_x = np.gradient(dem, cell_size)
    slope = np.sqrt(grad_x**2 + grad_y**2)
    slope = np.maximum(slope, 0.0005)  # minimum slope floor to prevent division by zero

    # Manning's roughness n (composite floodplain = 0.035, river channel = 0.030)
    manning_n = 0.035
    
    manning_n = 0.035
    
    # 2D Hydrodynamic Flood Routing (Mass-conserving upwind shallow water wave)
    dt_sim = 60.0  # seconds
    n_steps = len(time_seconds)
    cell_area = cell_size * cell_size

    # Define active downstream computational bounding box
    r_start = max(0, r_dam - 1500)
    r_end = min(nrows, r_dam + 150)
    c_start = max(0, c_dam - 600)
    c_end = min(ncols, c_dam + 600)
    logging.info(f"Active simulation domain: rows [{r_start}:{r_end}], cols [{c_start}:{c_end}] (resolution: {cell_size:.1f}m)")

    logging.info(f"Starting 2D hydrodynamic simulation ({n_steps} timesteps, dt={dt_sim}s)...")
    report_interval = max(n_steps // 10, 1)

    # Pre-calculate neighborhood offsets and distances (8 directions)
    dr_dc = [
        (-1, 0, cell_size),
        (1, 0, cell_size),
        (0, -1, cell_size),
        (0, 1, cell_size),
        (-1, -1, cell_size * 1.414),
        (-1, 1, cell_size * 1.414),
        (1, -1, cell_size * 1.414),
        (1, 1, cell_size * 1.414),
    ]

    for step in range(n_steps):
        t_sec = time_seconds[step]
        t_hr = time_hours[step]
        q_in = q_total[step]

        # 1. Inject breach outflow at source region
        source_radius_cells = max(int(breach_params["B_avg_m"] / (2 * cell_size)), 1)
        r_min, r_max = max(0, r_dam - source_radius_cells), min(nrows, r_dam + source_radius_cells + 1)
        c_min, c_max = max(0, c_dam - source_radius_cells), min(ncols, c_dam + source_radius_cells + 1)
        num_source_cells = (r_max - r_min) * (c_max - c_min)
        
        water_volume_injected = (q_in * dt_sim) / num_source_cells
        depth_grid[r_min:r_max, c_min:c_max] += (water_volume_injected / cell_area)

        # 2. 2D Hydrodynamic Flow Routing
        sub_depth = depth_grid[r_start:r_end, c_start:c_end]
        sub_dem = dem[r_start:r_end, c_start:c_end]
        sub_wse = sub_dem + sub_depth
        
        wet_mask = sub_depth > 0.05
        if np.any(wet_mask):
            gwse_y, gwse_x = np.gradient(sub_wse, cell_size)
            wse_slope = np.sqrt(gwse_x**2 + gwse_y**2)
            wse_slope = np.maximum(wse_slope, 0.0001)

            # Local velocity
            vel = np.zeros_like(sub_depth)
            vel[wet_mask] = (1.0 / manning_n) * (sub_depth[wet_mask] ** (2.0 / 3.0)) * np.sqrt(wse_slope[wet_mask])
            vel = np.clip(vel, 0.0, 12.0)
            max_velocity_grid[r_start:r_end, c_start:c_end] = np.maximum(
                max_velocity_grid[r_start:r_end, c_start:c_end], vel
            )

            # Mass-conserving down-gradient flux transfer
            # Directional transfers along water surface gradient
            sub_nrows, sub_ncols = sub_depth.shape
            d_vol = np.zeros_like(sub_depth)

            # Downward flow along river gradient (towards lower row indices in DEM)
            wet_r, wet_c = np.where(sub_depth > 0.08)
            for i in range(len(wet_r)):
                r, c = wet_r[i], wet_c[i]
                h_curr = sub_depth[r, c]
                wse_curr = sub_wse[r, c]
                
                # Check 8 neighbors
                best_slope = 0.0
                best_dr, best_dc, best_dist = 0, 0, cell_size
                
                for dr, dc, dist in dr_dc:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < sub_nrows and 0 <= nc < sub_ncols:
                        slp = (wse_curr - sub_wse[nr, nc]) / dist
                        if slp > best_slope:
                            best_slope = slp
                            best_dr, best_dc, best_dist = dr, dc, dist
                
                if best_slope > 0.0002:
                    # Manning flow rate Q = (1/n) * A * R^(2/3) * S^(1/2)
                    flow_velocity = (1.0 / manning_n) * (h_curr ** (2.0 / 3.0)) * np.sqrt(best_slope)
                    flow_velocity = min(flow_velocity, 10.0)
                    flux_vol = min(flow_velocity * h_curr * cell_size * dt_sim, h_curr * cell_area * 0.45)
                    
                    d_vol[r, c] -= flux_vol
                    d_vol[r + best_dr, c + best_dc] += flux_vol

            # Update sub-grid depths
            sub_depth += (d_vol / cell_area)
            sub_depth = np.maximum(sub_depth, 0.0)
            depth_grid[r_start:r_end, c_start:c_end] = sub_depth

        # 3. Update Max State Grids
        active_wet = depth_grid >= 0.10
        max_depth_grid = np.maximum(max_depth_grid, depth_grid)
        
        new_arrival = active_wet & np.isnan(arrival_time_grid)
        arrival_time_grid[new_arrival] = t_hr
        duration_grid[active_wet] += (dt_sim / 3600.0)

        # 4. Record Gauge Timeseries
        for key, st in stations.items():
            st["depth"].append(float(depth_grid[st["r"], st["c"]]))

        if step % report_interval == 0 or step == n_steps - 1:
            peak_curr = np.max(depth_grid)
            inund_area_km2 = np.sum(depth_grid > 0.10) * (cell_area / 1e6)
            morbi_depth = depth_grid[r_morbi, c_morbi]
            logging.info(f"  t = {t_hr:5.2f}h | Max Depth = {peak_curr:5.2f}m | Inundated Area = {inund_area_km2:6.1f} km² | Morbi Depth = {morbi_depth:4.2f}m")

    # Post-processing: Cartographic refinement
    max_depth_grid = gaussian_filter(max_depth_grid, sigma=0.4)
    max_velocity_grid = gaussian_filter(max_velocity_grid, sigma=0.4)
    logging.info("Simulation loop completed successfully.")
    
    return {
        "dem": dem,
        "transform": transform,
        "crs": crs,
        "max_depth": max_depth_grid,
        "max_velocity": max_velocity_grid,
        "arrival_time": arrival_time_grid,
        "duration": duration_grid,
        "stations": stations,
        "time_hours": time_hours,
        "cell_size": cell_size,
    }


# ---------------------------------------------------------------------------
# 4. EXPORT GEOTIFFS
# ---------------------------------------------------------------------------
def export_geotiffs(sim_results):
    """Write maximum depth, velocity, arrival time, and duration rasters as GeoTIFFs."""
    transform = sim_results["transform"]
    crs = sim_results["crs"]
    nrows, ncols = sim_results["max_depth"].shape
    
    profile = {
        "driver": "GTiff",
        "dtype": rasterio.float32,
        "nodata": -9999.0,
        "width": ncols,
        "height": nrows,
        "count": 1,
        "crs": crs,
        "transform": transform,
        "compress": "lzw",
    }

    layers = [
        ("depth_max.tif", sim_results["max_depth"], "Maximum Flood Depth [m]"),
        ("velocity_max.tif", sim_results["max_velocity"], "Maximum Flow Velocity [m/s]"),
        ("arrival_time.tif", np.nan_to_num(sim_results["arrival_time"], nan=-9999.0), "Flood Arrival Time [hours]"),
        ("flood_duration.tif", sim_results["duration"], "Inundation Duration [hours]"),
    ]

    for fname, data_arr, desc in layers:
        out_path = OUTPUTS_SIM / fname
        data_to_write = data_arr.copy()
        if fname != "arrival_time.tif":
            data_to_write[data_to_write <= 0.01] = -9999.0

        with rasterio.open(out_path, "w", **profile) as dst:
            dst.write(data_to_write.astype(np.float32), 1)
            dst.set_band_description(1, desc)
        logging.info(f"Saved GeoTIFF: {out_path} ({out_path.stat().st_size / 1e6:.2f} MB)")


# ---------------------------------------------------------------------------
# 5. GENERATE VISUALIZATION PLOTS & MAPS
# ---------------------------------------------------------------------------
def generate_simulation_plots(sim_results, breach_hydrograph_tuple, breach_params):
    """Generate high-quality maps and stage-discharge hydrographs."""
    time_hours, _, q_total, q_breach = breach_hydrograph_tuple
    stations = sim_results["stations"]
    max_depth = sim_results["max_depth"]
    max_velocity = sim_results["max_velocity"]
    arrival_time = sim_results["arrival_time"]

    # 1. Gauge Stage Hydrograph Plot (Morbi & Dam Toe)
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(11, 8), sharex=True, dpi=200)
    
    # Discharge hydrograph
    ax1.plot(time_hours, q_total, color="#d90429", lw=2.2, label=f"Total Outflow (Peak: {np.max(q_total):,.0f} m³/s)")
    ax1.plot(time_hours, q_breach, color="#f77f00", lw=1.6, linestyle="--", label=f"Breach Outflow (Froehlich Q_p: {breach_params['Q_peak_m3s']:,.0f} m³/s)")
    ax1.set_ylabel("Discharge Q [m³/s]", fontsize=11, fontweight="bold")
    ax1.set_title("Machhu-II Dam Breach Hydrograph & Downstream Stage Propagation", fontsize=13, fontweight="bold", pad=10)
    ax1.grid(True, linestyle=":", alpha=0.6)
    ax1.legend(loc="upper right", frameon=True)

    # Inundation depth hydrograph at monitoring stations
    colors = {"dam_toe": "#03045e", "morbi": "#d90429", "lilapar": "#0077b6", "malia": "#0096c7"}
    for key, st in stations.items():
        peak_d = max(st["depth"])
        ax2.plot(time_hours, st["depth"], color=colors[key], lw=2.0, label=f"{st['name']} (Peak: {peak_d:.2f} m)")

    ax2.axhline(3.0, color="gray", linestyle=":", lw=1.5, label="Morbi Historical Flood Level (~3.0 m / 10 ft)")
    ax2.set_xlabel("Time from Failure Initiation [hours]", fontsize=11, fontweight="bold")
    ax2.set_ylabel("Flood Inundation Depth [m]", fontsize=11, fontweight="bold")
    ax2.set_xlim(0, 24)
    ax2.grid(True, linestyle=":", alpha=0.6)
    ax2.legend(loc="upper right", frameon=True)

    plt.tight_layout()
    plot_path = OUTPUTS_GIS / "morbi_hydrograph.png"
    plt.savefig(plot_path, dpi=200)
    plt.close()
    logging.info(f"Saved hydrograph plot: {plot_path}")

    # 2. Maximum Flood Depth Map
    fig, ax = plt.subplots(figsize=(10, 8), dpi=200)
    masked_depth = np.ma.masked_where(max_depth < 0.1, max_depth)
    cmap_depth = plt.cm.YlOrRd
    im = ax.imshow(masked_depth, cmap=cmap_depth, vmin=0, vmax=10.0)
    cbar = plt.colorbar(im, ax=ax, fraction=0.035, pad=0.04)
    cbar.set_label("Maximum Flood Depth [m]", fontsize=10, fontweight="bold")
    
    # Plot station markers
    for key, st in stations.items():
        ax.plot(st["c"], st["r"], marker="o", markersize=6, color="blue" if key != "morbi" else "black", markeredgecolor="white")
        ax.text(st["c"] + 15, st["r"], st["name"], color="black", fontsize=8, fontweight="bold",
                bbox=dict(boxstyle="round,pad=0.2", facecolor="white", alpha=0.8, edgecolor="none"))

    ax.set_title("Machhu-II Dam Breach: Maximum 2D Inundation Depth Map", fontsize=12, fontweight="bold")
    ax.axis("off")
    plt.tight_layout()
    depth_map_path = OUTPUTS_GIS / "inundation_depth_map.png"
    plt.savefig(depth_map_path, dpi=200)
    plt.close()
    logging.info(f"Saved depth map: {depth_map_path}")

    # 3. Maximum Velocity Map
    fig, ax = plt.subplots(figsize=(10, 8), dpi=200)
    masked_vel = np.ma.masked_where(max_velocity < 0.1, max_velocity)
    im = ax.imshow(masked_vel, cmap=plt.cm.plasma, vmin=0, vmax=6.0)
    cbar = plt.colorbar(im, ax=ax, fraction=0.035, pad=0.04)
    cbar.set_label("Maximum Flow Velocity [m/s]", fontsize=10, fontweight="bold")
    ax.set_title("Machhu-II Dam Breach: Maximum 2D Flow Velocity Map", fontsize=12, fontweight="bold")
    ax.axis("off")
    plt.tight_layout()
    vel_map_path = OUTPUTS_GIS / "flood_velocity_map.png"
    plt.savefig(vel_map_path, dpi=200)
    plt.close()
    logging.info(f"Saved velocity map: {vel_map_path}")

    # 4. Flood Arrival Time Map
    fig, ax = plt.subplots(figsize=(10, 8), dpi=200)
    masked_arr = np.ma.masked_where(np.isnan(arrival_time) | (max_depth < 0.1), arrival_time)
    im = ax.imshow(masked_arr, cmap=plt.cm.turbo, vmin=0, vmax=12.0)
    cbar = plt.colorbar(im, ax=ax, fraction=0.035, pad=0.04)
    cbar.set_label("Flood Wave Arrival Time [hours]", fontsize=10, fontweight="bold")
    ax.set_title("Machhu-II Dam Breach: Flood Arrival Time Map", fontsize=12, fontweight="bold")
    ax.axis("off")
    plt.tight_layout()
    arr_map_path = OUTPUTS_GIS / "arrival_time_map.png"
    plt.savefig(arr_map_path, dpi=200)
    plt.close()
    logging.info(f"Saved arrival time map: {arr_map_path}")


# ---------------------------------------------------------------------------
# 6. EXPORT SUMMARY JSON
# ---------------------------------------------------------------------------
def export_summary_json(sim_results, breach_params, breach_hydrograph_tuple):
    """Save comprehensive simulation metrics for dashboard and reporting."""
    time_hours, _, q_total, _ = breach_hydrograph_tuple
    max_depth = sim_results["max_depth"]
    max_vel = sim_results["max_velocity"]
    stations = sim_results["stations"]
    cell_size = sim_results["cell_size"]
    cell_area = cell_size * cell_size

    inund_area_km2 = float(np.sum(max_depth >= 0.10) * (cell_area / 1e6))
    deep_area_km2 = float(np.sum(max_depth >= 2.0) * (cell_area / 1e6))

    summary = {
        "project": "Machhu-II Dam Breach 3D Simulation",
        "directive": "5A",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model_engine": "2D Unsteady Hydrodynamic Raster Engine (Manning / Diffusive Wave)",
        "grid_resolution_m": float(cell_size),
        "breach_parameters_used": breach_params,
        "peak_discharge_m3s": float(np.max(q_total)),
        "total_inundation_area_km2": round(inund_area_km2, 2),
        "area_depth_gt_2m_km2": round(deep_area_km2, 2),
        "max_simulated_depth_m": round(float(np.max(max_depth)), 2),
        "max_simulated_velocity_ms": round(float(np.max(max_vel)), 2),
        "monitoring_gauges": {
            k: {
                "name": v["name"],
                "peak_depth_m": round(float(max(v["depth"])), 2),
                "arrival_time_hours": round(float(time_hours[np.argmax(np.array(v["depth"]) >= 0.10)]), 2) if any(np.array(v["depth"]) >= 0.10) else None,
                "peak_time_hours": round(float(time_hours[np.argmax(v["depth"])]), 2),
            }
            for k, v in stations.items()
        },
        "output_files": {
            "depth_max": str(OUTPUTS_SIM / "depth_max.tif"),
            "velocity_max": str(OUTPUTS_SIM / "velocity_max.tif"),
            "arrival_time": str(OUTPUTS_SIM / "arrival_time.tif"),
            "flood_duration": str(OUTPUTS_SIM / "flood_duration.tif"),
            "hydrograph_plot": str(OUTPUTS_GIS / "morbi_hydrograph.png"),
            "depth_map": str(OUTPUTS_GIS / "inundation_depth_map.png"),
        }
    }

    out_file = OUTPUTS_SIM / "simulation_summary.json"
    with open(out_file, "w") as f:
        json.dump(summary, f, indent=2)
    logging.info(f"Saved simulation summary: {out_file}")
    return summary


# ---------------------------------------------------------------------------
# MAIN EXECUTION
# ---------------------------------------------------------------------------
def main():
    print("=" * 70)
    print("  Directive 5A: 2D Hydrodynamic Dam Breach Flood Simulation")
    print("  Machhu-II Dam Failure, Morbi Floodplain, Gujarat")
    print("=" * 70)

    # 1. Load breach parameters
    breach_params = load_breach_parameters()
    print(f"\n[1] Breach Parameters:")
    print(f"    Average Width B_avg = {breach_params['B_avg_m']:.1f} m")
    print(f"    Side Slope Z        = {breach_params['Z_HV']:.1f} (H:V)")
    print(f"    Formation Time t_f  = {breach_params['t_f_hours']:.2f} h")
    print(f"    Peak Discharge Q_p  = {breach_params['Q_peak_m3s']:,.0f} m³/s")
    print(f"    Reservoir Volume V  = {breach_params['V_reservoir_m3']/1e6:.1f} Mm³")

    # 2. Synthesize unsteady hydrograph
    hydrograph_tuple = generate_unsteady_breach_hydrograph(breach_params, duration_hours=24.0, dt_seconds=60.0)
    time_h, _, q_tot, _ = hydrograph_tuple
    print(f"\n[2] Hydrograph Synthesized: 24h duration, peak outflow = {np.max(q_tot):,.0f} m³/s at t = {time_h[np.argmax(q_tot)]:.2f} h")

    # 3. Run 2D Hydrodynamic Simulation
    sim_results = run_2d_hydrodynamic_simulation(DEM_FILE, hydrograph_tuple, breach_params)

    # 4. Export GeoTIFFs
    print(f"\n[3] Exporting GeoTIFF Rasters to outputs/simulation/...")
    export_geotiffs(sim_results)

    # 5. Generate Maps and Plots
    print(f"\n[4] Generating High-Resolution Cartographic Maps & Hydrographs...")
    generate_simulation_plots(sim_results, hydrograph_tuple, breach_params)

    # 6. Save JSON Summary
    summary = export_summary_json(sim_results, breach_params, hydrograph_tuple)

    print("\n" + "=" * 70)
    print("  Simulation Finished Successfully!")
    print(f"  Total Inundated Area : {summary['total_inundation_area_km2']} km²")
    print(f"  Max Inundation Depth : {summary['max_simulated_depth_m']} m")
    print(f"  Morbi Peak Depth     : {summary['monitoring_gauges']['morbi']['peak_depth_m']} m (Historical ~3.0 m)")
    print(f"  Morbi Arrival Time   : {summary['monitoring_gauges']['morbi']['arrival_time_hours']} hours post-breach")
    print("=" * 70)


if __name__ == "__main__":
    main()
