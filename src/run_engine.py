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
import numpy as np
from .project import ROOT, Project, Scenario
from .terrain import load_terrain
from .flood_routing import FloodRouter
from .reservoir import StorageElevationCurve, ReservoirState
from .breach import StructuralMaterial, BreachGeometry, PhysicallyBasedBreachGrowth, weir_outflow_m3s

LOG = logging.getLogger(__name__)
RUNS = ROOT / "outputs/runs"


def write_json(path, value):
    path = Path(path)
    temp = path.with_suffix(path.suffix+".tmp")
    temp.write_text(json.dumps(value, allow_nan=False), encoding="utf-8")
    temp.replace(path)


def runoff_volume(rainfall_mm, curve_number, area_km2):
    retention = 25400/curve_number-254
    excess = max(rainfall_mm-.2*retention,0)
    runoff_mm = excess**2/(excess+retention) if excess+retention else 0
    return runoff_mm*area_km2*1000


class Run:
    def __init__(self, project: Project, scenario: Scenario, output_root=RUNS):
        self.id = uuid.uuid4().hex
        self.project, self.scenario = project, scenario
        self.directory = Path(output_root)/self.id
        self.directory.mkdir(parents=True)
        self.cancel = threading.Event()
        self.lock = threading.Lock()
        self.state = {"simulation_id": self.id, "status": "PREPARING", "progress": 0., "frame_count": 0,
                      "started_at": datetime.now(timezone.utc).isoformat(), "error": None}
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
            write_json(self.directory/"inputs.json", {"project": p.model_dump(), "scenario": s.model_dump()})
            terrain = load_terrain(p,s.domain_half_width_m,s.grid_size)
            self.update(status="INITIALIZING")
            bed = terrain.origin[2]
            crest = p.crest_elevation_m if p.crest_elevation_m is not None else bed+p.dam_height_m
            level = p.initial_water_level_m if p.initial_water_level_m is not None else bed+p.dam_height_m*s.initial_level_fraction
            if s.breach_depth_m > p.dam_height_m:
                raise ValueError("Initial breach depth exceeds dam height")
            if p.dam_length_m and s.max_breach_width_m > p.dam_length_m:
                raise ValueError("Maximum breach width exceeds dam length")
            if s.rainfall_mm and not p.catchment_area_km2:
                raise ValueError("Rainfall scenario requires catchment_area_km2")
            curve = StorageElevationCurve(bed_elevation_m=bed,
                coeff=p.reservoir_capacity_m3/p.dam_height_m**1.7,exponent=1.7)
            if p.stage_storage:
                points = np.array(p.stage_storage)
                curve = StorageElevationCurve(elevations_m=points[:,0],storages_m3=points[:,1])
            reservoir = ReservoirState(curve, crest,
                p.spillway_crest_elevation_m if p.spillway_crest_elevation_m is not None else crest,
                spillway_width_m=p.spillway_width_m or 0, storage_m3=curve.elevation_to_storage(level))
            initial = reservoir.storage_m3
            geometry = BreachGeometry(s.breach_width_m, crest-s.breach_depth_m,s.breach_side_slope,p.dam_height_m)
            breach = PhysicallyBasedBreachGrowth(StructuralMaterial(critical_shear_stress_pa=s.critical_shear_pa,
                erodibility_coeff=s.erosion_coefficient,ultimate_shear_capacity_pa=s.collapse_shear_pa),
                geometry,crest,geometry.bottom_elevation_m,bed)
            router = FloodRouter(terrain,s.manning_n,s.wet_depth_m)
            # Reservoir volume is owned by the lumped reservoir, never counted twice on the routing grid.
            reservoir_domain = terrain.reservoir_mask(p,crest)
            router.valid &= ~reservoir_domain
            router.valid[terrain.source_cell] = True
            inflow = s.inflow_m3s+runoff_volume(s.rainfall_mm,s.curve_number,p.catchment_area_km2 or 0)/s.duration_s
            total_inflow = 0.
            count = 0
            next_frame = 0.
            interval = max(s.output_interval_s,s.duration_s/160)
            hydrograph = []
            timings = {"prepare_s": time.perf_counter()-start,"reservoir_breach_s":0.,"routing_s":0.,"serialization_s":0.,"sph_s":0.}
            sph = None
            if s.near_field == "sph":
                from .sph_breach import SPHBreachSolver, SPHParams
                sph = SPHBreachSolver(SPHParams(particle_spacing_m=1.))
                sph.add_boundary_line((-4,0),(15,-.9))
                sph.seed_reservoir_block(3,3,(-3,1))
            self.update(status="RUNNING")
            while reservoir.time_s < s.duration_s-1e-9:
                if self.cancel.is_set():
                    raise InterruptedError("Cancelled by user")
                dt = min(s.dt_s,s.duration_s-reservoir.time_s)
                tick = time.perf_counter()
                if s.breach_model == "parametric":
                    fraction = min(1.,(reservoir.time_s+dt)/s.formation_time_s)
                    geometry.bottom_width_m = s.breach_width_m+(s.max_breach_width_m-s.breach_width_m)*fraction
                    geometry.bottom_elevation_m = crest-s.breach_depth_m-(p.dam_height_m-s.breach_depth_m)*fraction
                    breach.started = True
                    state = {"status":"prescribed_formation", "shear_stress_pa":None}
                else:
                    state = breach.step(dt,reservoir.elevation_m)
                geometry.bottom_width_m = min(geometry.bottom_width_m,s.max_breach_width_m)
                # Recompute discharge after geometry constraints, before reservoir depletion cap.
                q = weir_outflow_m3s(geometry,reservoir.elevation_m) if breach.started else 0.
                record = reservoir.step(dt,inflow,q,include_overtopping=False)
                total_inflow += inflow*dt
                discharge = record["breach_outflow_m3s"]+record["spillway_outflow_m3s"]
                timings["reservoir_breach_s"] += time.perf_counter()-tick
                tick = time.perf_counter()
                router.step(dt,discharge,self.cancel.is_set)
                timings["routing_s"] += time.perf_counter()-tick
                hydrograph.append([reservoir.time_s,discharge])
                if reservoir.time_s >= next_frame or reservoir.time_s >= s.duration_s:
                    tick = time.perf_counter()
                    near = {"mode":"hydraulic", "velocity_ms": q/max(geometry.flow_area_m2(reservoir.elevation_m),1e-9),
                            "particles":[], "volume_accounting":"diagnostic only; release counted once in downstream grid"}
                    if sph is not None:
                        # A bounded local experiment, with its own truthful clock; not full-domain mass storage.
                        sph.vel[~sph.is_boundary,0] = near["velocity_ms"]
                        target = sph.time_s+.03
                        while sph.time_s < target-1e-9:
                            sph.step(target-sph.time_s)
                        near.update(mode="sph_diagnostic_slice", time_s=sph.time_s,
                                    particles=sph.pos[~sph.is_boundary].round(3).tolist())
                    timings["sph_s"] += time.perf_counter()-tick
                    wet = np.flatnonzero(router.depth.ravel()>=s.wet_depth_m)
                    error = initial+total_inflow-reservoir.storage_m3-router.volume
                    frame = {"protocol_version":1,"type":"simulation_frame","simulation_id":self.id,
                        "index":count,"time_s":reservoir.time_s,"progress":reservoir.time_s/s.duration_s,
                        "reservoir":record,"breach":{"width_m":geometry.bottom_width_m,
                        "depth_m":crest-geometry.bottom_elevation_m,"invert_m":geometry.bottom_elevation_m,
                        "area_m2":geometry.flow_area_m2(reservoir.elevation_m),"status":state["status"],
                        "discharge_m3s":record["breach_outflow_m3s"]},"near_field":near,
                        "downstream":{"indices":wet.tolist(),"depth_m":router.depth.ravel()[wet].round(4).tolist(),
                        "velocity_ms":router.velocity.ravel()[wet].round(4).tolist()},
                        "metrics":{"max_depth_m":float(router.max_depth.max()),"max_velocity_ms":float(router.max_velocity.max()),
                        "inundated_area_km2":float((router.max_depth>=s.wet_depth_m).sum()*router.dx**2/1e6),
                        "mass_error_m3":error,"downstream_volume_m3":router.volume}}
                    tick = time.perf_counter()
                    write_json(self.directory/f"frame-{count:04d}.json",frame)
                    timings["serialization_s"] += time.perf_counter()-tick
                    count += 1
                    self.update(frame_count=count,progress=frame["progress"])
                    next_frame = reservoir.time_s+interval
            self.update(status="POSTPROCESSING")
            from .results import export_results
            exports = export_results(self.directory,terrain,router,p,s)
            edge_wet = bool(np.any(router.max_depth[[0,-1],:]>=s.wet_depth_m) or np.any(router.max_depth[:,[0,-1]]>=s.wet_depth_m))
            self.summary = {**self.status(),"status":"COMPLETE","project":p.model_dump(),"scenario":s.model_dump(),
                "solver":"conservative diffusive-wave screening approximation", "near_field":near["mode"],
                "validated_against_observations":False,"terrain":terrain.metadata,"metrics":frame["metrics"],
                "initial_storage_m3":initial,"inflow_volume_m3":total_inflow,"final_storage_m3":reservoir.storage_m3,
                "mass_error_percent":100*error/max(initial+total_inflow,1),"peak_discharge_m3s":max(q[1] for q in hydrograph),
                "boundary_reached":edge_wet,"boundary_condition":"closed domain; no external drainage",
                "timings":{**timings,"total_s":time.perf_counter()-start},"exports":exports,
                "limitations":p.assumptions+["No full momentum/shock resolution or independently calibrated roughness.",
                    "Overtopping disabled: only breach and configured spillway releases routed.",
                    "SPH is an optional local diagnostic with a separate clock, not a mass-bearing coupled domain.",
                    "Reservoir shoreline is a DEM approximation unless a verified polygon is supplied."]}
            np.savetxt(self.directory/"hydrograph.csv",hydrograph,delimiter=",",header="time_s,discharge_m3s",comments="")
            write_json(self.directory/"summary.json",self.summary)
            self.update(status="COMPLETE",progress=1.)
            LOG.info("simulation_complete id=%s seconds=%.2f",self.id,time.perf_counter()-start)
        except InterruptedError as exc:
            self.update(status="CANCELLED",error=str(exc))
        except Exception as exc:
            LOG.exception("simulation_failed id=%s",self.id)
            self.update(status="FAILED",error=str(exc))
        finally:
            write_json(self.directory/"status.json",self.status())


class RunManager:
    def __init__(self, output_root=RUNS):
        self.output_root = Path(output_root)
        self.active = None
        self.lock = threading.Lock()

    def start(self, project, scenario):
        with self.lock:
            if self.active and self.active.status()["status"] not in {"COMPLETE","FAILED","CANCELLED"}:
                raise RuntimeError("A simulation is already active; cancel it before starting another")
            run = Run(project,scenario,self.output_root)
            self.active = run
            threading.Thread(target=run.execute,daemon=True,name=f"simulation-{run.id}").start()
            return run
