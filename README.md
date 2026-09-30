# InundaX dam-break scenario laboratory

InundaX is a local geospatial dam-break screening application for the SIH-2026
Machhu-II case. It combines a reservoir mass balance, configurable breach growth,
optional near-field SPH diagnostics, conservative DEM-based downstream routing,
GIS exports, and a Three.js digital twin served by FastAPI.

The default downstream model is a diffusive-wave screening approximation. It has
not been calibrated against observed 1979 flood extents and must not be used as an
operational evacuation forecast. Every result records its solver, inputs, assumptions,
CRS, resolution, timing, provenance, and mass residual.

The 3D viewer renders metre-scale parametric dam geometry and a water surface clipped
to the supplied reservoir footprint and replayed level. The water shader is visual
only; it does not solve Navier–Stokes equations. No surveyed Machhu-II GLB asset is
bundled. The published crest and reported dam height imply a toe below the current
DEM sample at the dam, so the viewer reports both values instead of altering the DEM.
The optional intact-dam studio study fits its procedural sill and deck to configured
water and crest elevations. Its engineering-view shoreline connection is a labeled,
DEM-clipped visual inference; neither changes the simulation or source data.

## Quick start

The repository has three user-facing views: the landing page in `frontend-dam/`,
the 2D flood map in `frontend/`, and the engineering twin in
`outputs/3d/dashboard/`. `src/` contains the simulation and API code;
`scripts/` contains data preparation and run commands. `data/` stores source
and processed inputs, while `outputs/` stores generated results and the static
twin. The root `npm run build` prepares the frontends before FastAPI starts.

Python 3.11–3.13 and Node.js 20.19+ or 22.12+ are supported.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-core.txt
npm ci
npm run build
python scripts\run_demo.py
```

On macOS or Linux, activate the environment with `source .venv/bin/activate`
and run `python scripts/run_demo.py` after the same install and build commands.

Open <http://127.0.0.1:8050>. The demo uses cached local DEM, river, Sentinel-2,
land-use, and OSM facility data; it does not require internet access after preparation.
The root build installs each frontend's locked npm dependencies on a fresh clone.
If the 2D view has no completed run, select **Generate baseline simulation** there;
the server runs the configured Machhu-II scenario and loads its saved result when
finished. To adjust the scenario first, use the 3D Twin. Simulation runs are stored
locally under `outputs/runs/` and are not included in a fresh clone.

The default server listens only on this computer. For access from other machines on
the same trusted network, run `python -m uvicorn server:app --host 0.0.0.0 --port 8050
--workers 1` and open the host computer's IP address instead of `127.0.0.1`.

The replay is driven by stored solver frames rather than a decorative animation.
Each frame couples reservoir storage, stage-storage level, breach geometry and
excess-shear erosion, configured spillway flow, crest overtopping, and conservative
downstream routing. The dashboard exposes material resistance, roughness, exact
initial level, and spillway what-if overrides. Values absent from project evidence
remain visibly unconfigured; they are not silently synthesized.

Replay schema v2 adds explicit `intact`, `incipient`, `erosion`, `mass_failure`,
`widening`, `stabilizing`, and `final` failure states; immutable run/asset/frame
manifests; source/configuration hashes; exact frame seeking; and retained deterministic
forecast vintages. The dashboard separates engineering, operational, and diagnostic
modes and marks forecast geometry with text plus a dashed treatment, not colour alone.

Relevant API routes are:

- `GET /api/project/{project_id}/assets` for the reusable structural/provenance contract;
- `GET /api/simulation/results/{run_id}/metadata` and `/assets` for replay manifests;
- `GET /api/simulation/results/{run_id}/frames/{index}` for exact keyframes;
- `POST /api/simulation/results/{run_id}/forecasts` for a bounded seeded ensemble;
- `GET /api/simulation/results/{run_id}/forecasts` and
  `/forecasts/{vintage_id}?trajectory=p50` for retained vintages and selection.

Forecast reservoir level, breach dimensions, and discharge carry P10/P50/P90 bands.
Far-field forecast depth, velocity, and arrival bands are generated when the forecast
request sets `include_far_field: true`. They remain explicitly unavailable when that
costlier ensemble routing is not requested; they are never filled with synthetic
precision.

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

## Generic dam evidence agent

The research agent is not tied to Machhu-II. For an existing project, generate a
four-track research plan and then run the Deep Agents workflow:

```powershell
python scripts\research_dam.py plan --project machhu-ii --country India --region Gujarat
python scripts\research_dam.py run --project machhu-ii --country India --region Gujarat
python scripts\research_dam.py validate --project machhu-ii
python scripts\research_dam.py report --project machhu-ii
```

For a new dam, only an ID and name are required. Country, region, river, coordinates,
and aliases are optional search hints that reduce ambiguity:

```powershell
python scripts\research_dam.py run --dam-id sample-dam --name "Sample Dam" `
  --country India --region "Example State" --river "Example River" `
  --latitude 20.0 --longitude 75.0 --alias "Local spelling"
