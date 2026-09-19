#!/usr/bin/env python3
"""Build, run, and summarize a Delft3D-FM dam-break model.

This replaces the previous dummy Delft3D-FLOW deck.  It creates a genuine
D-Flow FM UGRID mesh from the conditioned DEM, writes a time-varying source
release and downstream water-level boundary, and runs ``dflowfm-cli``.

The source hydrograph is deliberately an input artifact: it must be generated
from the reservoir/gate/breach physics service before this workflow is run.
"""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
from pathlib import Path

import numpy as np
import rasterio
from netCDF4 import Dataset
from pyproj import Transformer


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = PROJECT_ROOT / "outputs" / "simulation" / "delft3d_fm"
DEM_PATH = PROJECT_ROOT / "data" / "processed" / "dem_conditioned.tif"
CONFIG_PATH = PROJECT_ROOT / "config.json"
DASHBOARD_RESULT_PATH = PROJECT_ROOT / "outputs" / "3d" / "dashboard" / "delft3d_fm_latest.json"


def find_dflowfm_cli() -> Path:
    """Locate the FM CLI, including the standard Windows Suite layout."""
    discovered = shutil.which("dflowfm-cli") or shutil.which("dflowfm-cli.exe")
    if discovered:
        return Path(discovered)

    dimr = shutil.which("dimr") or shutil.which("dimr.exe")
    if dimr:
        sibling = Path(dimr).with_name("dflowfm-cli.exe")
        if sibling.is_file():
            return sibling
    raise FileNotFoundError("dflowfm-cli.exe was not found on PATH")


def load_dam_location() -> tuple[float, float]:
    with CONFIG_PATH.open(encoding="utf-8") as stream:
        dam = json.load(stream)["machhu-ii"]
    return float(dam["lat"]), float(dam["lon"])


def default_hydrograph(duration_s: int, dt_s: int) -> list[tuple[float, float]]:
    """A small, explicit test hydrograph used only when requested.

    Production runs must pass a CSV written from the physics service; this
    fallback exists solely to validate the Delft3D-FM input deck and CLI.
    """
    times = np.arange(0, duration_s + dt_s, dt_s, dtype=float)
    q = np.where(times < duration_s * 0.25, 200.0 * times / (duration_s * 0.25),
                 200.0 * np.exp(-(times - duration_s * 0.25) / max(duration_s * 0.5, 1)))
    return list(zip(times.tolist(), q.tolist()))


def read_hydrograph(path: Path) -> list[tuple[float, float]]:
    with path.open(newline="", encoding="utf-8") as stream:
        rows = csv.DictReader(stream)
        values = [(float(row["time_s"]), float(row["discharge_m3s"])) for row in rows]
    if len(values) < 2:
        raise ValueError("hydrograph CSV needs at least two time_s/discharge_m3s rows")
    return values


