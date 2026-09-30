"""Conservative finite-volume diffusive-wave approximation on a metric DEM.

Inertia is neglected; this is a screening model, not a validated shock-resolving
dam-break solver. Closed domain boundaries retain water and are reported.
"""

import numpy as np


class FloodRouter:
    def __init__(self, terrain, manning_n=0.04, wet_depth=0.1):
        self.terrain = terrain
        self.bed = terrain.elevation
        self.valid = terrain.valid.copy()
        self.depth = np.zeros_like(self.bed)
        self.velocity = np.zeros_like(self.bed)
        self.max_depth = self.depth.copy()
        self.max_velocity = self.depth.copy()
        self.arrival = np.full_like(self.bed, -1)
        self.duration = self.depth.copy()
        self.dx = terrain.transform.a
        self.n = manning_n
        self.wet_depth = wet_depth
        self.time = 0.0
        self.injected = 0.0

    def step(self, dt, discharge, cancelled=lambda: False):
        remaining = dt
        while remaining > 1e-9:
            if cancelled():
                raise InterruptedError("Simulation cancelled")
            surface = self.bed + self.depth
            sx = (surface[:, :-1] - surface[:, 1:]) / self.dx
            sy = (surface[:-1, :] - surface[1:, :]) / self.dx
            hx = np.maximum(
                np.maximum(surface[:, :-1], surface[:, 1:])
                - np.maximum(self.bed[:, :-1], self.bed[:, 1:]),
                0,
            )
            hy = np.maximum(
                np.maximum(surface[:-1, :], surface[1:, :])
                - np.maximum(self.bed[:-1, :], self.bed[1:, :]),
                0,
            )
            ux = np.sign(sx) * np.sqrt(np.abs(sx)) * hx ** (2 / 3) / self.n
            uy = np.sign(sy) * np.sqrt(np.abs(sy)) * hy ** (2 / 3) / self.n
            qx = ux * hx * self.dx * (self.valid[:, :-1] & self.valid[:, 1:])
            qy = uy * hy * self.dx * (self.valid[:-1, :] & self.valid[1:, :])
            speed = max(float(np.max(np.abs(ux))), float(np.max(np.abs(uy))), 1.0)
            sub = min(
                remaining,
                0.2 * self.dx / (speed + np.sqrt(9.81 * float(self.depth.max()))),
            )
            if sub < 1e-7:
                raise ArithmeticError(
                    "Routing timestep collapsed; reduce forcing or refine inputs"
                )
            self.depth[self.terrain.source_cell] += discharge * sub / self.dx**2
            self.injected += discharge * sub
            outgoing = np.zeros_like(self.depth)
            outgoing[:, :-1] += np.maximum(qx, 0)
            outgoing[:, 1:] += np.maximum(-qx, 0)
            outgoing[:-1, :] += np.maximum(qy, 0)
            outgoing[1:, :] += np.maximum(-qy, 0)
            scale = np.minimum(
                1.0, self.depth * self.dx**2 / np.maximum(outgoing * sub, 1e-30)
            )
            qx *= np.where(qx >= 0, scale[:, :-1], scale[:, 1:])
            qy *= np.where(qy >= 0, scale[:-1, :], scale[1:, :])
            delta = np.zeros_like(self.depth)
            delta[:, :-1] -= qx
            delta[:, 1:] += qx
            delta[:-1, :] -= qy
            delta[1:, :] += qy
            self.depth += delta * sub / self.dx**2
            if not np.isfinite(self.depth).all() or self.depth.min() < -1e-8:
                raise ArithmeticError("Nonfinite or negative routing depth")
            self.depth = np.maximum(self.depth, 0)
            vx = np.zeros_like(self.depth)
            vy = vx.copy()
            vx[:, :-1] += qx
            vx[:, 1:] += qx
            vy[:-1, :] += qy
            vy[1:, :] += qy
            self.velocity = np.where(
                self.depth >= self.wet_depth,
                np.hypot(vx, vy)
                / (2 * self.dx * np.maximum(self.depth, self.wet_depth)),
                0,
            )
            self.time += sub
            wet = self.depth >= self.wet_depth
            self.arrival[(self.arrival < 0) & wet] = self.time
            self.duration[wet] += sub
            self.max_depth = np.maximum(self.max_depth, self.depth)
            self.max_velocity = np.maximum(self.max_velocity, self.velocity)
            remaining -= sub

    @property
    def volume(self):
        return float(self.depth.sum() * self.dx**2)
