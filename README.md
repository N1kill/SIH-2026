# SIH-2026: Machhu-II Dam Breach 3D Flood Inundation Simulation

## Project Context
- **Study Area**: Machhu-II Dam, Morbi, Gujarat, India (Breach date: 11 Aug 1979)
- **Dam Location**: 22.82°N, 70.84°E
- **Catchment Area**: 1,928 km²
- **Full Basin Area**: 2,515 km² (130 km length)
- **Dam Height**: 22.56 m (rebuilt ~22.6 m)
- **Gross Storage**: ~101 million m³
- **AOI Bounding Box**: 22.0–23.2°N, 70.4–71.3°E

## Directory Structure
- `data/raw/`: Raw datasets (DEM, IMD Rainfall, HydroRIVERS, NRLD Dam Register, ESA WorldCover LULC)
- `data/processed/`: Conditioned DEM, watershed polygons, composite CN layers
- `scripts/`:
  - `01_download_data.py`: Automated download of DEM, IMD 1979 rainfall, and HydroRIVERS
  - `02_extract_dam_data.py`: NRLD PDF table extractor for Machhu dam records
  - `03_download_lulc.py`: ESA WorldCover 10m Land Use / Land Cover download
  - `04_archive_unwanted.py`: Data housekeeping and archival utility
- `models/`: Hydrologic and hydraulic model setup files
- `outputs/`:
  - `gis/`: Inundation maps and hydrographs
  - `hecras/`: HEC-RAS 2D simulation results and depth rasters
  - `3d/`: 3D web visualizations and CesiumJS exports
- `docs/`: Technical documentation and project brief
- `archives/`: Legacy and auxiliary data files

## Quick Start
```bash
# Set up Python virtual environment and install dependencies
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Run automated data downloads
python scripts/01_download_data.py
python scripts/02_extract_dam_data.py
python scripts/03_download_lulc.py
```
