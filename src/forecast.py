"""Deterministic, bounded physics ensembles for replay forecasting."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import json
import uuid

import numpy as np
from pydantic import BaseModel, ConfigDict, Field

from .breach import (
    BreachGeometry,
    PhysicallyBasedBreachGrowth,
    StructuralMaterial,
    weir_outflow_m3s,
)
from .project import Project, Scenario
from .replay import REPLAY_SCHEMA_VERSION, canonical_hash
from .reservoir import ReservoirState, StorageElevationCurve
from .run_engine import write_json
from .flood_routing import FloodRouter
from .terrain import load_terrain

FORECAST_MODEL_VERSION = "physics-ensemble-1"


class ForecastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    horizon_s: float = Field(default=3600, gt=0, le=86400)
    ensemble_size: int = Field(default=9, ge=3, le=101)
    seed: int = Field(default=20260921, ge=0, le=2**32 - 1)
    max_workers: int = Field(default=4, ge=1, le=8)
    inflow_relative_std: float = Field(default=0.15, ge=0, le=1)
    erodibility_relative_std: float = Field(default=0.25, ge=0, le=2)
    initiation_level_std_m: float = Field(default=0.25, ge=0, le=10)
    trajectory: str = Field(default="p50", pattern=r"^(p10|p50|p90|member:[0-9]+)$")
    include_far_field: bool = False


def _curve(project: Project, bed: float) -> StorageElevationCurve:
    if project.stage_storage:
        points = np.asarray(project.stage_storage, dtype=float)
        return StorageElevationCurve(
            elevations_m=points[:, 0], storages_m3=points[:, 1]
        )
    return StorageElevationCurve(
        bed_elevation_m=bed,
        coeff=project.reservoir_capacity_m3 / project.dam_height_m**1.7,
        exponent=1.7,
    )


def _member(
    index: int,
    seed: int,
    project: Project,
    scenario: Scenario,
    request: ForecastRequest,
    initial: dict,
    terrain=None,
) -> dict:
    rng = np.random.default_rng(seed)
    inflow_factor = float(max(0.0, rng.normal(1.0, request.inflow_relative_std)))
    erosion_factor = float(
        max(
            0.01,
            rng.lognormal(
                -0.5 * request.erodibility_relative_std**2,
                request.erodibility_relative_std,
            ),
        )
    )
    initiation_offset = float(rng.normal(0.0, request.initiation_level_std_m))
    bed = float(initial["bed_elevation_m"])
    crest = float(initial["crest_elevation_m"])
    curve = _curve(project, bed)
    reservoir = ReservoirState(
        curve,
        crest,
        scenario.spillway_crest_elevation_m
        if scenario.spillway_crest_elevation_m is not None
        else project.spillway_crest_elevation_m or crest,
        spillway_width_m=scenario.spillway_width_m
        if scenario.spillway_width_m is not None
        else project.spillway_width_m or 0.0,
        storage_m3=curve.elevation_to_storage(initial["reservoir_elevation_m"]),
    )
    geometry = BreachGeometry(
        initial["breach_width_m"],
        initial["breach_invert_m"],
        scenario.breach_side_slope,
        project.dam_height_m,
    )
    material = StructuralMaterial(
        name=project.dam_type or "unspecified",
        critical_shear_stress_pa=scenario.critical_shear_pa,
        erodibility_coeff=scenario.erosion_coefficient * erosion_factor,
        ultimate_shear_capacity_pa=scenario.collapse_shear_pa,
    )
    breach = PhysicallyBasedBreachGrowth(
        material,
        geometry,
        crest,
        initial["breach_invert_m"] + initiation_offset,
        bed,
        initiation_mode=scenario.breach_initiation,
        piping_diameter_m=scenario.piping_diameter_m,
        breach_thickness_m=project.crest_width_m
        or max(6.0, project.dam_height_m * 0.3),
    )
    # A forecast starts from the selected current geometry, not a replay of initiation.
    breach.started = initial["breach_width_m"] > 0
    if breach.started:
        breach.state = initial.get("failure_state", "widening")
    dt = min(max(scenario.dt_s, 1.0), 30.0)
    sample = max(scenario.output_interval_s, request.horizon_s / 120.0)
    next_sample = 0.0
    records = []
    inflow = scenario.inflow_m3s * inflow_factor
    start_time = float(initial["time_s"])
    router = (
        FloodRouter(terrain, scenario.manning_n, scenario.wet_depth_m)
        if terrain is not None
        else None
    )
    if router is not None:
        router.valid &= ~terrain.reservoir_mask(project, crest)
        router.valid[terrain.source_cell] = True
        downstream = initial.get("downstream", {})
        indices = np.asarray(downstream.get("indices", []), dtype=int)
        depths = np.asarray(downstream.get("depth_m", []), dtype=float)
        valid = (indices >= 0) & (indices < router.depth.size)
        router.depth.ravel()[indices[valid]] = depths[valid]
        router.arrival[router.depth >= scenario.wet_depth_m] = 0.0
    while reservoir.time_s < request.horizon_s - 1e-9:
        step = min(dt, request.horizon_s - reservoir.time_s)
        state = breach.step(step, reservoir.elevation_m)
        geometry.bottom_width_m = min(
            geometry.bottom_width_m, scenario.max_breach_width_m
        )
        q = weir_outflow_m3s(geometry, reservoir.elevation_m) if breach.started else 0.0
        water = reservoir.step(step, inflow, q)
        discharge = (
            water["breach_outflow_m3s"]
            + water["spillway_outflow_m3s"]
            + water["overtopping_outflow_m3s"]
        )
        if router is not None:
            router.step(step, discharge)
        if (
            reservoir.time_s + 1e-9 >= next_sample
            or reservoir.time_s >= request.horizon_s
        ):
            records.append(
                {
                    "time_s": start_time + reservoir.time_s,
                    "reservoir_level_m": water["elevation_m"],
                    "breach_width_m": geometry.bottom_width_m,
                    "breach_invert_m": geometry.bottom_elevation_m,
                    "discharge_m3s": discharge,
                    "failure_state": state["failure_state"],
                }
            )
            next_sample = reservoir.time_s + sample
    result = {
        "member": index,
        "seed": seed,
        "assumptions": {
            "inflow_factor": inflow_factor,
            "erodibility_factor": erosion_factor,
            "initiation_level_offset_m": initiation_offset,
        },
        "records": records,
        "summary": {
            "peak_discharge_m3s": max(
                (r["discharge_m3s"] for r in records), default=0.0
            ),
            "final_reservoir_level_m": records[-1]["reservoir_level_m"],
            "final_breach_width_m": records[-1]["breach_width_m"],
        },
    }
    if router is not None:
        result["far_field"] = {
            "depth_m": router.max_depth.astype(np.float32).ravel().tolist(),
            "velocity_ms": router.max_velocity.astype(np.float32).ravel().tolist(),
            "arrival_time_s": router.arrival.astype(np.float32).ravel().tolist(),
            "grid_size": int(terrain.elevation.shape[0]),
            "crs": terrain.crs,
        }
    return result


def _bands(members: list[dict]) -> list[dict]:
    size = min(len(member["records"]) for member in members)
    result = []
    fields = ("reservoir_level_m", "breach_width_m", "breach_invert_m", "discharge_m3s")
    for index in range(size):
        row = {"time_s": members[0]["records"][index]["time_s"]}
        for field in fields:
            values = [member["records"][index][field] for member in members]
            p10, p50, p90 = np.percentile(values, [10, 50, 90])
            row[field] = {"p10": float(p10), "p50": float(p50), "p90": float(p90)}
        result.append(row)
    return result


def _far_field_bands(members: list[dict]) -> dict:
    fields = {}
    for field in ("depth_m", "velocity_ms"):
        values = np.asarray(
            [member["far_field"][field] for member in members], dtype=float
        )
        quantiles = np.percentile(values, [10, 50, 90], axis=0)
        fields[field] = {
            f"p{percentile}": quantiles[i].round(4).tolist()
            for i, percentile in enumerate((10, 50, 90))
        }
    arrivals = np.asarray(
        [member["far_field"]["arrival_time_s"] for member in members], dtype=float
    )
    reached = arrivals >= 0
    masked = np.where(reached, arrivals, np.nan)
    reached_any = reached.any(axis=0)
    masked[:, ~reached_any] = 0.0
    with np.errstate(invalid="ignore"):
        quantiles = np.nanpercentile(masked, [10, 50, 90], axis=0)
    fields["arrival_time_s"] = {
        f"p{percentile}": np.where(reached_any, quantiles[i], -1).round(2).tolist()
        for i, percentile in enumerate((10, 50, 90))
    }
    fields["arrival_time_s"]["member_coverage"] = reached.mean(axis=0).round(3).tolist()
    return {
        "status": "simulated",
        "grid_size": members[0]["far_field"]["grid_size"],
        "crs": members[0]["far_field"]["crs"],
        **fields,
    }


def generate_forecast(run_directory: Path, request: ForecastRequest) -> dict:
    inputs = json.loads((run_directory / "inputs.json").read_text(encoding="utf-8"))
    project = Project.model_validate(inputs["project"])
    scenario = Scenario.model_validate(inputs["scenario"])
    frame_paths = sorted(run_directory.glob("frame-*.json"))
    if not frame_paths:
        raise ValueError("Forecasting requires at least one completed replay frame")
    current = json.loads(frame_paths[-1].read_text(encoding="utf-8"))
    bed = (
        project.stage_storage[0][0]
        if project.stage_storage
        else (
            project.crest_elevation_m - project.dam_height_m
            if project.crest_elevation_m is not None
            else current["breach"]["invert_m"]
            - max(project.dam_height_m - current["breach"]["depth_m"], 0.0)
        )
    )
    crest = (
        project.crest_elevation_m
        if project.crest_elevation_m is not None
        else bed + project.dam_height_m
    )
    initial = {
        "time_s": current["time_s"],
        "bed_elevation_m": bed,
        "crest_elevation_m": crest,
        "reservoir_elevation_m": current["reservoir"]["elevation_m"],
        "breach_width_m": current["breach"]["width_m"],
        "breach_invert_m": current["breach"]["invert_m"],
        "failure_state": current["breach"].get("failure_state", "widening"),
        "downstream": current.get("downstream", {}),
    }
    terrain = (
        load_terrain(project, scenario.domain_half_width_m, scenario.grid_size)
        if request.include_far_field
        else None
    )
    seeds = (
        np.random.SeedSequence(request.seed)
        .generate_state(request.ensemble_size)
        .tolist()
    )
    with ThreadPoolExecutor(
        max_workers=min(request.max_workers, request.ensemble_size)
    ) as pool:
        members = list(
            pool.map(
                lambda args: _member(*args),
                [
                    (index, int(seed), project, scenario, request, initial, terrain)
                    for index, seed in enumerate(seeds)
                ],
            )
        )
    initialized_at = datetime.now(timezone.utc).isoformat()
    vintage_id = (
        initialized_at.replace(":", "-").replace("+", "_") + "-" + uuid.uuid4().hex[:8]
    )
    result = {
        "schema_version": REPLAY_SCHEMA_VERSION,
        "model_version": FORECAST_MODEL_VERSION,
        "vintage_id": vintage_id,
        "initialized_at": initialized_at,
        "initial_state": initial,
        "horizon_s": request.horizon_s,
        "ensemble_size": request.ensemble_size,
        "request": request.model_dump(),
        "input_hash": canonical_hash(
            {"inputs": inputs, "request": request.model_dump(), "initial": initial}
        ),
        "bands": _bands(members),
        "members": members,
        "downstream_uncertainty": (
            _far_field_bands(members)
            if request.include_far_field
            else {
                "status": "unavailable",
                "depth_m": {
                    "status": "unavailable",
                    "reason": "set include_far_field=true to run ensemble routing",
                },
                "velocity_ms": {
                    "status": "unavailable",
                    "reason": "set include_far_field=true to run ensemble routing",
                },
                "arrival_time_s": {
                    "status": "unavailable",
                    "reason": "set include_far_field=true to run ensemble routing",
                },
            }
        ),
        "classification": "screening forecast; simulated, not observed",
    }
    directory = run_directory / "forecasts"
    directory.mkdir(exist_ok=True)
    write_json(directory / f"{vintage_id}.json", result)
    return result


def list_forecasts(run_directory: Path) -> list[dict]:
    directory = run_directory / "forecasts"
    if not directory.exists():
        return []
    results = []
    for path in sorted(directory.glob("*.json"), reverse=True):
        value = json.loads(path.read_text(encoding="utf-8"))
        results.append(
            {
                key: value[key]
                for key in (
                    "vintage_id",
                    "initialized_at",
                    "model_version",
                    "horizon_s",
                    "ensemble_size",
                    "input_hash",
                )
            }
        )
    return results
