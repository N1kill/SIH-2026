#!/usr/bin/env python3
"""Create map products for Directive 2 DEM/catchment outputs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import geopandas as gpd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import rasterio
from rasterio.enums import Resampling


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
OUTPUT_DIR = PROJECT_ROOT / "outputs" / "gis"

DEM_CONDITIONED = PROCESSED_DIR / "dem_conditioned.tif"
FLOW_ACC = PROCESSED_DIR / "flow_acc.tif"
STREAMS = PROCESSED_DIR / "streams.tif"
WATERSHED_SHP = PROCESSED_DIR / "watershed.shp"
POUR_POINT_SNAPPED = PROCESSED_DIR / "pour_point_snapped.shp"
RIVERS = PROCESSED_DIR / "rivers_clipped.shp"
REPORT_JSON = PROCESSED_DIR / "dem_catchment_report.json"

DEM_MAP = OUTPUT_DIR / "dem_map.png"
FLOW_ACC_MAP = OUTPUT_DIR / "flow_accumulation.png"
WATERSHED_MAP = OUTPUT_DIR / "watershed_map.png"


def require_inputs() -> None:
    missing = [
        path
        for path in (DEM_CONDITIONED, FLOW_ACC, STREAMS, WATERSHED_SHP, POUR_POINT_SNAPPED)
        if not path.exists()
    ]
    if missing:
        formatted = "\n".join(f"  - {path}" for path in missing)
        raise FileNotFoundError(
            "Missing catchment outputs. Run scripts/06_dem_catchment.py first.\n" + formatted
        )


def read_raster_for_plot(path: Path, max_dim: int = 1800, nearest: bool = False):
    with rasterio.open(path) as src:
        scale = max(src.width / max_dim, src.height / max_dim, 1.0)
        out_width = max(1, int(src.width / scale))
        out_height = max(1, int(src.height / scale))
        resampling = Resampling.nearest if nearest else Resampling.bilinear
        data = src.read(1, masked=True, out_shape=(out_height, out_width), resampling=resampling)
        extent = [src.bounds.left, src.bounds.right, src.bounds.bottom, src.bounds.top]
        return data, extent, src.crs


def hillshade(elevation: np.ma.MaskedArray, azimuth: float = 315.0, altitude: float = 45.0) -> np.ndarray:
    elev = np.ma.filled(elevation, np.nan).astype("float64")
    dy, dx = np.gradient(elev)
    slope = np.pi / 2.0 - np.arctan(np.hypot(dx, dy))
    aspect = np.arctan2(-dx, dy)
    azimuth_rad = np.deg2rad(azimuth)
    altitude_rad = np.deg2rad(altitude)
    shaded = (
        np.sin(altitude_rad) * np.sin(slope)
        + np.cos(altitude_rad) * np.cos(slope) * np.cos(azimuth_rad - aspect)
    )
    shaded = 255.0 * (shaded + 1.0) / 2.0
    return np.clip(np.nan_to_num(shaded, nan=0.0), 0, 255)


def load_vectors(target_crs):
    watershed = gpd.read_file(WATERSHED_SHP).to_crs(target_crs)
    point = gpd.read_file(POUR_POINT_SNAPPED).to_crs(target_crs)
    rivers = gpd.read_file(RIVERS).to_crs(target_crs) if RIVERS.exists() else None
    return watershed, point, rivers


def watershed_area_label() -> str:
    if REPORT_JSON.exists():
        report = json.loads(REPORT_JSON.read_text(encoding="utf-8"))
        area = report.get("summary", {}).get("watershed_area_km2")
        if area is not None:
            return f"Watershed area: {area:,.1f} sq km"

    watershed = gpd.read_file(WATERSHED_SHP)
    projected = watershed.to_crs(watershed.estimate_utm_crs())
    area = projected.geometry.area.sum() / 1_000_000.0
    return f"Watershed area: {area:,.1f} sq km"


def add_standard_overlays(ax, watershed, point, rivers=None) -> None:
    if rivers is not None and not rivers.empty:
        rivers.plot(ax=ax, color="#2166ac", linewidth=0.8, alpha=0.75)
    watershed.boundary.plot(ax=ax, color="#fdd835", linewidth=1.8)
    point.plot(ax=ax, marker="*", color="#d73027", edgecolor="white", linewidth=0.8, markersize=130)


def save_dem_map() -> None:
    dem, extent, crs = read_raster_for_plot(DEM_CONDITIONED)
    watershed, point, rivers = load_vectors(crs)
    shade = hillshade(dem)

    fig, ax = plt.subplots(figsize=(11, 8.5), constrained_layout=True)
    ax.imshow(shade, extent=extent, cmap="gray", alpha=0.45)
    image = ax.imshow(dem, extent=extent, cmap="terrain", alpha=0.82)
    add_standard_overlays(ax, watershed, point, rivers)
    fig.colorbar(image, ax=ax, shrink=0.74, label="Elevation (m)")
    ax.set_title("Conditioned DEM with Watershed Boundary")
    ax.set_xlabel("Easting (m)")
    ax.set_ylabel("Northing (m)")
    fig.savefig(DEM_MAP, dpi=220)
    plt.close(fig)


def save_flow_accumulation_map() -> None:
    acc, extent, crs = read_raster_for_plot(FLOW_ACC)
    streams, _, _ = read_raster_for_plot(STREAMS, nearest=True)
    watershed, point, _ = load_vectors(crs)
    positive_acc = np.ma.masked_where(np.ma.filled(acc, 0) <= 0, acc)
    log_acc = np.ma.log10(positive_acc)
    stream_overlay = np.ma.masked_where(np.ma.filled(streams, 0) == 0, streams)

    fig, ax = plt.subplots(figsize=(11, 8.5), constrained_layout=True)
    image = ax.imshow(log_acc, extent=extent, cmap="magma")
    ax.imshow(stream_overlay, extent=extent, cmap="Blues", alpha=0.85)
    watershed.boundary.plot(ax=ax, color="white", linewidth=1.4)
    point.plot(ax=ax, marker="*", color="#00e5ff", edgecolor="black", linewidth=0.7, markersize=130)
    fig.colorbar(image, ax=ax, shrink=0.74, label="log10(flow accumulation cells)")
    ax.set_title("Flow Accumulation and Extracted Streams")
    ax.set_xlabel("Easting (m)")
    ax.set_ylabel("Northing (m)")
    fig.savefig(FLOW_ACC_MAP, dpi=220)
    plt.close(fig)


def save_watershed_map() -> None:
    dem, extent, crs = read_raster_for_plot(DEM_CONDITIONED)
    streams, _, _ = read_raster_for_plot(STREAMS, nearest=True)
    watershed, point, rivers = load_vectors(crs)
    stream_overlay = np.ma.masked_where(np.ma.filled(streams, 0) == 0, streams)

    fig, ax = plt.subplots(figsize=(11, 8.5), constrained_layout=True)
    ax.imshow(dem, extent=extent, cmap="Greys", alpha=0.78)
    ax.imshow(stream_overlay, extent=extent, cmap="winter", alpha=0.88)
    add_standard_overlays(ax, watershed, point, rivers)
    ax.text(
        0.02,
        0.03,
        watershed_area_label(),
        transform=ax.transAxes,
        ha="left",
        va="bottom",
        fontsize=11,
        bbox={"boxstyle": "round,pad=0.35", "facecolor": "white", "edgecolor": "#555555", "alpha": 0.88},
    )
    ax.set_title("Delineated Watershed and River Network")
    ax.set_xlabel("Easting (m)")
    ax.set_ylabel("Northing (m)")
    fig.savefig(WATERSHED_MAP, dpi=220)
    plt.close(fig)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR, help="Directory for PNG map outputs")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    global OUTPUT_DIR, DEM_MAP, FLOW_ACC_MAP, WATERSHED_MAP
    OUTPUT_DIR = args.output_dir
    DEM_MAP = OUTPUT_DIR / "dem_map.png"
    FLOW_ACC_MAP = OUTPUT_DIR / "flow_accumulation.png"
    WATERSHED_MAP = OUTPUT_DIR / "watershed_map.png"

    require_inputs()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    save_dem_map()
    save_flow_accumulation_map()
    save_watershed_map()
    print(f"Wrote {DEM_MAP}")
    print(f"Wrote {FLOW_ACC_MAP}")
    print(f"Wrote {WATERSHED_MAP}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
