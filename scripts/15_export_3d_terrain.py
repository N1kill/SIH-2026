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
from pyproj import Transformer

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEM_TIF = PROJECT_ROOT / "data" / "processed" / "dem_conditioned.tif"
DEPTH_TIF = PROJECT_ROOT / "outputs" / "simulation" / "depth_max.tif"
OUTPUT_3D_DATA = PROJECT_ROOT / "outputs" / "3d" / "terrain_3d_data_base.json"
DASHBOARD_3D_DATA = PROJECT_ROOT / "outputs" / "3d" / "dashboard" / "terrain_3d_data_base.json"
CONFIG_PATH = PROJECT_ROOT / "config.json"
MODEL_HALF_WIDTH_M = 6000.0


def export_3d_terrain_grid(grid_size=120):
    """Downsample DEM and max flood depth to an optimized regular grid for 3D WebGL rendering."""
    logging.info(f"Loading DEM for 3D terrain generation: {DEM_TIF}")
    
    with rasterio.open(DEM_TIF) as src:
        dem = src.read(1)
        nodata = src.nodata
        bounds = src.bounds
        transformer = Transformer.from_crs("EPSG:4326", src.crs, always_xy=True)
        dam = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))["machhu-ii"]
        dam_x, dam_y = transformer.transform(float(dam["lon"]), float(dam["lat"]))

        # Match the D-Flow FM domain exactly.  The old percentage crop had
        # no spatial relationship to the solver mesh or dam location.
        left = max(bounds.left, dam_x - MODEL_HALF_WIDTH_M)
        right = min(bounds.right, dam_x + MODEL_HALF_WIDTH_M)
        bottom = max(bounds.bottom, dam_y - MODEL_HALF_WIDTH_M)
        top = min(bounds.top, dam_y + MODEL_HALF_WIDTH_M)
        window = rasterio.windows.from_bounds(left, bottom, right, top, src.transform).round_offsets().round_lengths()
        dem = src.read(1, window=window)
        transform = src.window_transform(window)
        nodata = src.nodata

    # Historical max-depth is only an offline fallback visual layer; it is
    # resampled from the same projected window when available.
    if DEPTH_TIF.is_file():
        with rasterio.open(DEPTH_TIF) as src_d:
            sub_depth = src_d.read(1, window=window, boundless=True, fill_value=0)
    else:
        sub_depth = np.zeros_like(dem, dtype=np.float32)
    sub_dem = dem

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
        "crs": str(src.crs),
        "projected_bounds": {"min_x": left, "max_x": right, "min_y": bottom, "max_y": top},
        "dam_projected": {"x": dam_x, "y": dam_y},
        "dam_position": {"x": 0.0, "y": 0.0, "z": 0.0},
    }

    for output_path in (OUTPUT_3D_DATA, DASHBOARD_3D_DATA):
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(terrain_data, f)

    logging.info(f"Saved 3D WebGL terrain data: {OUTPUT_3D_DATA} ({grid_size}x{grid_size} vertices)")


if __name__ == "__main__":
    export_3d_terrain_grid(120)
