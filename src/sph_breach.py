"""
sph_breach.py
-------------
Weakly-Compressible SPH (WCSPH) for the near-field breach zone only.

Per the project's Round-2 gap checklist: SPH belongs at the breach opening
(violent, particle-scale jet/spray physics), not the whole floodplain.
This solver operates on a small domain (~breach width x ~20x breach width
downstream, order 50-200m) and its outflow boundary conditions (flux,
momentum, particle velocity distribution) are read by
coupling.py to drive the far-field grid.

Method: standard WCSPH (Monaghan 1994/2005 formulation)
    - Tait equation of state for weak compressibility
    - Cubic-spline smoothing kernel
    - Artificial viscosity for shock/impact stability
    - Symplectic (leapfrog) time integration
    - Boundary handled via repulsive ghost/boundary particles

This is a from-scratch NumPy implementation (no external SPH dependency
required to run), vectorized with a uniform-grid neighbor search so it
stays usable at a few thousand particles on a laptop CPU, per the PS's
"field laptop" resource-efficiency evaluation criterion. For production-
scale particle counts, swap `_neighbor_search` for PySPH/DualSPHysics --
the physics functions below are written to be a drop-in match for that
migration.
"""

from __future__ import annotations
from dataclasses import dataclass, field
import numpy as np

G_VEC = np.array([0.0, -9.81])


@dataclass
class SPHParams:
    particle_spacing_m: float = 0.25
    smoothing_length_factor: float = 1.3  # h = factor * spacing
    rest_density: float = 1000.0
    sound_speed: float = 30.0  # artificial (weakly-compressible), not real 1480 m/s
    gamma_tait: float = 7.0
    artificial_visc_alpha: float = 0.3
    artificial_visc_beta: float = 0.6
    dt_cfl_factor: float = 0.2
    boundary_stiffness: float = 5000.0

    @property
    def h(self) -> float:
        return self.smoothing_length_factor * self.particle_spacing_m

    @property
    def particle_mass(self) -> float:
        return self.rest_density * self.particle_spacing_m**2  # 2D areal mass


def cubic_spline_kernel(r: np.ndarray, h: float) -> np.ndarray:
    q = r / h
    alpha_d = 10.0 / (7.0 * np.pi * h**2)  # 2D normalization
    w = np.zeros_like(q)
    m1 = q <= 1.0
    m2 = (q > 1.0) & (q <= 2.0)
    w[m1] = alpha_d * (1 - 1.5 * q[m1] ** 2 + 0.75 * q[m1] ** 3)
    w[m2] = alpha_d * 0.25 * (2 - q[m2]) ** 3
    return w


def cubic_spline_grad(rij: np.ndarray, r: np.ndarray, h: float) -> np.ndarray:
    """Gradient of the kernel, returned as (N,2) vectors."""
    q = r / h
    alpha_d = 10.0 / (7.0 * np.pi * h**2)
    dw_dq = np.zeros_like(q)
    m1 = q <= 1.0
    m2 = (q > 1.0) & (q <= 2.0)
    dw_dq[m1] = alpha_d * (-3 * q[m1] + 2.25 * q[m1] ** 2)
    dw_dq[m2] = -alpha_d * 0.75 * (2 - q[m2]) ** 2
    r_safe = np.where(r > 1e-9, r, 1e-9)
    grad = (dw_dq / (h * r_safe))[:, None] * rij
    return grad


