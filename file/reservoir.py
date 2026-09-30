"""
reservoir.py
------------
Reservoir mass-balance and hydraulic state.

Physics:
    dS/dt = Q_in - Q_out_breach - Q_out_spillway - Q_seepage

S is reservoir storage volume (m^3). Elevation is recovered from a
storage-elevation curve (either supplied as survey data, or approximated
with a power-law S = a * (h - h_bed)^b if no survey is available -- this
approximation is clearly flagged so it is never silently treated as real
bathymetry).

This module owns the reservoir's physical state and enforces:
    - conservation of volume (no water created/destroyed)
    - storage can't go below dead storage (bed) or above dam crest + freeboard
      without triggering overtopping flow
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Callable, Optional
import numpy as np


@dataclass
class StorageElevationCurve:
    """
    Storage-elevation-area relation.

    If real survey points (elevation_m, storage_m3, area_m2) are supplied,
    they are interpolated. Otherwise a power-law approximation is used and
    `is_synthetic` is set True so downstream reporting can flag it as an
    assumption rather than surveyed bathymetry.
    """

    elevations_m: Optional[np.ndarray] = None
    storages_m3: Optional[np.ndarray] = None
    areas_m2: Optional[np.ndarray] = None
    bed_elevation_m: float = 0.0
    # Power law fallback: S = coeff * (h - bed)^exponent
    coeff: float = 1.0e4
    exponent: float = 1.8
    is_synthetic: bool = True

    def __post_init__(self):
        if self.elevations_m is not None:
            self.is_synthetic = False
            order = np.argsort(self.elevations_m)
            self.elevations_m = np.asarray(self.elevations_m)[order]
            self.storages_m3 = np.asarray(self.storages_m3)[order]
            if self.areas_m2 is not None:
                self.areas_m2 = np.asarray(self.areas_m2)[order]

    def storage_to_elevation(self, storage_m3: float) -> float:
        storage_m3 = max(storage_m3, 0.0)
        if not self.is_synthetic:
            return float(np.interp(storage_m3, self.storages_m3, self.elevations_m))
        h = self.bed_elevation_m + (storage_m3 / self.coeff) ** (1.0 / self.exponent)
        return float(h)

    def elevation_to_storage(self, elevation_m: float) -> float:
        if not self.is_synthetic:
            return float(np.interp(elevation_m, self.elevations_m, self.storages_m3))
        h_above_bed = max(elevation_m - self.bed_elevation_m, 0.0)
        return float(self.coeff * h_above_bed**self.exponent)

    def surface_area(self, elevation_m: float) -> float:
        """dS/dh at this elevation -- used to convert flow rates to level change."""
        if not self.is_synthetic and self.areas_m2 is not None:
            return float(np.interp(elevation_m, self.elevations_m, self.areas_m2))
        # derivative of the power law: dS/dh = coeff*exponent*(h-bed)^(exponent-1)
        h_above_bed = max(elevation_m - self.bed_elevation_m, 1e-6)
        return float(self.coeff * self.exponent * h_above_bed ** (self.exponent - 1))


@dataclass
class ReservoirState:
    curve: StorageElevationCurve
    dam_crest_elevation_m: float
    spillway_crest_elevation_m: float
    spillway_coeff_cd: float = 1.7  # broad-crested weir coefficient
    spillway_width_m: float = 20.0
    storage_m3: float = 0.0
    time_s: float = 0.0

    def __post_init__(self):
        if self.storage_m3 == 0.0:
            raise ValueError(
                "Initialize storage_m3 to the reservoir's starting volume."
            )

    @property
    def elevation_m(self) -> float:
        return self.curve.storage_to_elevation(self.storage_m3)

    def spillway_outflow_m3s(self) -> float:
        h = self.elevation_m
        head = max(h - self.spillway_crest_elevation_m, 0.0)
        if head <= 0:
            return 0.0
        # Standard weir equation: Q = Cd * L * H^1.5
        return self.spillway_coeff_cd * self.spillway_width_m * head**1.5

    def overtopping_outflow_m3s(
        self, discharge_coeff: float = 1.7, crest_length_m: float = 100.0
    ) -> float:
        """Flow over the dam crest itself once the reservoir exceeds crest elevation
        but before/without a structural breach forming. Distinct from the breach
        outflow computed in breach.py."""
        h = self.elevation_m
        head = max(h - self.dam_crest_elevation_m, 0.0)
        if head <= 0:
            return 0.0
        return discharge_coeff * crest_length_m * head**1.5

    def step(
        self,
        dt_s: float,
        inflow_m3s: float,
        breach_outflow_m3s: float,
        seepage_m3s: float = 0.0,
        include_overtopping: bool = True,
    ) -> dict:
        """
        Advance reservoir mass balance by dt_s using explicit Euler with a
        sub-stepped correction so storage never goes negative (mass conservation
        is enforced exactly, not just approximately).
        """
        spill_q = self.spillway_outflow_m3s()
        over_q = self.overtopping_outflow_m3s() if include_overtopping else 0.0
        total_out = breach_outflow_m3s + spill_q + over_q + seepage_m3s

        dS = (inflow_m3s - total_out) * dt_s

        # Enforce non-negative storage: if outflow would drain more than
        # available, cap total_out for this step (can't release water that
        # doesn't exist).
        if self.storage_m3 + dS < 0:
            max_out_rate = (self.storage_m3 + inflow_m3s * dt_s) / dt_s
            scale = max(max_out_rate, 0.0) / max(total_out, 1e-9)
            breach_outflow_m3s *= scale
            spill_q *= scale
            over_q *= scale
            seepage_m3s *= scale
            total_out = breach_outflow_m3s + spill_q + over_q + seepage_m3s
            dS = (inflow_m3s - total_out) * dt_s

        self.storage_m3 = max(self.storage_m3 + dS, 0.0)
        self.time_s += dt_s

        return {
            "time_s": self.time_s,
            "elevation_m": self.elevation_m,
            "storage_m3": self.storage_m3,
            "inflow_m3s": inflow_m3s,
            "breach_outflow_m3s": breach_outflow_m3s,
            "spillway_outflow_m3s": spill_q,
            "overtopping_outflow_m3s": over_q,
            "seepage_m3s": seepage_m3s,
        }
