"""Master pipeline orchestrator for dynamic dam data scraping.
Combines geocoding, structural metadata extraction, real-time weather telemetry,
downstream receptor discovery, and CWC reservoir monitoring into a unified system.
NO HARDCODED DATA.
"""

import os
import json
import logging
import pathlib
import time
from typing import Dict, Any, Optional

from .geocoding import geocode_dam
from .metadata_scraper import scrape_dam_metadata
from .realtime_weather import fetch_realtime_weather
from .downstream_stations import discover_downstream_stations
from .cwc_scraper import scrape_cwc_reservoir_status

logger = logging.getLogger(__name__)


class DamDataScraper:
    """Orchestrator to dynamically scrape all required data for any given dam name."""

    def __init__(self, project_root: Optional[pathlib.Path] = None):
        if project_root is None:
            self.project_root = pathlib.Path(__file__).resolve().parents[1]
        else:
            self.project_root = pathlib.Path(project_root)

    def scrape(
        self,
        dam_name: str,
        country_code: str = "in",
        include_realtime_weather: bool = True,
        include_downstream: bool = True,
        include_cwc: bool = True,
    ) -> Dict[str, Any]:
        """Perform comprehensive dynamic scraping for the given dam name.

        Args:
            dam_name: Name of the dam (e.g. "Idukki Dam", "Tehri Dam")
            country_code: Country ISO code (default: "in")
            include_realtime_weather: Whether to fetch live meteorology
            include_downstream: Whether to discover downstream stations
            include_cwc: Whether to check CWC live telemetry

        Returns:
            Comprehensive structured dictionary of all scraped data and provenance.
        """
        start_time = time.time()
        logger.info("==================================================")
        logger.info("Initiating dynamic data scraping for: '%s'", dam_name)
        logger.info("==================================================")

        # 1. Geocoding
        geo = geocode_dam(dam_name, country_code=country_code)
        lat = geo["lat"]
        lon = geo["lon"]
        state = geo["state"]
        bbox = geo["bbox"]

        # Generate a slug ID for config and filesystem
        clean_key = (
            dam_name.lower()
            .replace("dam", "")
            .replace("reservoir", "")
            .strip()
            .replace(" ", "_")
            .replace("-", "_")
        )
        if not clean_key:
            clean_key = "dam_" + str(int(time.time()))
        dam_id = clean_key.strip("_")

        # 2. Structural & Hydraulic Metadata
        meta = scrape_dam_metadata(
            dam_name=dam_name,
            lat=lat,
            lon=lon,
            wikidata_id=geo.get("wikidata_id"),
            wikipedia_title=geo.get("wikipedia_title"),
        )

        # 3. Real-Time Meteorology & Hydrology
        weather = None
        if include_realtime_weather:
            try:
                weather = fetch_realtime_weather(lat=lat, lon=lon)
            except Exception as e:
                logger.warning("Weather scraping encountered an issue: %s", e)
                weather = {"error": str(e), "telemetry_available": False}

        # 4. Downstream Receptor Stations
        stations = []
        if include_downstream:
            try:
                stations = discover_downstream_stations(
                    dam_name=dam_name,
                    dam_lat=lat,
                    dam_lon=lon,
                    bbox=bbox,
                )
            except Exception as e:
                logger.warning("Downstream stations discovery encountered an issue: %s", e)
                stations = [
                    {"name": f"{dam_name} Toe (0 km)", "key": "dam_toe", "lat": lat, "lon": lon, "dist_km": 0.0}
                ]

        # 5. CWC Reservoir Telemetry
        cwc_data = None
        if include_cwc:
            cwc_data = scrape_cwc_reservoir_status(
                dam_name=dam_name,
                state=state,
                river=meta.get("river"),
            )

        elapsed_sec = round(time.time() - start_time, 2)
        logger.info("Scraping completed in %.2f seconds.", elapsed_sec)

        # Build Config-compatible structure
        config_entry = {
            "dam_name": dam_name,
            "state": state,
            "lat": lat,
            "lon": lon,
            "dam_height_m": meta.get("dam_height_m"),
            "crest_length_m": meta.get("crest_length_m"),
            "reservoir_volume_m3": meta.get("reservoir_volume_m3"),
            "spillway_capacity_m3s": meta.get("spillway_capacity_m3s"),
            "downstream_stations": stations,
            "bbox": bbox,
        }

        # Complete unified dossier
        dossier = {
            "dam_id": dam_id,
            "dam_name": dam_name,
            "scrape_timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "elapsed_seconds": elapsed_sec,
            "geography": geo,
            "structural_parameters": meta,
            "realtime_weather": weather,
            "downstream_monitoring_stations": stations,
            "live_reservoir_telemetry": cwc_data,
            "simulation_config_entry": config_entry,
        }

        return dossier

    def save_dossier(self, dossier: Dict[str, Any], output_path: Optional[pathlib.Path] = None) -> pathlib.Path:
        """Save the complete scraped dossier as a JSON file in scraper/output/."""
        dam_id = dossier["dam_id"]
        if output_path is None:
            out_dir = self.project_root / "scraper" / "output"
            out_dir.mkdir(parents=True, exist_ok=True)
            output_path = out_dir / f"{dam_id}_realtime_dossier.json"
        else:
            output_path = pathlib.Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(dossier, f, indent=2, ensure_ascii=False)
        logger.info("Saved scraped dossier to: %s", output_path)

        # Also mirror to data/scraped for simulation pipeline backwards compatibility
        try:
            mirror_dir = self.project_root / "data" / "scraped"
            mirror_dir.mkdir(parents=True, exist_ok=True)
            mirror_path = mirror_dir / f"{dam_id}_realtime_dossier.json"
            if mirror_path.resolve() != output_path.resolve():
                with open(mirror_path, "w", encoding="utf-8") as mf:
                    json.dump(dossier, mf, indent=2, ensure_ascii=False)
        except Exception as err:
            logger.debug("Mirroring to data/scraped skipped: %s", err)

        return output_path

    def update_config_json(self, dossier: Dict[str, Any], config_file: Optional[pathlib.Path] = None) -> pathlib.Path:
        """Inject or update the scraped dam configuration into project config.json."""
        if config_file is None:
            config_file = self.project_root / "config.json"
        else:
            config_file = pathlib.Path(config_file)

        existing_config = {}
        if config_file.is_file():
            with open(config_file, "r", encoding="utf-8") as f:
                try:
                    existing_config = json.load(f)
                except Exception:
                    existing_config = {}

        dam_id = dossier["dam_id"]
        existing_config[dam_id] = dossier["simulation_config_entry"]

        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(existing_config, f, indent=2, ensure_ascii=False)

        logger.info("Updated %s with new dam entry '%s'", config_file.name, dam_id)
        return config_file


def scrape_dam_data(dam_name: str, **kwargs) -> Dict[str, Any]:
    """Convenience functional interface to scrape dam data."""
    scraper = DamDataScraper()
    return scraper.scrape(dam_name, **kwargs)
