# Dam-break digital twin implementation checklist

Updated during the implementation run. “Verified” means the behavior was executed
locally; “implemented” means code exists but the stated validation is still missing.

## Finished and verified

- [x] **Repository-wide agent rules** — root `AGENTS.md` is discoverable; local skill
  names and frontmatter validate without duplicates. All 24 skills pass the official
  validator; the bundled UI skill's 130 applicable tests pass and two upstream-only
  maintenance suites skip explicitly when their unbundled harness is absent.
- [x] **Reusable project/scenario schemas** — strict Pydantic validation covers dam,
  reservoir, data paths, breach, rainfall, solver, domain, and risk parameters.
- [x] **Shared coordinate transform** — WGS84 → metric UTM → local Three.js X/Y/Z is
  reversible and covered by a round-trip test.
- [x] **DEM processing for the digital twin** — bounded, reprojected, nodata-aware
  terrain grids use source DEM elevations and cache keys; full-domain and near-dam
  detail meshes use 1:1 vertical scale.
- [x] **Real terrain imagery** — a bounded Sentinel-2 L2A RGB raster is cached,
  reprojected onto the DEM grid, and accompanied by acquisition/source/license
  metadata. It is contemporary context, explicitly not 1979 validation imagery.
- [x] **Reservoir mass balance** — storage cannot become negative; component outflows
  are capped to available volume; invalid flow/timestep inputs fail explicitly.
- [x] **Breach simulation** — configurable excess-shear erosion and prescribed
  formation modes feed a single reservoir release hydrograph.
- [x] **SPH numerical repairs** — the solver now respects acoustic and acceleration
  timestep limits, rejects invalid timesteps, prevents tensile pressure, and reports
  its actual clock. It is exposed as a diagnostic near-field slice.
- [x] **DEM-based downstream screening solver** — conservative finite-volume
  diffusive-wave routing produces depth, velocity, arrival, duration, and inundation
  fields without browser-side hydraulics.
- [x] **Mass ledger** — initial storage + inflow − final storage − routed volume is
  stored per run. A 30-minute Machhu-II run closed to about `1.1e-13%` residual.
- [x] **Run lifecycle** — one active run per process, validation, cancellation,
  progress states, failure reporting, stored replay frames, and nonblocking WebSocket
  streaming are implemented and API-tested.
- [x] **Scenario replay/comparison** — completed frames are replayed without rerunning
  physics; recent scenarios show peak discharge, maximum depth, inundated area, and
  mass residual.
- [x] **GIS exports** — GeoTIFF depth/velocity/arrival/duration/risk, GeoJSON, KML,
  Shapefile, hydrograph, metadata, and downloadable ZIP are generated per run.
- [x] **Risk screening** — editable depth/velocity thresholds produce transparent
  categories and expose each zone’s depth, speed, arrival time, and area.
- [x] **Facility ingestion and screening** — attributed OSM facilities are treated as
  candidates and checked against model coverage, flood depth, elevation, distance,
  and arrival. No capacity, road access, or official shelter status is invented.
- [x] **Offline frontend build** — Three.js and OrbitControls are pinned and copied
  locally; the dashboard no longer needs JavaScript CDNs.
- [x] **Dashboard controls** — project/scenario inputs, start/cancel, progress,
  layers, camera presets, coordinate inspection, replay, speed, arrival-time display,
  result comparison, GIS export, and facility markers are implemented.
- [x] **Command-line workflows** — terrain build, data preparation, simulation,
  validation, optional Delft3D comparison, and demo-server commands exist.
- [x] **Optional integration status** — startup health distinguishes core availability
  from GEE, OpenFOAM, and Delft3D status; it also checks the dashboard, DEM, local
  Three.js bundle, and project schema without making optional tools block startup.
- [x] **Automated tests** — 16 tests cover physics invariants, routing conservation,
  SPH stability, coordinates, rainfall response, schema validation, cancellation,
  API lifecycle, WebSocket ordering, replay, export, and a scenario what-if response.