def write_ugrid_mesh(dem_path: Path, lat: float, lon: float, cell_m: float,
                     half_width_m: float, model_dir: Path) -> tuple[Path, tuple[float, float], float, float, tuple[float, float, float, float]]:
    """Create a quad UGRID mesh and node bathymetry around the dam toe."""
    with rasterio.open(dem_path) as src:
        transformer = Transformer.from_crs("EPSG:4326", src.crs, always_xy=True)
        dam_x, dam_y = transformer.transform(lon, lat)
        left = max(src.bounds.left, dam_x - half_width_m)
        right = min(src.bounds.right, dam_x + half_width_m)
        bottom = max(src.bounds.bottom, dam_y - half_width_m)
        top = min(src.bounds.top, dam_y + half_width_m)
        nx = max(4, int((right - left) / cell_m))
        ny = max(4, int((top - bottom) / cell_m))
        xs = np.linspace(left, right, nx + 1)
        ys = np.linspace(bottom, top, ny + 1)
        xx, yy = np.meshgrid(xs, ys)
        node_xy = np.column_stack((xx.ravel(), yy.ravel()))
        z = np.fromiter((sample[0] for sample in src.sample(node_xy)), dtype=np.float64)
        valid = z[np.isfinite(z) & (z != src.nodata)] if src.nodata is not None else z[np.isfinite(z)]
        z[~np.isfinite(z)] = float(np.nanmedian(valid))
        if src.nodata is not None:
            z[z == src.nodata] = float(np.nanmedian(valid))

    faces = []
    for row in range(ny):
        for col in range(nx):
            a = row * (nx + 1) + col
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))

    net_path = model_dir / "machhu_net.nc"
    # D-Flow FM's NetFile reader requires the Deltares network variables, not
    # merely a generic UGRID face list.  Connectivity is one-based by format.
    links: list[tuple[int, int]] = []
    boundary_links: list[int] = []
    for row in range(ny + 1):
        for col in range(nx):
            links.append((row * (nx + 1) + col + 1, row * (nx + 1) + col + 2))
            if row in (0, ny):
                boundary_links.append(len(links))
    for row in range(ny):
        for col in range(nx + 1):
            links.append((row * (nx + 1) + col + 1, (row + 1) * (nx + 1) + col + 1))
            if col in (0, nx):
                boundary_links.append(len(links))

    with Dataset(net_path, "w", format="NETCDF4_CLASSIC") as nc:
        nc.createDimension("nNetNode", len(node_xy))
        nc.createDimension("nNetLink", len(links))
        nc.createDimension("nNetLinkPts", 2)
        nc.createDimension("nNetElem", len(faces))
        nc.createDimension("nNetElemMaxNode", 4)
        nc.createDimension("nBndLink", len(boundary_links))
        x_var = nc.createVariable("NetNode_x", "f8", ("nNetNode",))
        y_var = nc.createVariable("NetNode_y", "f8", ("nNetNode",))
        z_var = nc.createVariable("NetNode_z", "f8", ("nNetNode",))
        x_var[:] = node_xy[:, 0]
        y_var[:] = node_xy[:, 1]
        z_var[:] = z
        nc.createVariable("NetLink", "i4", ("nNetLink", "nNetLinkPts"))[:] = np.asarray(links, dtype=np.int32)
        nc.createVariable("NetLinkType", "i4", ("nNetLink",))[:] = 2
        nc.createVariable("NetElemNode", "i4", ("nNetElem", "nNetElemMaxNode"))[:] = np.asarray(faces, dtype=np.int32) + 1
        nc.createVariable("BndLink", "i4", ("nBndLink",))[:] = np.asarray(boundary_links, dtype=np.int32)
        nc.Conventions = "CF-1.4:Deltares-0.1"

    # Lowest outer edge is the physically sensible open downstream boundary.
    edge_values = {
        "west": z.reshape(ny + 1, nx + 1)[:, 0],
        "east": z.reshape(ny + 1, nx + 1)[:, -1],
        "south": z.reshape(ny + 1, nx + 1)[0, :],
        "north": z.reshape(ny + 1, nx + 1)[-1, :],
    }
    outlet = min(edge_values, key=lambda key: float(np.mean(edge_values[key])))
    outlet_level = float(np.min(edge_values[outlet]) + 0.05)
    write_outlet_polyline(model_dir / "downstream.pli", outlet, left, right, bottom, top)
    dam_bed_level = float(z[np.argmin(np.sum((node_xy - np.array((dam_x, dam_y))) ** 2, axis=1))])
    return net_path, (dam_x, dam_y), outlet_level, dam_bed_level, (left, right, bottom, top)


def write_outlet_polyline(path: Path, edge: str, left: float, right: float, bottom: float, top: float) -> None:
    points = {
        "west": ((left, bottom), (left, top)),
        "east": ((right, bottom), (right, top)),
        "south": ((left, bottom), (right, bottom)),
        "north": ((left, top), (right, top)),
    }[edge]
    path.write_text(
        "downstream\n2 2\n" + "\n".join(f"{x:.3f} {y:.3f}" for x, y in points) + "\n",
        encoding="ascii",
    )


