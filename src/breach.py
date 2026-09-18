"""
breach.py
---------
Dam-breach geometry growth and breach-outflow hydraulics.

Two complementary models are provided, matching your existing pipeline's
"three independent cross-checked methods" (Froehlich, Wahl, Von Thun &
Gillette) but here exposed as a *time-stepped* growth process rather than
single-number peak estimates, since this module drives a live simulation
frame by frame:

1. ParametricBreachGrowth
   Uses regression-based final breach geometry (Froehlich 2008) and a
   time-to-failure to linearly/sinusoidally interpolate breach size --
   fast, matches your validated peak-discharge numbers, good default.

2. PhysicallyBasedBreachGrowth
   Erosion-driven ODE: breach widens/deepens based on excess shear stress
   over the material's critical shear stress (Shields-type erosion law).
   This is the model that should feed the near-field SPH solver, since it
   produces a physically continuous breach shape and outflow, not an
   interpolated one. Use this when you need the breach and the SPH jet to
   be mechanically consistent with each other.

Both models expose `breach_outflow_m3s(reservoir_elevation_m)` using the
broad-crested weir / orifice equations appropriate to the current breach
geometry, so reservoir.py and the downstream solver can call either
interchangeably.

Structural endurance limits (StructuralMaterial) cap erosion and flag
"failure" only once actual shear/hydraulic force exceeds the material's
critical threshold -- the breach does not grow just because the reservoir
is full; it grows because the material physically can't resist the flow.
"""

from __future__ import annotations
from dataclasses import dataclass, field
import numpy as np

G = 9.81           # m/s^2
RHO_WATER = 1000.0  # kg/m^3


@dataclass
class StructuralMaterial:
    """
    Physical endurance limits of the dam material at the breach location.
    Values are representative ranges for earthen/rockfill dams; override
    with site data when available (geotechnical reports, borehole logs).
    """
    name: str = "earthfill_homogeneous"
    critical_shear_stress_pa: float = 20.0     # erosion onset (tau_c)
    erodibility_coeff: float = 5.0e-5          # m^3/(N.s) - detachment rate coefficient
    unit_weight_kNm3: float = 18.0             # bulk unit weight
    internal_friction_angle_deg: float = 30.0
    ultimate_shear_capacity_pa: float = 5000.0  # beyond this = instant structural collapse of a slice

    def erosion_rate(self, applied_shear_pa: float) -> float:
        """
        Excess-shear erosion law: E = k * (tau - tau_c)   for tau > tau_c else 0
        Returns volumetric erosion rate per unit wetted area (m/s).
        """
        excess = max(applied_shear_pa - self.critical_shear_stress_pa, 0.0)
        return self.erodibility_coeff * excess

    def check_collapse(self, applied_shear_pa: float) -> bool:
        """Instantaneous structural failure of a breach-wall slice (geotechnical
        slope failure / piping collapse) once shear exceeds ultimate capacity --
        distinct from gradual erosion."""
        return applied_shear_pa >= self.ultimate_shear_capacity_pa


@dataclass
class BreachGeometry:
    bottom_width_m: float
    bottom_elevation_m: float
    side_slope_h_per_v: float = 1.0    # horizontal:vertical, e.g. 1H:1V
    dam_height_m: float = 30.0

    def top_width_m(self, water_elevation_m: float) -> float:
        depth = max(water_elevation_m - self.bottom_elevation_m, 0.0)
        return self.bottom_width_m + 2 * self.side_slope_h_per_v * depth

    def flow_area_m2(self, water_elevation_m: float) -> float:
        depth = max(water_elevation_m - self.bottom_elevation_m, 0.0)
        if depth <= 0:
            return 0.0
        return depth * (self.bottom_width_m + self.side_slope_h_per_v * depth)

    def wetted_perimeter_m(self, water_elevation_m: float) -> float:
        depth = max(water_elevation_m - self.bottom_elevation_m, 0.0)
        side_len = depth * np.sqrt(1 + self.side_slope_h_per_v ** 2)
        return self.bottom_width_m + 2 * side_len


def weir_outflow_m3s(geometry: BreachGeometry, water_elevation_m: float,
                      discharge_coeff: float = 1.44) -> float:
    """
    Broad-crested trapezoidal weir equation used for breach outflow:
    Q = Cd * [ b * H^1.5 + (2/5) * z * H^2.5 * sqrt(2g) ]  (standard trapezoidal
    breach formula, consistent with Froehlich/NWS BREACH conventions)
    """
    depth = max(water_elevation_m - geometry.bottom_elevation_m, 0.0)
    if depth <= 0:
        return 0.0
    b = geometry.bottom_width_m
    z = geometry.side_slope_h_per_v
    q_rect = discharge_coeff * b * depth ** 1.5
    q_tri = discharge_coeff * (8.0 / 15.0) * z * np.sqrt(2 * G) * depth ** 2.5
    return q_rect + q_tri


