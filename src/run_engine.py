"""One scenario, one mass ledger, bounded replay, cancellable background execution."""

from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
import json
import logging
import math
import threading
import time
import uuid
import gc
import numpy as np
from .project import ROOT, Project, Scenario
from .terrain import load_terrain
from .flood_routing import FloodRouter
from .reservoir import StorageElevationCurve, ReservoirState
from .breach import (
    StructuralMaterial,
    BreachGeometry,
    PhysicallyBasedBreachGrowth,
    weir_outflow_m3s,
)
from .replay import (
    REPLAY_SCHEMA_VERSION,
    RENDERER_VERSION,
    asset_manifest,
    canonical_hash,
    frame_index,
)

LOG = logging.getLogger(__name__)
RUNS = ROOT / "outputs/runs"


def write_json(path, value):
    path = Path(path)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, allow_nan=False), encoding="utf-8")
    temp.replace(path)


def runoff_volume(rainfall_mm, curve_number, area_km2):
    retention = 25400 / curve_number - 254
    excess = max(rainfall_mm - 0.2 * retention, 0)
    runoff_mm = excess**2 / (excess + retention) if excess + retention else 0
    return runoff_mm * area_km2 * 1000


class Run:
    def __init__(self, project: Project, scenario: Scenario, output_root=RUNS):
        self.id = uuid.uuid4().hex
        self.project, self.scenario = project, scenario
        self.directory = Path(output_root) / self.id
        self.directory.mkdir(parents=True)
        self.cancel = threading.Event()
        self.lock = threading.Lock()
        self.state = {
            "simulation_id": self.id,
            "status": "PREPARING",
            "progress": 0.0,
            "frame_count": 0,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "error": None,
        }
        self.summary = None

    def status(self):
        with self.lock:
            return dict(self.state)

    def update(self, **values):
        with self.lock:
            self.state.update(values)

    def execute(self):
        start = time.perf_counter()
        s, p = self.scenario, self.project
        try:
            inputs = {"project": p.model_dump(), "scenario": s.model_dump()}
            write_json(self.directory / "inputs.json", inputs)
            terrain = load_terrain(p, s.domain_half_width_m, s.grid_size)
            self.update(status="INITIALIZING")
            bed = terrain.origin[2]
            crest = (
                p.crest_elevation_m
                if p.crest_elevation_m is not None
                else bed + p.dam_height_m
            )
            level = (
                s.initial_water_level_m
                if s.initial_water_level_m is not None
                else p.initial_water_level_m
                if p.initial_water_level_m is not None
                else bed + p.dam_height_m * s.initial_level_fraction
            )
            if level < bed or level > crest + p.dam_height_m * 0.2:
                raise ValueError(
                    "Initial water level must be between the DEM bed and 20% above dam crest"
                )
            if s.breach_depth_m > p.dam_height_m:
                raise ValueError("Initial breach depth exceeds dam height")
            if p.dam_length_m and s.max_breach_width_m > p.dam_length_m:
                raise ValueError("Maximum breach width exceeds dam length")
            if s.rainfall_mm and not p.catchment_area_km2:
                raise ValueError("Rainfall scenario requires catchment_area_km2")
            curve = StorageElevationCurve(
                bed_elevation_m=bed,
                coeff=p.reservoir_capacity_m3 / p.dam_height_m**1.7,
                exponent=1.7,
            )
            if p.stage_storage:
                points = np.array(p.stage_storage)
                curve = StorageElevationCurve(
                    elevations_m=points[:, 0], storages_m3=points[:, 1]
                )
            spillway_width = (
                s.spillway_width_m
                if s.spillway_width_m is not None
                else p.spillway_width_m or 0
            )
            spillway_crest = (
                s.spillway_crest_elevation_m
                if s.spillway_crest_elevation_m is not None
                else p.spillway_crest_elevation_m
                if p.spillway_crest_elevation_m is not None
                else crest
            )
            reservoir = ReservoirState(
                curve,
                crest,
                spillway_crest,
                spillway_width_m=spillway_width,
                storage_m3=curve.elevation_to_storage(level),
            )
            replay_assets = asset_manifest(p, bed)
            write_json(self.directory / "assets.json", replay_assets)
            replay_spec = replay_assets["specification"]
            gates = replay_spec.get("gates", [])
            if gates:
                widths = [
                    gate["width"]["value"]
                    for gate in gates
                    if gate["width"]["value"] is not None
                ]
                coeffs = [
                    gate["discharge_coefficient"]["value"]
                    for gate in gates
                    if gate["discharge_coefficient"]["value"] is not None
                ]
                max_openings = [
                    gate["maximum_opening"]["value"]
                    for gate in gates
                    if gate["maximum_opening"]["value"] is not None
                ]
                reservoir.gate_count = len(gates)
                reservoir.gate_width_m = float(np.mean(widths)) if widths else 0.0
                reservoir.gate_discharge_coeff = (
                    float(np.mean(coeffs)) if coeffs else 0.62
                )
                reservoir.gate_opening_m = 0.0
                reservoir.open_gate_count = 0
                if len(widths) != len(gates) or len(max_openings) != len(gates):
                    reservoir.gate_count = 0
            initial = reservoir.storage_m3
            geometry = BreachGeometry(
                s.breach_width_m,
                crest - s.breach_depth_m,
                s.breach_side_slope,
                p.dam_height_m,
            )
            valley_floor = (
                crest - p.dam_height_m if p.crest_elevation_m is not None else bed
            )
            material = StructuralMaterial(
                name=p.dam_type or "unspecified",
                critical_shear_stress_pa=s.critical_shear_pa,
                erodibility_coeff=s.erosion_coefficient,
                ultimate_shear_capacity_pa=s.collapse_shear_pa,
            )
            breach = PhysicallyBasedBreachGrowth(
                material,
                geometry,
                crest,
                geometry.bottom_elevation_m,
                valley_floor,
                initiation_mode="piping"
                if s.breach_model == "piping"
                else s.breach_initiation,
                piping_diameter_m=s.piping_diameter_m,
                breach_thickness_m=(p.crest_width_m or max(6.0, p.dam_height_m * 0.3)),
            )
            router = FloodRouter(terrain, s.manning_n, s.wet_depth_m)
            # Reservoir volume is owned by the lumped reservoir, never counted twice on the routing grid.
            reservoir_domain = terrain.reservoir_mask(p, crest)
            router.valid &= ~reservoir_domain
            router.valid[terrain.source_cell] = True
            inflow = (
                s.inflow_m3s
                + runoff_volume(
                    s.rainfall_mm, s.curve_number, p.catchment_area_km2 or 0
                )
                / s.duration_s
            )
            total_inflow = 0.0
            count = 0
            next_frame = 0.0
            interval = max(s.output_interval_s, s.duration_s / 160)
            hydrograph = []
            timings = {
                "prepare_s": time.perf_counter() - start,
                "reservoir_breach_s": 0.0,
                "routing_s": 0.0,
                "serialization_s": 0.0,
                "sph_s": 0.0,
            }
            sph = None
            if s.near_field == "sph":
                from .sph_breach import SPHBreachSolver, SPHParams

                sph = SPHBreachSolver(SPHParams(particle_spacing_m=1.0))
                sph.add_boundary_line((-4, 0), (15, -0.9))
                sph.seed_reservoir_block(3, 3, (-3, 1))
            self.update(status="RUNNING")
            gate_openings = {gate["gate_id"]: 0.0 for gate in gates}
            while reservoir.time_s < s.duration_s - 1e-9:
                if self.cancel.is_set():
                    raise InterruptedError("Cancelled by user")
                dt = min(s.dt_s, s.duration_s - reservoir.time_s)
                gate_states = []
                if gates:
                    for gate in gates:
                        gate_id = gate["gate_id"]
                        commands = sorted(
                            (
                                point
                                for point in s.gate_schedule
                                if point.gate_id in {"all", gate_id}
                            ),
                            key=lambda point: point.time_s,
                        )
                        opening = 0.0
                        for command in commands:
                            if command.time_s <= reservoir.time_s + 1e-9:
                                opening = command.opening_m
                            else:
                                break
                        maximum = gate["maximum_opening"]["value"]
                        if maximum is not None:
                            opening = min(opening, float(maximum))
                        if gate["status"] != "available":
                            opening = 0.0
                        rate = gate.get("opening_rate", {}).get("value")
                        previous = gate_openings[gate_id]
                        if rate is not None:
                            maximum_change = float(rate) * dt
                            opening = float(
                                np.clip(
                                    opening,
                                    previous - maximum_change,
                                    previous + maximum_change,
                                )
                            )
                        gate_openings[gate_id] = opening
                        gate_states.append(
                            {
                                "gate_id": gate_id,
                                "opening_m": opening,
                                "status": "open" if opening > 0 else "closed",
                                "command_status": gate["status"],
                                "width_m": gate["width"]["value"],
                                "discharge_coefficient": gate["discharge_coefficient"][
                                    "value"
                                ],
                            }
                        )
                    openings = [
                        gate["opening_m"]
                        for gate in gate_states
                        if gate["opening_m"] > 0
                    ]
                    reservoir.open_gate_count = len(openings)
                    reservoir.gate_opening_m = (
                        float(np.mean(openings)) if openings else 0.0
                    )
                    reservoir.gate_states = gate_states
                tick = time.perf_counter()
                if s.breach_model in {"parametric", "prescribed"}:
                    fraction = min(1.0, (reservoir.time_s + dt) / s.formation_time_s)
                    geometry.bottom_width_m = (
                        s.breach_width_m
                        + (s.max_breach_width_m - s.breach_width_m) * fraction
                    )
                    geometry.bottom_elevation_m = (
                        crest
                        - s.breach_depth_m
                        - (p.dam_height_m - s.breach_depth_m) * fraction
                    )
                    breach.started = True
                    state = {
                        "status": "widening",
                        "failure_state": "widening",
                        "shear_stress_pa": None,
                        "velocity_ms": None,
                        "eroded_volume_m3": None,
                        "events": [],
                    }
                else:
                    state = breach.step(dt, reservoir.elevation_m)
                geometry.bottom_width_m = min(
                    geometry.bottom_width_m, s.max_breach_width_m
                )
                # Recompute discharge after geometry constraints, before reservoir depletion cap.
                q = (
                    weir_outflow_m3s(geometry, reservoir.elevation_m)
                    if breach.started
                    else 0.0
                )
                record = reservoir.step(dt, inflow, q, include_overtopping=True)
                total_inflow += inflow * dt
                discharge = (
                    record["breach_outflow_m3s"]
                    + record["spillway_outflow_m3s"]
                    + record["overtopping_outflow_m3s"]
                )
                timings["reservoir_breach_s"] += time.perf_counter() - tick
                tick = time.perf_counter()
                router.step(dt, discharge, self.cancel.is_set)
                timings["routing_s"] += time.perf_counter() - tick
                hydrograph.append([reservoir.time_s, discharge])
                if reservoir.time_s >= next_frame or reservoir.time_s >= s.duration_s:
                    tick = time.perf_counter()
                    near = {
                        "mode": "hydraulic",
                        "velocity_ms": q
                        / max(geometry.flow_area_m2(reservoir.elevation_m), 1e-9),
                        "particles": [],
                        "volume_accounting": "diagnostic only; release counted once in downstream grid",
                    }
                    if sph is not None:
                        # A bounded local experiment, with its own truthful clock; not full-domain mass storage.
                        sph.vel[~sph.is_boundary, 0] = near["velocity_ms"]
                        target = sph.time_s + 0.03
                        while sph.time_s < target - 1e-9:
                            sph.step(target - sph.time_s)
                        near.update(
                            mode="sph_diagnostic_slice",
                            time_s=sph.time_s,
                            particles=sph.pos[~sph.is_boundary].round(3).tolist(),
                        )
                    timings["sph_s"] += time.perf_counter() - tick
                    wet = np.flatnonzero(router.depth.ravel() >= s.wet_depth_m)
                    error = (
                        initial + total_inflow - reservoir.storage_m3 - router.volume
                    )
                    hydraulic_head = max(
                        record["elevation_m"] - geometry.bottom_elevation_m, 0.0
                    )
                    flow_area = geometry.flow_area_m2(record["elevation_m"])
                    breach_velocity = record["breach_outflow_m3s"] / max(
                        flow_area, 1e-9
                    )
                    shear = state.get("shear_stress_pa")
                    erosion_rate = (
                        material.erosion_rate(shear) if shear is not None else None
                    )
                    spillway_head = max(record["elevation_m"] - spillway_crest, 0.0)
                    overtopping_head = max(record["elevation_m"] - crest, 0.0)
                    frame = {
                        "protocol_version": 1,
                        "schema_version": REPLAY_SCHEMA_VERSION,
                        "renderer_version": RENDERER_VERSION,
                        "type": "simulation_frame",
                        "simulation_id": self.id,
                        "index": count,
                        "time_s": reservoir.time_s,
                        "progress": reservoir.time_s / s.duration_s,
                        "time_region": "history",
                        "data_status": "simulated",
                        "reservoir": {
                            **record,
                            "surface_area_m2": curve.surface_area(
                                record["elevation_m"]
                            ),
                            "level_change_rate_ms": (inflow - discharge)
                            / max(curve.surface_area(record["elevation_m"]), 1e-9),
                        },
                        "breach": {
                            "width_m": geometry.bottom_width_m,
                            "depth_m": crest - geometry.bottom_elevation_m,
                            "invert_m": geometry.bottom_elevation_m,
                            "top_width_m": geometry.bottom_width_m
                            + 2
                            * geometry.side_slope_h_per_v
                            * (crest - geometry.bottom_elevation_m),
                            "wetted_top_width_m": geometry.top_width_m(
                                record["elevation_m"]
                            ),
                            "area_m2": flow_area,
                            "hydraulic_head_m": hydraulic_head,
                            "velocity_ms": breach_velocity,
                            "hydrostatic_pressure_pa": 1000 * 9.81 * hydraulic_head,
                            "hydrostatic_force_per_m_N": 0.5
                            * 1000
                            * 9.81
                            * hydraulic_head**2,
                            "shear_stress_pa": shear,
                            "erosion_rate_ms": erosion_rate,
                            "critical_shear_pa": material.critical_shear_stress_pa,
                            "collapse_shear_pa": material.ultimate_shear_capacity_pa,
                            "material": material.name,
                            "status": state["status"],
                            "failure_state": state.get(
                                "failure_state", state["status"]
                            ),
                            "side_slope_h_per_v": geometry.side_slope_h_per_v,
                            "eroded_volume_m3": state.get("eroded_volume_m3"),
                            "piping_diameter_m": state.get("piping_diameter_m"),
                            "events": state.get("events", []),
                            "discharge_m3s": record["breach_outflow_m3s"],
                        },
                        "spillway": {
                            "configured": spillway_width > 0,
                            "width_m": spillway_width or None,
                            "crest_elevation_m": spillway_crest
                            if spillway_width > 0
                            else None,
                            "head_m": spillway_head if spillway_width > 0 else 0.0,
                            "exit_velocity_ms": reservoir.spillway_exit_velocity_ms()
                            if spillway_width > 0
                            else 0.0,
                            "discharge_m3s": record["spillway_outflow_m3s"],
                            "gates": gate_states,
                        },
                        "overtopping": {
                            "head_m": overtopping_head,
                            "discharge_m3s": record["overtopping_outflow_m3s"],
                        },
                        "near_field": near,
                        "downstream": {
                            "indices": wet.tolist(),
                            "depth_m": router.depth.ravel()[wet].round(4).tolist(),
                            "velocity_ms": router.velocity.ravel()[wet]
                            .round(4)
                            .tolist(),
                            "inflow_m3s": discharge,
                            "components_m3s": {
                                "breach": record["breach_outflow_m3s"],
                                "spillway": record["spillway_outflow_m3s"],
                                "overtopping": record["overtopping_outflow_m3s"],
                            },
                        },
                        "mass_ledger": {
                            "initial_storage_m3": initial,
                            "inflow_volume_m3": total_inflow,
                            "reservoir_storage_m3": reservoir.storage_m3,
                            "downstream_volume_m3": router.volume,
                            "residual_m3": error,
                        },
                        "metrics": {
                            "max_depth_m": float(router.max_depth.max()),
                            "max_velocity_ms": float(router.max_velocity.max()),
                            "inundated_area_km2": float(
                                (router.max_depth >= s.wet_depth_m).sum()
                                * router.dx**2
                                / 1e6
                            ),
                            "mass_error_m3": error,
                            "downstream_volume_m3": router.volume,
                        },
                    }
                    tick = time.perf_counter()
                    write_json(self.directory / f"frame-{count:04d}.json", frame)
                    timings["serialization_s"] += time.perf_counter() - tick
                    count += 1
                    self.update(frame_count=count, progress=frame["progress"])
                    next_frame = reservoir.time_s + interval
            self.update(status="POSTPROCESSING")
            from .results import export_results

            exports = export_results(self.directory, terrain, router, p, s)
            edge_wet = bool(
                np.any(router.max_depth[[0, -1], :] >= s.wet_depth_m)
                or np.any(router.max_depth[:, [0, -1]] >= s.wet_depth_m)
            )
            self.summary = {
                **self.status(),
                "status": "COMPLETE",
                "project": p.model_dump(),
                "scenario": s.model_dump(),
                "schema_version": REPLAY_SCHEMA_VERSION,
                "renderer_version": RENDERER_VERSION,
                "configuration_hash": canonical_hash(inputs),
                "asset_manifest_hash": replay_assets["manifest_hash"],
                "solver": "conservative diffusive-wave screening approximation",
                "near_field": near["mode"],
                "validated_against_observations": False,
                "terrain": terrain.metadata,
                "metrics": frame["metrics"],
                "initial_storage_m3": initial,
                "inflow_volume_m3": total_inflow,
                "final_storage_m3": reservoir.storage_m3,
                "mass_error_percent": 100 * error / max(initial + total_inflow, 1),
                "peak_discharge_m3s": max(q[1] for q in hydrograph),
                "boundary_reached": edge_wet,
                "boundary_condition": "closed domain; no external drainage",
                "timings": {**timings, "total_s": time.perf_counter() - start},
                "exports": exports,
                "limitations": p.assumptions
                + [
                    "No full momentum/shock resolution or independently calibrated roughness.",
                    "Overtopping, breach, and configured spillway releases share one conservative routing boundary.",
                    "SPH is an optional local diagnostic with a separate clock, not a mass-bearing coupled domain.",
                    "Reservoir shoreline is a DEM approximation unless a verified polygon is supplied.",
                ],
            }
            np.savetxt(
                self.directory / "hydrograph.csv",
                hydrograph,
                delimiter=",",
                header="time_s,discharge_m3s",
                comments="",
            )
            write_json(self.directory / "frames.json", frame_index(self.directory))
            write_json(
                self.directory / "run-manifest.json",
                {
                    "schema_version": REPLAY_SCHEMA_VERSION,
                    "renderer_version": RENDERER_VERSION,
                    "simulation_id": self.id,
                    "created_at": self.state["started_at"],
                    "configuration_hash": self.summary["configuration_hash"],
                    "asset_manifest": "assets.json",
                    "frame_index": "frames.json",
                    "physics_timestep_s": s.dt_s,
                    "output_interval_s": interval,
                    "deterministic": True,
                    "random_seed": None,
                    "failure_transitions": breach.events,
                },
            )
            write_json(self.directory / "summary.json", self.summary)
            self.update(status="COMPLETE", progress=1.0)
            LOG.info(
                "simulation_complete id=%s seconds=%.2f",
                self.id,
                time.perf_counter() - start,
            )
        except InterruptedError as exc:
            self.update(status="CANCELLED", error=str(exc))
        except Exception as exc:
            LOG.exception("simulation_failed id=%s", self.id)
            self.update(status="FAILED", error=str(exc))
        finally:
            write_json(self.directory / "status.json", self.status())
            gc.collect()


class RunManager:
    def __init__(self, output_root=RUNS):
        self.output_root = Path(output_root)
        self.active = None
        self.lock = threading.Lock()

    def start(self, project, scenario):
        with self.lock:
            if self.active and self.active.status()["status"] not in {
                "COMPLETE",
                "FAILED",
                "CANCELLED",
            }:
                raise RuntimeError(
                    "A simulation is already active; cancel it before starting another"
                )
            run = Run(project, scenario, self.output_root)
            self.active = run
            threading.Thread(
                target=run.execute, daemon=True, name=f"simulation-{run.id}"
            ).start()
            return run
