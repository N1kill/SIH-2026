#!/usr/bin/env python3
"""Script to download required raw datasets for the Machhu‑II dam breach project.

Directives covered (Directive 1):
1. DEM – OpenTopography SRTM GL1 (30 m) using the provided API key.
2. Rainfall – IMD 0.25° gridded daily rainfall for 1979 via `imdlib`.
3. River network – HydroRIVERS Asia shapefile.
4. Dam register – NRLD 2023 PDF (placeholder for manual extraction).

All data are stored under `/data/raw/<subfolder>` relative to the project root.
"""

import os
import sys
import json
import pathlib
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")

# Project root (SIH directory, one level up from scripts/)
PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_RAW = PROJECT_ROOT / "data" / "raw"

# Ensure subfolders exist
SUBFOLDERS = {
    "dem": DATA_RAW / "dem",
    "rainfall": DATA_RAW / "rainfall",
    "rivers": DATA_RAW / "rivers",
    "dams": DATA_RAW / "dams",
}
for name, path in SUBFOLDERS.items():
    path.mkdir(parents=True, exist_ok=True)
    logging.info(f"Ensured folder: {path}")

# ---------------------------------------------------------------------------
# Helper: retry with exponential backoff
# ---------------------------------------------------------------------------
import time as _time

def _retry(func, description: str, max_attempts: int = 3, backoff: float = 5.0):
    """Call *func()* up to *max_attempts* times with exponential backoff."""
    for attempt in range(1, max_attempts + 1):
        try:
            return func()
        except Exception as e:
            if attempt == max_attempts:
                logging.error(f"{description}: all {max_attempts} attempts failed – {e}")
                raise
            wait = backoff * (2 ** (attempt - 1))
            logging.warning(f"{description}: attempt {attempt} failed ({e}). Retrying in {wait:.0f}s …")
            _time.sleep(wait)

# ---------------------------------------------------------------------------
# 1. DEM download via OpenTopography
# ---------------------------------------------------------------------------
def download_dem(api_key: str, bbox: tuple, out_path: pathlib.Path):
    """Download SRTM GL1 DEM for the given bounding box.

    Args:
        api_key: OpenTopography API key (string).
        bbox: (min_lon, min_lat, max_lon, max_lat) in decimal degrees.
        out_path: Path where the GeoTIFF will be saved.
    """
    import requests

    url = "https://portal.opentopography.org/API/globaldem"
    params = {
        "demtype": "SRTMGL1",
        "west": bbox[0],
        "south": bbox[1],
        "east": bbox[2],
        "north": bbox[3],
        "outputFormat": "GTiff",
        "API_Key": api_key,
    }
    logging.info(f"Requesting DEM from OpenTopography: {params}")

    def _do():
        response = requests.get(url, params=params, timeout=180)
        response.raise_for_status()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "wb") as f:
            f.write(response.content)
        logging.info(f"DEM saved to {out_path}")

    _retry(_do, "DEM download")

# ---------------------------------------------------------------------------
# 2. Rainfall via imdlib
# ---------------------------------------------------------------------------
def download_rainfall(year: int, out_path: pathlib.Path):
    """Fetch IMD daily rainfall for a single year and write to NetCDF.
    The `imdlib` library returns an xarray Dataset which we save as NetCDF.
    """
    import imdlib

    def _do():
        ds = imdlib.get_data("rain", year, year, fn_format="yearwise")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        ds.to_netcdf(out_path)
        logging.info(f"Rainfall data for {year} saved to {out_path}")

    _retry(_do, f"Rainfall {year}")

# ---------------------------------------------------------------------------
# 3. River network – HydroRIVERS Asia shapefile
# ---------------------------------------------------------------------------
def download_hydrorivers(out_dir: pathlib.Path):
    """Download the HydroRIVERS shapefile (Asia subset) and extract it.
    The source is a public zip file – no authentication required.
    """
    import zipfile
    import tempfile
    import requests

    url = "https://data.hydrosheds.org/file/HydroRIVERS/HydroRIVERS_v10_as_shp.zip"
    logging.info(f"Downloading HydroRIVERS from {url}")

    def _do():
        resp = requests.get(url, stream=True, timeout=300)
        resp.raise_for_status()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp_zip:
            for chunk in resp.iter_content(chunk_size=65536):
                if chunk:
                    tmp_zip.write(chunk)
            temp_path = pathlib.Path(tmp_zip.name)
        with zipfile.ZipFile(temp_path, "r") as zip_ref:
            zip_ref.extractall(out_dir)
        logging.info(f"HydroRIVERS extracted to {out_dir}")
        temp_path.unlink()

    _retry(_do, "HydroRIVERS download")

# ---------------------------------------------------------------------------
# 4. Dam register – NRLD PDF (manual step)
# ---------------------------------------------------------------------------
def note_dam_register_manual():
    logging.info(
        "NRLD PDF download and Gujarat table extraction is a manual step. "
        "Please download the PDF from https://cwc.gov.in/en/publication/nrld, "
        "save it to /data/raw/dams/nrld_2023.pdf, and extract the Machhu‑II rows "
        "into /data/raw/dams/nrld_machhu.csv."
    )

# ---------------------------------------------------------------------------
# Helper: check if a download step can be skipped
# ---------------------------------------------------------------------------
def _already_done(path: pathlib.Path, min_bytes: int = 1024) -> bool:
    """Return True if *path* exists and is larger than *min_bytes*."""
    if path.is_file() and path.stat().st_size >= min_bytes:
        return True
    if path.is_dir() and any(path.iterdir()):
        return True
    return False

# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    API_KEY = "00c7ae9598c4b554b6b633baf0b76348"  # <-- Provided in the mission brief
    BBOX = (70.4, 22.0, 71.3, 23.2)  # (west, south, east, north)

    # 1. DEM
    dem_path = SUBFOLDERS["dem"] / "dem_raw.tif"
    if _already_done(dem_path):
        logging.info(f"SKIP DEM – already exists: {dem_path} ({dem_path.stat().st_size / 1e6:.1f} MB)")
    else:
        try:
            download_dem(API_KEY, BBOX, dem_path)
        except Exception:
            logging.error("DEM download failed – continuing with other steps.")

    # 2. Rainfall for 1979
    rainfall_path = SUBFOLDERS["rainfall"] / "imd_1979.nc"
    if _already_done(rainfall_path):
        logging.info(f"SKIP Rainfall – already exists: {rainfall_path} ({rainfall_path.stat().st_size / 1e6:.1f} MB)")
    else:
        try:
            download_rainfall(1979, rainfall_path)
        except Exception:
            logging.error("Rainfall download failed – continuing with other data.")

    # 3. River network
    rivers_dir = SUBFOLDERS["rivers"]
    if _already_done(rivers_dir):
        logging.info(f"SKIP Rivers – already exists: {rivers_dir}")
    else:
        try:
            download_hydrorivers(rivers_dir)
        except Exception:
            logging.error("River network download failed – continuing.")

    # 4. Dam register – manual reminder
    note_dam_register_manual()

    logging.info("All automated data downloads completed.")
