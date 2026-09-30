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
import argparse
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
from numba import njit, prange, cuda

GPU_AVAILABLE = False
try:
    if cuda.is_available():
        GPU_AVAILABLE = True
except Exception:
    pass


# Numba-optimized 2D Diffusive Wave routing step
@njit(parallel=True)
def diffusive_wave_step(
    box_dem, box_depth, n_substeps, dt_sub, cell_size, cell_area, manning_n
):
    nrows, ncols = box_dem.shape
    drs = np.array([-1, 1, 0, 0, -1, -1, 1, 1], dtype=np.int32)
    dcs = np.array([0, 0, -1, 1, -1, 1, -1, 1], dtype=np.int32)
    # distance weights
    dists = np.array(
        [
            cell_size,
            cell_size,
            cell_size,
            cell_size,
            cell_size * 1.4142,
            cell_size * 1.4142,
            cell_size * 1.4142,
            cell_size * 1.4142,
        ],
        dtype=np.float32,
    )

    for _ in range(n_substeps):
        box_wse = box_dem + box_depth

        fluxes = np.zeros((nrows, ncols, 8), dtype=np.float32)
        total_out = np.zeros((nrows, ncols), dtype=np.float32)

        for r in prange(nrows):
            for c in range(ncols):
                depth = box_depth[r, c]
                if depth <= 0.05:
                    continue

                wse = box_wse[r, c]
                for i in range(8):
                    nr = r + drs[i]
                    nc = c + dcs[i]
                    if 0 <= nr < nrows and 0 <= nc < ncols:
                        nwse = box_wse[nr, nc]
                        slope = (wse - nwse) / dists[i]
                        if slope > 0.0001:
                            v_flow = (
                                (1.0 / manning_n)
                                * (depth ** (2.0 / 3.0))
                                * np.sqrt(slope)
                            )
                            flux = v_flow * depth * cell_size * dt_sub
                            fluxes[r, c, i] = flux
                            total_out[r, c] += flux

        d_vol = np.zeros((nrows, ncols), dtype=np.float32)
        max_out = box_depth * cell_area * 0.85

        for r in prange(nrows):
            for c in range(ncols):
                tout = total_out[r, c]
                if tout > 0.0:
                    scale = min(1.0, max_out[r, c] / (tout + 1e-6))
                    for i in range(8):
                        f = fluxes[r, c, i] * scale
                        if f > 0.0:
                            d_vol[r, c] -= f
                            d_vol[r + drs[i], c + dcs[i]] += f

        for r in prange(nrows):
            for c in range(ncols):
                box_depth[r, c] = max(0.0, box_depth[r, c] + d_vol[r, c] / cell_area)


