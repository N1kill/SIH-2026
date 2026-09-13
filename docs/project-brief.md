---
tags: [SIH2026, dam-break-modelling, build-brief, antigravity]
created: 2026-09-06
status: authoritative — supersedes prior scope discussions in this project
repo: https://github.com/N1kill/SIH-2026
---

# Machhu-II Dam Break Modelling — Build Brief for Antigravity

## 0. Read this first: what NOT to do

This project has twice drifted into scope creep that produced impressive-looking but disconnected work:
- Building a polished 3D/2D dashboard with **hardcoded mock numbers** before the physics engine produced real output
- Planning a **second full SPH/Delft3D engine** as a "differentiator" before the first engine (HEC-RAS/in-house) was even correct

**Do not repeat this pattern.** The order of work below is deliberate: fix the physics first, validate it, and only then extend visualization or add comparison engines. If asked to build a visual feature before its underlying data is real, flag it and ask whether it should use clearly-labeled placeholder data instead.

---

## 1. Project identity

- **PS**: SIH26161 — Dam Break Inundation Modelling Using Hydrodynamic Modelling of any River
- **Sponsor**: NTRO | **Theme**: Disaster Management | **Category**: Software
- **Team**: MAVeNS
- **Primary case study**: Machhu-II Dam, Morbi, Gujarat
  - Coordinates: 22.82°N, 70.84°E (verify against CWC NRLD before any re-run — a 0.01° mismatch has already caused a watershed error once)
  - Built 1972, earthfill embankment, height 22.56m, length 3,542m, gross storage 101 Mm³
  - Historical breach: 11 August 1979, overtopping from extreme monsoon rainfall
  - Catchment at dam: ~1,928 km² (± 10% acceptable)
- **Repo**: `https://github.com/N1kill/SIH-2026`

## 2. Product definition

A scenario-based, validated, uncertainty-aware dam-break inundation decision-support tool. Converts a breach scenario into flood extent, depth, velocity, arrival-time, exposure, and priority outputs — for the Machhu-II case first, architected to generalize to other dams later.

**Positioning**: a transparent scenario-simulation prototype. Never claim exact prediction or guaranteed evacuation safety — every output is a labelled modelled estimate with stated assumptions and uncertainty.

## 3. Current state (as of this brief)

### Working / solid — do not rebuild
- **Directive 0-1 (setup, data acquisition)**: DEM (SRTM 30m), IMD rainfall NetCDF, ESA WorldCover LULC, HydroRIVERS, CWC NRLD dam record — all downloaded and verified for the AOI (22.0–23.2°N, 70.4–71.3°E)
- **Directive 4 (breach parameters)**: Froehlich (2008) vs Wahl (1998) vs Von Thun & Gillette vs historical CWC-observed comparison table. This is the strongest, most defensible artifact in the project. Keep exactly as-is.
- **Directive 6 (validation harness)**: the harness itself works (computes CSI, F1, accuracy against satellite comparison). It currently reports failure (CSI=0.004) because its inputs are broken — the harness is not the problem.

### Broken — fix these, in this order
1. **Directive 2 (watershed delineation) — FAILS validation.** Logged: `Watershed area 1024.33 km² is outside target range 1735.20–2120.80 km²` (~47% undersized), yet the pipeline continued to Directive 3 anyway on the bad output.
   - **Fix**: verify pour-point coordinates against CWC NRLD exactly (prior runs used 22.82/70.84 in one place and 22.82/70.83 elsewhere — resolve this first). Re-run DEM conditioning and flow accumulation with the corrected pour point. **Do not let the pipeline proceed past a FAIL validation status** — add a hard stop.
2. **Directive 3 (SCS-CN hydrology) — inflow peak was force-calibrated, not derived.** Logged: `Area-Scaled Inflow Peak: 4153.57 m³/s` → then manually calibrated to hit a target of 5600 m³/s using a peak-rate factor of 652.5 (vs. the standard 484 — a 35% deviation with no stated justification). This is circular: it assumes the answer to validate the answer.
   - **Fix**: once Directive 2's catchment area is correct, re-derive the inflow hydrograph without forcing it to a target. Report whatever peak flow results, and compare it honestly against the historical estimate (~5,550–5,663 m³/s) — do not tune parameters to hit that number.
3. **Directive 5A (2D hydrodynamic solver) — physically impossible output.** Logged: max depth of 353–499m for a dam 22.56m tall with a 22.56m water head. This is a solver bug (likely CFL instability or a units/indexing error), not a calibration issue. Morbi depth stayed at 0.00m for the entire run — the flood never actually reached the city in this simulation.
   - **Fix option A (preferred if time allows)**: debug the in-house shallow-water solver — check CFL condition (timestep vs. cell size vs. wave speed), check for unit consistency (m vs. mm, m/s vs. m/hr) at the breach source term.
   - **Fix option B (fallback, time-boxed)**: switch to HEC-RAS 2D via `ras-commander` as the production solver. This was already the intended fallback — use it if option A isn't resolved within a reasonable time-box (recommend: 2-3 days max before switching).
4. **Directive 5B/6/7/8 (satellite comparison, validation, damage, risk)** — all currently computing on the broken Directive 5 output. **Do not touch these until Directive 5 is fixed.** Re-run in sequence once real depth/velocity rasters exist.

