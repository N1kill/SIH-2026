# InundaX dam-break scenario laboratory

InundaX is a local geospatial dam-break screening application for the SIH-2026
Machhu-II case. It combines a reservoir mass balance, configurable breach growth,
optional near-field SPH diagnostics, conservative DEM-based downstream routing,
GIS exports, and a Three.js digital twin served by FastAPI.

The default downstream model is a diffusive-wave screening approximation. It has
not been calibrated against observed 1979 flood extents and must not be used as an
operational evacuation forecast. Every result records its solver, inputs, assumptions,
CRS, resolution, timing, provenance, and mass residual.

## Quick start

Python 3.11–3.13 and Node.js 20+ are supported.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-core.txt
npm ci
npm run build
python scripts\run_demo.py
```

Open <http://127.0.0.1:8050>. The demo uses cached local DEM, river, Sentinel-2,
land-use, and OSM facility data; it does not require internet access after preparation.

## Exact workflows

Prepare/validate local terrain:

```powershell
python scripts\prepare_data.py --project machhu-ii
python scripts\build_digital_twin.py --project machhu-ii
```

Refresh public contemporary imagery, facility candidates, and mapped geometry:

```powershell
python scripts\prepare_data.py --project machhu-ii --imagery --facilities --geometry
```

This writes provenance and rejects mapped dam geometry that is implausibly distant or
inconsistent with the configured length. It never treats an OSM facility as an official
shelter.

## Evidence-backed approximate reconstruction

Research, candidate generation, and project promotion are separate steps. Research
never writes candidate geometry into the approved project configuration.

```powershell
python scripts\reconstruct_dam.py collect-imagery --project machhu-ii --candidate-latitude 22.76389 --candidate-longitude 70.86583
python scripts\reconstruct_dam.py draft --project machhu-ii --candidate-latitude 22.766743688 --candidate-longitude 70.8661350514 --candidate-length-m 4930 --candidate-capacity-m3 87900000 --candidate-initial-level-m 56.41 --candidate-maximum-level-m 57.30
python scripts\reconstruct_dam.py validate --project machhu-ii
```

Review `data/candidates/machhu-ii/reconstruction-preview.png`, the draft JSON,
shoreline, evidence manifest, conflicts, uncertainties, and disclaimer. A human may
then promote the draft explicitly:

```powershell
python scripts\reconstruct_dam.py approve --project machhu-ii --reviewer "<name>" --accept approximate-screening-only
```

No approval was performed automatically. Published water levels have an unstated
datum and the DEM shoreline differs materially from the reported full-reservoir area;
both limitations must be reviewed before promotion.

Run without the UI and validate the mass ledger:

```powershell
python scripts\run_simulation.py --project machhu-ii --duration 1800
python scripts\validate_simulation.py --simulation <simulation-id>
```

Run the server directly:

```powershell
python -m uvicorn server:app --host 127.0.0.1 --port 8050 --workers 1
```

Run tests and frontend build checks:

```powershell
python -m unittest discover -s tests -v
npm test
```

Run the optional D-Flow FM comparison after a completed scenario:

```powershell
python scripts\run_delft3d.py --simulation <simulation-id> --build-only
python scripts\run_delft3d.py --simulation <simulation-id> --threads 2
```

The second command requires `dflowfm-cli` on `PATH`. The comparison uses the stored
release hydrograph and remains uncalibrated.

Docker, when Docker Desktop is running:

```powershell
docker compose -f docker-compose.twin.yml build
docker compose -f docker-compose.twin.yml up
```

## User-supplied evidence

Add project JSON files to `data/projects/`. Referenced files must remain inside the
repository and carry CRS metadata where applicable:

- DEM GeoTIFF: `dem_path`.
- 8-bit georeferenced RGB GeoTIFF: `imagery_path`.
- Reservoir GeoJSON/Shapefile: `reservoir_polygon_path`.
- River vector: `river_path`.
- Facility GeoJSON/Shapefile: `facilities_path`.
- Surveyed crest: `crest_coordinates` as `[longitude, latitude]` pairs.
- Stage-storage survey: `stage_storage` as `[elevation_m, storage_m3]` pairs.
- Observed flood raster: `validate_simulation.py --observed <path>`.
- Dam photographs: `data/raw/dam_images/<dam-id>/`, with a manifest recording filename,
  source URL, view direction, capture date, coordinates, and license. Copy
  `data/raw/dam_images/machhu-ii/manifest.example.json` and set the project JSON's
  `dam_images_manifest` field; the example itself is not evidence.

For optional Earth Engine metadata refresh, copy `.env.example` to `.env`, configure
`EE_PROJECT`, and authenticate outside the repository. Never commit credentials.

See [architecture and limitations](docs/IMPLEMENTATION.md), the live
[implementation checklist](IMPLEMENTATION_CHECKLIST.md), and the directive-oriented
[completion matrix](docs/REQUIREMENTS_STATUS.md).
