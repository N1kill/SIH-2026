#!/usr/bin/env python3
"""
15_export_3d_terrain.py
=======================
Generate 3D Heightmap and Simulation Mesh Data for Three.js WebGL Digital Twin
Extracts DEM topography, dam breach geometry, and dynamic flood surface heights.
"""

import json
import logging
from pathlib import Path

import numpy as np
import rasterio

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEM_TIF = PROJECT_ROOT / "data" / "processed" / "dem_conditioned.tif"
DEPTH_TIF = PROJECT_ROOT / "outputs" / "simulation" / "depth_max.tif"
OUTPUT_3D_DATA = PROJECT_ROOT / "outputs" / "3d" / "terrain_3d_data.json"


def export_3d_terrain_grid(grid_size=120):
    """Downsample DEM and max flood depth to an optimized regular grid for 3D WebGL rendering."""
    logging.info(f"Loading DEM for 3D terrain generation: {DEM_TIF}")
    
    with rasterio.open(DEM_TIF) as src:
        dem = src.read(1)
        nodata = src.nodata
        bounds = src.bounds
        nrows, ncols = dem.shape

    with rasterio.open(DEPTH_TIF) as src_d:
        depth = src_d.read(1)

    # Focus on the active Machhu-II to Morbi valley corridor (upper central area)
    # Row slice: from dam to northern delta
    r_start, r_end = max(0, int(nrows * 0.45)), min(nrows, int(nrows * 0.85))
    c_start, c_end = max(0, int(ncols * 0.35)), min(ncols, int(ncols * 0.65))

    sub_dem = dem[r_start:r_end, c_start:c_end]
    sub_depth = depth[r_start:r_end, c_start:c_end]

    # Replace NaNs
    valid = (sub_dem != nodata) & np.isfinite(sub_dem)
    min_elev = float(np.min(sub_dem[valid]))
    sub_dem[~valid] = min_elev

    # Resample to grid_size x grid_size
    from scipy.ndimage import zoom
    zoom_r = grid_size / sub_dem.shape[0]
    zoom_c = grid_size / sub_dem.shape[1]

    dem_resampled = zoom(sub_dem, (zoom_r, zoom_c), order=1)
    depth_resampled = zoom(sub_depth, (zoom_r, zoom_c), order=1)
    depth_resampled[depth_resampled < 0.05] = 0.0

    # Normalize elevation for smooth 3D display
    elev_min = float(np.min(dem_resampled))
    elev_max = float(np.max(dem_resampled))
    elev_normalized = (dem_resampled - elev_min) / max(1.0, (elev_max - elev_min))

    terrain_data = {
        "grid_size": grid_size,
        "elev_min_m": elev_min,
        "elev_max_m": elev_max,
        "elevation_grid": np.round(dem_resampled, 2).tolist(),
        "depth_grid": np.round(depth_resampled, 2).tolist(),
        "normalized_elev": np.round(elev_normalized, 4).tolist(),
        "dam_position": {"x": 0.0, "y": 0.25, "z": -0.2},
        "morbi_position": {"x": -0.05, "y": 0.15, "z": 0.15},
    }

    OUTPUT_3D_DATA.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_3D_DATA, "w") as f:
        json.dump(terrain_data, f)

    logging.info(f"Saved 3D WebGL terrain data: {OUTPUT_3D_DATA} ({grid_size}x{grid_size} vertices)")


if __name__ == "__main__":
    export_3d_terrain_grid(120)