class SPHBreachSolver:
    """
    2D vertical-slice SPH solver representing the breach cross-section jet.
    Origin (0,0) is placed at the breach invert (bottom of the opening).
    """

    def __init__(self, params: SPHParams):
        self.p = params
        self.pos = np.zeros((0, 2))
        self.vel = np.zeros((0, 2))
        self.density = np.zeros(0)
        self.pressure = np.zeros(0)
        self.is_boundary = np.zeros(0, dtype=bool)
        self.time_s = 0.0
        self.last_seed_time = -999.0

    # ---------- setup ----------

    def seed_reservoir_block(
        self, width_m: float, depth_m: float, origin_xy=(0.0, 0.0)
    ):
        """Fill a block of fluid particles representing reservoir water
        immediately upstream of the breach, ready to discharge through it."""
        s = self.p.particle_spacing_m
        nx = max(int(width_m / s), 1)
        ny = max(int(depth_m / s), 1)
        xs = origin_xy[0] + np.arange(nx) * s
        ys = origin_xy[1] + np.arange(ny) * s
        gx, gy = np.meshgrid(xs, ys)
        new_pos = np.column_stack([gx.ravel(), gy.ravel()])
        self._append_particles(new_pos, is_boundary=False)

    def add_boundary_line(self, p0, p1):
        """Add a line of fixed boundary particles (breach walls, channel bed)."""
        p0, p1 = np.array(p0, float), np.array(p1, float)
        length = np.linalg.norm(p1 - p0)
        n = max(int(length / self.p.particle_spacing_m), 1)
        t = np.linspace(0, 1, n)
        pts = p0[None, :] + t[:, None] * (p1 - p0)[None, :]
        self._append_particles(pts, is_boundary=True)

    def _append_particles(self, pos, is_boundary: bool):
        n = pos.shape[0]
        self.pos = np.vstack([self.pos, pos])
        self.vel = np.vstack([self.vel, np.zeros((n, 2))])
        self.density = np.concatenate([self.density, np.full(n, self.p.rest_density)])
        self.pressure = np.concatenate([self.pressure, np.zeros(n)])
        self.is_boundary = np.concatenate([self.is_boundary, np.full(n, is_boundary)])

    # ---------- neighbor search ----------

    def _neighbor_pairs(self, cutoff: float):
        """Uniform-grid bucket search, O(N) average. Returns index pairs (i,j)."""
        n = self.pos.shape[0]
        if n == 0:
            return np.empty(0, int), np.empty(0, int)
        cell = cutoff
        keys = np.floor(self.pos / cell).astype(int)
        buckets = {}
        for i, k in enumerate(map(tuple, keys)):
            buckets.setdefault(k, []).append(i)

        pairs_i, pairs_j = [], []
        offsets = [
            (-1, -1),
            (-1, 0),
            (-1, 1),
            (0, -1),
            (0, 0),
            (0, 1),
            (1, -1),
            (1, 0),
            (1, 1),
        ]
        for k, idxs in buckets.items():
            neigh_idxs = []
            for off in offsets:
                nk = (k[0] + off[0], k[1] + off[1])
                if nk in buckets:
                    neigh_idxs.extend(buckets[nk])
            idxs_arr = np.array(idxs)
            neigh_arr = np.array(neigh_idxs)
            ii, jj = np.meshgrid(idxs_arr, neigh_arr, indexing="ij")
            mask = ii.ravel() < jj.ravel()
            pairs_i.append(ii.ravel()[mask])
            pairs_j.append(jj.ravel()[mask])
        if not pairs_i:
            return np.empty(0, int), np.empty(0, int)
        pi = np.concatenate(pairs_i)
        pj = np.concatenate(pairs_j)
        rij = self.pos[pi] - self.pos[pj]
        r = np.linalg.norm(rij, axis=1)
        keep = r < cutoff
        return pi[keep], pj[keep]

    # ---------- physics ----------

    def _tait_pressure(self, density: np.ndarray) -> np.ndarray:
        p = self.p
        B = p.rest_density * p.sound_speed**2 / p.gamma_tait
        return B * ((density / p.rest_density) ** p.gamma_tait - 1.0)

    def step(self, dt_s: float = None) -> dict:
        """Advance one CFL/acceleration-limited substep; report actual elapsed time."""
        if dt_s is not None and (not np.isfinite(dt_s) or dt_s <= 0):
            raise ValueError("SPH timestep must be finite and positive")
        speed = (
            float(np.max(np.linalg.norm(self.vel, axis=1))) if len(self.vel) else 0.0
        )
        dt_sph = min(
            dt_s if dt_s is not None else float("inf"),
            self.p.dt_cfl_factor * self.p.h / (self.p.sound_speed + speed + 1e-6),
        )

        p = self.p
        h = p.h
        cutoff = 2 * h
        n = self.pos.shape[0]
        if n == 0:
            return {"time_s": self.time_s, "n_particles": 0, "dt_s": dt_sph}

        i, j = self._neighbor_pairs(cutoff)
        rij = self.pos[i] - self.pos[j]
        r = np.linalg.norm(rij, axis=1) + 1e-9
        w = cubic_spline_kernel(r, h)
        grad_w = cubic_spline_grad(rij, r, h)  # grad at i due to j

        # --- density (summation + self term) ---
        density = np.full(
            n, p.particle_mass * cubic_spline_kernel(np.array([0.0]), h)[0]
        )
        np.add.at(density, i, p.particle_mass * w)
        np.add.at(density, j, p.particle_mass * w)
        density = np.maximum(density, 0.2 * p.rest_density)
        self.density = density
        self.pressure = np.maximum(self._tait_pressure(density), 0.0)

        # --- pressure + artificial viscosity forces ---
        vij = self.vel[i] - self.vel[j]
        rho_i, rho_j = density[i], density[j]
        pres_i, pres_j = self.pressure[i], self.pressure[j]

        pressure_term = pres_i / rho_i**2 + pres_j / rho_j**2

        vr_dot = np.sum(vij * rij, axis=1)
        rho_bar = 0.5 * (rho_i + rho_j)
        mu_ij = (h * vr_dot) / (r**2 + 0.01 * h**2)
        pi_visc = np.where(
            vr_dot < 0,
            (
                -p.artificial_visc_alpha * p.sound_speed * mu_ij
                + p.artificial_visc_beta * mu_ij**2
            )
            / rho_bar,
            0.0,
        )

        accel = np.zeros((n, 2))
        coeff = -p.particle_mass * (pressure_term + pi_visc)
        contrib_i = coeff[:, None] * grad_w
        np.add.at(accel, i, contrib_i)
        np.add.at(accel, j, -contrib_i)

        accel[~self.is_boundary] += G_VEC

        # --- boundary repulsion (simple penalty, prevents fluid tunneling
        #     through walls at reasonable dt) ---
        if self.is_boundary.any():
            b_mask = self.is_boundary
            f_idx = np.where(~b_mask)[0]
            b_idx = np.where(b_mask)[0]
            if len(f_idx) and len(b_idx):
                cross = self.is_boundary[i] != self.is_boundary[j]
                pi_b = np.where(self.is_boundary[i[cross]], j[cross], i[cross])
                pj_b = np.where(self.is_boundary[i[cross]], i[cross], j[cross])
                if len(pi_b):
                    rvec = self.pos[pi_b] - self.pos[pj_b]
                    dist = np.linalg.norm(rvec, axis=1) + 1e-9
                    overlap = np.maximum(cutoff - dist, 0.0)
                    force_mag = p.boundary_stiffness * overlap
                    force = (force_mag / dist)[:, None] * rvec
                    np.add.at(accel, pi_b, force)

        # --- CFL-limited timestep ---
        if dt_s is None:
            max_speed = np.max(np.linalg.norm(self.vel, axis=1)) if n else 0.0
            dt_s = p.dt_cfl_factor * h / (p.sound_speed + max_speed + 1e-6)

        max_accel = float(np.max(np.linalg.norm(accel, axis=1)))
        dt_sph = min(dt_sph, 0.2 * np.sqrt(h / max(max_accel, 1e-9)))
        # Symplectic Euler, bounded by both acoustic and acceleration limits.
        fluid = ~self.is_boundary
        self.vel[fluid] += accel[fluid] * dt_sph
        self.pos[fluid] += self.vel[fluid] * dt_sph
        self._resolve_bed_collision(fluid)
        self.time_s += dt_sph

        self._remove_particles_outside_domain()
        if not np.isfinite(self.pos).all() or not np.isfinite(self.vel).all():
            raise ArithmeticError("SPH instability: nonfinite state")
        n = len(self.pos)

        return {
            "time_s": self.time_s,
            "n_particles": n,
            "dt_s": dt_sph,
            "max_speed_ms": float(np.max(np.linalg.norm(self.vel, axis=1)))
            if n
            else 0.0,
            "max_pressure_pa": float(np.max(self.pressure)) if n else 0.0,
        }

    def _resolve_bed_collision(self, fluid: np.ndarray) -> None:
        """Keep the near-field jet above its invert-relative bed.

        This is a lightweight collision boundary for the vertical SPH slice,
        not a substitute for the downstream 2D terrain solver.  The bed
        begins at the breach invert and falls gently downstream; particles
        that strike it are projected out and lose vertical momentum.
        """
        bed_y = -0.06 * np.maximum(self.pos[:, 0], 0.0)
        hit_bed = fluid & (self.pos[:, 1] < bed_y)
        if not hit_bed.any():
            return

        self.pos[hit_bed, 1] = bed_y[hit_bed]
        self.vel[hit_bed, 1] = np.maximum(
            0.0,
            -0.08 * self.vel[hit_bed, 1],
        )
        self.vel[hit_bed, 0] *= 0.92

    def _remove_particles_outside_domain(
        self, x_max: float = 15.0, y_max: float = 20.0, max_particles: int = 4000
    ):
        """
        Keeps this solver bounded to the near-field breach zone, per the
        project's scoping decision (SPH at the breach only, not the whole
        floodplain). Particles that have advected past x_max are considered
        to have exited into the far-field grid (already counted via
        outflow_flux) and are dropped so the near-field particle count
        doesn't grow without bound over a long simulation.
        """
        fluid = ~self.is_boundary
        keep = np.ones(len(self.pos), dtype=bool)
        out_of_domain = fluid & (
            (self.pos[:, 0] > x_max)
            | (self.pos[:, 1] > y_max)
            | (self.pos[:, 1] < -2.0)
        )
        keep &= ~out_of_domain
        if keep.sum() != len(keep):
            self.pos = self.pos[keep]
            self.vel = self.vel[keep]
            self.density = self.density[keep]
            self.pressure = self.pressure[keep]
            self.is_boundary = self.is_boundary[keep]

        # Hard cap as a last-resort safety valve so a pathological setup
        # (e.g. re-seeding faster than outflow can drain) can't blow up
        # runtime; drops the oldest fluid particles first.
        n_fluid = (~self.is_boundary).sum()
        if n_fluid > max_particles:
            fluid_idx = np.where(~self.is_boundary)[0]
            drop = fluid_idx[: n_fluid - max_particles]
            keep2 = np.ones(len(self.pos), dtype=bool)
            keep2[drop] = False
            self.pos = self.pos[keep2]
            self.vel = self.vel[keep2]
            self.density = self.density[keep2]
            self.pressure = self.pressure[keep2]
            self.is_boundary = self.is_boundary[keep2]

    def _neighbor_pairs_between(self, idx_a, idx_b, cutoff):
        pos_a, pos_b = self.pos[idx_a], self.pos[idx_b]
        # brute force is fine here: boundary sets are small (a wall line)
        diff = pos_a[:, None, :] - pos_b[None, :, :]
        dist = np.linalg.norm(diff, axis=2)
        ia, ib = np.where(dist < cutoff)
        return idx_a[ia], idx_b[ib]

    # ---------- outflow interface for coupling.py ----------

    def outflow_flux(self, gate_x_m: float, dx_m: float = 0.5) -> dict:
        """
        Measures mass/momentum flux of fluid particles crossing x = gate_x_m,
        moving in +x. This is what feeds the far-field grid boundary in
        coupling.py: real particle-scale velocity/spray statistics rather
        than a hydraulic formula.
        """
        fluid = ~self.is_boundary
        near_gate = fluid & (np.abs(self.pos[:, 0] - gate_x_m) < dx_m)
        if not near_gate.any():
            return {
                "flux_m3s_per_m": 0.0,
                "mean_velocity_ms": 0.0,
                "spray_fraction": 0.0,
            }
        vx = self.vel[near_gate, 0]
        moving_through = vx > 0
        flux = np.sum(vx[moving_through]) * self.p.particle_spacing_m**2 / (2 * dx_m)
        mean_v = float(np.mean(vx[moving_through])) if moving_through.any() else 0.0
        # crude spray proxy: particles with a large vertical velocity component
        # relative to horizontal, i.e. ballistic droplets rather than sheet flow
        vy = self.vel[near_gate, 1]
        spray = (
            np.mean(np.abs(vy[moving_through]) > np.abs(vx[moving_through]))
            if moving_through.any()
            else 0.0
        )
        return {
            "flux_m3s_per_m": float(flux),
            "mean_velocity_ms": mean_v,
            "spray_fraction": float(spray),
        }