```

Set `OPENAI_API_KEY` in `.env` or the process environment. The default model is
`openai:gpt-5-mini`; override it with `DAM_RESEARCH_MODEL` or `--model` using a
LangChain `provider:model` identifier. Search is independent from the coordinator:
set `DAM_SEARCH_PROVIDER` to `openai`, `google`, `ollama`, or local `searxng`
(`auto` is the default), and use
`GEMINI_API_KEY` for Google. For new Google projects, use a currently available
Gemini model such as `google_genai:gemini-3.6-flash`. The agent delegates identity/geometry,
reservoir/hydrology, spillway/history, and safety/context research to specialists.

Ollama can run the coordinator and specialists locally. Install Ollama, pull a
tool-capable model such as `qwen3:8b`, and set:

```text
DAM_RESEARCH_MODEL=ollama:qwen3:8b
DAM_SEARCH_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_API_KEY=your_ollama_web_search_key
DAM_RESEARCH_RATE_LIMIT_DELAY_S=0
```

The local model itself does not require a paid model API key. Ollama's hosted web
search service requires its own search key. When `DAM_SEARCH_PROVIDER=ollama` has no
`OLLAMA_API_KEY`, the agent automatically uses the Compose-managed SearXNG service;
you can also explicitly select `searxng`, `google`, or `openai`.

The dashboard exposes the same workflow under **Web evidence agent**. Select a dam
and choose **Start research for this dam** to see the current stage, active public-web
query, elapsed time, sources archived, recent activity, and any provider error. The
tracker is live only while the API process that started the run remains running.

Ollama runs a bounded search/read/extract/archive sequence for each of the four
topics. It reads up to three documents per topic, checks quotes against downloaded
content, and keeps machine-selected passages as discovery evidence. `PARTIAL`
means the run finished but engineering coverage or source review is outstanding;
`FAILED` means it validated no evidence in that run. `DAM_RESEARCH_MAX_SECONDS`
defaults to 600. Reports remain available at `/api/research/report/<project-id>`
after the run, including source links, exact quotes, coverage and errors.

Outputs are written under `data/evidence/<dam-id>/`: the sparse seed, query plan,
bounded source artifacts, extracted text, SHA-256 evidence manifest, conflict-aware
findings, and a candidate project patch. Sources are accepted only when a short exact
quote is found in the archived page or PDF. Conflicting values are retained and never
averaged. The agent never edits `data/projects/`; promotion remains a named-human
review step. `DAM_RESEARCH_RATE_LIMIT_DELAY_S` defaults to 12.5 seconds so the
workflow can operate within common free-tier quotas; set it to `0` only when the
selected provider has sufficient paid rate limits.

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

Use `docker-compose.twin.yml` for the full application. The older
`docker-compose.yml` serves only legacy static dashboard files and has no API.

The default Compose stack starts the application without an Ollama or GPU requirement.
For the optional local research services, run
`docker compose -f docker-compose.twin.yml --profile research up --build`.
That profile starts Ollama, SearXNG, and a one-shot initializer that downloads roughly
5 GB for `qwen3:8b`; later starts reuse the `ollama-models` volume. The dashboard
connects to Ollama at `http://ollama:11434` inside the Compose network. The research
profile requests NVIDIA GPUs; remove `gpus: all` on a host without GPU support.
To expose the dashboard to trusted LAN collaborators, set `INUNDAX_BIND_HOST` to the
host computer's LAN address before running Compose. Set
`OLLAMA_API_KEY` only if using Ollama's hosted web-search service. `EE_PROJECT` must
remain a Google Cloud project ID, never an API key.

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
