"""
mock_grid.py
------------
Stand-in downstream solver: simple 1D diffusive-wave approximation
just so the coupling pipeline is runnable end-to-end. Replace with a
real adapter wrapping your validated in-house/Delft3D-family 2D solver.

This is NOT a validated hydraulic model -- purely to make the pipeline
runnable for Phase 1 integration.
"""

from __future__ import annotations
import numpy as np


class MockGridAdapter:
    """Crude kinematic-wave placeholder for the downstream 2D solver."""

    def __init__(self, length_m: float = 5000, dx_m: float = 50):
        self.n = int(length_m / dx_m)
        self.dx = dx_m
        self.depth = np.zeros(self.n)
        self.q = np.zeros(self.n)
        self._boundary_q = 0.0
        self._boundary_v = 0.0

    def set_upstream_boundary(self, discharge_m3s: float, velocity_ms: float,
                               x_m: float) -> None:
        self._boundary_q = discharge_m3s
        self._boundary_v = velocity_ms

    def step(self, dt_s: float) -> dict:
        self.q[0] = self._boundary_q
        width_m = 40.0
        self.depth[0] = self.q[0] / (width_m * max(self._boundary_v, 0.5))
        for i in range(1, self.n):
            self.depth[i] += 0.15 * (self.depth[i - 1] - self.depth[i])
        return {"max_depth_m": float(np.max(self.depth))}

    def water_depth_at(self, x_m: float, y_m: float) -> float:
        i = min(int(x_m / self.dx), self.n - 1)
        return float(self.depth[max(i, 0)])

    def velocity_at(self, x_m: float, y_m: float) -> np.ndarray:
        v = self._boundary_v * 0.6
        return np.array([v, 0.0])

    def river_corridor_mask(self) -> np.ndarray:
        return np.ones(self.n, dtype=bool)
