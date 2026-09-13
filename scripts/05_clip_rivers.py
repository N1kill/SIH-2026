#!/usr/bin/env python3
"""Clip the Asia-wide HydroRIVERS shapefile to the Machhu AOI bounding box.

AOI: (west=70.4, south=22.0, east=71.3, north=23.2)
Input: data/raw/rivers/HydroRIVERS_v10_as_shp/HydroRIVERS_v10_as.shp (~207 MB)
Output: data/raw/rivers/hydrorivers_clip.shp (~1 MB) per Directive 1.
"""

import pathlib
import logging
import geopandas as gpd
from shapely.geometry import box

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")

PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
RIVERS_DIR = PROJECT_ROOT / "data" / "raw" / "rivers"
SRC_SHP = RIVERS_DIR / "HydroRIVERS_v10_as_shp" / "HydroRIVERS_v10_as.shp"
OUT_SHP = RIVERS_DIR / "hydrorivers_clip.shp"

BBOX = (70.4, 22.0, 71.3, 23.2)  # (minx, miny, maxx, maxy)

def main():
    if OUT_SHP.is_file() and OUT_SHP.stat().st_size > 1024:
        gdf = gpd.read_file(OUT_SHP)
        logging.info(f"Clipped HydroRIVERS shapefile already present and validated: {OUT_SHP} ({len(gdf)} segments, {OUT_SHP.stat().st_size / 1024:.1f} KB)")
        return

    if not SRC_SHP.is_file():
        logging.warning(f"Source HydroRIVERS shapefile not found: {SRC_SHP}. Checking if hydrorivers_clip.shp exists...")
        if OUT_SHP.is_file():
            gdf = gpd.read_file(OUT_SHP)
            logging.info(f"Using existing clipped HydroRIVERS: {OUT_SHP} ({len(gdf)} segments)")
            return
        logging.error(f"Both source {SRC_SHP} and clipped {OUT_SHP} are missing.")
        return

    logging.info(f"Loading and clipping HydroRIVERS from {SRC_SHP.name} to bbox {BBOX}...")
    bbox_geom = box(*BBOX)
    
    gdf = gpd.read_file(SRC_SHP, bbox=BBOX)
    logging.info(f"Extracted {len(gdf)} river segments within AOI.")
    
    gdf.to_file(OUT_SHP)
    logging.info(f"Saved clipped river shapefile to {OUT_SHP} ({OUT_SHP.stat().st_size / 1024:.1f} KB)")

if __name__ == "__main__":
    main()
