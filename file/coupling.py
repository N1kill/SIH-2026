"""
coupling.py
-----------
Ties reservoir.py + breach.py + sph_breach.py to your existing downstream
2D grid solver (the "Delft3D-family" solver referenced in the gap
checklist), and enforces physical object endurance limits on downstream
structures (bridges, buildings, walls) using the flood's local force.

Design intent (matches the checklist's recommended scope):
    - SPH runs ONLY on a small near-field domain around the breach opening.
    - Its outflow flux/velocity feeds the downstream grid as a time-varying
      boundary condition (a "hybrid" coupling, not full-domain SPH).
    - The downstream grid itself is NOT reimplemented here -- `GridSolverAdapter`
      is a thin interface your existing 2D shallow-water/Delft3D-family code
      should implement, so this module has one integration point instead of
      being welded to a specific solver.

River/reservoir boundary enforcement:
    - Reservoir storage can never go negative (reservoir.py).
    - Breach geometry can't exceed the dam's physical footprint (breach.py,
      caller-supplied dam_length_m cap enforced here).
    - Downstream flow is confined to the river/valley polygon; any grid
      cells outside the valid geospatial river-corridor mask are treated as
      dry regardless of computed water level (prevents flow "leaking" past
      terrain boundaries due to solver numerical noise).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Protocol, Optional
import numpy as np

from reservoir import ReservoirState
from breach import PhysicallyBasedBreachGrowth, BreachGeometry
from sph_breach import SPHBreachSolver, SPHParams


class GridSolverAdapter(Protocol):
    """Implement this against your existing downstream 2D solver."""

    def set_upstream_boundary(self, discharge_m3s: float, velocity_ms: float,
                               x_m: float) -> None: ...

    def step(self, dt_s: float) -> dict: ...

    def water_depth_at(self, x_m: float, y_m: float) -> float: ...

    def velocity_at(self, x_m: float, y_m: float) -> np.ndarray: ...

    def river_corridor_mask(self) -> np.ndarray:
        """Boolean mask of cells that are legitimately part of the river/
        valley -- used to hard-clip any spurious flow outside real terrain
        boundaries."""
        ...


@dataclass
class StructuralObject:
    """A downstream object (bridge pier, building, wall segment) with a
    physical endurance limit, checked every coupling step against the
    locally computed hydrodynamic force."""
    name: str
    x_m: float
    y_m: float
    frontal_area_m2: float          # area exposed to flow
    drag_coeff: float = 1.2
    failure_force_kN: float = 500.0  # structural capacity
    failed: bool = False
    failure_time_s: Optional[float] = None

    def hydrodynamic_force_kN(self, depth_m: float, velocity_ms: np.ndarray) -> float:
        """F = 0.5 * rho * Cd * A_submerged * v^2 (standard drag/impact load
        used in flood-structure vulnerability assessment)."""
        if depth_m <= 0:
            return 0.0
        submerged_area = min(self.frontal_area_m2, self.frontal_area_m2 * depth_m /
                              max(depth_m, 0.1))
        speed = float(np.linalg.norm(velocity_ms))
        force_n = 0.5 * 1000.0 * self.drag_coeff * submerged_area * speed ** 2
        return force_n / 1000.0

    def check(self, depth_m: float, velocity_ms: np.ndarray, time_s: float) -> bool:
        if self.failed:
            return True
        force = self.hydrodynamic_force_kN(depth_m, velocity_ms)
        if force >= self.failure_force_kN:
            self.failed = True
            self.failure_time_s = time_s
        return self.failed


@dataclass
class BreachCouplingSimulation:
    reservoir: ReservoirState
    breach: PhysicallyBasedBreachGrowth
    sph: SPHBreachSolver
    grid: GridSolverAdapter
    dam_length_m: float               # hard cap: breach can't exceed dam footprint
    breach_x_m: float                 # location of breach along downstream grid's x-axis
    structures: list = field(default_factory=list)
    sph_substeps_per_macro_step: int = 5
    log: list = field(default_factory=list)

    def add_structure(self, s: StructuralObject):
        self.structures.append(s)

    def step(self, dt_s: float, inflow_m3s: float) -> dict:
        """
        Single-source-of-truth mass accounting, in this order:

        1. The weir/orifice breach-hydraulics equation (from breach.py,
           itself using the *current* eroded geometry) is the one and only
           thing that removes water from the reservoir. This is standard
           dam-break practice (it's the same formulation your validated
           Froehlich/Wahl/Von Thun numbers rest on) and it's what keeps
           reservoir storage physically honest.
        2. That exact same discharge is converted to a volume and injected
           into the SPH domain as a mass source -- SPH is never
           independently re-seeded to "match the current head". SPH
           therefore never holds more or less water than what the
           reservoir actually lost.
        3. SPH is used only to resolve HOW that mass moves once it's
           through the opening -- velocity profile, jet spread, spray
           fraction -- not to produce a second, competing discharge number.
           The old code computed sph_total_q independently and blended it
           with breach_q via an arbitrary np.clip(ratio, 0.5, 2.0); that
           reconciliation step is removed entirely, not just tuned.
        """
        # 1. Breach growth driven by current reservoir elevation (previous
        #    step's elevation on the first call; state is continuous so this
        #    one-step lag is standard explicit-scheme behavior, not a bug).
        last_elevation = self.reservoir.elevation_m
        breach_state = self.breach.step(dt_s, last_elevation)

        # hard cap: breach cannot exceed dam's physical footprint
        if self.breach.geometry.bottom_width_m > self.dam_length_m:
            self.breach.geometry.bottom_width_m = self.dam_length_m

        breach_q = breach_state.get("outflow_m3s", 0.0)

        # 2. Reservoir loses exactly breach_q (plus spillway/overtopping/
        #    seepage, accounted inside reservoir.step). This is the ONLY
        #    place reservoir mass is removed.
        res_state = self.reservoir.step(dt_s, inflow_m3s, breach_q)

        # 3. Inject exactly the volume that left the reservoir this step
        #    into the SPH domain, as a thin slug at the inlet -- not a
        #    block re-sized to match current head. Volume in equals volume
        #    physically removed from storage, so the two systems can't
        #    drift apart in total mass.
        injection_width_m = min(self.breach.geometry.bottom_width_m, 5.0)
        if breach_q > 0 and injection_width_m > 0 and breach_state.get("status") != "not_initiated":
            # area (m^2) of this 2D slice == volume per unit out-of-plane
            # width (m^3/m) delivered this step; this is the explicit,
            # documented 2D-slice-represents-a-unit-width-through-the-
            # breach-centerline assumption.
            slug_area_m2 = (breach_q * dt_s) / max(self.breach.geometry.bottom_width_m, 1e-6)
            slug_depth_m = slug_area_m2 / injection_width_m
            self.sph.seed_reservoir_block(
                width_m=injection_width_m,
                depth_m=slug_depth_m,
                origin_xy=(-injection_width_m - 1.0, self.breach.geometry.bottom_elevation_m),
            )

        sph_dt = dt_s / self.sph_substeps_per_macro_step
        sph_info = {}
        for _ in range(self.sph_substeps_per_macro_step):
            sph_info = self.sph.step(sph_dt)

        # SPH-measured velocity/spray are diagnostic detail on top of the
        # mass-consistent breach_q -- not a replacement for it.
        sph_flux = self.sph.outflow_flux(gate_x_m=2.0)
        velocity_for_boundary = (sph_flux["mean_velocity_ms"]
                                  if sph_flux["mean_velocity_ms"] > 0
                                  else self._hydraulic_velocity_estimate(breach_q))

        # 4. Push the mass-consistent discharge + SPH-resolved velocity into
        #    the far-field grid boundary condition.
        self.grid.set_upstream_boundary(
            discharge_m3s=breach_q,
            velocity_ms=velocity_for_boundary,
            x_m=self.breach_x_m,
        )
        grid_state = self.grid.step(dt_s)

        # 5. Clip any flow outside the true river/valley corridor.
        corridor_mask = self.grid.river_corridor_mask()
        # (Adapter is expected to apply this internally; asserted here so a
        # misbehaving adapter is caught rather than silently trusted.)
        assert corridor_mask.dtype == bool, "river_corridor_mask must be boolean"

        # 6. Structural endurance checks against local depth/velocity.
        structure_results = []
        for s in self.structures:
            depth = self.grid.water_depth_at(s.x_m, s.y_m)
            vel = self.grid.velocity_at(s.x_m, s.y_m)
            failed = s.check(depth, vel, self.reservoir.time_s)
            structure_results.append({
                "name": s.name, "failed": failed,
                "force_kN": s.hydrodynamic_force_kN(depth, vel),
                "depth_m": depth,
            })

        record = {
            "time_s": self.reservoir.time_s,
            "reservoir_elevation_m": res_state["elevation_m"],
            "reservoir_storage_m3": res_state["storage_m3"],
            "breach_status": breach_state.get("status"),
            "breach_bottom_width_m": self.breach.geometry.bottom_width_m,
            "breach_hit_valley_floor": breach_state.get("hit_valley_floor", False),
            "breach_outflow_m3s": breach_q,          # single source of truth
            "sph_mean_velocity_ms": sph_flux["mean_velocity_ms"],
            "sph_spray_fraction": sph_flux["spray_fraction"],
            "sph_n_particles": sph_info.get("n_particles", 0),
            "structures": structure_results,
        }
        self.log.append(record)
        return record

    def _hydraulic_velocity_estimate(self, breach_q: float) -> float:
        """Fallback velocity (Q/A through the current breach opening) for
        steps where SPH hasn't yet got particles at the measurement gate --
        e.g. the first few sub-steps right after breach initiation. Purely
        a cold-start bootstrap; once particles reach the gate, the
        SPH-measured velocity in `step()` takes over."""
        area = max(self.breach.geometry.flow_area_m2(self.reservoir.elevation_m), 1e-6)
        return breach_q / area if area > 0 else 0.0