def write_forcings(model_dir: Path, source_xy: tuple[float, float], outlet_level: float,
                   hydrograph: list[tuple[float, float]]) -> None:
    source_bc = ["[General]", "fileVersion = 1.01", "fileType = boundConds", "", "[Forcing]",
                 "name = dam_release", "function = timeSeries", "timeInterpolation = linear",
                 "quantity = time", "unit = seconds since 2001-01-01 00:00:00",
                 "quantity = sourcesink_discharge", "unit = m3 s-1"]
    source_bc.extend(f"{time_s:.1f} {q:.6f}" for time_s, q in hydrograph)
    source_bc.extend(["", "[Forcing]", "name = downstream_0001", "function = timeSeries",
                      "timeInterpolation = linear", "quantity = time",
                      "unit = seconds since 2001-01-01 00:00:00", "quantity = waterlevelbnd", "unit = m"])
    source_bc.extend(f"{time_s:.1f} {outlet_level:.4f}" for time_s, _ in hydrograph)
    (model_dir / "forcings.bc").write_text("\n".join(source_bc) + "\n", encoding="ascii")
    x, y = source_xy
    (model_dir / "forcings.ext").write_text(
        "[General]\nfileVersion = 2.02\nfileType = extForce\n\n"
        "[SourceSink]\nid = dam_release\nname = Dam release\n"
        "numCoordinates = 1\nxCoordinates = %.3f\nyCoordinates = %.3f\n"
        "discharge = forcings.bc\n\n"
        "[Boundary]\nquantity = waterlevelbnd\nlocationFile = downstream.pli\nforcingFile = forcings.bc\n" % (x, y),
        encoding="ascii",
    )


def write_dam_and_gates(model_dir: Path, dam_xy: tuple[float, float], bounds: tuple[float, float, float, float],
                        cell_m: float, crest_level: float) -> None:
    """Create an FM thin-dam barrier with a real gated crossing at its centre."""
    dam_x, dam_y = dam_xy
    left, right, _, _ = bounds
    gate_span_m = 9.0  # three open 3 m bays; the remaining two are closed
    # Retain the barrier geometry as an audit artifact. The FM gate structure
    # below spans the full dam line and itself blocks all but gate_span_m.
    (model_dir / "dam_barrier.thd").write_text(
        "left_dam\n2 2\n"
        f"{left:.3f} {dam_y:.3f}\n{dam_x - gate_span_m * 0.5:.3f} {dam_y:.3f}\n"
        "right_dam\n2 2\n"
        f"{dam_x + gate_span_m * 0.5:.3f} {dam_y:.3f}\n{right:.3f} {dam_y:.3f}\n",
        encoding="ascii",
    )
    # Gate geometry is supplied in the same projected CRS as the DEM.  FM
    # blocks the horizontal faces outside gateOpeningWidth and solves the
    # vertical opening hydraulics across the remaining structure links.
    (model_dir / "structures.ini").write_text(
        "[General]\nfileVersion = 3.01\nfileType = structure\n\n"
        "[Structure]\nid = spillway_gates\nname = Three open spillway gates\n"
        "type = gate\nnumCoordinates = 2\n"
        f"xCoordinates = {left:.3f} {right:.3f}\n"
        f"yCoordinates = {dam_y:.3f} {dam_y:.3f}\n"
        f"crestLevel = {crest_level:.3f}\n"
        # Lifted leaf: the 2 m gap below the gate is the vertical opening.
        f"gateLowerEdgeLevel = {crest_level + 2.0:.3f}\n"
        "gateHeight = 6.0\ngateOpeningWidth = 9.0\n"
        f"gateOpeningHorizontalDirection = symmetric\ncrestWidth = {right - left:.3f}\n",
        encoding="ascii",
    )


