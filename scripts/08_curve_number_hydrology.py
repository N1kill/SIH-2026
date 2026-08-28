#!/usr/bin/env python3
"""Directive 3: SCS-CN Hydrology & Inflow Hydrograph.

This script implements the SCS-CN method to estimate surface runoff depth for
the Machhu-II Dam catchment and routes it using the SCS Dimensionless Unit Hydrograph
and the SCS Type II storm distribution. It produces both the unscaled catchment hydrograph,
an area-scaled hydrograph, and a calibrated peak-inflow hydrograph to match historical records.
"""

from __future__ import annotations

import json
import logging
import pathlib
import numpy as np
import pandas as pd
import rasterio
import geopandas as gpd
import matplotlib.pyplot as plt
from rasterio.warp import reproject, Resampling
from shapely.geometry import box

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)

# Project paths
PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_RAW = PROJECT_ROOT / "data" / "raw"
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
OUTPUTS_GIS = PROJECT_ROOT / "outputs" / "gis"
OUTPUTS_GIS.mkdir(parents=True, exist_ok=True)

# Input files
WATERSHED_SHP = DATA_PROCESSED / "watershed.shp"
WATERSHED_TIF = DATA_PROCESSED / "watershed.tif"
DEM_CONDITIONED = DATA_PROCESSED / "dem_conditioned.tif"
FLOW_DIR_TIF = DATA_PROCESSED / "flow_dir.tif"
LULC_RAW = DATA_RAW / "lulc" / "lulc_raw.tif"
RAINFALL_NC = DATA_RAW / "rainfall" / "imd_1979.nc"

# Output files
CN_TIF = DATA_PROCESSED / "curve_number.tif"
HYDROGRAPH_CSV = OUTPUTS_GIS / "hydrograph.csv"
HYDROGRAPH_PNG = OUTPUTS_GIS / "inflow_hydrograph.png"
HYDROLOGY_REPORT = DATA_PROCESSED / "hydrology_report.json"

# Hydrologic Soil Group (HSG) D CN Mappings (Clayey/Black Cotton Soil)
# ESA WorldCover 2021 Class Mapping
CN_MAP_HSG_D = {
    10: 79,   # Tree cover (Forest)
    20: 77,   # Shrubland
    30: 80,   # Grassland
    40: 81,   # Cropland (Agriculture)
    50: 95,   # Built-up (Urban/Impervious)
    60: 94,   # Bare / sparse vegetation
    80: 100,  # Permanent water bodies
    90: 85,   # Herbaceous wetland
    95: 100,  # Mangroves (treated as water/wetland)
    100: 50,  # Moss and lichen
}

# SCS D8 Flow offsets
D8_OFFSETS = {
    64: (-1, 0),
    128: (-1, 1),
    1: (0, 1),
    2: (1, 1),
    4: (1, 0),
    8: (1, -1),
    16: (0, -1),
    32: (-1, -1)
}

# SCS Dimensionless Unit Hydrograph coordinates (t/t_p vs q/q_p)
DUH_T_TP = np.array([
    0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
    1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6,
    2.8, 3.0, 3.5, 4.0, 4.5, 5.0
])
DUH_Q_QP = np.array([
    0.0, 0.03, 0.10, 0.19, 0.31, 0.47, 0.66, 0.82, 0.93, 0.99, 1.00,
    0.99, 0.93, 0.86, 0.78, 0.68, 0.56, 0.39, 0.28, 0.207, 0.147, 0.107,
    0.077, 0.055, 0.022, 0.009, 0.004, 0.0
])

# SCS Type II 24-hour Cumulative Storm Distribution
SCS_TYPE_II = np.array([
    0.0, 0.011, 0.022, 0.034, 0.048, 0.064, 0.080, 0.099, 0.120, 0.147, 0.181, 0.235,
    0.663, 0.772, 0.820, 0.850, 0.872, 0.890, 0.906, 0.920, 0.933, 0.946, 0.958, 0.970, 1.0
])

def write_raster_like(reference_path: pathlib.Path, dst_path: pathlib.Path, data: np.ndarray, dtype: str, nodata: float | int) -> None:
    with rasterio.open(reference_path) as src:
        profile = src.profile.copy()
        profile.update(dtype=dtype, nodata=nodata, compress="deflate", tiled=True, bigtiff="if_safer")
    with rasterio.open(dst_path, "w", **profile) as dst:
        dst.write(data.astype(dtype, copy=False), 1)

def adjust_cn(cn2: np.ndarray, amc: int) -> np.ndarray:
    """Adjust AMC-II Curve Numbers to AMC-I or AMC-III."""
    if amc == 1:
        return 4.2 * cn2 / (10.0 - 0.058 * cn2)
    elif amc == 3:
        return 23.0 * cn2 / (10.0 + 0.13 * cn2)
    return cn2.copy()

