# SIH-2026 Pipeline Development Progress

## 2026-09-22 — scene connector milestone; visual acceptance still open

- Added official-SDK MCP stdio connector with list/read/validate/import tools and
  schema resources. Immutable package imports enforce hashes, local path containment,
  embedded GLB resources and explicit provenance; no scientific project changes.
- Added `/studio.html`, linked from the dashboard, and reusable `DamScenePlugin`
  supporting GLB/PBR, Draco, Meshopt, embedded KTX2, HDR environments and explicit
  gate-state inputs. Built-in spillway is a labelled architectural reconstruction.
- Seven focused tests passed, including real MCP subprocess roundtrip and API tests.
- Broader unittest discovery: 39 passed. JavaScript syntax checks, a gate-replay
  module test, and the frontend build passed. Exact 1440 px / 390 px headless checks
  passed without horizontal overflow or console/shader errors. These software-rendered
  captures are not target-GPU performance measurements or reference-quality approval.
- Prior whole-plan completion claim withdrawn. Main-dashboard saved-run integration,
  reference-quality material/water refinement, LOD review and GPU acceptance remain.

## Active Phase
- Integrated digital-twin scenario laboratory implemented and rendered in desktop
  and narrow browser captures; external structural evidence and qualified engineering
  acceptance remain the active limitations.

## 2026-09-22 high-fidelity renderer completion

- Replaced the flat single-material strip and rectangular engineering reservoir with
  a stable multi-surface earthfill assembly, crest surface, toe treatment, masked
  stage-responsive reservoir geometry, deterministic procedural PBR materials,
  atmospheric lighting, and discharge-scaled hydraulic flow sheets.
- Added automatic crest-path dimension checking, visible structural availability and
  reconstruction status, a synchronized reservoir/breach/release history chart, and
  a data-driven optional spillway/gate builder that remains hidden when the project
  lacks approved geometry.
- Completed desktop and 390 px rendered-browser review using local Chrome/SwiftShader.
  The final desktop capture rendered the masked reservoir and reconstructed dam at
  1:1 scale; narrow-layout overflow was corrected. All 32 Python tests and frontend
  syntax checks pass. No claim is made for external visual-reference approval or
  qualified hydraulic/geotechnical acceptance.

## 2026-09-21 coupled physics replay

- Routed breach, configured spillway, and crest-overtopping releases through one
  conservative reservoir/downstream mass ledger; added exact water-level and
  spillway what-if overrides without changing approved project data.
- Expanded replay frames with hydraulic head, pressure, force, material shear,
  erosion rate, collapse threshold, wetted/full breach geometry, component flows,
  reservoir area, and water-level trend.
- Rebuilt the Three.js dam opening at the configured dam location with adaptive
  crest resolution and trapezoidal side slopes. Added discharge-scaled release jets,
  pressure/material telemetry, and a per-project initially wetted notch suggestion.
- Verified a live Machhu-II erosion run at 47.47 m³/s peak discharge with a
  `1.67e-14%` mass residual. All 31 repository tests pass in the Linux image;
  frontend syntax and diff checks pass. Browser screenshot QA remains unavailable
  because no browser surface is connected to the automation environment.

## 2026-09-20 generic dam evidence agent

- Replaced unreliable local-model delegation with a bounded four-topic Ollama
  search/read/extract/archive workflow. The final GPU-backed Compose run completed
  in 81.7 seconds, validated four passages (three new), and left 12 hash-valid local
  discovery records, including official Gujarat dam data. Unreviewed coverage is
  explicitly PARTIAL; zero-evidence runs fail.
- Added source-focused excerpts, stopped elapsed clocks, per-track progress,
  persistent report access, and regression checks preserving prior artifacts when
  a later quote is rejected. Increased terrain imagery texture resolution and fitted
  the whole-crest camera to supplied geometry. Rendered visual QA remains unavailable.

- Added a dam-agnostic Deep Agents research workflow requiring only a dam ID and name,
  with optional location/alias hints and four specialist research tracks.
- Added bounded public-source acquisition, redirect/SSRF controls, exact-quote checks,
  extracted text, artifact hashing, evidence deduplication, conflict preservation,
  coverage reporting, and human-gated candidate project patches.
- Added the research runtime to the application image so dashboard-triggered agent
  runs use the same reproducible environment as the API.
- Added an Ollama Compose service, persistent model volume, `qwen3:8b` initializer,
  internal service networking, and an agent-enabled application image.
- Added a pinned private SearXNG service and JSON search adapter so local Ollama agents
  can discover public sources without Ollama's hosted search API key.
- Added a live dashboard research tracker with current stage, search query, elapsed
  time, evidence count, recent events, completion state, and provider errors.
- Restored the near-dam breach close-up as the default 3D camera, rejected invalid
  flood cells at render time, and made imagery outside the supplied raster footprint
  transparent over the DEM instead of displaying it as an opaque black slab.

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

## 2026-09-21 dedicated engineering replay close-up

- Split the Three.js replay into two visual treatments: satellite/DEM context remains
  in overview modes, while the default breach close-up now uses only solid PBR terrain,
  the reconstructed earthfill embankment, simulated reservoir water, and hydraulic
  release geometry.
- Tightened the breach camera around the dam, made the engineering water elevation
  follow every replay frame, and prevented asynchronously loaded imagery, coarse flood
  cells, river lines, and facility markers from leaking into close-up mode.
- Rebuilt and redeployed the Docker service. HTTP health/static checks pass, stored
  replay frames remain readable, and a headless Chrome render visually confirmed the
  close-up without satellite imagery.

## 2026-09-21 replay v2 and uncertainty implementation

- Added reusable, versioned project contracts for evidence values, gate geometry,
  material zones, and replay specifications. Missing Machhu-II structures remain
  `unavailable`; the renderer labels the parametric fallback as a reconstructed
  archetype.
- Added explicit progressive breach states and transition events, overtopping/seeded/
  piping initiation, bounded retreat/lowering rates, piping enlargement, eroded-volume
  diagnostics, and persistent mass-ledger fields.
- Added immutable run, frame, and asset manifests with configuration hashes, schema and
  renderer versions, exact keyframe access, and a read-only legacy compatibility path.
- Added scenario-local gate schedules and gate-state telemetry without modifying base
  project evidence.
- Added bounded parallel physics ensembles with reproducible seeds, retained forecast
  vintages, member inputs, P10/P50/P90 bands, trajectory selection, optional ensemble
  far-field depth/velocity/arrival bands, and explicit unavailable states when that
  costlier routing is not requested.
- Split the browser implementation into `SceneDirector`, `DamAssetLoader`,
  `ReplayClock`, `DamDeformer`, `HydraulicEffects`, `ForecastLayer`, `TelemetryPanel`,
  `QualityManager`, and `Diagnostics`. The dam now deforms a stable mesh topology;
  engineering/overview/diagnostic modes, camera presets, quality tiers, reduced motion,
  frame stepping, accessible canvas text, and a patterned forecast state are present.
- Verification: `34 passed`, Python compilation, both frontend JavaScript syntax checks,
  frontend build, diff whitespace check, live health/assets HTTP checks, and DOM ID/
  JavaScript-reference checks pass. Connected browser automation was unavailable and
  the local headless Chrome GPU process could not produce a screenshot, so new wide/
  narrow visual captures and reference-hardware frame budgets remain open.

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
- Perform interactive desktop/mobile orbit and timeline QA when a connected browser
  surface is available.
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
