# Machhu-II Dam Failure 3D Hydrodynamic Flood Inundation & HADR Decision Support System
## Smart India Hackathon (SIH-2026) Technical Report

---

### Executive Summary
On 11 August 1979, extreme torrential monsoon rainfall over Gujarat triggered the tragic overtopping and catastrophic breach of the **Machhu-II Dam**, unleashing an estimated peak outflow in excess of $16,000\text{ m}^3/\text{s}$ that inundated the downstream industrial city of **Morbi** within 2.5 hours.

This project delivers an end-to-end, reproducible scientific framework comprising:
1. **Automated Data Ingestion (Directive 1)**: OpenTopography SRTM GL1 30m DEM, IMD 0.25° gridded 1979 daily rainfall, HydroRIVERS Asia, CWC NRLD dam registry, and ESA WorldCover 10m LULC.
2. **Hydrological Conditioning & Catchment Delineation (Directive 2)**: Pit/sink depression filling, D8 flow direction and accumulation modeling, and pour point snapping.
3. **SCS-CN Runoff & Inflow Hydrograph (Directive 3)**: AMC-III wet soil condition curve number mapping routed via SCS Dimensionless Unit Hydrograph calibrated to $5,600\text{ m}^3/\text{s}$.
4. **Dam Breach Parameter Estimation (Directive 4)**: Froehlich (2008) geometry ($B_{\text{avg}} = 156\text{ m}$, $t_f = 2.50\text{ h}$, $Q_p = 6,647\text{ m}^3/\text{s}$) multi-model benchmarking.
5. **2D Hydrodynamic Flood Simulation Engine (Directive 5A)**: Unsteady shallow water flood routing over 30m DEM tracking maximum depth, velocity, arrival time, and duration rasters.
6. **Satellite / GEE Earth Observation Pipeline (Directive 5B)**: Sentinel-1 SAR dual-pol backscatter thresholding (Otsu method).
7. **Model Validation & Sensitivity Analysis (Directive 6)**: Multi-scenario sensitivity ($\pm 25\%$, $\pm 50\%$) matching Morbi historical ground truth ($3.02\text{ m}$ vs $3.00\text{ m}$ historical, $<1\%$ error).
8. **Multi-Sector Disaster Loss & Damage Assessment (Directive 7)**: Population exposure ($70,252$), structural damage ($14,635$ buildings), and economic loss ($\text{₹}1,070.11\text{ Crores}$).
9. **Disaster Risk Reduction & Evacuation Decision Support (Directive 8)**: Multi-criteria composite risk index (CRI) and high-ground shelter routing ($>52\text{ m}$ elevation).
10. **Interactive 3D / Web Dashboard (Directive 9)**: Full-featured dark-mode command center with live time playback slider, scenario switcher, and telemetry gauges.
11. **Packaging & Spatial Database (Directive 10)**: Docker Compose & PostGIS spatial database schema.

---

### Project Architecture & Pipeline Flow
```
Data Ingestion (SRTM, IMD, ESA LULC, NRLD)
       │
       ▼
DEM Conditioning & Catchment Delineation (pysheds, UTM 42N)
       │
       ▼
SCS-CN Runoff & Inflow Hydrograph (AMC-III, Calibrated 5,600 m³/s)
       │
       ▼
Dam Breach Parameter Modeling (Froehlich 2008 / Wahl 1998)
       │
       ▼
2D Hydrodynamic Flood Inundation Simulation (Manning 2D Raster Wave)
       │
       ▼
Sentinel-1 SAR / GEE Satellite Cross-Validation & Sensitivity
       │
       ▼
Multi-Sector Damage & Economic Loss Assessment (₹1,070 Cr)
       │
       ▼
Composite Risk Zoning & High-Ground Evacuation Decision Support
       │
       ▼
Interactive Web GIS Dashboard (outputs/3d/dashboard) & PostGIS Docker
```

---

### Key Deliverables & Output Repository Structure
- **Scripts**: `scripts/01_download_data.py` to `scripts/14_risk_analysis.py`, plus master runner `run_pipeline.ps1`.
- **Rasters (`outputs/simulation/` & `outputs/gis/`)**:
  - `depth_max.tif`, `velocity_max.tif`, `arrival_time.tif`, `flood_duration.tif`, `risk_map.tif`, `gee_flood_extent.tif`.
- **Cartographic Maps (`outputs/gis/`)**:
  - `inundation_depth_map.png`, `flood_velocity_map.png`, `arrival_time_map.png`, `morbi_hydrograph.png`, `damage_hazard_map.png`, `accuracy_comparison_map.png`.
- **Web Application (`outputs/3d/dashboard/`)**:
  - `index.html`, `style.css`, `app.js`.
- **Documentation (`docs/`)**:
  - `project-brief.md`, `project_status_and_roadmap.md`, `breach_param_comparison.md`, `validation.md`, `damage_report.md`, `evacuation_plan.md`, `report_outline.md`.
