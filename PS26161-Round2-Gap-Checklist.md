# PS26161 Expected Solution — Gap Checklist for Round 2 Submission
### Mapped line-by-line against what's actually been built and verified

**Status key:** ✅ Done & verified · 🟡 Partial / needs work · 🔴 Not started · ⚠️ Scoping decision needed

---

## Deliverable (i): Generalized dam-break/river-blockage modelling framework, using SPH + Delft3D for surge + loss/damage analysis

| Sub-requirement | Status | Detail |
|---|---|---|
| Modelling framework exists and runs end-to-end | ✅ | 8-directive pipeline runs coordinate-to-decision-support, verified across multiple real terminal runs |
| Sudden water surge / breach modelling | ✅ | Froehlich (2008), Wahl (1998), Von Thun & Gillette — three independent cross-checked methods |
| Downstream flood routing | ✅ | In-house 2D grid-based solver (same family as Delft3D/HEC-RAS); validated: 6.32m simulated vs. 6.1m historical at Morbi, CSI 0.844 against satellite |
| **SPH simulation specifically** | 🟡 | In-progress code written (`scripts/10a_pysph_breach_zone.py`) and coupling hook added in `scripts/10_hydrodynamic_simulation.py`. However, `pysph` package is not installed in the environment, the script has not been executed, and solver currently falls back to the Froehlich curve |
| **Delft3D specifically** | 🟡 | Input deck generator written (`scripts/10b_delft3d_comparison.py`) producing `.mdf`, `.grd`, `.dep`, `.bnd`, `.bcc` files. However, input grids are hardcoded flat stubs (not real DEM bathymetry), Delft3D binary is not installed on PATH, and code falls back to bundled static benchmark JSON (`delft3d_benchmark.json`) |
| Scenario comparison between SPH and Delft3D | 🔴 | Cannot exist on real physics until both SPH and Delft3D simulations are genuinely executed; comparison currently relies on static mock JSON rather than dynamic side-by-side simulation |
| Loss and damage analysis | 🟡 | Built (Directive 7 / `scripts/13_damage_analysis.py`) but explicitly labelled as area-based density estimates (GHSL/LandScan proxies), not GIS/census-verified — this labelling is honest, not a defect, but judges may ask for the real thing at this round |
| Generalized to "any river/dam," not hardcoded | 🟡 | Multi-dam configuration profile added (`config.json` with Panshet Dam, Maharashtra) and CLI/API hooks created. However, upstream raster pipeline still hardcodes Machhu-II DEM (`dem_conditioned.tif`), so running a second dam clips coordinates to Gujarat and has not completed an actual end-to-end run |

**⚠️ SPH and Delft3D status update:** Initial scaffolding and code hooks have been written, but neither has executed real physics yet. `pysph` is uninstalled and Delft3D inputs are flat stubs with no binary on PATH. Closing this requires installing `pysph` to run the near-field breach zone, and hooking real DEM bathymetry into the Delft3D deck generator.

---

## Deliverable (ii): Customized tool to generate flood scenarios from different input datasets

| Sub-requirement | Status | Detail |
|---|---|---|
| Accepts different input datasets | 🟡 | Directive 1 is coordinate-driven and pulls DEM/rainfall/LULC/river data automatically — architecture supports this, but only tested against Machhu-II's actual inputs |
| Multiple breach scenarios | ✅ | 5 breach scenarios (base, ±25% width, ±50% extreme/conservative) configured |
| Scenarios are independently computed, not scaled | ✅ | Refactored in `scripts/12_validation_and_sensitivity.py` (`compute_sensitivity_scenarios`). Decoupled from linear scaling multipliers; each scenario now runs an independent 2D hydrodynamic simulation (`run_2d_hydrodynamic_simulation`) with unique unsteady breach hydrographs |

---

## Deliverable (iii): Dashboard for input/output visualization (GUI), handles large data volume, exports to .shp/.kml