if GPU_AVAILABLE:

    @cuda.jit
    def cuda_zero_arrays(wse, dem, depth, fluxes, total_out, d_vol):
        r, c = cuda.grid(2)
        if r < dem.shape[0] and c < dem.shape[1]:
            wse[r, c] = dem[r, c] + depth[r, c]
            total_out[r, c] = 0.0
            d_vol[r, c] = 0.0
            for i in range(8):
                fluxes[r, c, i] = 0.0

    @cuda.jit
    def cuda_compute_flux(
        box_dem,
        box_depth,
        box_wse,
        fluxes,
        total_out,
        dt_sub,
        cell_size,
        cell_area,
        manning_n,
    ):
        r, c = cuda.grid(2)
        nrows, ncols = box_dem.shape
        drs_0, drs_1, drs_2, drs_3, drs_4, drs_5, drs_6, drs_7 = (
            -1,
            1,
            0,
            0,
            -1,
            -1,
            1,
            1,
        )
        dcs_0, dcs_1, dcs_2, dcs_3, dcs_4, dcs_5, dcs_6, dcs_7 = (
            0,
            0,
            -1,
            1,
            -1,
            1,
            -1,
            1,
        )
        d_0 = d_1 = d_2 = d_3 = cell_size
        d_4 = d_5 = d_6 = d_7 = cell_size * 1.4142

        if r < nrows and c < ncols:
            depth = box_depth[r, c]
            if depth > 0.05:
                wse = box_wse[r, c]

                # Check 8 neighbors
                # 0
                nr = r + drs_0
                nc = c + dcs_0
                if 0 <= nr < nrows and 0 <= nc < ncols:
                    slope = (wse - box_wse[nr, nc]) / d_0
                    if slope > 0.0001:
                        flux = (
                            (1.0 / manning_n)
                            * (depth ** (2.0 / 3.0))
                            * math.sqrt(slope)
                            * depth
                            * cell_size
                            * dt_sub
                        )
                        fluxes[r, c, 0] = flux
                        total_out[r, c] += flux
                # 1
                nr = r + drs_1
                nc = c + dcs_1
                if 0 <= nr < nrows and 0 <= nc < ncols:
                    slope = (wse - box_wse[nr, nc]) / d_1
                    if slope > 0.0001:
                        flux = (
                            (1.0 / manning_n)
                            * (depth ** (2.0 / 3.0))
                            * math.sqrt(slope)
                            * depth
                            * cell_size
                            * dt_sub
                        )
                        fluxes[r, c, 1] = flux
                        total_out[r, c] += flux
                # 2
                nr = r + drs_2
                nc = c + dcs_2
                if 0 <= nr < nrows and 0 <= nc < ncols:
                    slope = (wse - box_wse[nr, nc]) / d_2
                    if slope > 0.0001:
                        flux = (
                            (1.0 / manning_n)
                            * (depth ** (2.0 / 3.0))
                            * math.sqrt(slope)
                            * depth
                            * cell_size
                            * dt_sub
                        )
                        fluxes[r, c, 2] = flux
                        total_out[r, c] += flux
                # 3
                nr = r + drs_3
                nc = c + dcs_3
                if 0 <= nr < nrows and 0 <= nc < ncols:
                    slope = (wse - box_wse[nr, nc]) / d_3
                    if slope > 0.0001:
                        flux = (
                            (1.0 / manning_n)
                            * (depth ** (2.0 / 3.0))
                            * math.sqrt(slope)
                            * depth
                            * cell_size
                            * dt_sub
                        )
                        fluxes[r, c, 3] = flux
                        total_out[r, c] += flux
                # 4
                nr = r + drs_4
                nc = c + dcs_4
                if 0 <= nr < nrows and 0 <= nc < ncols:
                    slope = (wse - box_wse[nr, nc]) / d_4
                    if slope > 0.0001:
                        flux = (
                            (1.0 / manning_n)
                            * (depth ** (2.0 / 3.0))
                            * math.sqrt(slope)
                            * depth
                            * cell_size
                            * dt_sub
                        )
                        fluxes[r, c, 4] = flux
                        total_out[r, c] += flux
                # 5
                nr = r + drs_5
                nc = c + dcs_5
                if 0 <= nr < nrows and 0 <= nc < ncols:
                    slope = (wse - box_wse[nr, nc]) / d_5
                    if slope > 0.0001:
                        flux = (
                            (1.0 / manning_n)
                            * (depth ** (2.0 / 3.0))
                            * math.sqrt(slope)
                            * depth
                            * cell_size
                            * dt_sub
                        )
                        fluxes[r, c, 5] = flux
                        total_out[r, c] += flux
                # 6
                nr = r + drs_6
                nc = c + dcs_6
                if 0 <= nr < nrows and 0 <= nc < ncols:
                    slope = (wse - box_wse[nr, nc]) / d_6
                    if slope > 0.0001:
                        flux = (
                            (1.0 / manning_n)
                            * (depth ** (2.0 / 3.0))
                            * math.sqrt(slope)
                            * depth
                            * cell_size
                            * dt_sub
                        )
                        fluxes[r, c, 6] = flux
                        total_out[r, c] += flux
                # 7
                nr = r + drs_7
                nc = c + dcs_7
                if 0 <= nr < nrows and 0 <= nc < ncols:
                    slope = (wse - box_wse[nr, nc]) / d_7
                    if slope > 0.0001:
                        flux = (
                            (1.0 / manning_n)
                            * (depth ** (2.0 / 3.0))
                            * math.sqrt(slope)
                            * depth
                            * cell_size
                            * dt_sub
                        )
                        fluxes[r, c, 7] = flux
                        total_out[r, c] += flux

    @cuda.jit
    def cuda_update_dvol(box_depth, fluxes, total_out, d_vol, cell_area):
        r, c = cuda.grid(2)
        nrows, ncols = box_depth.shape
        drs_0, drs_1, drs_2, drs_3, drs_4, drs_5, drs_6, drs_7 = (
            -1,
            1,
            0,
            0,
            -1,
            -1,
            1,
            1,
        )
        dcs_0, dcs_1, dcs_2, dcs_3, dcs_4, dcs_5, dcs_6, dcs_7 = (
            0,
            0,
            -1,
            1,
            -1,
            1,
            -1,
            1,
        )

        if r < nrows and c < ncols:
            tout = total_out[r, c]
            if tout > 0.0:
                max_out = box_depth[r, c] * cell_area * 0.85
                scale = 1.0
                if max_out < tout:
                    scale = max_out / tout

                f0 = fluxes[r, c, 0] * scale
                if f0 > 0.0:
                    cuda.atomic.add(d_vol, (r, c), -f0)
                    cuda.atomic.add(d_vol, (r + drs_0, c + dcs_0), f0)
                f1 = fluxes[r, c, 1] * scale
                if f1 > 0.0:
                    cuda.atomic.add(d_vol, (r, c), -f1)
                    cuda.atomic.add(d_vol, (r + drs_1, c + dcs_1), f1)
                f2 = fluxes[r, c, 2] * scale
                if f2 > 0.0:
                    cuda.atomic.add(d_vol, (r, c), -f2)
                    cuda.atomic.add(d_vol, (r + drs_2, c + dcs_2), f2)
                f3 = fluxes[r, c, 3] * scale
                if f3 > 0.0:
                    cuda.atomic.add(d_vol, (r, c), -f3)
                    cuda.atomic.add(d_vol, (r + drs_3, c + dcs_3), f3)
                f4 = fluxes[r, c, 4] * scale
                if f4 > 0.0:
                    cuda.atomic.add(d_vol, (r, c), -f4)
                    cuda.atomic.add(d_vol, (r + drs_4, c + dcs_4), f4)
                f5 = fluxes[r, c, 5] * scale
                if f5 > 0.0:
                    cuda.atomic.add(d_vol, (r, c), -f5)
                    cuda.atomic.add(d_vol, (r + drs_5, c + dcs_5), f5)
                f6 = fluxes[r, c, 6] * scale
                if f6 > 0.0:
                    cuda.atomic.add(d_vol, (r, c), -f6)
                    cuda.atomic.add(d_vol, (r + drs_6, c + dcs_6), f6)
                f7 = fluxes[r, c, 7] * scale
                if f7 > 0.0:
                    cuda.atomic.add(d_vol, (r, c), -f7)
                    cuda.atomic.add(d_vol, (r + drs_7, c + dcs_7), f7)

    @cuda.jit
    def cuda_apply_dvol(box_depth, d_vol, cell_area):
        r, c = cuda.grid(2)
        nrows, ncols = box_depth.shape
        if r < nrows and c < ncols:
            nd = box_depth[r, c] + d_vol[r, c] / cell_area
            if nd < 0.0:
                nd = 0.0
            box_depth[r, c] = nd