def main():
    logging.info("Starting Directive 3: SCS-CN Hydrology & Inflow Hydrograph")

    # Check input files exist
    for p in (WATERSHED_SHP, WATERSHED_TIF, DEM_CONDITIONED, FLOW_DIR_TIF, LULC_RAW, RAINFALL_NC):
        if not p.exists():
            raise FileNotFoundError(f"Required input file missing: {p}")

    # Load watershed data
    ws_gdf = gpd.read_file(WATERSHED_SHP)
    ws_geom = ws_gdf.geometry.iloc[0]
    area_km2 = ws_gdf.geometry.area.sum() / 1e6
    logging.info(f"Delineated Watershed Area: {area_km2:.2f} km2")

    # Load snapped pour point from report
    with open(DATA_PROCESSED / "dem_catchment_report.json", "r") as f:
        report_data = json.load(f)
    snapped_xy = report_data["summary"]["snapped_pour_point_utm"]
    logging.info(f"Snapped Pour Point (UTM): {snapped_xy}")

    # 1. Warp LULC GeoTIFF to match DEM / Watershed grid
    logging.info("Reprojecting and clipping ESA 10m LULC to UTM 42N grid...")
    with rasterio.open(DEM_CONDITIONED) as src:
        dem_data = src.read(1)
        transform = src.transform
        crs = src.crs
        dx, dy = abs(transform.a), abs(transform.e)

    with rasterio.open(WATERSHED_TIF) as src:
        ws_mask = src.read(1) == 1

    lulc_warped = np.zeros_like(dem_data, dtype=np.uint8)
    with rasterio.open(LULC_RAW) as src:
        reproject(
            source=rasterio.band(src, 1),
            destination=lulc_warped,
            src_transform=src.transform,
            src_crs=src.crs,
            src_nodata=src.nodata,
            dst_transform=transform,
            dst_crs=crs,
            dst_nodata=0,
            resampling=Resampling.nearest
        )

    # 2. Reclassify LULC to CN raster (HSG D)
    logging.info("Reclassifying LULC classes to AMC-II Curve Numbers (HSG D)...")
    cn2_raster = np.zeros_like(lulc_warped, dtype=np.float32)
    for val, cn in CN_MAP_HSG_D.items():
        cn2_raster[lulc_warped == val] = cn
    # Fill remaining zero pixels (no data or other classes) with agriculture CN (81)
    cn2_raster[cn2_raster == 0] = 81

    # Save AMC-II Curve Number raster
    write_raster_like(DEM_CONDITIONED, CN_TIF, cn2_raster, "float32", -9999.0)
    logging.info(f"Saved base CN raster to {CN_TIF}")

    # Compute mean CN inside the watershed
    ws_cn2 = cn2_raster[ws_mask]
    cn2_avg = float(np.mean(ws_cn2))
    logging.info(f"Mean Catchment CN (AMC-II): {cn2_avg:.2f}")

    # 3. Calculate Catchment Parameters L and Y
    logging.info("Calculating watershed average slope (Y)...")
    dz_dy, dz_dx = np.gradient(dem_data, dy, dx)
    slope_pct = np.sqrt(dz_dx**2 + dz_dy**2) * 100.0
    mean_slope_pct = float(np.mean(slope_pct[ws_mask]))
    logging.info(f"Average Watershed Slope (Y): {mean_slope_pct:.2f} %")

    logging.info("Calculating longest flow path (L) from D8 flow directions...")
    with rasterio.open(FLOW_DIR_TIF) as src:
        fdir = src.read(1)
        pour_row, pour_col = src.index(snapped_xy[0], snapped_xy[1])

    # Dynamic path distance calculator using JIT-like memoization
    height, width = fdir.shape
    path_len = np.full((height, width), -1.0)
    path_len[pour_row, pour_col] = 0.0
    ws_coords = np.argwhere(ws_mask)

    for r, c in ws_coords:
        path = []
        curr_r, curr_c = r, c
        reached = False
        while True:
            if curr_r == pour_row and curr_c == pour_col:
                reached = True
                break
            if curr_r < 0 or curr_r >= height or curr_c < 0 or curr_c >= width:
                break
            if path_len[curr_r, curr_c] >= 0:
                reached = True
                break
            
            fd = fdir[curr_r, curr_c]
            if fd not in D8_OFFSETS:
                break
                
            dr, dc = D8_OFFSETS[fd]
            next_r, next_c = curr_r + dr, curr_c + dc
            if not ws_mask[next_r, next_c]:
                break
                
            step = np.sqrt((dr * dy)**2 + (dc * dx)**2)
            path.append(((curr_r, curr_c), step))
            curr_r, curr_c = next_r, next_c
            
        if reached:
            dist = path_len[curr_r, curr_c]
            for (pr, pc), step in reversed(path):
                dist += step
                path_len[pr, pc] = dist

    max_L = float(np.max(path_len))
    logging.info(f"Longest Flow Path (L): {max_L:.1f} m ({max_L/1000.0:.2f} km)")

    # 4. Spatially-averaged daily rainfall
    logging.info("Processing daily rainfall from NetCDF dataset...")
    ws_shp_4326 = ws_gdf.to_crs(epsg=4326)
    ws_geom_4326 = ws_shp_4326.geometry.iloc[0]

    import xarray as xr
    ds = xr.open_dataset(RAINFALL_NC)
    lats = ds.lat.values
    lons = ds.lon.values
    time_coords = ds.time.values
    rain_data = ds.rain.values

    # Spatially weighted average calculations
    weights = np.zeros((len(lats), len(lons)))
    total_w = 0.0
    for i, lat in enumerate(lats):
        for j, lon in enumerate(lons):
            cell_box = box(lon - 0.125, lat - 0.125, lon + 0.125, lat + 0.125)
            if ws_geom_4326.intersects(cell_box):
                intersect_area = ws_geom_4326.intersection(cell_box).area
                weights[i, j] = intersect_area
                total_w += intersect_area

    if total_w == 0.0:
        logging.warning("Watershed does not intersect IMD rainfall grid cells! Using closest grid cell.")
        # Find closest coordinate
        centroid = ws_geom_4326.centroid
        lat_idx = np.argmin(np.abs(lats - centroid.y))
        lon_idx = np.argmin(np.abs(lons - centroid.x))
        weights[lat_idx, lon_idx] = 1.0
        total_w = 1.0
    else:
        weights /= total_w

    daily_rain_all = []
    for t_idx in range(len(time_coords)):
        rain_slice = np.nan_to_num(rain_data[t_idx, :, :], nan=0.0)
        daily_rain_all.append(np.sum(rain_slice * weights))
    daily_rain_all = np.array(daily_rain_all)

    # Date indexes
    dates = pd.date_range(start="1979-01-01", end="1979-12-31")
    start_idx = np.where(dates == "1979-08-05")[0][0]
    end_idx = np.where(dates == "1979-08-15")[0][0]

    # Compute daily runoff depth for Aug 5-15
    daily_stats = []
    logging.info("Computing daily runoff depth based on AMC adjustments...")
    for d in range(start_idx, end_idx + 1):
        dt_str = dates[d].strftime("%Y-%m-%d")
        p = daily_rain_all[d]
        # 5-day antecedent rainfall
        ant5 = float(np.sum(daily_rain_all[d-5:d]))
        
        # Growing season AMC classes
        if ant5 < 36.0:
            amc = 1
        elif ant5 <= 53.0:
            amc = 2
        else:
            amc = 3

        # Adjust CN
        cn_adjusted = adjust_cn(cn2_raster, amc)
        cn_ws = cn_adjusted[ws_mask]
        
        # Runoff depth calculations (SCS-CN)
        # S = 25400 / CN - 254
        s = (25400.0 / cn_ws) - 254.0
        ia = 0.2 * s
        
        q_pixels = np.zeros_like(cn_ws)
        mask = p > ia
        q_pixels[mask] = ((p - ia[mask])**2) / (p - ia[mask] + s[mask])
        q_avg = float(np.mean(q_pixels))

        daily_stats.append({
            "date": dt_str,
            "rainfall_mm": float(p),
            "antecedent_5d_mm": ant5,
            "amc": amc,
            "runoff_mm": q_avg,
        })
        logging.info(f"  {dt_str} | Rain: {p:6.2f} mm | Ant5: {ant5:6.2f} mm | AMC: {amc} | Runoff: {q_avg:6.2f} mm")

    # 5. Route Runoff with SCS Dimensionless Unit Hydrograph
    logging.info("Routing runoff using SCS Dimensionless Unit Hydrograph...")
    
    # Potential maximum retention for base CN
    S_max = 25400.0 / cn2_avg - 254.0
    
    # Lag time calculation (metric SCS equation)
    t_lag = (max_L**0.8) * ((S_max + 25.4)**0.7) / (7069.0 * (mean_slope_pct**0.5))
    t_c = 1.67 * t_lag
    D = 1.0  # hourly time step
    t_p = D / 2.0 + t_lag
    
    logging.info(f"Potential Max Retention (S_max): {S_max:.2f} mm")
    logging.info(f"Catchment Lag Time (t_lag): {t_lag:.2f} hours")
    logging.info(f"Time of Concentration (t_c): {t_c:.2f} hours")
    logging.info(f"Time to Peak (t_p): {t_p:.2f} hours")

    # Peak flow of unscaled UH for Q = 1 mm:
    # q_p = 0.208 * A * Q / t_p
    q_p_uh = 0.208 * area_km2 * 1.0 / t_p
    
    # Build hourly Unit Hydrograph
    t_uh = np.arange(0.0, 5.0 * t_p, D)
    q_uh = np.interp(t_uh / t_p, DUH_T_TP, DUH_Q_QP) * q_p_uh
    
    # Scale UH to guarantee exact runoff volume conservation (mass balance)
    vol_actual = np.sum(q_uh) * 3600.0
    vol_expected = area_km2 * 1000.0  # 1 mm over area_km2
    q_uh *= (vol_expected / vol_actual)

    # Distribute daily runoff hourly using SCS Type II distribution
    hourly_runoff = np.zeros(11 * 24)
    hourly_rainfall = np.zeros(11 * 24)

    for idx, stat in enumerate(daily_stats):
        q_day = stat["runoff_mm"]
        p_day = stat["rainfall_mm"]
        for h in range(24):
            frac = SCS_TYPE_II[h+1] - SCS_TYPE_II[h]
            hourly_runoff[idx * 24 + h] = frac * q_day
            hourly_rainfall[idx * 24 + h] = frac * p_day

    # Convolve hourly runoff with Unit Hydrograph
    inflow_unscaled = np.convolve(hourly_runoff, q_uh)[:11 * 24]

    # Area Scaling to historical catchment area (1,928 km2)
    historical_area_km2 = 1928.0
    area_scale_ratio = historical_area_km2 / area_km2
    inflow_scaled = inflow_unscaled * area_scale_ratio

    # Calibration to historical peak flow (~5,600 m3/s)
    # Let's find the unscaled and scaled peak flows
    unscaled_peak = float(np.max(inflow_unscaled))
    scaled_peak = float(np.max(inflow_scaled))
    
    target_peak = 5600.0  # m3/s
    calibration_factor = target_peak / unscaled_peak
    inflow_calibrated = inflow_unscaled * calibration_factor
    
    # Calibrated Peak Rate Factor:
    # Scale factor = Calibration factor / Area scale ratio
    # Calibrated PRF = Standard PRF (484) * Scale factor
    calibrated_prf = 484.0 * (calibration_factor / area_scale_ratio)

    logging.info(f"Unscaled Inflow Peak: {unscaled_peak:.2f} m3/s")
    logging.info(f"Area-Scaled Inflow Peak: {scaled_peak:.2f} m3/s")
    logging.info(f"Calibrated Inflow Peak (Target {target_peak:.1f}): {np.max(inflow_calibrated):.2f} m3/s")
    logging.info(f"Calibrated Peak Rate Factor: {calibrated_prf:.1f} (compared to standard 484)")

    # 6. Save hourly hydrograph series to CSV
    date_range_hourly = pd.date_range(start="1979-08-05 00:00:00", periods=11 * 24, freq="h")
    df_out = pd.DataFrame({
        "datetime": date_range_hourly.strftime("%Y-%m-%d %H:%M:%S"),
        "rainfall_mm": hourly_rainfall,
        "runoff_mm": hourly_runoff,
        "inflow_unscaled_m3s": inflow_unscaled,
        "inflow_scaled_m3s": inflow_scaled,
        "inflow_calibrated_m3s": inflow_calibrated,
    })
    df_out.to_csv(HYDROGRAPH_CSV, index=False)
    logging.info(f"Saved hourly hydrograph data to {HYDROGRAPH_CSV}")

    # 7. Generate a professional visualization plot
    logging.info("Generating hydrograph plot...")
    plt.rcParams.update({"font.size": 11, "font.family": "sans-serif"})
    fig, ax1 = plt.subplots(figsize=(12, 7))

    # Plot inflow hydrographs
    color_unscaled = "#3498db"
    color_scaled = "#e67e22"
    color_calib = "#e74c3c"
    
    time_hours = np.arange(len(inflow_unscaled))
    
    ax1.plot(time_hours, inflow_unscaled, label=f"Unscaled Delineated Inflow (Area: {area_km2:.1f} km²)", color=color_unscaled, linewidth=2)
    ax1.plot(time_hours, inflow_scaled, label=f"Area-Scaled Inflow (Area: {historical_area_km2:.1f} km²)", color=color_scaled, linewidth=2, linestyle="--")
    ax1.plot(time_hours, inflow_calibrated, label=f"Calibrated Inflow (Peak: {target_peak:.0f} m³/s, PRF: {calibrated_prf:.0f})", color=color_calib, linewidth=2.5)

    ax1.set_xlabel("Hours since August 5, 1979, 00:00")
    ax1.set_ylabel("Inflow Discharge (m³/s)", color="black")
    ax1.tick_params(axis="y", labelcolor="black")
    ax1.grid(True, linestyle=":", alpha=0.6)
    
    # Set y-axis limit with some padding
    ax1.set_ylim(0, target_peak * 1.15)

    # Highlight peak points
    peak_h_cal = np.argmax(inflow_calibrated)
    ax1.scatter([peak_h_cal], [target_peak], color=color_calib, s=60, zorder=5)
    ax1.annotate(
        f"Peak Inflow: {target_peak:.1f} m³/s\n(Hour {peak_h_cal}, Aug 11-12)",
        xy=(peak_h_cal, target_peak),
        xytext=(peak_h_cal - 55, target_peak * 0.85),
        arrowprops=dict(facecolor=color_calib, shrink=0.08, width=1.5, headwidth=6),
        fontweight="bold",
    )

    # Highlight unscaled peak
    peak_h_un = np.argmax(inflow_unscaled)
    ax1.scatter([peak_h_un], [unscaled_peak], color=color_unscaled, s=40, zorder=5)
    ax1.annotate(
        f"{unscaled_peak:.1f} m³/s",
        xy=(peak_h_un, unscaled_peak),
        xytext=(peak_h_un + 10, unscaled_peak * 1.1),
        fontsize=9,
    )

    # Second y-axis for daily rainfall bars
    ax2 = ax1.twinx()
    
    # Calculate daily bars (each day spans 24 hours, placed at the middle of the day)
    rain_days = [stat["rainfall_mm"] for stat in daily_stats]
    bar_x = np.arange(11) * 24 + 12
    
    color_rain = "#2ecc71"
    ax2.bar(bar_x, rain_days, width=22, alpha=0.25, color=color_rain, label="Daily Rainfall (mm)", edgecolor=color_rain, linewidth=1)
    ax2.set_ylabel("Daily Average Rainfall (mm)", color="#27ae60")
    ax2.tick_params(axis="y", labelcolor="#27ae60")
    ax2.set_ylim(0, max(rain_days) * 2.5)  # keep rainfall bars at the top/background
    ax2.invert_yaxis()  # invert rainfall axis to display from top down

    # Add legend
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper right", framealpha=0.9)

    plt.title("Machhu-II Dam Catchment Inflow Hydrograph (August 5–15, 1979)", fontsize=13, fontweight="bold", pad=15)
    
    # Set x-ticks to display dates
    xtick_positions = np.arange(0, 11 * 24 + 1, 24)
    xtick_labels = [stat["date"] for stat in daily_stats] + ["1979-08-16"]
    ax1.set_xticks(xtick_positions)
    ax1.set_xticklabels(xtick_labels, rotation=30, ha="right")

    fig.tight_layout()
    plt.savefig(HYDROGRAPH_PNG, dpi=300)
    plt.close()
    logging.info(f"Saved hydrograph visualization to {HYDROGRAPH_PNG}")

    # 8. Write a comprehensive hydrology report to JSON
    report = {
        "catchment_properties": {
            "delineated_area_km2": area_km2,
            "historical_area_km2": historical_area_km2,
            "longest_flow_path_m": max_L,
            "mean_slope_percent": mean_slope_pct,
            "mean_curve_number_amc2": cn2_avg,
            "potential_max_retention_s_mm": S_max,
            "lag_time_hours": t_lag,
            "time_of_concentration_hours": t_c,
            "time_to_peak_hours": t_p,
        },
        "rainfall_runoff_routing": {
            "daily_records": daily_stats,
            "unscaled_peak_inflow_m3s": unscaled_peak,
            "scaled_peak_inflow_m3s": scaled_peak,
            "calibrated_peak_inflow_m3s": target_peak,
            "calibrated_peak_rate_factor": calibrated_prf,
            "peak_time_hours_since_aug05": int(peak_h_cal),
            "peak_datetime": date_range_hourly[peak_h_cal].strftime("%Y-%m-%d %H:%M:%S"),
        }
    }
    with open(HYDROLOGY_REPORT, "w") as f:
        json.dump(report, f, indent=2)
    logging.info(f"Saved hydrology summary report to {HYDROLOGY_REPORT}")

if __name__ == "__main__":
    main()