- [x] **Evidence research pipeline** — eight hashed evidence records preserve URL,
  publisher, retrieval date, usage status, artifact hash, CRS/coordinates,
  measurements, uncertainty, and `verified`/`approximate`/`discovery_only` status.
- [x] **Human-gated reconstruction draft** — licensed Sentinel-2 imagery, a 4.88 km
  candidate axis, DEM shoreline, and capacity-scaled stage-storage curve are generated
  outside project configuration. Validation checks every hash; promotion requires a
  named reviewer and the exact `approximate-screening-only` acceptance phrase.

## Implemented, validation still in progress

- [ ] **DEM-constrained dam mesh and dynamic breach opening** — frontend geometry
  follows a crest polyline when verified, samples the local DEM beneath the embankment,
  applies known length/height, and opens according to simulated breach width/depth.
  The available OSM candidate is rejected because it is 2,042 m from the configured
  site and 5,123 m long versus the configured 3,542 m crest. A Sentinel-derived 4.88
  km candidate is now available with ±20–40 m uncertainty and agrees with the 4.93 km
  India-WRIS record. Remaining: human approval and rendered application inspection.
- [ ] **Terrain/reservoir/dam visual alignment** — common coordinates and diagnostic
  markers are implemented. Remaining: browser screenshot inspection is unavailable
  because no browser is connected to the computer-use tool.
- [ ] **Responsive/accessibility pass** — semantic form labels, visible focus, reduced
  motion, responsive panels, explicit legends/units, and color-plus-text statuses are
  implemented. Remaining: visual checks at desktop and 375 px widths.
- [x] **Delft3D adapter** — installed D-Flow FM completed an isolated per-run
  comparison using the exact stored 1,800-second hydrograph. Seven map frames expose
  D-Flow water depth and velocity variables; output remains labeled an uncalibrated
  comparison because viscosity limiting occurred and no observation dataset exists.
  Runtime warnings are retained in `comparison_metadata.json`, not hidden.
- [x] **Docker packaging** — Compose validation and image build pass. A missing
  `libexpat1` Rasterio runtime dependency found during the first live start is fixed.
  The rebuilt container remains up; health, dashboard, reconstruction draft, and
  preview endpoints all return HTTP 200.
- [x] **Fresh-data end-to-end run** — run `3c0b4222d8924e29a98d6816f48cfaa6`
  completed with current imagery/facilities, 61 replay frames, 59 screened facility
  candidates, all GIS products, and `-1.08e-13%` mass residual.

## Incomplete because external evidence or software is missing

- [ ] **Survey-grade dam reconstruction / photogrammetry** — no multi-view licensed dam
  photographs, camera calibration, engineering cross-section, spillway drawings, or
  surveyed crest polyline are present. Current Tier-C/B geometry must remain labeled
  approximate.
- [ ] **Verified reservoir shoreline and bathymetry** — no authoritative reservoir
  polygon or stage-area-storage survey is present. Current shoreline is a DEM-connected
  level approximation and storage uses a documented power law.
- [ ] **Historical observational validation** — no georeferenced 1979 inundation extent,
  depth observations, or surveyed breach hydrograph is present. IoU support exists but
  no scientific validation claim is made.
- [ ] **Official shelter designation, capacity, and route safety** — OSM candidates do
  not establish capacity, structural suitability, official designation, or road
  availability during flooding. These require local authority/field data.
- [ ] **OpenFOAM near-field mode** — no OpenFOAM installation is detected. The default
  workflow uses hydraulic/SPH diagnostic near-field handling.
- [ ] **Authenticated GEE raster refresh** — clean optional metadata adapter exists, but
  `EE_PROJECT` and credentials are absent. Local Sentinel imagery keeps the base demo
  independent of GEE.

## Remaining implementation work

- [x] Finish external-solver and browser-independent static checks plus an exact
  completion report matching the directive’s required categories.
- [x] Update `README.md`, architecture/physics/data documentation, `PROGRESS.md`, and
  exact run commands.