def write_mdu(model_dir: Path, duration_s: float) -> Path:
    mdu_path = model_dir / "machhu_dambreak.mdu"
    mdu_path.write_text(
        "[General]\nProgram = D-Flow FM\nVersion = 1.2.60\nFileType = modelDef\n"
        "FileVersion = 1.09\nAutoStart = 0\n\n"
        "[Geometry]\nNetFile = machhu_net.nc\nBedlevType = 3\n"
        "StructureFile = structures.ini\n\n"
        "[Physics]\nUnifFrictType = 1\nUnifFrictCoef = 0.035\n\n"
        "[Numerics]\nCFLMax = 0.7\n\n"
        "[Time]\nRefDate = 20010101\nTUnit = S\nDtUser = 60\nDtMax = 15\nDtInit = 1\n"
        f"TStart = 0\nTStop = {duration_s:.1f}\n\n"
        "[External forcing]\nExtForceFile =\nExtForceFileNew = forcings.ext\n\n"
        "[Output]\nOutputDir = DFM_OUTPUT_machhu_dambreak\nMapInterval = 300\n"
        "MapFormat = 4\nNcFormat = 4\nwriMap_waterdepth = 1\n"
        "wriMap_velocity_vector = 1\nwriMap_velocity_magnitude = 1\n",
        encoding="ascii",
    )
    return mdu_path


def build_model(hydrograph: list[tuple[float, float]], cell_m: float, half_width_m: float,
                dam_location: tuple[float, float] | None = None) -> Path:
    if not DEM_PATH.is_file():
        raise FileNotFoundError(f"conditioned DEM missing: {DEM_PATH}")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    lat, lon = dam_location or load_dam_location()
    _, dam_xy, outlet_level, dam_bed_level, bounds = write_ugrid_mesh(DEM_PATH, lat, lon, cell_m, half_width_m, MODEL_DIR)
    # The reservoir-side source is upstream of the barrier.  It cannot reach
    # the downstream domain except through the FM gate structure.
    source_xy = (dam_xy[0], dam_xy[1] + max(cell_m, 30.0))
    write_dam_and_gates(MODEL_DIR, dam_xy, bounds, cell_m, dam_bed_level)
    write_forcings(MODEL_DIR, source_xy, outlet_level, hydrograph)
    return write_mdu(MODEL_DIR, hydrograph[-1][0])


def run_model(mdu_path: Path, threads: int) -> None:
    cli = find_dflowfm_cli()
    # FM auto-discovers a same-name restart file.  Remove only artifacts
    # generated for this model so a new hydrograph never resumes an old run.
    output_dir = mdu_path.parent / "DFM_OUTPUT_machhu_dambreak"
    if output_dir.exists():
        shutil.rmtree(output_dir)
    cache_path = mdu_path.parent / "machhu_dambreak.cache"
    if cache_path.exists():
        cache_path.unlink()
    result = subprocess.run(
        [str(cli), "--threads", str(threads), "--autostartstop", mdu_path.name],
        cwd=mdu_path.parent,
        text=True,
        capture_output=True,
    )
    (mdu_path.parent / "dflowfm_stdout.log").write_text(result.stdout, encoding="utf-8")
    (mdu_path.parent / "dflowfm_stderr.log").write_text(result.stderr, encoding="utf-8")
    diagnostic = output_dir / "machhu_dambreak.dia"
    diagnostic_text = diagnostic.read_text(encoding="utf-8", errors="replace") if diagnostic.exists() else ""
    map_path = output_dir / "machhu_dambreak_map.nc"
    if result.returncode or "** ERROR" in result.stdout or "** ERROR" in diagnostic_text or not map_path.is_file():
        raise RuntimeError(f"D-Flow FM failed; see {mdu_path.parent / 'dflowfm_stderr.log'}")
    export_dashboard_wet_cells(map_path, DASHBOARD_RESULT_PATH)


