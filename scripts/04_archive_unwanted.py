#!/usr/bin/env python3
"""Move unwanted / leftover / irrelevant files from active folders into `archives/`."""

import pathlib
import shutil
import logging

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")

PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
ARCHIVES_DIR = PROJECT_ROOT / "archives"
ARCHIVES_DIR.mkdir(parents=True, exist_ok=True)

# 1. Unwanted zip files in data/raw/
raw_zips = [
    PROJECT_ROOT / "data" / "raw" / "HydroRIVERS_v10_as_shp.zip",
    PROJECT_ROOT / "data" / "raw" / "N16E074.SRTMGL1.hgt.zip",
    PROJECT_ROOT / "data" / "raw" / "P5_PAN_CD_N14_000_E078_000_30m.zip",
    PROJECT_ROOT / "data" / "raw" / "P5_PAN_CD_N14_000_E079_000_30m.zip",
]

for p in raw_zips:
    if p.is_file():
        dest = ARCHIVES_DIR / "zips" / p.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(p), str(dest))
        logging.info(f"Archived: {p.name} -> archives/zips/")

# 2. Stray folders (data/dam, data/river, rain)
stray_folders = [
    (PROJECT_ROOT / "data" / "dam", ARCHIVES_DIR / "legacy_dam_folder"),
    (PROJECT_ROOT / "data" / "river", ARCHIVES_DIR / "legacy_river_folder"),
    (PROJECT_ROOT / "rain", ARCHIVES_DIR / "legacy_rain_folder"),
]

for src, dest in stray_folders:
    if src.is_dir():
        dest.mkdir(parents=True, exist_ok=True)
        for item in src.iterdir():
            target = dest / item.name
            try:
                if item.is_file():
                    shutil.copy2(item, target)
                    try:
                        item.unlink()
                        logging.info(f"Moved: {item.name} -> {dest.relative_to(PROJECT_ROOT)}")
                    except Exception:
                        logging.info(f"Copied (in-use): {item.name} -> {dest.relative_to(PROJECT_ROOT)}")
                elif item.is_dir():
                    shutil.copytree(item, target, dirs_exist_ok=True)
                    try:
                        shutil.rmtree(item)
                    except Exception:
                        pass
            except Exception as e:
                logging.warning(f"Could not archive {item.name}: {e}")
        try:
            src.rmdir()
        except Exception:
            pass

# 3. Old log/batch files in root
root_files = [
    PROJECT_ROOT / "download_log.txt",
    PROJECT_ROOT / "powershell.bat",
]
for p in root_files:
    if p.is_file():
        dest = ARCHIVES_DIR / p.name
        try:
            shutil.move(str(p), str(dest))
            logging.info(f"Archived root file: {p.name} -> archives/")
        except Exception as e:
            logging.warning(f"Could not move {p.name}: {e}")

logging.info("Archive cleanup complete.")
