# SIH-2026 Pipeline Development Progress

## Active Phase
- All Phase deliverables completed.

## Log of Changes
- **2026-09-18**: 
  - Added `config.json` incorporating Panshet Dam for generalization testing.
  - Refactored `scripts/10_hydrodynamic_simulation.py` to accept CLI `--dam_config` and ingest PySPH output.
  - Created `scripts/10a_pysph_breach_zone.py` for bounded near-field SPH simulation (CPU OpenMP).
  - Created `scripts/10b_delft3d_comparison.py` generating `.mdf`/`.grd` and handling conditional execution of `delft3d`.
  - Updated `scripts/11_gee_flood_analysis.py` with Live GEE authentication and a headless fallback.
  - Rewrote `scripts/12_validation_and_sensitivity.py` to decouple scenarios by running genuine physics simulations over base parameters.
  - Created `server.py` FastAPI backend and augmented `outputs/3d/dashboard/index.html` with a New Simulation modal, gracefully degrading to offline mode if `file:///` protocol is detected.
  - Migrated physics modules (`reservoir.py`, `breach.py`, `sph_breach.py`) into `src/` and implemented `coupling.py`, `mock_grid.py`, and `physics_service.py` to orchestrate end-to-end simulation.
  - Updated `server.py` with WebSocket streaming `/ws/physics` and REST snapshot `/api/physics/snapshot`.
  - Upgraded frontend 3D Digital Twin (`app.js`, `index.html`, `style.css`) to consume backend WebSocket stream for live particle physics rendering, with offline fallback.
  - Fixed an issue where the WebGL render loop would crash during live mode due to an unhandled exception in `stepThreePhysics`, causing a black screen.
## Next Steps
- Verify execution of test suite or pipeline locally.
- Review and finalize documentation for submission.
  - Updated .gitignore to prevent massive simulation output files from triggering GitHub file size limits, and restaged commit.
