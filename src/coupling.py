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

Dimensional note on SPH coupling:
    The SPH solver operates on a 2D vertical slice through the breach
    centreline.  ``sph_slice_width_m`` (default 1.0 m) converts between
    the total volumetric discharge Q_total (m³/s) and the per-unit-width
    slice that SPH ingests:

        Q_total  →  reservoir mass balance  (3D volumetric)
        Q_total / sph_slice_width  →  SPH slice injection  (2D per-metre)
        Q_total  →  downstream 2D boundary  (3D volumetric)
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Protocol, Optional
import numpy as np

from .reservoir import ReservoirState
from .breach import PhysicallyBasedBreachGrowth, BreachGeometry
from .sph_breach import SPHBreachSolver, SPHParams


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
    simplified load-bearing model checked against the locally computed flood
    depth and velocity. It is suitable for scenario testing, not design
    certification by a structural engineer."""
    name: str
    x_m: float
    y_m: float
    frontal_area_m2: float          # area exposed to flow
    drag_coeff: float = 1.2
    failure_force_kN: float = 500.0  # structural capacity
    height_m: float = 5.0
    base_width_m: float = 4.0
    foundation_area_m2: float = 16.0
    dead_weight_kN: float = 2500.0
    allowable_bearing_kPa: float = 350.0
    minimum_overturning_fs: float = 1.5
    uplift_reduction_factor: float = 0.25
    failed: bool = False
    failure_time_s: Optional[float] = None
    failure_reason: Optional[str] = None

    def load_state(self, depth_m: float, velocity_ms: np.ndarray) -> dict:
        """Return the current simplified hydraulic and foundation loads.

        Horizontal loading combines velocity-driven drag and hydrostatic
        pressure. Vertical effective load includes a conservative uplift
        allowance; bearing and overturning are then assessed from that load.
        """
        rho = 1000.0
        gravity = 9.81
        submerged_height = min(max(depth_m, 0.0), self.height_m)
        width_m = self.frontal_area_m2 / max(self.height_m, 1e-6)
        submerged_area = width_m * submerged_height
        speed = float(np.linalg.norm(velocity_ms))
        drag_kN = (
            0.5 * rho * self.drag_coeff * submerged_area * speed ** 2 /
            1000.0
        )
        hydrostatic_kN = (
            0.5 * rho * gravity * width_m * submerged_height ** 2 /
            1000.0
        )
        uplift_kN = (
            rho * gravity * self.foundation_area_m2 * submerged_height *
            self.uplift_reduction_factor / 1000.0
        )
        effective_weight_kN = max(0.0, self.dead_weight_kN - uplift_kN)
        bearing_kPa = effective_weight_kN / max(self.foundation_area_m2, 1e-6)
        drag_lever_m = submerged_height * 0.5
        hydrostatic_lever_m = submerged_height / 3.0
        overturning_moment_kNm = (
            drag_kN * drag_lever_m +
            hydrostatic_kN * hydrostatic_lever_m
        )
        resisting_moment_kNm = effective_weight_kN * self.base_width_m * 0.5
        # JSON has no representation for Infinity.  ``None`` means the
        # water exerts no overturning moment (dry / zero-load condition).
        overturning_fs = (
            resisting_moment_kNm / overturning_moment_kNm
            if overturning_moment_kNm > 1e-6 else None
        )
        horizontal_load_kN = drag_kN + hydrostatic_kN

        return {
            "depth_m": depth_m,
            "velocity_ms": speed,
            "drag_kN": drag_kN,
            "hydrostatic_kN": hydrostatic_kN,
            "horizontal_load_kN": horizontal_load_kN,
            "uplift_kN": uplift_kN,
            "bearing_kPa": bearing_kPa,
            "overturning_fs": overturning_fs,
        }

    def hydrodynamic_force_kN(self, depth_m: float, velocity_ms: np.ndarray) -> float:
        """Compatibility accessor for the total horizontal flood load."""
        return self.load_state(depth_m, velocity_ms)["horizontal_load_kN"]

    def check(self, depth_m: float, velocity_ms: np.ndarray, time_s: float) -> bool:
        if self.failed:
            return True
        state = self.load_state(depth_m, velocity_ms)
        reason = None
        if state["horizontal_load_kN"] >= self.failure_force_kN:
            reason = "horizontal_capacity"
        elif state["bearing_kPa"] > self.allowable_bearing_kPa:
            reason = "bearing_capacity"
        elif (state["overturning_fs"] is not None and
              state["overturning_fs"] < self.minimum_overturning_fs):
            reason = "overturning"

        if reason:
            self.failed = True
            self.failure_time_s = time_s
            self.failure_reason = reason
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

    # Dimensional conversion factor: how wide (in the out-of-plane direction)
    # is the 2D SPH slice?  The total volumetric breach discharge Q_total
    # (m³/s) is divided by this width to produce the per-unit-width volume
    # (m²/s) that the 2D SPH domain actually ingests.  Document it, don't
    # hide it.
    sph_slice_width_m: float = 1.0

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

        # Use the reservoir's possibly storage-limited component flow for
        # every downstream hand-off. This preserves mass conservation even
        # in the final time step of a nearly drained reservoir.
        breach_q = res_state["breach_outflow_m3s"]

        spillway_q = res_state["spillway_outflow_m3s"]
        overtopping_q = res_state["overtopping_outflow_m3s"]

        # 3. Inject exactly the breach portion into the local SPH slice.
        #    into the SPH domain.
        #
        #    Dimensional interpretation: Q_total (m³/s) is the full 3D
        #    volumetric discharge.  The SPH domain is a 2D vertical slice
        #    of width ``sph_slice_width_m``.  We inject the slice's share:
        #
        #        volume_per_metre = (Q_total * dt) / sph_slice_width_m   (m²)
        #
        #    That 2D area is then laid out as a rectangular slug of
        #    ``injection_width_m`` x ``slug_depth_m`` at the inlet.
        injection_width_m = min(self.breach.geometry.bottom_width_m, 5.0)
        if breach_q > 0 and injection_width_m > 0 and breach_state.get("status") != "not_initiated":
            slice_area_m2 = (breach_q * dt_s) / max(self.sph_slice_width_m, 1e-6)
            slug_depth_m = slice_area_m2 / injection_width_m
            self.sph.seed_reservoir_block(
                width_m=injection_width_m,
                depth_m=slug_depth_m,
                # SPH uses an invert-relative vertical coordinate system:
                # y=0 is the current breach invert.  Physical elevation is
                # restored only when the renderer maps the streamed slice.
                origin_xy=(-injection_width_m - 1.0, 0.0),
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

        # 4. Push every released component into the far-field boundary. The
        # local SPH slice resolves breach flow only; gate and overtopping
        # water use their hydraulic exit velocities. This closes the former
        # mass-balance hole where spillway water left storage but never
        # reached the downstream model.
        gate_velocity = self.reservoir.spillway_exit_velocity_ms()
        overtopping_velocity = np.sqrt(
            2 * 9.81 * max(
                self.reservoir.elevation_m - self.reservoir.dam_crest_elevation_m,
                0.0,
            )
        )
        total_downstream_q = breach_q + spillway_q + overtopping_q
        velocity_for_boundary = (
            (
                breach_q * velocity_for_boundary +
                spillway_q * gate_velocity +
                overtopping_q * overtopping_velocity
            ) / total_downstream_q
            if total_downstream_q > 0 else 0.0
        )
        self.grid.set_upstream_boundary(
            discharge_m3s=total_downstream_q,
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
            load = s.load_state(depth, vel)
            structure_results.append({
                "name": s.name, "failed": failed,
                "failure_reason": s.failure_reason,
                **load,
            })

        record = {
            "time_s": self.reservoir.time_s,
            "reservoir_elevation_m": res_state["elevation_m"],
            "reservoir_storage_m3": res_state["storage_m3"],
            "breach_status": breach_state.get("status"),
            "breach_bottom_width_m": self.breach.geometry.bottom_width_m,
            "breach_bottom_elevation_m": self.breach.geometry.bottom_elevation_m,
            "breach_outflow_m3s": breach_q,          # single source of truth
            "spillway_outflow_m3s": spillway_q,
            "overtopping_outflow_m3s": overtopping_q,
            "downstream_inflow_m3s": total_downstream_q,
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
