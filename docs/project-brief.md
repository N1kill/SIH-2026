# Machhu-II Dam Breach Project Brief

## Context
- **Project**: 3D Dam-Breach Flood Inundation Prototype
- **Target Dam**: Machhu-II Dam, Morbi, Gujarat, India
- **Breach Event**: 11 August 1979
- **Coordinates**: 22.82°N, 70.84°E
- **Catchment Area at Dam**: 1,928 km²
- **Full Machhu River Basin**: 2,515 km², 130 km long
- **Dam Height**: 22.56 m (~22.6 m)
- **Gross Storage**: ~101 million m³
- **AOI Bounding Box (All Spatial Data)**: 22.0–23.2°N, 70.4–71.3°E

## Technical Directives Summary
1. **Data Collection**: DEM (OpenTopography 30m SRTM GL1), IMD Rainfall 1979 (0.25° grid), HydroRIVERS Asia shapefile, NRLD dam register, LULC (ESA WorldCover 10m / Bhuvan).
2. **DEM Conditioning**: Reproject to EPSG:32642 (UTM 42N), fill sinks with RichDEM, D8 flow direction/accumulation, delineate watershed pour point at (22.82°N, 70.84°E) to verify 1,928 km² catchment.
3. **SCS-CN Runoff & Hydrograph**: Overlay LULC × HSG soil for composite CN, compute runoff depth for 5–15 Aug 1979, derive inflow hydrograph with SCS Dimensionless Unit Hydrograph (sanity check ~5,550–5,663 m³/s).
4. **Breach Parameters**: Calculate Froehlich (2008) regression parameters (width, side slope, time) and compare vs Wahl (1998) observed values.
5. **HEC-RAS 2D Simulation**: Build 2D mesh, terrain, storage area, boundary conditions, breach event, simulate via headless automation, export depth/WSE GeoTIFFs.
6. **Validation & Sensitivity**: Run ±25% and ±50% sensitivity scenarios; qualitative flood level comparison at Morbi city center (~10 ft historical).
7. **3D Visualization**: CesiumJS interactive 3D web application with scenario dropdown + time slider, and QGIS 3D export.
8. **Documentation**: Final audit and technical report.
