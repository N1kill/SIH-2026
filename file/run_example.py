"""
run_example.py
---------------
Minimal end-to-end smoke test: reservoir -> physically-based breach growth
-> near-field SPH jet -> a MOCK downstream grid (stand-in for your real
Delft3D-family solver, which should implement GridSolverAdapter for real
use) -> structural endurance check on one downstream bridge.

Run: python run_example.py
"""

import numpy as np
from reservoir import ReservoirState, StorageElevationCurve
from breach import PhysicallyBasedBreachGrowth, BreachGeometry, StructuralMaterial
from sph_breach import SPHBreachSolver, SPHParams
from coupling import BreachCouplingSimulation, StructuralObject


class MockGridAdapter:
    """Stand-in downstream solver: simple 1D diffusive-wave approximation
    just so the coupling pipeline is runnable end-to-end. Replace with a
    real adapter wrapping your validated in-house/Delft3D-family 2D solver."""

    def __init__(self, length_m=5000, dx_m=50):
        self.n = int(length_m / dx_m)
        self.dx = dx_m
        self.depth = np.zeros(self.n)
        self.q = np.zeros(self.n)
        self._boundary_q = 0.0
        self._boundary_v = 0.0

    def set_upstream_boundary(self, discharge_m3s, velocity_ms, x_m):
        self._boundary_q = discharge_m3s
        self._boundary_v = velocity_ms

    def step(self, dt_s):
        # crude kinematic-wave push: inject boundary discharge, translate
        # downstream with numerical diffusion (NOT a validated hydraulic
        # model -- purely to make the example runnable).
        self.q[0] = self._boundary_q
        width_m = 40.0
        self.depth[0] = self.q[0] / (width_m * max(self._boundary_v, 0.5))
        for i in range(1, self.n):
            self.depth[i] += 0.15 * (self.depth[i - 1] - self.depth[i])
        return {"max_depth_m": float(np.max(self.depth))}

    def water_depth_at(self, x_m, y_m):
        i = min(int(x_m / self.dx), self.n - 1)
        return float(self.depth[max(i, 0)])

    def velocity_at(self, x_m, y_m):
        i = min(int(x_m / self.dx), self.n - 1)
        v = self._boundary_v * 0.6  # attenuated downstream, crude placeholder
        return np.array([v, 0.0])

    def river_corridor_mask(self):
        return np.ones(self.n, dtype=bool)


def main():
    curve = StorageElevationCurve(bed_elevation_m=0.0, coeff=8000.0, exponent=1.7)
    reservoir = ReservoirState(
        curve=curve,
        dam_crest_elevation_m=30.0,
        spillway_crest_elevation_m=27.0,
        spillway_width_m=15.0,
        storage_m3=curve.elevation_to_storage(29.5),
    )

    material = StructuralMaterial(
        name="compacted_earthfill",
        critical_shear_stress_pa=25.0,
        erodibility_coeff=4.0e-5,
        ultimate_shear_capacity_pa=4000.0,
    )
    geometry = BreachGeometry(
        bottom_width_m=2.0,
        bottom_elevation_m=5.0,
        side_slope_h_per_v=1.0,
        dam_height_m=30.0,
    )
    breach = PhysicallyBasedBreachGrowth(
        material=material,
        geometry=geometry,
        dam_crest_elevation_m=30.0,
        initiation_elevation_m=28.5,
        # In a real run this comes from the DEM/surveyed channel-bed
        # elevation under the dam, not left to default to the initial
        # breach-bottom guess.
        valley_floor_elevation_m=3.0,
    )

    sph_params = SPHParams(particle_spacing_m=0.3)
    sph = SPHBreachSolver(sph_params)
    sph.add_boundary_line((-6, 0), (6, 0))  # channel bed at breach
    sph.add_boundary_line((-6, 0), (-6, 8))  # left wall stub

    grid = MockGridAdapter(length_m=5000, dx_m=50)

    sim = BreachCouplingSimulation(
        reservoir=reservoir,
        breach=breach,
        sph=sph,
        grid=grid,
        dam_length_m=120.0,
        breach_x_m=0.0,
    )
    sim.add_structure(
        StructuralObject(
            name="downstream_bridge",
            x_m=1500,
            y_m=0,
            frontal_area_m2=25.0,
            failure_force_kN=800.0,
        )
    )

    dt = 5.0  # seconds, macro coupling step
    inflow = 40.0  # m3/s baseflow into reservoir

    for step_i in range(15):
        rec = sim.step(dt, inflow_m3s=inflow)
        if step_i % 10 == 0:
            print(
                f"t={rec['time_s']:6.0f}s  "
                f"res_elev={rec['reservoir_elevation_m']:.2f}m  "
                f"breach_w={rec['breach_bottom_width_m']:.2f}m  "
                f"Q={rec['breach_outflow_m3s']:.1f}m3/s  "
                f"sph_v={rec['sph_mean_velocity_ms']:.2f}m/s  "
                f"particles={rec['sph_n_particles']}  "
                f"bridge_failed={rec['structures'][0]['failed']}"
            )

    print("\nDone. Final breach width:", sim.breach.geometry.bottom_width_m, "m")
    print("Final reservoir storage:", sim.reservoir.storage_m3, "m3")


if __name__ == "__main__":
    main()