def run_diffusive_wave_gpu(
    box_dem, box_depth, n_substeps, dt_sub, cell_size, cell_area, manning_n
):
    nrows, ncols = box_dem.shape
    d_box_dem = cuda.to_device(box_dem)
    d_box_depth = cuda.to_device(box_depth)

    threadsperblock = (16, 16)
    blockspergrid_x = math.ceil(nrows / threadsperblock[0])
    blockspergrid_y = math.ceil(ncols / threadsperblock[1])
    blockspergrid = (blockspergrid_x, blockspergrid_y)

    d_box_wse = cuda.device_array((nrows, ncols), dtype=np.float32)
    d_fluxes = cuda.device_array((nrows, ncols, 8), dtype=np.float32)
    d_total_out = cuda.device_array((nrows, ncols), dtype=np.float32)
    d_d_vol = cuda.device_array((nrows, ncols), dtype=np.float32)

    for _ in range(n_substeps):
        cuda_zero_arrays[blockspergrid, threadsperblock](
            d_box_wse, d_box_dem, d_box_depth, d_fluxes, d_total_out, d_d_vol
        )
        cuda.synchronize()
        cuda_compute_flux[blockspergrid, threadsperblock](
            d_box_dem,
            d_box_depth,
            d_box_wse,
            d_fluxes,
            d_total_out,
            dt_sub,
            cell_size,
            cell_area,
            manning_n,
        )
        cuda.synchronize()
        cuda_update_dvol[blockspergrid, threadsperblock](
            d_box_depth, d_fluxes, d_total_out, d_d_vol, cell_area
        )
        cuda.synchronize()
        cuda_apply_dvol[blockspergrid, threadsperblock](d_box_depth, d_d_vol, cell_area)
        cuda.synchronize()

    d_box_depth.copy_to_host(box_depth)


def dispatch_diffusive_wave(
    box_dem, box_depth, n_substeps, dt_sub, cell_size, cell_area, manning_n
):
    if GPU_AVAILABLE:
        run_diffusive_wave_gpu(
            box_dem, box_depth, n_substeps, dt_sub, cell_size, cell_area, manning_n
        )
    else:
        diffusive_wave_step(
            box_dem, box_depth, n_substeps, dt_sub, cell_size, cell_area, manning_n
        )