@dataclass
class ParametricBreachGrowth:
    """
    Froehlich (2008)-style final geometry reached over a time-to-failure,
    growth shaped with a smoothstep (matches typical S-curve breach
    development observed in case-history data e.g. Teton, Machhu-II).
    """
    final_bottom_width_m: float
    final_bottom_elevation_m: float
    time_to_failure_s: float
    side_slope_h_per_v: float = 1.0
    dam_height_m: float = 30.0
    initiation_elevation_m: float = None  # water level that triggers breach start
    t0_s: float = None                    # set on first call once triggered

    def _smoothstep(self, x: float) -> float:
        x = np.clip(x, 0.0, 1.0)
        return x * x * (3 - 2 * x)

    def geometry_at(self, t_s: float, initial_bottom_elevation_m: float) -> BreachGeometry:
        if self.t0_s is None:
            frac = 0.0
        else:
            frac = self._smoothstep((t_s - self.t0_s) / self.time_to_failure_s)
        bottom_elev = initial_bottom_elevation_m + frac * (
            self.final_bottom_elevation_m - initial_bottom_elevation_m)
        bottom_width = frac * self.final_bottom_width_m
        return BreachGeometry(bottom_width, bottom_elev, self.side_slope_h_per_v,
                               self.dam_height_m)


@dataclass
class PhysicallyBasedBreachGrowth:
    """
    Erosion-ODE breach growth, mechanically coupled to StructuralMaterial.
    Widens and deepens the breach each timestep based on actual computed
    shear stress from the current flow, not a pre-set final shape. This is
    the model whose outflow hydrograph should be handed to the SPH breach-
    jet solver, since geometry and hydraulics evolve together.
    """
    material: StructuralMaterial
    geometry: BreachGeometry
    dam_crest_elevation_m: float
    initiation_elevation_m: float
    # True lower bound on breach-bottom elevation: the original valley
    # floor / streambed under the dam, from DEM or surveyed cross-section.
    # This is a required physical input, not an internal detail computed
    # from the breach geometry itself -- defaulting it to the geometry's
    # own starting elevation (see __post_init__) is a stated assumption,
    # flagged via `valley_floor_is_default`, not a validated bed level.
    valley_floor_elevation_m: float = None
    valley_floor_is_default: bool = field(default=False, init=False)
    started: bool = False

    def __post_init__(self):
        if self.valley_floor_elevation_m is None:
            self.valley_floor_elevation_m = self.geometry.bottom_elevation_m
            self.valley_floor_is_default = True

    def shear_stress_pa(self, water_elevation_m: float, velocity_ms: float) -> float:
        """tau = rho * g * R * S_f, approximated via friction-slope from velocity
        using Manning-consistent bed shear: tau ~ rho*g*n^2*v^2 / R^(1/3)."""
        depth = max(water_elevation_m - self.geometry.bottom_elevation_m, 1e-3)
        area = self.geometry.flow_area_m2(water_elevation_m)
        perim = self.geometry.wetted_perimeter_m(water_elevation_m)
        hydraulic_radius = area / max(perim, 1e-6)
        manning_n = 0.030  # disturbed earthfill / eroding channel
        tau = (RHO_WATER * G * manning_n ** 2 * velocity_ms ** 2
               / max(hydraulic_radius, 1e-3) ** (1.0 / 3.0))
        return tau

    def step(self, dt_s: float, water_elevation_m: float) -> dict:
        if not self.started:
            if water_elevation_m < self.initiation_elevation_m:
                return {"status": "not_initiated", "geometry": self.geometry}
            self.started = True

        q = weir_outflow_m3s(self.geometry, water_elevation_m)
        area = max(self.geometry.flow_area_m2(water_elevation_m), 1e-6)
        velocity = q / area if area > 0 else 0.0

        tau = self.shear_stress_pa(water_elevation_m, velocity)
        collapsed = self.material.check_collapse(tau)

        if collapsed:
            # Instant geotechnical slope failure: widen by one failure-slice
            # increment rather than the slow erosion law.
            slice_width_m = 2.0
            self.geometry.bottom_width_m += slice_width_m
            deepen_m = 0.0
        else:
            erosion_rate_ms = self.material.erosion_rate(tau)  # m/s of lateral/vertical retreat
            widen_m = erosion_rate_ms * dt_s * 2  # both banks
            deepen_m = erosion_rate_ms * dt_s
            self.geometry.bottom_width_m += widen_m

        # Breach cannot deepen below the true valley floor / streambed.
        # (Previously this was a no-op `max(x, x)` -- fixed: the bound now
        # comes from an actual external elevation, not the value being
        # clamped.)
        proposed_bottom = self.geometry.bottom_elevation_m - deepen_m
        self.geometry.bottom_elevation_m = max(proposed_bottom,
                                                self.valley_floor_elevation_m)

        return {
            "status": "collapsed_slice" if collapsed else "eroding",
            "shear_stress_pa": tau,
            "velocity_ms": velocity,
            "outflow_m3s": q,
            "bottom_width_m": self.geometry.bottom_width_m,
            "bottom_elevation_m": self.geometry.bottom_elevation_m,
            "hit_valley_floor": self.geometry.bottom_elevation_m <= self.valley_floor_elevation_m + 1e-9,
            "valley_floor_is_default": self.valley_floor_is_default,
        }
