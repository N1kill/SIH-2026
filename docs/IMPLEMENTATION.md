# Architecture, physics, data, and limitations

## End-to-end data flow

`Project + Scenario → metric DEM/imagery cache → reservoir/breach release → optional
SPH diagnostic → conservative downstream router → risk/facility screening → stored
frames + GIS products → FastAPI/WebSocket → Three.js replay`

`src/project.py` validates project evidence and scenario controls. `src/terrain.py`
owns the WGS84/projected/local transform and builds full-domain plus near-dam DEM
meshes. `src/run_engine.py` owns each run and its mass ledger. `src/api.py` provides a
single-user lifecycle. Large fields are GeoTIFFs; replay frames contain sparse wet-cell
updates. Static inputs are cached by a project/data fingerprint.

## Physics and numerics

Reservoir storage obeys `ΔS = (Qin − Qbreach − Qspillway − Qovertopping − Qseepage)Δt`.
Component outflows are scaled before storage can become negative. Surveyed monotonic
stage-storage data are used when supplied; otherwise a power law calibrated to the
configured capacity is marked as an assumption.

The breach supports an excess-shear erosion ODE and a prescribed formation-time mode.
The configured valley floor, maximum width, dam height, and dam length constrain its
geometry. The same storage-limited discharge drives downstream routing.

The default downstream solver uses a finite-volume diffusive-wave approximation with
Manning resistance and an adaptive stability substep. It conserves volume in a closed
domain and tracks depth, velocity, arrival time, duration, and maxima. It neglects
inertia and shock physics; it is suitable for scenario screening, not certification.

The WCSPH implementation uses a uniform-grid neighbor search, Tait pressure, artificial
viscosity, boundary repulsion, and acoustic/acceleration timestep limits. It is limited
to a near-field visualization/diagnostic slice. It does not own downstream water mass,
so the system does not double-count release volume.

D-Flow FM is an optional separate comparison. It consumes the exact per-run release
hydrograph, builds a metric UGRID mesh from the conditioned DEM, and parses actual map
NetCDF variables. Differences in boundary conditions and numerical warnings are
preserved; its presence is not presented as validation.

## Digital twin

The terrain uses EPSG:32642 for Machhu-II. Three.js coordinates are `X = easting −
origin_easting`, `Y = elevation − origin_elevation`, and `Z = origin_northing −
northing`. Vertical exaggeration is 1. The near-dam grid uses source-DEM-scale detail;
far terrain is decimated.

Sentinel-2 RGB is reprojected to the same metric bounds and cached with acquisition,
cloud, source, processing, and license metadata. A supplied reservoir polygon is
preferred. Without one, the application displays an upstream, DEM-connected level-set
approximation. A surveyed crest polyline is preferred. Without one, the earthfill mesh
uses configured location, length, height, downstream bearing, DEM ground profile, and
an explicitly assumed crest width/slope. The simulated breach cuts this mesh.

## Decision support and exports

Risk categories use scenario-controlled maximum depth and velocity thresholds. Each
polygon includes contributing metrics. OSM schools, community centres, hospitals, and
shelter-tagged features are only candidate facilities; the application reports model
coverage, exposure, elevation, flood distance, and arrival time. Capacity, official
designation, structural condition, and road access remain unknown until supplied.

Each run exports compressed GeoTIFFs, GeoJSON, KML, Shapefile, hydrograph CSV, inputs,
summary, validation, frames, and a ZIP. GeoTIFF tags preserve units and solver context.

## External evidence still required

- Surveyed crest, cross-section, spillway, and breach-location drawings.
- Reservoir shoreline and stage-area-storage/bathymetric survey.
- Licensed multi-view dam photographs with camera and capture metadata.
- Georeferenced 1979 flood extent/depth observations or another validation event.
- Official shelters, capacities, road condition, population, and infrastructure data.
- GEE project/credentials for optional refresh; OpenFOAM for a future CFD adapter.

These gaps are surfaced in UI/result metadata. Missing observations never become a
zero-flood raster and unknown attributes never receive invented values.

Place new evidence inside the repository and reference it from
`data/projects/<dam-id>.json`:

| Evidence | Location/configuration |
|---|---|
| DEM, imagery, reservoir, river, land use, facilities | `data/raw/<type>/...`; set the matching `*_path` field |
| Surveyed crest and dam specifications | set `crest_coordinates` and the dimension/elevation fields; record the drawing in `provenance` |
| Stage-storage or bathymetry | set `stage_storage`; keep the source survey in `data/raw/reservoir/` |
| Licensed dam photographs | `data/raw/dam_images/<dam-id>/`; copy the example manifest and set `dam_images_manifest` |
| Observed flood extent/depth | keep it in `data/raw/observations/`; pass the raster to `validate_simulation.py --observed` |
| GEE access | copy `.env.example` to `.env`, set `EE_PROJECT`, and authenticate outside version control |
| OpenFOAM or D-Flow FM | install externally and expose the executable on `PATH`; health reports detection separately |

Official shelter capacities and route condition need a verified facility dataset in
`facilities_path`; absence remains unknown rather than being converted to a safe value.
