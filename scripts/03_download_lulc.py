#!/usr/bin/env python3
"""Script to download Land Use / Land Cover (LULC) data for the Machhu basin / Gujarat AOI.

AOI bounding box: 22.0–23.2°N, 70.4–71.3°E
Sources:
1. ESA WorldCover 2021 (10m resolution) - tile N21E069 covers 21-24°N, 69-72°E.
2. Copernicus Global Land Cover (100m resolution) as fallback.

Output is saved to `data/raw/lulc/lulc_raw.tif` or clipped to AOI.
"""

import pathlib
import logging
import requests
import time

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")

PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_RAW_LULC = PROJECT_ROOT / "data" / "raw" / "lulc"
DATA_RAW_LULC.mkdir(parents=True, exist_ok=True)

OUT_FILE = DATA_RAW_LULC / "lulc_raw.tif"

# ESA WorldCover 2021 10m tile for (N21-N24, E069-E072) covering our AOI:
# Lon: 70.4 to 71.3, Lat: 22.0 to 23.2
URL_ESA = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N21E069_Map.tif"

def download_file(url: str, dest: pathlib.Path, chunk_size: int = 1024 * 1024):
    logging.info(f"Checking URL: {url}")
    head = requests.head(url, timeout=30)
    if head.status_code != 200:
        raise RuntimeError(f"URL returned HTTP {head.status_code}")
    
    total_bytes = int(head.headers.get("content-length", 0))
    logging.info(f"Downloading {dest.name} ({total_bytes / (1024*1024):.1f} MB)...")
    
    resp = requests.get(url, stream=True, timeout=120)
    resp.raise_for_status()
    
    downloaded = 0
    start_time = time.time()
    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=chunk_size):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                if total_bytes > 0:
                    pct = (downloaded / total_bytes) * 100
                    speed = (downloaded / (1024*1024)) / (time.time() - start_time + 0.001)
                    print(f"\r  Progress: {pct:.1f}% ({downloaded/(1024*1024):.1f}/{total_bytes/(1024*1024):.1f} MB, {speed:.2f} MB/s)", end="", flush=True)
    print()
    logging.info(f"Saved to {dest} ({dest.stat().st_size / (1024*1024):.1f} MB)")

def main():
    if OUT_FILE.is_file() and OUT_FILE.stat().st_size > 1024 * 1024:
        logging.info(f"SKIP LULC – already exists: {OUT_FILE} ({OUT_FILE.stat().st_size / 1e6:.1f} MB)")
        return
    
    try:
        download_file(URL_ESA, OUT_FILE)
    except Exception as e:
        logging.error(f"Failed to download ESA WorldCover: {e}")
        # Fallback note
        logging.info("If direct ESA download fails, manual Bhuvan LULC can be placed in data/raw/lulc/ as noted in Directive 1b.")

if __name__ == "__main__":
    main()