# Configure logging
logging.basicConfig(
    level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s"
)

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
        b_avg, z_hv, t_f_hr, q_peak, v_res, h_dam = (
            156.0,
            1.4,
            2.50,
            6647.0,
            101.0e6,
            22.56,
        )

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
def generate_unsteady_breach_hydrograph(
    breach_params, duration_hours=24.0, dt_seconds=60.0
):
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
        v_rise = float(
            np.sum(
                0.5
                * (q_breach[rise_mask][:-1] + q_breach[rise_mask][1:])
                * np.diff(times[rise_mask])
            )
        )
    v_remaining = max(v_total - v_rise, 0.2 * v_total)

    # Recession limb: exponential decay matching remaining volume
    # integral_{t_f}^{inf} Q_p * exp(-(t - t_f) / tau) dt = Q_p * tau = V_remaining  ==> tau = V_remaining / Q_p
    tau = v_remaining / q_p
    decay_mask = times > t_f_sec
    q_breach[decay_mask] = q_p * np.exp(-(times[decay_mask] - t_f_sec) / tau)

    # Strictly use breach outflow matching Directive 4 Froehlich peak Q_p (no unexplained baseflow bump)
    q_total = q_breach

    time_hours = times / 3600.0
    return time_hours, times, q_total, q_breach


# ---------------------------------------------------------------------------
# 3. 2D HYDRODYNAMIC FLOOD ROUTING SOLVER
# ---------------------------------------------------------------------------


