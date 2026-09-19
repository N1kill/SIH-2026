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

## Next Steps
- Verify execution of test suite or pipeline locally.
- Review and finalize documentation for submission.

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
