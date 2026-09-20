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

## Log of Changes (continued)
- **2026-09-20**:
  - **Frontend pipeline data binding** (`outputs/3d/dashboard/app.js`, `index.html`):
    - Added `loadPipelineData()` async function in `app.js` that fetches `simulation_summary.json` and `validation_report.json` on startup.
    - Patches `PIPELINE_DATA.scenarios.base` fields (`q_peak`, `t_f`, `b_avg`, `morbi_peak_depth`, `morbi_arrival_time`, `morbi_peak_time`, `inund_area_km2`) from live pipeline JSON.
    - Patches all 4 monitoring station peak depths, arrival times, and peak times from `simulation_summary.json > monitoring_gauges`.
    - Patches all sensitivity scenario `morbi_peak_depth`, `inund_area_km2`, `q_peak`, `t_f`, `b_avg` from `validation_report.json > sensitivity_scenarios`.
    - Updates gauge sidebar subtexts (arrival/peak times) dynamically.
    - Updates all validation table metric spans (CSI, F1, Hit Rate, FAR, Overall Accuracy, Cohen's Kappa, pixel counts, Morbi simulated depth, relative error) from pipeline JSON.
    - Updates scenario selector buttons (depth label, meta line) from patched data.
    - Updates timeline playback markers from physics values.
    - Updates hero stats (peak discharge, grid resolution) from sim JSON.
    - Added IDs to all physics-sourced HTML elements in `index.html` for JS targeting.
    - Fallback: if JSON fetch fails, all hardcoded baseline values are used silently.
  - **2D simulation physics fixes** (`outputs/3d/dashboard/app.js`):
    - Extracted `gaugeDepthAtTime(t, arrival, peakTime, peakDepth, tauRec)` helper — power-law rising limb (exponent 1.4, matching SCS unit hydrograph shape) + physical exponential recession to 0 (no artificial floor).
    - Dam toe curve: was `(t/1.2) * morbi_depth * 3.5` (nonsensical); now uses `stations.dam_toe.peak_depth/peak_time` from pipeline JSON, tau derived from `V_res / Q_peak`.
    - Morbi recession floor: was `Math.max(1.0, ...)` (never went below 1m); now `Math.max(0.0, ...)` — physically drains.
    - Lilapar: was hardcoded `17.5h` arrival, `3.87m` peak, linear rise with no recession; now uses `stations.lilapar` pipeline data with full rise+recession.
    - Malia gauge: was never updated by `updateGaugesAtTime` (DOM element existed but value was always stale); now fully computed.
    - All gauge bar fill widths: replaced hardcoded `22.56` and `3.87` denominators with dynamic `stationPeak` values.
    - Velocity HUD: replaced `Math.min(12.0, 1.5 + Q/Qpeak * 9.5)` with `maxVel * (Q/Qpeak)^0.6` (Manning power law scaling), `maxVel` from pipeline `metrics.max_velocity_ms`.
    - Q discharge floor: removed `Math.max(450.0, ...)` — reservoir now physically empties; tau = `V_res / Q_peak` hours.
    - GeoJSON opacity: now scales with `dMorbi / morbiPeak` (proportional to actual flood extent) instead of `t / 12.0`.
    - `updatePhaseDescription`: all 6 phase thresholds now driven by `sc.t_f`, `sc.morbi_arrival_time`, `sc.morbi_peak_time`, `stations.lilapar.arrival` — fully scenario-aware.
    - `PIPELINE_DATA._maxVelocity` set from `sim.metrics.max_velocity_ms` in loader.