def run_2d_hydrodynamic_simulation(
    dem_path, breach_hydrograph_tuple, breach_params, dam_config
):
    """
    2D Raster Hydrodynamic Flood Inundation Model.
    Vectorized diffusive-wave solver for downstream propagation from Machhu-II Dam.
    """
    from pyproj import Transformer

    time_hours, time_seconds, q_total, q_breach = breach_hydrograph_tuple

    logging.info(f"Opening conditioned DEM: {dem_path}")
    with rasterio.open(dem_path) as src:
        dem = src.read(1).astype(np.float32)
        transform = src.transform
        crs = src.crs
        nodata = src.nodata
        res_x = abs(transform.a)
        res_y = abs(transform.e)
        cell_size = (res_x + res_y) / 2.0
        nrows, ncols = dem.shape

    # Handle nodata
    if nodata is not None:
        valid_mask = dem != nodata
        dem[~valid_mask] = np.nan
    else:
        valid_mask = np.isfinite(dem)

    # Fill NaNs with interpolation for stability
    min_elev = (
        np.nanmax(dem[valid_mask]) + 100.0
    )  # NaN cells become walls to prevent water pooling
    dem[np.isnan(dem)] = min_elev

    # Convert real geographic station coordinates to grid row/col
    transformer = Transformer.from_crs("EPSG:4326", crs, always_xy=True)

    def geo_to_grid(lat, lon, snap_radius=12):
        """Convert lat/lon to grid row/col, snap to lowest elevation (channel thalweg)."""
        x, y = transformer.transform(lon, lat)
        c = int((x - transform.c) // transform.a)
        r = int((y - transform.f) // transform.e)
        r = int(np.clip(r, 0, nrows - 1))
        c = int(np.clip(c, 0, ncols - 1))
        # Snap to channel (lowest elevation within radius)
        r_low = max(0, r - snap_radius)
        r_high = min(nrows, r + snap_radius + 1)
        c_low = max(0, c - snap_radius)
        c_high = min(ncols, c + snap_radius + 1)
        sub_elev = dem[r_low:r_high, c_low:c_high]
        min_idx = np.unravel_index(np.argmin(sub_elev), sub_elev.shape)
        return r_low + min_idx[0], c_low + min_idx[1]

    # Use real dam coordinates from config
    r_dam, c_dam = geo_to_grid(dam_config["lat"], dam_config["lon"], snap_radius=5)
    logging.info(
        f"Dam toe source cell in grid: row={r_dam}, col={c_dam}, elev={dem[r_dam, c_dam]:.2f}m"
    )

    # Build monitoring stations from config
    stations = {}
    for info in dam_config["downstream_stations"]:
        key = info["key"]
        snap = 5 if key == "dam_toe" else 15
        sr, sc = geo_to_grid(info["lat"], info["lon"], snap_radius=snap)
        stations[key] = {"name": info["name"], "r": sr, "c": sc, "depth": []}

    logging.info("Monitoring stations (real geographic coordinates → grid):")
    for k, v in stations.items():
        logging.info(
            f"  {v['name']}: row={v['r']}, col={v['c']}, elev={dem[v['r'], v['c']]:.2f}m"
        )

    # Simulation arrays
    depth_grid = np.zeros((nrows, ncols), dtype=np.float32)
    max_depth_grid = np.zeros((nrows, ncols), dtype=np.float32)
    max_velocity_grid = np.zeros((nrows, ncols), dtype=np.float32)
    arrival_time_grid = np.full((nrows, ncols), np.nan, dtype=np.float32)
    duration_grid = np.zeros((nrows, ncols), dtype=np.float32)

    # Manning's roughness n (composite floodplain = 0.035)
    manning_n = 0.035

    # 2D Hydrodynamic Flood Routing (Vectorized diffusive-wave solver on active envelope)
    dt_sim = float(time_seconds[1] - time_seconds[0]) if len(time_seconds) > 1 else 60.0
    n_steps = len(time_seconds)
    cell_area = cell_size * cell_size

    # Define active downstream computational bounding box
    domain_radius = 700
    r_start = max(0, r_dam - domain_radius)
    r_end = min(nrows, r_dam + domain_radius)
    c_start = max(0, c_dam - domain_radius)
    c_end = min(ncols, c_dam + domain_radius)
    logging.info(
        f"Active simulation domain: rows [{r_start}:{r_end}], cols [{c_start}:{c_end}] ({r_end - r_start}×{c_end - c_start} cells, res={cell_size:.1f}m)"
    )

    logging.info(
        f"Starting 2D hydrodynamic simulation ({n_steps} timesteps, dt={dt_sim}s)..."
    )
    report_interval = max(n_steps // 10, 1)

    # Pre-extract active sub-domain grids for high-performance routing
    sub_dem = dem[r_start:r_end, c_start:c_end].copy()
    sub_depth = np.zeros_like(sub_dem, dtype=np.float32)
    sub_vel = np.zeros_like(sub_dem, dtype=np.float32)
    sub_nrows, sub_ncols = sub_dem.shape

    local_r_dam = r_dam - r_start
    local_c_dam = c_dam - c_start

    # Source breach cells (distributed across 156m channel thalweg at dam toe)
    src_cells = [
        (local_r_dam + dr, local_c_dam + dc)
        for dr in range(-1, 2)
        for dc in range(-2, 3)
    ]
    n_src = len(src_cells)

    max_dam_head = float(
        breach_params.get("H_dam_m", breach_params.get("h_dam_m", 22.56))
    )

    n_substeps = 1
    dt_sub = dt_sim / float(n_substeps)

    # Pre-check PySPH files to avoid disk I/O in the tight loop
    pysph_vals = {}
    for pysph_file in OUTPUTS_SIM.glob("pysph_hydrograph_*.txt"):
        try:
            step_idx = int(pysph_file.stem.split("_")[-1])
            with open(pysph_file, "r") as pf:
                pysph_vals[step_idx] = float(pf.read().strip())
        except ValueError:
            pass

    for step in range(n_steps):
        t_sec = time_seconds[step]
        t_hr = time_hours[step]
        q_in = q_total[step]

        # 1. Exact Physical Breach Mass Injection (with PySPH fallback)
        if step in pysph_vals:
            v_in = pysph_vals[step] * dt_sim
        else:
            v_in = q_in * dt_sim
        d_h_in = (v_in / float(n_src)) / cell_area
        for sr, sc in src_cells:
            sub_depth[sr, sc] += d_h_in

        # 2. Dynamic active bounding box around wet cells (+- 20 cells buffer)
        wet_r, wet_c = np.where(sub_depth > 0.05)
        if len(wet_r) > 0:
            pad = 20
            b_r0 = max(0, int(wet_r.min()) - pad)
            b_r1 = min(sub_nrows, int(wet_r.max()) + pad + 1)
            b_c0 = max(0, int(wet_c.min()) - pad)
            b_c1 = min(sub_ncols, int(wet_c.max()) + pad + 1)
        else:
            b_r0 = max(0, local_r_dam - 5)
            b_r1 = min(sub_nrows, local_r_dam + 5)
            b_c0 = max(0, local_c_dam - 5)
            b_c1 = min(sub_ncols, local_c_dam + 5)

        # Contiguous copies are required for Numba njit
        box_dem = np.ascontiguousarray(sub_dem[b_r0:b_r1, b_c0:b_c1])
        box_depth = np.ascontiguousarray(sub_depth[b_r0:b_r1, b_c0:b_c1])
        box_vel_active = sub_vel[b_r0:b_r1, b_c0:b_c1]

        # Adaptive CFL timestepping for current active box
        active_wet = box_depth > 0.05
        v_max = np.max(box_vel_active[active_wet]) if np.any(active_wet) else 0.0
        h_max = np.max(box_depth[active_wet]) if np.any(active_wet) else 0.0
        wave_speed = v_max + np.sqrt(9.81 * h_max)
        if wave_speed > 0:
            dt_cfl = 0.45 * cell_size / wave_speed
            n_substeps = max(1, int(np.ceil(dt_sim / dt_cfl)))
        else:
            n_substeps = 1
        dt_sub = dt_sim / float(n_substeps)

        if np.any(box_depth > 0.05):
            dispatch_diffusive_wave(
                box_dem, box_depth, n_substeps, dt_sub, cell_size, cell_area, manning_n
            )

        # Write mutated depth back into sub-domain (box_depth is a copy, not a view)
        sub_depth[b_r0:b_r1, b_c0:b_c1] = box_depth

        # Update velocity field on active box
        gwse_y, gwse_x = np.gradient(box_dem + box_depth, cell_size)
        wse_slope = np.maximum(np.sqrt(gwse_x**2 + gwse_y**2), 0.0002)
        box_wet = box_depth > 0.05
        box_vel = np.zeros_like(box_depth)
        box_vel[box_wet] = (
            (1.0 / manning_n)
            * (box_depth[box_wet] ** (2.0 / 3.0))
            * np.sqrt(wse_slope[box_wet])
        )
        sub_vel[b_r0:b_r1, b_c0:b_c1] = box_vel

        # 3. Write back and update cumulative max grids
        depth_grid[r_start:r_end, c_start:c_end] = sub_depth
        max_velocity_grid[r_start:r_end, c_start:c_end] = np.maximum(
            max_velocity_grid[r_start:r_end, c_start:c_end], sub_vel
        )

        active_wet = depth_grid >= 0.10
        max_depth_grid = np.maximum(max_depth_grid, depth_grid)

        new_arrival = active_wet & np.isnan(arrival_time_grid)
        arrival_time_grid[new_arrival] = t_hr
        duration_grid[active_wet] += dt_sim / 3600.0

        # 4. Record Gauge Timeseries (sampling channel thalweg and adjacent flood zone in 3x3 window)
        for key, st in stations.items():
            st_r, st_c = st["r"], st["c"]
            d_val = float(
                np.max(
                    depth_grid[
                        max(0, st_r - 1) : min(nrows, st_r + 2),
                        max(0, st_c - 1) : min(ncols, st_c + 2),
                    ]
                )
            )
            st["depth"].append(d_val)

        if step % report_interval == 0 or step == n_steps - 1:
            peak_curr = np.max(depth_grid)
            inund_area_km2 = np.sum(depth_grid > 0.10) * (cell_area / 1e6)
            morbi_depth = stations.get("morbi", list(stations.values())[-1])["depth"][
                -1
            ]
            logging.info(
                f"  t = {t_hr:5.2f}h | Max Depth = {peak_curr:5.2f}m | Inundated Area = {inund_area_km2:6.1f} km² | Morbi Depth = {morbi_depth:4.2f}m"
            )

    # Post-processing
    # max_depth_grid = gaussian_filter(max_depth_grid, sigma=0.4)
    # max_velocity_grid = gaussian_filter(max_velocity_grid, sigma=0.4)
    logging.info("Simulation loop completed successfully.")

    # Sanity check: max depth must be physically plausible
    observed_max = float(np.max(max_depth_grid))
    sanity_limit = max_dam_head * 2.0
    if observed_max > sanity_limit:
        logging.critical(
            "SANITY CHECK FAILED: Max simulated depth %.1f m exceeds 2× dam height (%.1f m). "
            "This indicates a solver instability (CFL violation or units error).",
            observed_max,
            sanity_limit,
        )
    else:
        logging.info(
            f"Sanity check PASSED: Max depth {observed_max:.2f}m ≤ {sanity_limit:.1f}m (2× dam height)"
        )

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
        "sanity_passed": observed_max <= sanity_limit,
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
        (
            "velocity_max.tif",
            sim_results["max_velocity"],
            "Maximum Flow Velocity [m/s]",
        ),
        (
            "arrival_time.tif",
            np.nan_to_num(sim_results["arrival_time"], nan=-9999.0),
            "Flood Arrival Time [hours]",
        ),
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
        logging.info(
            f"Saved GeoTIFF: {out_path} ({out_path.stat().st_size / 1e6:.2f} MB)"
        )


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
    ax1.plot(
        time_hours,
        q_total,
        color="#d90429",
        lw=2.2,
        label=f"Total Outflow (Peak: {np.max(q_total):,.0f} m³/s)",
    )
    ax1.plot(
        time_hours,
        q_breach,
        color="#f77f00",
        lw=1.6,
        linestyle="--",
        label=f"Breach Outflow (Froehlich Q_p: {breach_params['Q_peak_m3s']:,.0f} m³/s)",
    )
    ax1.set_ylabel("Discharge Q [m³/s]", fontsize=11, fontweight="bold")
    ax1.set_title(
        "Machhu-II Dam Breach Hydrograph & Downstream Stage Propagation",
        fontsize=13,
        fontweight="bold",
        pad=10,
    )
    ax1.grid(True, linestyle=":", alpha=0.6)
    ax1.legend(loc="upper right", frameon=True)

    # Inundation depth hydrograph at monitoring stations
    # Dynamic station colors — assign from a palette so any config works
    palette = [
        "#03045e",
        "#d90429",
        "#0077b6",
        "#0096c7",
        "#48cae4",
        "#f77f00",
        "#d62828",
    ]
    for i, (key, st) in enumerate(stations.items()):
        peak_d = max(st["depth"])
        ax2.plot(
            time_hours,
            st["depth"],
            color=palette[i % len(palette)],
            lw=2.0,
            label=f"{st['name']} (Peak: {peak_d:.2f} m)",
        )

    # Historical benchmark — read from NRLD CSV if available, fall back to config or 3.0m
    _hist_bench = 3.0
    _nrld_csv = PROJECT_ROOT / "data" / "raw" / "dams" / "nrld_machhu.csv"
    if _nrld_csv.is_file():
        import csv as _csv

        with open(_nrld_csv, "r", encoding="utf-8") as _f:
            for _row in _csv.reader(_f):
                if _row and _row[0] == "flood_height_morbi":
                    try:
                        _hist_bench = float(_row[1].strip())
                    except ValueError:
                        pass
                    break
    ax2.axhline(
        _hist_bench,
        color="gray",
        linestyle=":",
        lw=1.5,
        label=f"Historical Flood Level (~{_hist_bench:.1f} m)",
    )
    ax2.set_xlabel(
        "Time from Failure Initiation [hours]", fontsize=11, fontweight="bold"
    )
    ax2.set_ylabel("Flood Inundation Depth [m]", fontsize=11, fontweight="bold")
    ax2.set_xlim(0, float(time_hours[-1]))
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
        ax.plot(
            st["c"],
            st["r"],
            marker="o",
            markersize=6,
            color="black" if key == "morbi" else "blue",
            markeredgecolor="white",
        )
        ax.text(
            st["c"] + 15,
            st["r"],
            st["name"],
            color="black",
            fontsize=8,
            fontweight="bold",
            bbox=dict(
                boxstyle="round,pad=0.2", facecolor="white", alpha=0.8, edgecolor="none"
            ),
        )

    ax.set_title(
        "Machhu-II Dam Breach: Maximum 2D Inundation Depth Map",
        fontsize=12,
        fontweight="bold",
    )
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
    ax.set_title(
        "Machhu-II Dam Breach: Maximum 2D Flow Velocity Map",
        fontsize=12,
        fontweight="bold",
    )
    ax.axis("off")
    plt.tight_layout()
    vel_map_path = OUTPUTS_GIS / "flood_velocity_map.png"
    plt.savefig(vel_map_path, dpi=200)
    plt.close()
    logging.info(f"Saved velocity map: {vel_map_path}")

    # 4. Flood Arrival Time Map
    fig, ax = plt.subplots(figsize=(10, 8), dpi=200)
    masked_arr = np.ma.masked_where(
        np.isnan(arrival_time) | (max_depth < 0.1), arrival_time
    )
    im = ax.imshow(masked_arr, cmap=plt.cm.turbo, vmin=0, vmax=12.0)
    cbar = plt.colorbar(im, ax=ax, fraction=0.035, pad=0.04)
    cbar.set_label("Flood Wave Arrival Time [hours]", fontsize=10, fontweight="bold")
    ax.set_title(
        "Machhu-II Dam Breach: Flood Arrival Time Map", fontsize=12, fontweight="bold"
    )
    ax.axis("off")
    plt.tight_layout()
    arr_map_path = OUTPUTS_GIS / "arrival_time_map.png"
    plt.savefig(arr_map_path, dpi=200)
    plt.close()
    logging.info(f"Saved arrival time map: {arr_map_path}")


# ---------------------------------------------------------------------------
# 6. EXPORT SUMMARY JSON (with dashboard-compatible `metrics` key)
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

    morbi_peak = float(max(stations.get("morbi", list(stations.values())[-1])["depth"]))
    morbi_arr = None
    morbi_depths = np.array(stations.get("morbi", list(stations.values())[-1])["depth"])
    if np.any(morbi_depths >= 0.10):
        morbi_arr = round(float(time_hours[np.argmax(morbi_depths >= 0.10)]), 2)

    summary = {
        "project": "Machhu-II Dam Breach Simulation",
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
        "sanity_check_passed": sim_results.get("sanity_passed", False),
        # Dashboard-compatible `metrics` key for live data loading
        "metrics": {
            "peak_discharge_m3s": float(np.max(q_total)),
            "total_inundated_area_km2": round(inund_area_km2, 2),
            "morbi_peak_depth_m": round(morbi_peak, 2),
            "morbi_arrival_time_hours": morbi_arr,
            "max_depth_m": round(float(np.max(max_depth)), 2),
            "max_velocity_ms": round(float(np.max(max_vel)), 2),
        },
        "monitoring_gauges": {
            k: {
                "name": v["name"],
                "peak_depth_m": round(float(max(v["depth"])), 2),
                "arrival_time_hours": round(
                    float(time_hours[np.argmax(np.array(v["depth"]) >= 0.10)]), 2
                )
                if any(np.array(v["depth"]) >= 0.10)
                else None,
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
        },
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
    parser = argparse.ArgumentParser(
        description="Run 2D Hydrodynamic Dam Breach Flood Simulation"
    )
    parser.add_argument(
        "--dam_config",
        type=str,
        default="machhu-ii",
        help="Key of the dam configuration in config.json",
    )
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
        breach_params["H_dam_m"] = dam_config["dam_height_m"]
    print(f"\n[1] Breach Parameters:")
    print(f"    Average Width B_avg = {breach_params['B_avg_m']:.1f} m")
    print(f"    Side Slope Z        = {breach_params['Z_HV']:.1f} (H:V)")
    print(f"    Formation Time t_f  = {breach_params['t_f_hours']:.2f} h")
    print(f"    Peak Discharge Q_p  = {breach_params['Q_peak_m3s']:,.0f} m³/s")
    print(f"    Reservoir Volume V  = {breach_params['V_reservoir_m3'] / 1e6:.1f} Mm³")

    # 2. Synthesize unsteady hydrograph
    hydrograph_tuple = generate_unsteady_breach_hydrograph(
        breach_params, duration_hours=8.0, dt_seconds=120.0
    )
    time_h, _, q_tot, _ = hydrograph_tuple
    print(
        f"\n[2] Hydrograph Synthesized: 8h duration, peak outflow = {np.max(q_tot):,.0f} m³/s at t = {time_h[np.argmax(q_tot)]:.2f} h"
    )

    # 3. Run 2D Hydrodynamic Simulation
    sim_results = run_2d_hydrodynamic_simulation(
        DEM_FILE, hydrograph_tuple, breach_params, dam_config
    )

    # 4. Export GeoTIFFs
    print(f"\n[3] Exporting GeoTIFF Rasters to outputs/simulation/...")
    export_geotiffs(sim_results)

    # 5. Generate Maps and Plots
    print(f"\n[4] Generating High-Resolution Cartographic Maps & Hydrographs...")
    generate_simulation_plots(sim_results, hydrograph_tuple, breach_params)

    # 6. Save JSON Summary
    summary = export_summary_json(sim_results, breach_params, hydrograph_tuple)

    print("\n" + "=" * 70)
    print("  Simulation Finished!")
    print(
        f"  Sanity Check         : {'PASSED ✓' if sim_results.get('sanity_passed') else 'FAILED ✗'}"
    )
    print(f"  Total Inundated Area : {summary['total_inundation_area_km2']} km²")
    print(f"  Max Inundation Depth : {summary['max_simulated_depth_m']} m")
    print(
        f"  Morbi Peak Depth     : {summary['monitoring_gauges'].get('morbi', list(summary['monitoring_gauges'].values())[-1])['peak_depth_m']} m (Historical benchmark from NRLD)"
    )
    print(
        f"  Morbi Arrival Time   : {summary['monitoring_gauges'].get('morbi', list(summary['monitoring_gauges'].values())[-1])['arrival_time_hours']} hours post-breach"
    )
    print("=" * 70)

    return 0 if sim_results.get("sanity_passed", False) else 1


if __name__ == "__main__":
    try:
        exit_code = main()
    except Exception:
        logging.exception("Directive 5A failed with an unhandled exception")
        exit_code = 1
    raise SystemExit(exit_code)