| Sub-requirement | Status | Detail |
|---|---|---|
| GUI dashboard exists | ✅ | 2D Leaflet dashboard + 3D Three.js terrain view, both built |
| Dashboard shows real output, not placeholders | ✅ | Confirmed wired to real `simulation_summary.json`, `damage_assessment.json`, `risk_analysis_summary.json` via live fetch, verified by real HTTP response inspection |
| .shp export | ✅ | Confirmed in every pipeline run — ESRI Shapefile export working |
| .kml export | ✅ | Confirmed in every pipeline run |
| Large-data-volume handling | 🔴 | Never stress-tested. Your current domain is ~1400×1000 cells for one dam; PS implies this should scale to "any river" nationally — untested at larger scale |
| **Input** side of the GUI (not just output viewing) | ✅ | "New Dam" interactive modal dialog built into `outputs/3d/dashboard/index.html` with inputs for Dam Name, Coordinates (Lat/Lon), Height, and Reservoir Volume. Connected to FastAPI backend (`server.py`) via `/api/simulate` and real-time streaming simulation logs via Server-Sent Events (`/api/status`), with graceful fallback in offline `file://` mode |

---

## Deliverable (iv): Near-real-time flood analysis via Google Earth Engine, open-source data

| Sub-requirement | Status | Detail |
|---|---|---|
| GEE integration exists at all | 🟡 | `scripts/11_gee_flood_analysis.py` contains GEE authentication hooks and structure |
| Actually near-real-time | 🔴 | Still synthetic. `earthengine-api` is not installed in the virtual environment. Furthermore, `scripts/11_gee_flood_analysis.py` contains `if not gee_authenticated or True:` which unconditionally falls back to generating deterministic spatial noise over the simulated `depth_max.tif` raster rather than downloading genuine Sentinel passes from the GEE API |
| Uses genuinely open-source data | 🟡 | Sentinel imagery itself is open-source in principle; current implementation synthesizes the observation layer from simulation output and noise rather than fetching live Sentinel data |

**⚠️ GEE status update:** Although GEE auth code was added, the `or True` short-circuit and uninstalled `earthengine-api` mean this is still fundamentally synthetic. To close this gap before submission, `earthengine-api` must be installed, authenticated with a valid Google account, and the short-circuit removed to pull a real Sentinel-1 pass.

---

## Deliverable (v): Final demo uses real, open-source Indian river/dam data

| Sub-requirement | Status | Detail |
|---|---|---|
| Uses real, open-source Indian data | ✅ | SRTM DEM, IMD rainfall, ESA WorldCover, HydroRIVERS, CWC NRLD — all real, all open, all confirmed genuinely fetched |
| Demonstrated on a real Indian dam | ✅ | Machhu-II, with real historical validation |
| Demonstrated the framework is not single-dam-locked | 🟡 | Configuration profile added for Panshet Dam (`config.json`) and input modal allows entering any dam. However, the spatial ingestion and hydrodynamic routing have not been executed on Panshet's real DEM; running it currently defaults/clips to Machhu-II's raster grid |

---

## Priority order for the time you have before Round 2 submission

Given current codebase status:

1. **SPH — install `pysph` and execute the near-field simulation:**
   `scripts/10a_pysph_breach_zone.py` is written. Run `pip install pysph` in your environment, execute the script to generate `outputs/simulation/pysph_hydrograph_*.txt`, and let `10_hydrodynamic_simulation.py` ingest the real particle breach wave.

2. **Delft3D — wire real DEM bathymetry into the deck generator:**
   Update `scripts/10b_delft3d_comparison.py` to write real elevation data from `dem_conditioned.tif` into `domain.grd` / `domain.dep` instead of constant dummy values (`22.56`), providing an authentic Delft3D-FLOW input deck.

3. **Make GEE actually live:**
   Install `earthengine-api`, authenticate (`earthengine authenticate`), and remove the `or True` bypass in `scripts/11_gee_flood_analysis.py` so a real Sentinel-1 SAR acquisition is fetched for the AOI.

4. **Multi-dam generalization on real terrain:**
   Decouple `DEM_FILE` from Machhu-II in `scripts/10_hydrodynamic_simulation.py` by dynamically downloading/clipping the DEM for Panshet Dam coordinates (`config.json`), proving generalization without coordinate clipping.

5. **Completed milestones to maintain:**
   - ✅ Independent physics simulations for sensitivity scenarios (decoupled from linear multipliers).
   - ✅ Interactive GUI input modal and FastAPI backend (`server.py`) for live simulation dispatch.

---

## What NOT to do with this list

Don't try to fabricate placeholder versions of any of these to look done quickly — that pattern already cost real time earlier in this project when an AI assistant's confident-but-fake "100% completed" reports had to be independently re-audited three times before the real gaps surfaced. Build the narrow, honestly-scoped real version of each item, even if smaller than the full vision, and label anything still incomplete exactly the way your project reference document already does — as a stated limitation, not a hidden one.