### Frontend — currently a disconnected mockup, correctly labeled as such
- `index.html` / `app.js` / `style.css` (2D Leaflet dashboard): fully functional UI, but every number (`q_peak`, `morbi_peak`, `pop_exposed`, `loss_cr`) is a hardcoded JS constant, not read from any pipeline output file. Treat as a **UI/UX prototype only** until wired to real Directive 5-8 outputs.
- `machhu-dam-3d-terrain-twin.html` (3D Three.js digital twin): Stage 1 (real terrain via live Open-Meteo elevation API, with an honest labeled fallback) is genuinely real. Stages 2-3 (flood animation, cinematic camera) still run on a hand-tuned formula, not real depth rasters — clearly badged as "conceptual, not validated hydrodynamic output" in the UI itself. Do not remove that badge until Stage 2 is wired to real Directive 5 output.

## 4. Build order (do not reorder)

```
Fix Directive 2 (watershed) — verify coordinates, re-delineate, must pass validation
        ↓
Fix Directive 3 (hydrology) — re-derive inflow honestly, no forced calibration
        ↓
Fix Directive 5A (solver) — debug CFL/units bug, OR switch to HEC-RAS 2D if time-boxed out
        ↓
Re-run Directive 5B, 6, 7, 8 in sequence on the now-valid rasters
        ↓
Wire the 2D dashboard (app.js) to read real output files instead of hardcoded constants
        ↓
Wire the 3D digital twin's Stage 2 flood animation to real depth/velocity rasters
        ↓
(Optional, half-day, only after everything above works): run PySPH's built-in
dam_break_2d benchmark, compare wave-front timing to its published SPHERIC
reference values, cite this as validation-methodology credibility — do NOT
build a second full Machhu-II engine in SPH or Delft3D
```

## 5. Non-negotiable credibility rules (apply to every output, every directive)

- Every scenario/run must record: terrain source + resolution, data date, model engine + version, breach parameters used, and method (documented reasoning vs. inferred).
- Never let a failed validation check pass silently to the next step — hard stop and surface the failure.
- Distinguish observed data (satellite, historical records) from modelled data visually, everywhere.
- Label every estimate with its uncertainty range. Never present a single precise number for depth, loss, or population exposed without a range and its source.
- Unverified data is flagged explicitly, never fabricated (existing dam-reference table already does this correctly for 3 unverified 2025 incidents — keep that pattern).
- If cross-checking two models or methods, call it "model-consistency assessment," not "validation." Only comparison against a real historical/observed outcome counts as validation.

## 6. Scenario set (already defined, keep as-is)

| Scenario | Breach width | Peak outflow | Formation time |
|---|---|---|---|
| Base Case (Froehlich 2008) | 156m | 6,647 m³/s | 2.5h |
| -25% Conservative | 117m | 4,985 m³/s | 3.1h |
| +25% Breach Width | 195m | 8,309 m³/s | 2.0h |
| +50% Extreme Overtopping | 234m | 10,500 m³/s | 1.5h |

These map directly to the "lower / baseline / conservative" uncertainty framing — no new scenario design work needed, just relabel for the decision-support framing if presenting to judges.

## 7. Visualization priorities (only build once real data exists)

**Build, high value / low cost:**
- Breach outflow hydrograph + downstream depth/time curves at checkpoints (data already exists from Directive 3/4)
- Arrival-time isochrone map (coloring of the arrival-time raster, once real)
- Hazard classification map: High = depth≥2m OR velocity≥2m/s; Medium = depth 0.5-2m OR velocity 0.5-2m/s; Low = below both — state this is a configurable prototype threshold, not a statutory standard
- Loss & damage KPI dashboard (UI already built in `app.js`, just needs real numbers)

**Defer / cut:**
- SPH vs Delft3D side-by-side comparison map — do not build a second production engine
- Photorealistic dam reconstruction from photogrammetry — out of scope for hackathon timeline
- Google Maps satellite draping — use Cesium/ESRI World Imagery instead for licensing reasons if this is pursued later

## 8. Tech stack reference

- Geospatial: Python, rasterio, richdem, geopandas, whitebox
- Hydrology: SCS-CN Dimensionless Unit Hydrograph
- Breach params: Froehlich (2008), Wahl (1998) regression equations
- Hydrodynamic engine: in-house 2D solver (currently broken) OR HEC-RAS 2D via `ras-commander` (fallback)
- Satellite validation: Sentinel-1 SAR / Sentinel-2 via Google Earth Engine
- Frontend: Leaflet.js (2D), Three.js/CesiumJS (3D), Chart.js
- Optional validation-only: PySPH (`pip install pysph`, local, no API/network needed at runtime; requires a C/C++ compiler)
- Core datasets: SRTM DEM, IMD gridded rainfall, HydroRIVERS, ESA WorldCover LULC, CWC NRLD-2023

## 9. Definition of done for this phase

Not "done" until:
- [ ] Directive 2 passes its own validation check (catchment area within target range)
- [ ] Directive 3's inflow peak is derived, not force-calibrated to a target
- [ ] Directive 5 produces depth values physically consistent with dam height (no >20x-head depths)
- [ ] Directive 6 validation metrics (CSI/F1) improve from near-zero to a defensible, reported value — or the gap is honestly documented if it doesn't
- [ ] At least one dashboard (2D or 3D) reads real pipeline output instead of hardcoded numbers, for at least one scenario
