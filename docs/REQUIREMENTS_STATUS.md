# Master directive completion report

## COMPLETED AND VERIFIED

### Project configuration, terrain, imagery, and coordinates

- **Files:** `src/project.py`, `src/terrain.py`, `scripts/prepare_data.py`.
- **Implementation:** strict reusable schemas, safe supplied paths, WGS84/UTM/local
  transforms, source DEM sampling, full/near-dam grids, georeferenced Sentinel RGB.
- **Verification:** schema and coordinate tests pass; local EPSG:32642 twin build and
  bounded data acquisition completed. Implausible OSM dam geometry was rejected.
- **Known limitation:** several engineering values remain unknown and explicitly null.

### Run lifecycle, reservoir/breach, routing, mass diagnostics

- **Files:** `src/reservoir.py`, `src/breach.py`, `src/flood_routing.py`,
  `src/run_engine.py`, `src/api.py`, `server.py`.
- **Implementation:** validated/cancellable runs, reservoir/breach physics, DEM routing,
  progress, sparse frames, replay, WebSocket contract, and structured failures.
- **Verification:** run `3c0b4222d8924e29a98d6816f48cfaa6` completed 1,800 seconds
  with 61 frames and `-1.08e-13%` mass residual; API/WebSocket tests pass.
- **Known limitation:** default router is a screening approximation with closed edges.

### GIS risk and facility outputs

- **Files:** `src/results.py`, `scripts/validate_simulation.py`.
- **Implementation:** depth/velocity/arrival/duration/risk rasters, risk polygons, KML,
  Shapefile, transparent metrics, facility screening, and ZIP export.
- **Verification:** exports opened with correct CRS; 59 OSM candidates were evaluated.
- **Known limitation:** candidate status does not establish capacity or official safety.

### Frontend, testing, and CLI

- **Files:** `outputs/3d/dashboard/twin.*`, `scripts/build_frontend.mjs`,
  `tests/test_twin.py`, CLI scripts.
- **Implementation:** local Three.js, scenario/control/layer/camera/replay UI and exact
  build, prepare, simulate, validate, comparison, and demo commands.
- **Verification:** frontend build/syntax passes; 16 numerical/API/WebSocket/evidence tests pass,
  including an end-to-end check that breach-width changes alter solver results.
- **Known limitation:** rendered visual inspection was blocked by no connected browser.

## COMPLETED BUT NOT FULLY VALIDATED

### SPH diagnostic slice

- **Files:** `src/sph_breach.py`, `src/run_engine.py`.
- **Verification:** finite deterministic small-particle test passes.
- **Known limitation:** no laboratory/field validation; it is not a mass-bearing coupled
  downstream domain.

### D-Flow FM comparison

- **Files:** `scripts/run_delft3d.py`, `scripts/10b_delft3d_comparison.py`.
- **Verification:** installed D-Flow FM completed 1,800 seconds and produced seven
  NetCDF/replay frames with actual depth and velocity variables.
- **Known limitation:** viscosity limiting occurred, boundaries differ from the default
  screening run, and no observation calibration exists.

### Docker packaging

- **Files:** `Dockerfile`, `docker-compose.twin.yml`, `.dockerignore`.
- **Implementation:** pinned frontend build and single-worker Python runtime.
- **Verification:** Compose validation, image build, container startup, health,
  dashboard, reconstruction draft, and preview endpoints pass. The live check exposed
  and fixed the slim-image `libexpat1` dependency needed by Rasterio.
- **Known limitation:** optional D-Flow FM and OpenFOAM executables are not included in
  the core image.

### Evidence-backed reconstruction candidate

- **Files:** `src/reconstruction.py`, `scripts/reconstruct_dam.py`,
  `data/evidence/machhu-ii/evidence.json`, and `data/candidates/machhu-ii/`.
- **Implementation:** hashed source records, explicit license/status/uncertainty fields,
  Sentinel-derived crest digitization, DEM shoreline extraction, an approximate
  stage-storage curve, draft validation, preview API, and a named-reviewer promotion
  gate.
- **Verification:** all evidence hashes and candidate artifacts validate; the draft is
  marked `approximate` and remains outside the active project configuration.
- **Known limitation:** human geometry approval is intentionally outstanding; the
  shoreline area differs materially from a published full-reservoir figure and the
  source water-level datum is unstated.

## PARTIALLY IMPLEMENTED

- **Accurate reconstruction:** real DEM/imagery and a data-constrained earthfill mesh
  exist; verified crest/spillway geometry, bathymetry, photographs, photogrammetry,
  GLB compression, and visual QA remain.
- **Near-real-time context:** optional GEE status/metadata and cached Sentinel context
  exist; authenticated raster refresh and observed-water derivation remain.
- **Priority/infrastructure:** hazard metrics and candidate facilities exist;
  population, verified infrastructure/routes, capacity, and accessibility remain.

## BLOCKED BY EXTERNAL DEPENDENCY/DATA

- Survey-grade drawings, licensed multi-view photos, reservoir survey, georeferenced
  historical validation, and official shelter/capacity/route evidence.
- OpenFOAM is not installed. GEE credentials/project are not configured.
- Browser visual QA has no connected browser surface. The rebuilt Docker service is
  running and its health, dashboard, reconstruction, and preview routes return 200.

## NOT COMPLETED

- Survey-grade photogrammetry/GLB reconstruction and field-validated evacuation plans.
- Calibrated full-momentum operational forecasting or certification-grade structural
  assessment.
- GPU/CUDA rewrite: profiling shows the 30-minute CPU screen completes in under one
  second, so no measured bottleneck justifies it.

These are deliberately not represented as completed features.
