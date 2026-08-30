#!/usr/bin/env python3
"""Directive 2: DEM conditioning and catchment delineation.

This script converts the raw SRTM DEM into UTM 42N, conditions it for
hydrology, derives D8 flow products, snaps the requested pour point to the
nearest high-accumulation cell, and delineates the upstream watershed.
"""

from __future__ import annotations

import argparse
import json
import logging
import math
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.features import shapes
from rasterio.transform import rowcol, xy
from rasterio.warp import calculate_default_transform, reproject
from shapely.geometry import Point, shape
from shapely.ops import unary_union


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DEM = PROJECT_ROOT / "data" / "raw" / "dem" / "dem_raw.tif"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
# Directive 1 writes the AOI-clipped HydroRIVERS data under ``data/raw``.
# Keep the former processed location as a secondary option so older project
# layouts can still be rerun, but never silently fall back when the raw input
# is available.
HYDRORIVERS_INPUTS = (
    PROJECT_ROOT / "data" / "raw" / "rivers" / "hydrorivers_clip.shp",
    PROJECT_ROOT / "data" / "processed" / "rivers_clipped.shp",
)

DEM_UTM = PROCESSED_DIR / "dem_utm42.tif"
DEM_CLIP = PROCESSED_DIR / "dem_clip.tif"
DEM_CONDITIONED = PROCESSED_DIR / "dem_conditioned.tif"
FLOW_DIR = PROCESSED_DIR / "flow_dir.tif"
FLOW_ACC = PROCESSED_DIR / "flow_acc.tif"
STREAMS = PROCESSED_DIR / "streams.tif"
POUR_POINT = PROCESSED_DIR / "pour_point.shp"
POUR_POINT_SNAPPED = PROCESSED_DIR / "pour_point_snapped.shp"
WATERSHED_TIF = PROCESSED_DIR / "watershed.tif"
WATERSHED_SHP = PROCESSED_DIR / "watershed.shp"
REPORT_JSON = PROCESSED_DIR / "dem_catchment_report.json"

TARGET_CRS = CRS.from_epsg(32642)
SOURCE_CRS = CRS.from_epsg(4326)
POUR_POINT_LON = 70.84
POUR_POINT_LAT = 22.82
EXPECTED_AREA_KM2 = 1928.0
AREA_TOLERANCE = 0.10
DEFAULT_STREAM_THRESHOLD = 1000
STREAM_THRESHOLD_CANDIDATES = (500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000)

# pysheds' ESRI-style D8 coding, ordered clockwise from N.
D8_DIRMAP = (64, 128, 1, 2, 4, 8, 16, 32)


@dataclass
class RunConfig:
    overwrite: bool
    stream_threshold: int | None
    snap_radius_m: float
    expected_area_km2: float
    area_tolerance: float


@dataclass
class RunSummary:
    dem: dict[str, Any] = field(default_factory=dict)
    stream_threshold: int | None = None
    stream_threshold_diagnostics: dict[str, Any] = field(default_factory=dict)
    pour_point_utm: tuple[float, float] | None = None
    snapped_pour_point_utm: tuple[float, float] | None = None
    snap_distance_m: float | None = None
    watershed_area_km2: float | None = None
    validation: dict[str, Any] = field(default_factory=dict)


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(message)s",
        datefmt="%H:%M:%S",
    )


def ensure_pysheds():
    # Current Numba releases support Windows and Python 3.13.  Do not force
    # NUMBA_DISABLE_JIT here: it turns DEM conditioning into a slow Python
    # loop on a fresh run.  The NumPy 2 compatibility alias below is still
    # required by pysheds 0.5.
    if not hasattr(np, "in1d"):
        np.in1d = lambda ar1, ar2, assume_unique=False, invert=False: np.isin(  # type: ignore[attr-defined]
            ar1,
            ar2,
            assume_unique=assume_unique,
            invert=invert,
        )
    try:
        from pysheds.grid import Grid
    except ImportError as exc:
        raise SystemExit(
            "pysheds is required for Directive 2. Install dependencies with "
            "`pip install -r requirements.txt` and rerun this script."
        ) from exc
    return Grid


