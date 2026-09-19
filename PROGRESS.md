# SIH-2026 Pipeline Development Progress

## Active Phase
- Integrated digital-twin scenario laboratory implemented; scientific evidence and
  rendered-browser validation remain the active limitations.

## 2026-09-19 implementation directive run

- Repaired repository agent discovery and scope: root policy is authoritative, local
  skills are opt-in, all 24 entrypoints validate, and the standalone UI skill now
  skips two upstream-harness-only suites explicitly rather than failing discovery.
- Added strict reusable project/scenario schemas, common UTM/local coordinates,
  DEM/imagery terrain caching, near-dam detail, and evidence-aware reconstruction.
- Added a cancellable single-run FastAPI lifecycle, versioned WebSocket replay,
  conservative DEM routing, mass diagnostics, risk/facility screening, and per-run GIS
  exports. Disabled the legacy mock-grid live endpoints.
- Added an offline Three.js dashboard with scenario controls, camera/layer modes,
  dynamic breach/flood rendering, replay, comparison, and export.
- Acquired and attributed bounded Sentinel-2 RGB and OSM facility candidates. Rejected
  a mapped dam way 2.0 km from the configured site rather than treating it as evidence.
- Verified run `3c0b4222d8924e29a98d6816f48cfaa6`: 1,800 simulated seconds,
  61 frames, all GIS outputs, 59 candidate facilities screened, `-1.08e-13%` mass
  residual, 0.95-second wall time on the current machine.
- Verified installed D-Flow FM using the stored hydrograph: seven NetCDF map frames with
  water depth/velocity. The comparison remains uncalibrated and reported warnings.
- Added 12 numerical/API/WebSocket tests; all pass, including a what-if response
  regression. Frontend build/syntax and Compose configuration validation pass.
- Added Docker packaging, but Docker Desktop's Linux engine was stopped during the
  build check. Browser visual QA was unavailable because no browser surface was
  connected.
- See `IMPLEMENTATION_CHECKLIST.md` and `docs/REQUIREMENTS_STATUS.md` for the live
  completion ledger and exact external-data gaps.

## 2026-09-20 evidence-backed reconstruction and Docker verification

- Reviewed 252 web-search result slots across four workstreams and retained eight
  hashed evidence records with explicit licenses/status/uncertainty.
- Identified a critical coordinate conflict: the configured point is near Morbi, while
  official coarse coordinates and Sentinel imagery place the dam near 22.7667 N,
  70.8661 E. The approved project remains unchanged.
- Downloaded an attributed Sentinel-2 candidate crop and digitized an unapproved
  4.882 km crest/spillway axis, close to the 4.930 km India-WRIS inventory length.
- Added an evidence manifest, DEM-derived shoreline/stage-storage draft, hash
  validation, and an explicit named-human approval gate.
- Docker image build and live deployment pass. The first startup exposed a missing
  Rasterio `libexpat1` dependency; after correction, health, dashboard, reconstruction
  draft, and preview endpoints all returned HTTP 200.

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
- Perform rendered desktop/mobile visual QA when a browser surface is available.
- Obtain named human approval before promoting the approximate reconstruction draft
  into `data/projects/machhu-ii.json`.
- Replace approximate geometry and validation placeholders only when surveyed or
  attributable evidence becomes available.
  - Updated .gitignore to prevent massive simulation output files from triggering GitHub file size limits, and restaged commit.

---

## Log of Changes (continued)
- **2026-09-19**:
  - **Performance optimization**: Rewrote the 2D diffusive-wave routing solver in `scripts/10_hydrodynamic_simulation.py` using `numba.njit(parallel=True)`.
    - Extracted the inner 8-direction routing loop into `diffusive_wave_step()`, decorated with `@njit(parallel=True)` — eliminates all Python interpreter overhead and temporary NumPy array allocations inside the hot path.
    - Replaced the Python-level `for (dr, dc), dist in directions` loop (8 passes over the grid per substep, each allocating `neighbor_wse`, `flux`, `scale`, `d_vol` arrays) with a single Numba-compiled kernel that runs in parallel across rows.
    - Removed the PySPH file-existence `os.path.is_file()` check from inside the main simulation loop (was executing 1000s of disk I/O syscalls per run) — pre-loads all PySPH boundary conditions into a dict before the loop begins.
    - Used `np.ascontiguousarray()` to ensure Numba receives C-contiguous arrays for correct memory layout.
    - Removed dead `directions` list that was no longer referenced.
  - Fixed `scripts/12_validation_and_sensitivity.py`: sensitivity analysis was still running each of its 5 scenarios at 24h (`duration_hours=24.0`), changed to `duration_hours=8.0` for consistency.
  - **Digital twin de-hardcoding** (scripts 10 & 12):
    - `scripts/10_hydrodynamic_simulation.py`: replaced hardcoded station color dict keyed by Machhu-specific names with a dynamic palette; historical flood benchmark now read from `nrld_machhu.csv` (with 3.0m fallback); `xlim` on hydrograph plot now uses actual simulation duration instead of `24`.
    - `scripts/12_validation_and_sensitivity.py`: sensitivity scenarios now read base breach parameters (`B_avg`, `t_f`, `Q_p`, `Z_HV`) live from `breach_params.json` (Directive 4 output) instead of hardcoded values; config key auto-selects first dam in `config.json`; primary downstream gauge resolved from config's `downstream_stations[1]` instead of hardcoded `"morbi"`.
