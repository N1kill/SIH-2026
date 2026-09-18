"""
physics_service.py
------------------
Simulation orchestrator.  Owns the physics loop and produces
``PhysicsFrame`` dicts ready for WebSocket / REST serialization.

Keeps server.py from becoming a 300-line simulation script.

Architecture:

    PhysicsService
        ├── ReservoirState
        ├── PhysicallyBasedBreachGrowth
        ├── SPHBreachSolver
        ├── GridSolverAdapter  (MockGridAdapter for Phase 1)
        └── StructuralObject[]
        │
        ▼
    PhysicsFrame  →  WebSocket JSON / REST snapshot
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import numpy as np

from .reservoir import ReservoirState, StorageElevationCurve
from .breach import (
    PhysicallyBasedBreachGrowth,
    BreachGeometry,
    StructuralMaterial,
)
from .sph_breach import SPHBreachSolver, SPHParams
from .coupling import BreachCouplingSimulation, StructuralObject
from .mock_grid import MockGridAdapter


# ── Defaults ─────────────────────────────────────────────────────────────

DEFAULT_DAM_HEIGHT_M = 30.0
DEFAULT_DAM_LENGTH_M = 120.0
DEFAULT_RESERVOIR_STORAGE_COEFF = 8000.0
DEFAULT_RESERVOIR_STORAGE_EXP = 1.7
DEFAULT_DAM_CREST_ELEVATION_M = 30.0
DEFAULT_SPILLWAY_CREST_M = 27.0
DEFAULT_SPILLWAY_WIDTH_M = 15.0
DEFAULT_INITIAL_ELEVATION_M = 30.01
DEFAULT_INFLOW_M3S = 500.0
DEFAULT_DT_S = 5.0
DEFAULT_TOTAL_STEPS = 600

# SPH particle-streaming policy
MAX_STREAMED_PARTICLES = 2000
STREAM_EVERY_N_STEPS = 3


@dataclass
class SimulationConfig:
    """All tunables for a single simulation run."""
    dam_height_m: float = DEFAULT_DAM_HEIGHT_M
    dam_length_m: float = DEFAULT_DAM_LENGTH_M
    dam_crest_elevation_m: float = DEFAULT_DAM_CREST_ELEVATION_M
    spillway_crest_m: float = DEFAULT_SPILLWAY_CREST_M
    spillway_width_m: float = DEFAULT_SPILLWAY_WIDTH_M
    gate_count: int = 5
    open_gate_count: int = 3
    gate_width_m: float = 3.0
    gate_opening_m: float = 2.0
    gate_discharge_coeff: float = 0.62
    initial_elevation_m: float = DEFAULT_INITIAL_ELEVATION_M
    storage_coeff: float = DEFAULT_RESERVOIR_STORAGE_COEFF
    storage_exponent: float = DEFAULT_RESERVOIR_STORAGE_EXP
    inflow_m3s: float = DEFAULT_INFLOW_M3S
    dt_s: float = DEFAULT_DT_S
    total_steps: int = DEFAULT_TOTAL_STEPS

    # Breach material
    material_name: str = "compacted_earthfill"
    critical_shear_stress_pa: float = 25.0
    erodibility_coeff: float = 4.0e-5
    ultimate_shear_capacity_pa: float = 4000.0

    # Breach geometry
    initial_breach_width_m: float = 2.0
    initial_breach_elevation_m: float = 5.0
    breach_side_slope: float = 1.0
    initiation_elevation_m: float = 28.5
    valley_floor_elevation_m: float = 3.0

    # SPH
    particle_spacing_m: float = 0.3
    sph_slice_width_m: float = 1.0

    # Downstream structure
    bridge_name: str = "downstream_bridge"
    bridge_x_m: float = 1500.0
    bridge_y_m: float = 0.0
    bridge_frontal_area_m2: float = 25.0
    bridge_failure_force_kN: float = 800.0
    bridge_height_m: float = 5.0
    bridge_base_width_m: float = 4.0
    bridge_foundation_area_m2: float = 16.0
    bridge_dead_weight_kN: float = 2500.0
    bridge_allowable_bearing_kPa: float = 350.0

    # Grid
    grid_length_m: float = 5000.0
    grid_dx_m: float = 50.0


def _build_simulation(cfg: SimulationConfig) -> BreachCouplingSimulation:
    """Construct a fully wired coupling simulation from config."""
    curve = StorageElevationCurve(
        bed_elevation_m=0.0,
        coeff=cfg.storage_coeff,
        exponent=cfg.storage_exponent,
    )
    reservoir = ReservoirState(
        curve=curve,
        dam_crest_elevation_m=cfg.dam_crest_elevation_m,
        spillway_crest_elevation_m=cfg.spillway_crest_m,
        spillway_width_m=cfg.spillway_width_m,
        gate_count=cfg.gate_count,
        open_gate_count=cfg.open_gate_count,
        gate_width_m=cfg.gate_width_m,
        gate_opening_m=cfg.gate_opening_m,
        gate_discharge_coeff=cfg.gate_discharge_coeff,
        storage_m3=curve.elevation_to_storage(cfg.initial_elevation_m),
    )

    material = StructuralMaterial(
        name=cfg.material_name,
        critical_shear_stress_pa=cfg.critical_shear_stress_pa,
        erodibility_coeff=cfg.erodibility_coeff,
        ultimate_shear_capacity_pa=cfg.ultimate_shear_capacity_pa,
    )
    geometry = BreachGeometry(
        bottom_width_m=cfg.initial_breach_width_m,
        bottom_elevation_m=cfg.initial_breach_elevation_m,
        side_slope_h_per_v=cfg.breach_side_slope,
        dam_height_m=cfg.dam_height_m,
    )
    breach = PhysicallyBasedBreachGrowth(
        material=material,
        geometry=geometry,
        dam_crest_elevation_m=cfg.dam_crest_elevation_m,
        initiation_elevation_m=cfg.initiation_elevation_m,
        valley_floor_elevation_m=cfg.valley_floor_elevation_m,
    )

    sph_params = SPHParams(particle_spacing_m=cfg.particle_spacing_m)
    sph = SPHBreachSolver(sph_params)
    # Fixed SPH boundary particles define the breach floor and the upstream
    # wall. The solver's bed-contact projection uses this same fall.
    sph.add_boundary_line((-8, 0), (15, -0.9))
    sph.add_boundary_line((-8, 0), (-8, 8))

    grid = MockGridAdapter(length_m=cfg.grid_length_m, dx_m=cfg.grid_dx_m)

    sim = BreachCouplingSimulation(
        reservoir=reservoir,
        breach=breach,
        sph=sph,
        grid=grid,
        dam_length_m=cfg.dam_length_m,
        breach_x_m=0.0,
        sph_slice_width_m=cfg.sph_slice_width_m,
    )
    sim.add_structure(StructuralObject(
        name=cfg.bridge_name,
        x_m=cfg.bridge_x_m,
        y_m=cfg.bridge_y_m,
        frontal_area_m2=cfg.bridge_frontal_area_m2,
        failure_force_kN=cfg.bridge_failure_force_kN,
        height_m=cfg.bridge_height_m,
        base_width_m=cfg.bridge_base_width_m,
        foundation_area_m2=cfg.bridge_foundation_area_m2,
        dead_weight_kN=cfg.bridge_dead_weight_kN,
        allowable_bearing_kPa=cfg.bridge_allowable_bearing_kPa,
    ))
    return sim


def generate_downstream_hydrograph(cfg: Optional[SimulationConfig] = None) -> list[tuple[float, float]]:
    """Generate the FM forcing hydrograph without advancing the visual SPH slice.

    The far-field solver needs mass-conserving released discharge, which is
    governed by reservoir storage, breach growth, gates, and overtopping.
    SPH resolves the near-field jet shape and is streamed independently; using
    it merely to precompute a hydrograph makes a 2D FM run unnecessarily slow.
    """
    cfg = cfg or SimulationConfig()
    curve = StorageElevationCurve(
        bed_elevation_m=0.0,
        coeff=cfg.storage_coeff,
        exponent=cfg.storage_exponent,
    )
    reservoir = ReservoirState(
        curve=curve,
        dam_crest_elevation_m=cfg.dam_crest_elevation_m,
        spillway_crest_elevation_m=cfg.spillway_crest_m,
        spillway_width_m=cfg.spillway_width_m,
        gate_count=cfg.gate_count,
        open_gate_count=cfg.open_gate_count,
        gate_width_m=cfg.gate_width_m,
        gate_opening_m=cfg.gate_opening_m,
        gate_discharge_coeff=cfg.gate_discharge_coeff,
        storage_m3=curve.elevation_to_storage(cfg.initial_elevation_m),
    )
    material = StructuralMaterial(
        name=cfg.material_name,
        critical_shear_stress_pa=cfg.critical_shear_stress_pa,
        erodibility_coeff=cfg.erodibility_coeff,
        ultimate_shear_capacity_pa=cfg.ultimate_shear_capacity_pa,
    )
    breach = PhysicallyBasedBreachGrowth(
        material=material,
        geometry=BreachGeometry(
            bottom_width_m=cfg.initial_breach_width_m,
            bottom_elevation_m=cfg.initial_breach_elevation_m,
            side_slope_h_per_v=cfg.breach_side_slope,
            dam_height_m=cfg.dam_height_m,
        ),
        dam_crest_elevation_m=cfg.dam_crest_elevation_m,
        initiation_elevation_m=cfg.initiation_elevation_m,
        valley_floor_elevation_m=cfg.valley_floor_elevation_m,
    )
    # D-Flow FM samples every forcing at simulation time zero; do not start
    # the BC at the first post-step value (t=dt), or FM rejects the series.
    hydrograph = [(0.0, 0.0)]
    for _ in range(cfg.total_steps):
        breach_state = breach.step(cfg.dt_s, reservoir.elevation_m)
        breach_q = breach_state.get("outflow_m3s", 0.0)
        state = reservoir.step(cfg.dt_s, cfg.inflow_m3s, breach_q)
        hydrograph.append((
            float(reservoir.time_s),
            float(state["breach_outflow_m3s"] + state["spillway_outflow_m3s"] + state["overtopping_outflow_m3s"]),
        ))
    return hydrograph


def _sample_fluid_particles(sph: SPHBreachSolver,
                             max_count: int = MAX_STREAMED_PARTICLES) -> list:
    """Deterministic stride-sample of fluid-only particles for streaming.

    Returns at most ``max_count`` particles.  Uses a fixed stride so the
    same physical particles are selected across consecutive frames,
    preventing visual flicker.  Boundary particles are never included.
    """
    fluid_mask = ~sph.is_boundary
    fluid_idx = np.where(fluid_mask)[0]
    n_fluid = len(fluid_idx)
    if n_fluid == 0:
        return []

    if n_fluid <= max_count:
        selected = fluid_idx
    else:
        stride = max(1, n_fluid // max_count)
        selected = fluid_idx[::stride][:max_count]

    particles = []
    for idx in selected:
        particles.append({
            "id": int(idx),
            "x": round(float(sph.pos[idx, 0]), 3),
            "y": round(float(sph.pos[idx, 1]), 3),
            "vx": round(float(sph.vel[idx, 0]), 2),
            "vy": round(float(sph.vel[idx, 1]), 2),
        })
    return particles


def build_physics_frame(record: dict,
                        sph: SPHBreachSolver,
                        step_index: int,
                        include_particles: bool) -> dict:
    """Shape a coupling-step record into the WebSocket frame format."""
    frame = {
        "type": "physics_frame",
        "simulation": {
            "time_s": record["time_s"],
            "time_hours": round(record["time_s"] / 3600, 4),
            "step_index": step_index,
        },
        "reservoir": {
            "elevation_m": round(record["reservoir_elevation_m"], 3),
            "storage_m3": round(record["reservoir_storage_m3"], 1),
            "spillway_outflow_m3s": round(record["spillway_outflow_m3s"], 2),
            "overtopping_outflow_m3s": round(record["overtopping_outflow_m3s"], 2),
        },
        "breach": {
            "status": record["breach_status"],
            "bottom_width_m": round(record["breach_bottom_width_m"], 3),
            "bottom_elevation_m": round(record.get("breach_bottom_elevation_m", 0), 3),
            "outflow_m3s": round(record["breach_outflow_m3s"], 2),
            "hit_valley_floor": record.get("breach_hit_valley_floor", False),
        },
        "sph": {
            "mean_velocity_ms": round(record["sph_mean_velocity_ms"], 3),
            "spray_fraction": round(record["sph_spray_fraction"], 4),
            "n_particles_total": record["sph_n_particles"],
        },
        "structures": record["structures"],
    }

    if include_particles:
        particles = _sample_fluid_particles(sph)
        frame["sph"]["n_particles_streamed"] = len(particles)
        frame["sph"]["particles"] = particles
    else:
        frame["sph"]["n_particles_streamed"] = 0

    return frame


class PhysicsService:
    """Owns simulation lifecycle.  Used by both WebSocket and REST."""

    def __init__(self, cfg: Optional[SimulationConfig] = None):
        self.cfg = cfg or SimulationConfig()
        self.sim: Optional[BreachCouplingSimulation] = None
        self.step_index = 0
        self.completed = False
        self._snapshot: list[dict] = []

    def initialize(self) -> None:
        self.sim = _build_simulation(self.cfg)
        self.step_index = 0
        self.completed = False
        self._snapshot = []

    def step(self) -> dict:
        """Advance one physics coupling step.  Returns a PhysicsFrame dict."""
        if self.sim is None:
            self.initialize()

        if self.step_index >= self.cfg.total_steps:
            self.completed = True
            return {"type": "simulation_complete",
                    "simulation": {"time_s": self.sim.reservoir.time_s,
                                   "time_hours": round(self.sim.reservoir.time_s / 3600, 4),
                                   "status": "completed"}}

        record = self.sim.step(self.cfg.dt_s, inflow_m3s=self.cfg.inflow_m3s)
        self.step_index += 1

        include_particles = (self.step_index % STREAM_EVERY_N_STEPS == 0)
        frame = build_physics_frame(record, self.sim.sph,
                                    self.step_index, include_particles)
        self._snapshot.append(frame)
        return frame

    def run_full(self) -> list[dict]:
        """Run entire simulation synchronously, return all frames.
        Used by the REST snapshot endpoint."""
        if self.sim is None:
            self.initialize()

        frames = []
        while self.step_index < self.cfg.total_steps:
            frames.append(self.step())
        return frames

    def snapshot_summary(self) -> dict:
        """Compact summary for REST /api/physics/snapshot."""
        if not self._snapshot:
            return {"error": "no simulation data"}

        last = self._snapshot[-1]
        return {
            "simulation": {
                "time_s": last["simulation"]["time_s"],
                "time_hours": last["simulation"]["time_hours"],
                "status": "completed" if self.completed else "running",
                "total_steps": len(self._snapshot),
            },
            "reservoir": last["reservoir"],
            "breach": last["breach"],
            "sph": {k: v for k, v in last["sph"].items() if k != "particles"},
            "structures": last["structures"],
            "frames": self._snapshot,
        }