def export_dashboard_wet_cells(map_path: Path, output_path: Path) -> None:
    """Export every D-Flow FM wet-cell timestep for the WebGL renderer.

    FM is an Eulerian solver: this is the actual flexible computational mesh
    with per-cell water level, depth, and velocity, not fabricated particles.
    """
    with Dataset(map_path) as nc:
        node_x = np.asarray(nc["mesh2d_node_x"][:], dtype=float)
        node_y = np.asarray(nc["mesh2d_node_y"][:], dtype=float)
        face_variable = nc["mesh2d_face_nodes"]
        start_index = int(getattr(face_variable, "start_index", 0))
        faces = np.ma.filled(face_variable[:], -999).astype(int) - start_index
        times = np.asarray(nc["time"][:], dtype=float)
        depths = np.ma.filled(nc["mesh2d_waterdepth"][:], 0.0).astype(float)
        levels = np.ma.filled(nc["mesh2d_s1"][:], 0.0).astype(float)
        velocity_x = np.ma.filled(nc["mesh2d_ucx"][:], 0.0).astype(float)
        velocity_y = np.ma.filled(nc["mesh2d_ucy"][:], 0.0).astype(float)

    def frame_at(index: int) -> dict:
        wet_cells = []
        for face_index, nodes in enumerate(faces):
            valid_nodes = [int(node) for node in nodes if 0 <= node < len(node_x)]
            if len(valid_nodes) < 3 or depths[index, face_index] <= 0.01:
                continue
            u = float(velocity_x[index, face_index])
            v = float(velocity_y[index, face_index])
            wet_cells.append({
                "corners": [[round(float(node_x[node]), 3), round(float(node_y[node]), 3)] for node in valid_nodes],
                "surface_elevation_m": round(float(levels[index, face_index]), 4),
                "depth_m": round(float(depths[index, face_index]), 4),
                "velocity_x_ms": round(u, 4),
                "velocity_y_ms": round(v, 4),
                "velocity_ms": round(float(np.hypot(u, v)), 4),
            })
        return {"time_s": round(float(times[index]), 3), "wet_cells": wet_cells}

    frames = [frame_at(index) for index in range(len(times))]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps({
        "solver": "D-Flow FM",
        "time_s": float(times[-1]),
        "coordinate_bounds": {
            "min_x": float(node_x.min()), "max_x": float(node_x.max()),
            "min_y": float(node_y.min()), "max_y": float(node_y.max()),
        },
        "wet_cells": frames[-1]["wet_cells"],
        "frames": frames,
    }, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hydrograph", type=Path, help="CSV with time_s,discharge_m3s")
    parser.add_argument("--smoke-test", action="store_true", help="use a 15-minute test hydrograph")
    parser.add_argument("--cell-m", type=float, default=25.0)
    parser.add_argument("--half-width-m", type=float, default=6000.0,
                        help="half-width of the FM/Three.js shared DEM domain")
    parser.add_argument("--lat", type=float, help="dam latitude; pair with --lon for a custom dam")
    parser.add_argument("--lon", type=float, help="dam longitude; pair with --lat for a custom dam")
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--build-only", action="store_true")
    args = parser.parse_args()
    if not args.hydrograph and not args.smoke_test:
        parser.error("pass --hydrograph from the physics service, or --smoke-test")
    if (args.lat is None) != (args.lon is None):
        parser.error("--lat and --lon must be supplied together")
    hydrograph = read_hydrograph(args.hydrograph) if args.hydrograph else default_hydrograph(900, 60)
    location = (args.lat, args.lon) if args.lat is not None else None
    mdu = build_model(hydrograph, args.cell_m, args.half_width_m, location)
    print(f"Built D-Flow FM model: {mdu}")
    if not args.build_only:
        run_model(mdu, args.threads)
        print(f"D-Flow FM completed: {mdu.parent}")


if __name__ == "__main__":
    main()
