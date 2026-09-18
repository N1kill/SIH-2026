# Dam-Break Physics Backend

Physically-based backend for the dam-break simulation pipeline (SPH breach jet +
reservoir/breach/downstream-grid coupling + structural endurance checks),
scoped per PS26161-Round2-Gap-Checklist.md's recommendation: SPH at the
breach zone only, coupled into your existing far-field grid solver.

## Files

- `reservoir.py` — reservoir mass balance (dS/dt = inflow - breach - spillway -
  overtopping - seepage), storage-elevation curve, hard non-negative-storage
  enforcement (conservation of volume).
- `breach.py` — two breach-growth models:
  - `ParametricBreachGrowth`: Froehlich-style final geometry + smoothstep
    growth to a time-to-failure (matches your validated peak-discharge
    numbers, cheap).
  - `PhysicallyBasedBreachGrowth`: excess-shear erosion ODE driven by
    `StructuralMaterial` endurance limits (critical shear stress = erosion
    onset, ultimate shear capacity = instant geotechnical collapse of a
    breach-wall slice). This is the one that should feed the SPH solver so
    geometry and near-field hydraulics stay mechanically consistent.
- `sph_breach.py` — from-scratch WCSPH (Tait EOS, cubic-spline kernel,
  artificial viscosity, symplectic integration, uniform-grid neighbor
  search) for the near-field breach jet/spray only. Exposes
  `outflow_flux()` — real particle-scale flux/velocity/spray statistics —
  as the boundary condition for the far-field grid.
- `coupling.py` — `BreachCouplingSimulation` ties reservoir + breach + SPH
  to `GridSolverAdapter`, a thin interface your existing downstream
  Delft3D-family 2D solver should implement (one integration point, not a
  reimplementation of your grid solver). Also implements `StructuralObject`
  — drag-force based endurance limits on bridges/buildings/walls, checked
  every step against local depth/velocity from the grid.
- `run_example.py` — runnable end-to-end smoke test with a `MockGridAdapter`
  stand-in. Replace `MockGridAdapter` with a real adapter wrapping your
  validated in-house 2D solver (or a real Delft3D run) before using this for
  anything beyond a wiring test.

## Physical constraints enforced

- **Reservoir**: storage can't go negative; outflows are scaled down within
  a timestep if they'd release more water than exists (exact mass
  conservation, not approximate).
- **Breach**: capped at `dam_length_m` (can't erode wider than the dam's
  physical footprint); erosion only occurs once computed shear stress
  exceeds the material's `critical_shear_stress_pa`; instant slice collapse
  only once shear exceeds `ultimate_shear_capacity_pa`.
- **River/valley boundary**: `GridSolverAdapter.river_corridor_mask()` is
  the hook for clipping any flow that would otherwise leak outside the real
  terrain/valley polygon due to solver numerical noise.
- **Structures**: fail only when computed hydrodynamic drag force
  (0.5·ρ·Cd·A·v²) reaches the object's `failure_force_kN` — not merely when
  water reaches them.

## What's genuinely modeled vs. simplified (be honest about this at judging)

- Reservoir mass balance, weir/orifice breach outflow, erosion-ODE breach
  growth, and structural drag-failure are standard, defensible hydraulic/
  geotechnical formulations.
- The SPH solver is a real (not toy) WCSPH implementation, but the boundary-
  particle repulsion is a simple penalty method, not a full no-slip wall
  condition — adequate for a breach-zone jet/spray visualization, not for
  publishing SPH validation results without further tuning.
- `MockGridAdapter` in `run_example.py` is a placeholder kinematic-wave
  stand-in purely so the pipeline is runnable end-to-end — it is NOT your
  validated downstream solver. Wire `GridSolverAdapter` to your actual
  in-house 2D grid solver (or Delft3D output) before treating any of this
  example's downstream numbers as real.
- Discharge coefficients, Manning's n, erodibility coefficients, and
  material shear thresholds are representative literature values, not
  site-calibrated for Machhu-II or any specific dam — flag them as
  assumptions in your report per Appendix B of your documentation.

## Fixed after external review (2nd pass)

An independent review caught three real problems, not just style issues.
All three are fixed in this version, not just re-explained:

1. **Dead-code bug in `breach.py`**: the valley-floor floor on breach
   deepening was `max(x, x)` — a no-op. Fixed: `PhysicallyBasedBreachGrowth`
   now takes an explicit `valley_floor_elevation_m` (from DEM/surveyed
   channel bed in a real run) and clamps against *that*, not against
   itself.
2. **Reservoir and SPH weren't sharing one mass budget.** The old code
   re-seeded the SPH domain to match the *current head* every step
   (independent of how much water the reservoir had actually lost), then
   computed a second, competing discharge from SPH and blended it with the
   hydraulic estimate via `np.clip(ratio, 0.5, 2.0)` — an arbitrary
   reconciliation with no physical justification. Fixed: the weir/orifice
   breach-hydraulics equation is now the single source of truth for how
   much water leaves the reservoir; that exact volume is injected into SPH
   as a mass source each step (no independent re-seeding); SPH is used
   only to resolve the velocity/spray *structure* of that same flow, which
   is what actually gets passed to the downstream grid boundary alongside
   the mass-consistent discharge.
3. **Cold-start handling**: before SPH has particles at the measurement
   gate, velocity now falls back to a Q/A hydraulic estimate instead of
   silently reporting 0.

This does **not** turn the erosion-shear model into a validated breach
model, and does **not** replace `MockGridAdapter` with a real solver —
those are still open items below.

## Still open (not yet done)

- `PhysicallyBasedBreachGrowth`'s shear-stress erosion law is a Manning-based
  surrogate; it does not represent headcut migration, piping, or side-slope
  geotechnical failure mechanics beyond the single instant-collapse check.
  Treat it as a defensible prototype mechanism, not a validated breach model.
- SPH boundary treatment is still a simple penalty method, not a rigorous
  no-slip condition, and the solver has not been benchmarked against a
  standard dam-break test case (e.g. Martin & Moyce, or a SWASHES/DamBreak
  benchmark) — do that before citing specific SPH numbers.
- `MockGridAdapter` is still a placeholder; wire `GridSolverAdapter` to your
  real in-house/Delft3D-family solver before treating downstream numbers as
  real.
- Discharge/erodibility/material coefficients remain representative
  literature values, not Machhu-II-calibrated.

## Quick start

```bash
pip install numpy
python run_example.py
```
