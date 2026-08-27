# Machhu-II Dam Breach 3D Flood Simulation — Status & Roadmap

**Repository**: [https://github.com/N1kill/SIH-2026](https://github.com/N1kill/SIH-2026)  
**Last Updated**: 2026-08-27  

---

## 📊 Summary of Completed Work (Directives 0 & 1)

### ✅ 1. Project Initialization & Architecture (Directive 0)
- Established unified folder structure: `/data/raw`, `/data/processed`, `/scripts`, `/models`, `/outputs/gis`, `/outputs/hecras`, `/outputs/3d`, `/docs`, `/archives`.
- Configured Python virtual environment (`.venv`) and created [`requirements.txt`](../requirements.txt).
- Formulated project mission brief in [`docs/project-brief.md`](project-brief.md).
- Cleaned up legacy/duplicate files and moved non-pertinent datasets to [`archives/`](../archives/).

### ✅ 2. Automated Data Acquisition & Harmonization (Directive 1)
All raw spatial, meteorological, and hydraulic inputs for the Machhu-II Dam (Morbi, Gujarat — AOI: 22.0–23.2°N, 70.4–71.3°E) have been downloaded, verified, and placed under `data/raw/`:

| Dataset | Source / Resolution | Local File Path | Status |
| :--- | :--- | :--- | :--- |
| **DEM** | OpenTopography SRTM GL1 (30m) | `data/raw/dem/dem_raw.tif` | ✅ Downloaded (7.3 MB) |
| **Rainfall** | IMD 0.25° Gridded Daily (1979) | `data/raw/rainfall/imd_1979.nc` | ✅ Downloaded (50.9 MB) |
| **River Network** | HydroRIVERS Asia Shapefile | `data/raw/rivers/hydrorivers_clip.shp` | ✅ Clipped to AOI (564 river segments, 89 KB) |
| **Dam Register** | Central Water Commission NRLD | `data/raw/dams/nrld_machhu.csv` | ✅ Extracted (Machhu-I, II, III records) |
| **LULC** | ESA WorldCover 2021 (10m) | `data/raw/lulc/lulc_raw.tif` | ✅ Downloaded (88.6 MB GeoTIFF) |

### ✅ 3. Repository Version Control & Synchronization
- Configured [`.gitignore`](../.gitignore) to exclude oversized binaries while retaining critical models, documentation, code, and clipped spatial layers.
- Tracked and pushed code and data commits to `https://github.com/N1kill/SIH-2026` (`main` branch).

---

## 🗺️ Detailed Roadmap: What Needs To Be Done

```mermaid
graph TD
    D0["Directive 0: Project Setup (Done)"] --> D1["Directive 1: Data Collection (Done)"]
    D1 --> D2["Directive 2: DEM Conditioning & Catchment Delineation"]
    D2 --> D3["Directive 3: SCS-CN Hydrology & Inflow Hydrograph"]
    D3 --> D4["Directive 4: Froehlich Dam Breach Parameters"]
    D4 --> D5["Directive 5: HEC-RAS 2D Hydrodynamic Modeling"]
    D5 --> D6["Directive 6: Sensitivity & Uncertainty Scenarios"]
    D6 --> D7["Directive 7: 3D CesiumJS & Web Visualization"]
    D7 --> D8["Directive 8: Final Packaging & Technical Report"]
```

---

### ⏳ Phase 1: Hydrology & Catchment Analysis

#### **Directive 2: DEM Conditioning & Catchment Delineation**
- **Tasks**:
  1. Reproject DEM to UTM Zone 42N (**EPSG:32642**).
  2. Fill sinks and depressions using `richdem` / depression-filling algorithms.
  3. Compute D8 flow direction and accumulation rasters.
  4. Reproject pour point (**22.82°N, 70.84°E**) and snap to the channel.
  5. Delineate upstream watershed boundary and verify area matches **1,928 km² ± 10%**.
- **Outputs**: `data/processed/dem_conditioned.tif`, `data/processed/flow_acc.tif`, `data/processed/watershed.shp`.

#### **Directive 3: Rainfall, LULC, Soil $\rightarrow$ SCS-CN Runoff Hydrograph**
- **Tasks**:
  1. Clip IMD rainfall to delineated watershed for the critical event (5–15 Aug 1979).
  2. Reclassify ESA 10m LULC raster and assign Hydrologic Soil Groups (HSG).
  3. Generate composite AMC-II Curve Number (CN) raster and adjust for antecedent moisture.
  4. Compute runoff depth using SCS-CN formula:
     $$S = \frac{25400}{CN} - 254, \quad I_a = 0.2S, \quad Q = \frac{(P - I_a)^2}{P - I_a + S}$$
  5. Route runoff into an inflow hydrograph using the SCS Dimensionless Unit Hydrograph.
  6. Sanity-check peak flow against historical records (~5,550–5,663 m³/s).
- **Outputs**: `outputs/gis/inflow_hydrograph.png`, `outputs/gis/hydrograph.csv`, `data/processed/curve_number.tif`.

---

### ⏳ Phase 2: Dam Breach & Hydrodynamic Modeling

#### **Directive 4: Breach Parameters Estimation**
- **Tasks**:
  1. Compute Froehlich (2008) breach geometry equations (average breach width $B_{avg}$, side slopes $Z$, formation time $t_f$) using dam height (22.56 m) and reservoir volume (101 Mm³).
  2. Formulate comparison table comparing Froehlich empirical estimates vs. Wahl (1998) historical observed breach dimensions.
- **Outputs**: `scripts/08_breach_parameters.py`, `docs/breach_param_comparison.md`.

#### **Directive 5: HEC-RAS 2D Hydrodynamic Modeling**
- **Tasks**:
  1. Script HEC-RAS 2D project via `ras-commander`.
  2. Construct computational 2D mesh over the downstream Morbi floodplain (~30–50m resolution).
  3. Set up reservoir storage elevation-volume relationship and upstream boundary condition (inflow hydrograph).
  4. Configure breach mechanics in HEC-RAS Unsteady Flow editor using Froehlich parameters.
  5. Run 2D unsteady hydrodynamic simulation and extract maximum flood depth, velocity, and arrival time rasters.
- **Outputs**: `outputs/hecras/depth_max.tif`, `outputs/hecras/velocity_max.tif`, `outputs/hecras/arrival_time.tif`.

---

### ⏳ Phase 3: Validation, 3D Web Prototype & Packaging

#### **Directive 6: Sensitivity Analysis & Validation**
- **Tasks**:
  1. Execute sensitivity simulations varying breach width & formation time by $\pm 25\%$ and $\pm 50\%$.
  2. Benchmark simulated peak inundation depths at Morbi city center against qualitative historical accounts (~10 ft / 3.0 m flood level).
- **Outputs**: `docs/validation.md`, `outputs/hecras/sensitivity/`.

#### **Directive 7: 3D Visualization Prototype**
- **Tasks**:
  1. Build a responsive CesiumJS web application in `outputs/3d/cesium_app/`.
  2. Overlay time-series flood depth GeoTIFFs dynamically over 3D terrain.
  3. Include UI controls: playback time slider, breach scenario selector ($\pm 25\%, \pm 50\%$), and depth legend.
- **Outputs**: `outputs/3d/cesium_app/index.html`, `outputs/3d/cesium_app/app.js`.

#### **Directive 8: Final Packaging & Submission Ready Documentation**
- **Tasks**:
  1. Create comprehensive technical project report outline in `docs/report_outline.md`.
  2. Verify all references, citations, and repository artifacts.
- **Outputs**: `docs/report_outline.md`, `README.md`.