def should_skip(path: Path, overwrite: bool) -> bool:
    if path.exists() and not overwrite:
        logging.info("Skipping existing %s (use --overwrite to regenerate)", path)
        return True
    return False


def remove_shapefile(path: Path) -> None:
    for suffix in (".shp", ".shx", ".dbf", ".prj", ".cpg", ".qix"):
        sidecar = path.with_suffix(suffix)
        if sidecar.exists():
            sidecar.unlink()


def raster_has_valid_data(path: Path) -> bool:
    with rasterio.open(path) as src:
        band = src.read(1, masked=True)
        return bool(np.ma.count(band) > 0)


def to_jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): to_jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_jsonable(item) for item in value]
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, Path):
        return str(value)
    return value


def inspect_dem(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Raw DEM not found: {path}")

    with rasterio.open(path) as src:
        data = src.read(1, masked=True)
        info = {
            "path": str(path),
            "crs": src.crs.to_string() if src.crs else None,
            "width": src.width,
            "height": src.height,
            "dtype": src.dtypes[0],
            "nodata": src.nodata,
            "bounds": tuple(float(v) for v in src.bounds),
            "resolution": tuple(float(v) for v in src.res),
            "min": float(data.min()),
            "max": float(data.max()),
            "mean": float(data.mean()),
        }

    logging.info(
        "Raw DEM: %sx%s %s %s, elevation %.2f..%.2f m",
        info["width"],
        info["height"],
        info["crs"],
        info["dtype"],
        info["min"],
        info["max"],
    )
    return info


def reproject_dem(src_path: Path, dst_path: Path, overwrite: bool) -> None:
    if should_skip(dst_path, overwrite):
        return

    logging.info("Reprojecting DEM to %s: %s", TARGET_CRS.to_string(), dst_path)
    with rasterio.open(src_path) as src:
        transform, width, height = calculate_default_transform(
            src.crs, TARGET_CRS, src.width, src.height, *src.bounds
        )
        profile = src.profile.copy()
        profile.update(
            crs=TARGET_CRS,
            transform=transform,
            width=width,
            height=height,
            dtype="float32",
            nodata=src.nodata if src.nodata is not None else -9999.0,
            compress="deflate",
            tiled=True,
            bigtiff="if_safer",
        )

        with rasterio.open(dst_path, "w", **profile) as dst:
            reproject(
                source=rasterio.band(src, 1),
                destination=rasterio.band(dst, 1),
                src_transform=src.transform,
                src_crs=src.crs,
                src_nodata=src.nodata,
                dst_transform=transform,
                dst_crs=TARGET_CRS,
                dst_nodata=profile["nodata"],
                resampling=Resampling.bilinear,
            )


def clip_dem(src_path: Path, dst_path: Path, overwrite: bool) -> None:
    if should_skip(dst_path, overwrite):
        return

    logging.info("Clipping DEM using full available extent: %s", dst_path)
    with rasterio.open(src_path) as src:
        profile = src.profile.copy()
        data = src.read(1)

    with rasterio.open(dst_path, "w", **profile) as dst:
        dst.write(data, 1)


def write_raster_like(reference_path: Path, dst_path: Path, data: np.ndarray, dtype: str, nodata: float | int) -> None:
    with rasterio.open(reference_path) as src:
        profile = src.profile.copy()
        profile.update(dtype=dtype, nodata=nodata, compress="deflate", tiled=True, bigtiff="if_safer")

    with rasterio.open(dst_path, "w", **profile) as dst:
        dst.write(data.astype(dtype, copy=False), 1)


def fill_sinks(src_path: Path, dst_path: Path, overwrite: bool) -> None:
    if should_skip(dst_path, overwrite):
        return

    logging.info("Conditioning DEM with pysheds depression filling: %s", dst_path)
    Grid = ensure_pysheds()
    grid = Grid.from_raster(str(src_path))
    dem = grid.read_raster(str(src_path))
    pit_filled = grid.fill_pits(dem)
    depression_filled = grid.fill_depressions(pit_filled)
    conditioned = grid.resolve_flats(depression_filled)

    with rasterio.open(src_path) as src:
        nodata = src.nodata if src.nodata is not None else -9999.0
    write_raster_like(src_path, dst_path, np.asarray(conditioned), "float32", nodata)


def flow_direction(src_path: Path, dst_path: Path, overwrite: bool) -> None:
    if should_skip(dst_path, overwrite):
        return

    logging.info("Deriving D8 flow direction: %s", dst_path)
    Grid = ensure_pysheds()
    grid = Grid.from_raster(str(src_path))
    dem = grid.read_raster(str(src_path))
    fdir = grid.flowdir(dem, dirmap=D8_DIRMAP)
    write_raster_like(src_path, dst_path, np.asarray(fdir), "uint8", 0)


def flow_accumulation(flow_dir_path: Path, reference_path: Path, dst_path: Path, overwrite: bool) -> None:
    if should_skip(dst_path, overwrite):
        return

    logging.info("Accumulating upstream cells: %s", dst_path)
    Grid = ensure_pysheds()
    grid = Grid.from_raster(str(reference_path))
    fdir = grid.read_raster(str(flow_dir_path))
    acc = grid.accumulation(fdir, dirmap=D8_DIRMAP)
    write_raster_like(reference_path, dst_path, np.asarray(acc), "float32", -9999.0)


def cell_size_m(path: Path) -> float:
    with rasterio.open(path) as src:
        return float((abs(src.transform.a) + abs(src.transform.e)) / 2.0)


def estimate_stream_length_km(acc_path: Path, threshold: int) -> float:
    with rasterio.open(acc_path) as src:
        acc = src.read(1, masked=True)
    valid = np.ma.filled(acc, -np.inf)
    cells = int(np.count_nonzero(valid >= threshold))
    return cells * cell_size_m(acc_path) / 1000.0


def hydro_rivers_path() -> Path | None:
    """Return the first available clipped HydroRIVERS input."""
    return next((path for path in HYDRORIVERS_INPUTS if path.exists()), None)


def calibrate_stream_threshold(acc_path: Path, requested_threshold: int | None) -> tuple[int, dict[str, Any]]:
    if requested_threshold is not None:
        return requested_threshold, {"mode": "manual", "threshold": requested_threshold}

    diagnostics: dict[str, Any] = {"mode": "default", "candidates": {}}
    rivers_path = hydro_rivers_path()
    if rivers_path is not None:
        try:
            rivers = gpd.read_file(rivers_path).to_crs(TARGET_CRS)
            hydro_length_km = float(rivers.length.sum() / 1000.0)
            diagnostics["hydro_rivers_path"] = str(rivers_path)
            diagnostics["hydro_rivers_feature_count"] = int(len(rivers))
            diagnostics["hydro_rivers_length_km"] = hydro_length_km
            diagnostics["mode"] = "hydro_rivers_calibrated"
            best_threshold = DEFAULT_STREAM_THRESHOLD
            best_delta = math.inf
            for threshold in STREAM_THRESHOLD_CANDIDATES:
                length_km = estimate_stream_length_km(acc_path, threshold)
                diagnostics["candidates"][str(threshold)] = length_km
                delta = abs(length_km - hydro_length_km)
                if delta < best_delta:
                    best_delta = delta
                    best_threshold = threshold
            return best_threshold, diagnostics
        except Exception as exc:  # pragma: no cover - diagnostic fallback
            logging.warning("Stream calibration from HydroRIVERS failed: %s", exc)
            diagnostics["calibration_error"] = str(exc)

    diagnostics["threshold"] = DEFAULT_STREAM_THRESHOLD
    return DEFAULT_STREAM_THRESHOLD, diagnostics


def extract_streams(acc_path: Path, dst_path: Path, threshold: int, overwrite: bool) -> None:
    # The threshold changes when HydroRIVERS calibration is introduced or the
    # candidate list is revised.  Retain a matching stream raster, otherwise
    # regenerate this cheap derivative even on a normal non-overwrite rerun.
    if dst_path.exists() and not overwrite:
        with rasterio.open(dst_path) as existing:
            stored_threshold = existing.tags().get("stream_threshold_cells")
        if stored_threshold == str(threshold):
            logging.info("Skipping existing %s with matching stream threshold %s", dst_path, threshold)
            return
        logging.info(
            "Regenerating %s because its recorded stream threshold (%s) does not match %s",
            dst_path,
            stored_threshold or "missing",
            threshold,
        )

    logging.info("Extracting streams with accumulation threshold %s cells: %s", threshold, dst_path)
    with rasterio.open(acc_path) as src:
        acc = src.read(1, masked=True)
        profile = src.profile.copy()

    streams = (np.ma.filled(acc, -np.inf) >= threshold).astype("uint8")
    profile.update(dtype="uint8", nodata=0, compress="deflate", tiled=True)
    with rasterio.open(dst_path, "w", **profile) as dst:
        dst.write(streams, 1)
        dst.update_tags(stream_threshold_cells=str(threshold))


def create_pour_point(dst_path: Path, overwrite: bool) -> tuple[float, float]:
    if dst_path.exists() and not overwrite:
        existing = gpd.read_file(dst_path).to_crs(TARGET_CRS)
        point = existing.geometry.iloc[0]
        logging.info("Using existing pour point: %s", dst_path)
        return float(point.x), float(point.y)

    transformer = Transformer.from_crs(SOURCE_CRS, TARGET_CRS, always_xy=True)
    x, y = transformer.transform(POUR_POINT_LON, POUR_POINT_LAT)
    gdf = gpd.GeoDataFrame(
        [{"lon": POUR_POINT_LON, "lat": POUR_POINT_LAT, "note": "original"}],
        geometry=[Point(x, y)],
        crs=TARGET_CRS,
    )
    remove_shapefile(dst_path)
    gdf.to_file(dst_path)
    logging.info("Created pour point at UTM %.2f, %.2f: %s", x, y, dst_path)
    return float(x), float(y)


def snap_pour_point(
    acc_path: Path,
    original_xy: tuple[float, float],
    dst_path: Path,
    radius_m: float,
    overwrite: bool,
) -> tuple[tuple[float, float], float]:
    if dst_path.exists() and not overwrite:
        existing = gpd.read_file(dst_path).to_crs(TARGET_CRS)
        point = existing.geometry.iloc[0]
        distance = Point(original_xy).distance(point)
        logging.info("Using existing snapped pour point: %s", dst_path)
        return (float(point.x), float(point.y)), float(distance)

    logging.info("Snapping pour point to highest accumulation cell within %.0f m", radius_m)
    with rasterio.open(acc_path) as src:
        acc = src.read(1, masked=True)
        transform = src.transform
        row, col = rowcol(transform, original_xy[0], original_xy[1])
        radius_cells = max(1, int(math.ceil(radius_m / cell_size_m(acc_path))))

        row_min = max(0, row - radius_cells)
        row_max = min(src.height, row + radius_cells + 1)
        col_min = max(0, col - radius_cells)
        col_max = min(src.width, col + radius_cells + 1)
        window = np.ma.filled(acc[row_min:row_max, col_min:col_max], -np.inf)

        if not np.isfinite(window).any():
            raise RuntimeError("No valid accumulation cells found near pour point")

        local_row, local_col = np.unravel_index(int(np.argmax(window)), window.shape)
        snapped_row = row_min + int(local_row)
        snapped_col = col_min + int(local_col)
        snapped_x, snapped_y = xy(transform, snapped_row, snapped_col)

    original_point = Point(original_xy)
    snapped_point = Point(float(snapped_x), float(snapped_y))
    snap_distance = float(original_point.distance(snapped_point))
    gdf = gpd.GeoDataFrame(
        [{"snap_m": snap_distance, "radius_m": radius_m, "note": "snapped"}],
        geometry=[snapped_point],
        crs=TARGET_CRS,
    )
    remove_shapefile(dst_path)
    gdf.to_file(dst_path)
    logging.info(
        "Snapped pour point %.1f m to UTM %.2f, %.2f: %s",
        snap_distance,
        snapped_x,
        snapped_y,
        dst_path,
    )
    return (float(snapped_x), float(snapped_y)), snap_distance


def delineate_watershed(
    flow_dir_path: Path,
    reference_path: Path,
    snapped_xy: tuple[float, float],
    raster_path: Path,
    vector_path: Path,
    overwrite: bool,
) -> float:
    if raster_path.exists() and vector_path.exists() and not overwrite:
        gdf = gpd.read_file(vector_path).to_crs(TARGET_CRS)
        area_km2 = float(gdf.geometry.area.sum() / 1_000_000.0)
        logging.info("Using existing watershed: %s", vector_path)
        return area_km2

    logging.info("Delineating upstream watershed from snapped pour point")
    Grid = ensure_pysheds()
    grid = Grid.from_raster(str(reference_path))
    fdir = grid.read_raster(str(flow_dir_path))
    with rasterio.open(reference_path) as src:
        pour_row, pour_col = rowcol(src.transform, snapped_xy[0], snapped_xy[1])
    catchment = grid.catchment(
        x=pour_col,
        y=pour_row,
        fdir=fdir,
        dirmap=D8_DIRMAP,
        xytype="index",
    )
    catchment_array = np.asarray(catchment).astype("uint8")

    write_raster_like(reference_path, raster_path, catchment_array, "uint8", 0)

    with rasterio.open(raster_path) as src:
        mask = catchment_array == 1
        polygons = [
            shape(geom)
            for geom, value in shapes(catchment_array, mask=mask, transform=src.transform)
            if int(value) == 1
        ]

    if not polygons:
        raise RuntimeError("Watershed delineation produced no polygon")

    merged = unary_union(polygons)
    gdf = gpd.GeoDataFrame([{"area_km2": float(merged.area / 1_000_000.0)}], geometry=[merged], crs=TARGET_CRS)
    remove_shapefile(vector_path)
    gdf.to_file(vector_path)
    area_km2 = float(gdf.geometry.area.sum() / 1_000_000.0)
    logging.info("Watershed area: %.2f km2", area_km2)
    return area_km2


def validate_outputs(summary: RunSummary, config: RunConfig) -> dict[str, Any]:
    min_area = config.expected_area_km2 * (1.0 - config.area_tolerance)
    max_area = config.expected_area_km2 * (1.0 + config.area_tolerance)
    raster_checks = {}
    errors: list[str] = []

    for path in (DEM_UTM, DEM_CLIP, DEM_CONDITIONED, FLOW_DIR, FLOW_ACC, STREAMS, WATERSHED_TIF):
        with rasterio.open(path) as src:
            crs_ok = bool(src.crs == TARGET_CRS)
        data_ok = raster_has_valid_data(path)
        raster_checks[path.name] = {"crs_epsg_32642": crs_ok, "has_valid_data": data_ok}
        if not crs_ok:
            errors.append(f"{path.name} CRS is not EPSG:32642")
        if not data_ok:
            errors.append(f"{path.name} contains no valid data")

    area = summary.watershed_area_km2
    area_ok = area is not None and min_area <= area <= max_area
    if not area_ok:
        errors.append(
            f"Watershed area {area:.2f} km2 is outside target range {min_area:.2f}-{max_area:.2f} km2"
            if area is not None
            else "Watershed area was not calculated"
        )

    snap_ok = summary.snap_distance_m is not None and summary.snap_distance_m <= config.snap_radius_m
    if not snap_ok:
        errors.append(
            f"Snapped point moved {summary.snap_distance_m:.2f} m, beyond {config.snap_radius_m:.2f} m"
            if summary.snap_distance_m is not None
            else "Snap distance was not calculated"
        )

    validation = {
        "status": "PASS" if not errors else "FAIL",
        "errors": errors,
        "rasters": raster_checks,
        "target_area_km2": config.expected_area_km2,
        "target_range_km2": [min_area, max_area],
        "snap_radius_m": config.snap_radius_m,
    }
    logging.info("Validation status: %s", validation["status"])
    return validation


def write_report(summary: RunSummary, config: RunConfig) -> None:
    report = {"config": asdict(config), "summary": asdict(summary)}
    REPORT_JSON.write_text(json.dumps(to_jsonable(report), indent=2), encoding="utf-8")
    logging.info("Wrote processing report: %s", REPORT_JSON)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--overwrite", action="store_true", help="Regenerate existing outputs")
    parser.add_argument(
        "--stream-threshold",
        type=int,
        default=None,
        help="Manual accumulation threshold in cells; defaults to HydroRIVERS calibration or 1000",
    )
    parser.add_argument("--snap-radius-m", type=float, default=500.0, help="Maximum pour-point snapping radius")
    parser.add_argument("--expected-area-km2", type=float, default=EXPECTED_AREA_KM2)
    parser.add_argument("--area-tolerance", type=float, default=AREA_TOLERANCE)
    return parser.parse_args()


def main() -> int:
    setup_logging()
    args = parse_args()
    config = RunConfig(
        overwrite=args.overwrite,
        stream_threshold=args.stream_threshold,
        snap_radius_m=args.snap_radius_m,
        expected_area_km2=args.expected_area_km2,
        area_tolerance=args.area_tolerance,
    )
    summary = RunSummary()
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    summary.dem = inspect_dem(RAW_DEM)
    reproject_dem(RAW_DEM, DEM_UTM, config.overwrite)
    clip_dem(DEM_UTM, DEM_CLIP, config.overwrite)
    fill_sinks(DEM_CLIP, DEM_CONDITIONED, config.overwrite)
    flow_direction(DEM_CONDITIONED, FLOW_DIR, config.overwrite)
    flow_accumulation(FLOW_DIR, DEM_CONDITIONED, FLOW_ACC, config.overwrite)

    threshold, threshold_diagnostics = calibrate_stream_threshold(FLOW_ACC, config.stream_threshold)
    summary.stream_threshold = threshold
    summary.stream_threshold_diagnostics = threshold_diagnostics
    extract_streams(FLOW_ACC, STREAMS, threshold, config.overwrite)

    summary.pour_point_utm = create_pour_point(POUR_POINT, config.overwrite)
    snapped_xy, snap_distance = snap_pour_point(
        FLOW_ACC,
        summary.pour_point_utm,
        POUR_POINT_SNAPPED,
        config.snap_radius_m,
        config.overwrite,
    )
    summary.snapped_pour_point_utm = snapped_xy
    summary.snap_distance_m = snap_distance
    summary.watershed_area_km2 = delineate_watershed(
        FLOW_DIR,
        DEM_CONDITIONED,
        snapped_xy,
        WATERSHED_TIF,
        WATERSHED_SHP,
        config.overwrite,
    )
    summary.validation = validate_outputs(summary, config)
    write_report(summary, config)

    if summary.validation["status"] != "PASS":
        for error in summary.validation["errors"]:
            logging.warning("Project validation note / deviation: %s", error)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
