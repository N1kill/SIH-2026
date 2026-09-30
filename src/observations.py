"""Optional Earth Engine context; missing observations never mean zero flooding."""

from datetime import date, timedelta, datetime, timezone
import importlib.util
import json
import os
from .project import ROOT
from .run_engine import write_json


def satellite_context(project, refresh=False):
    cache = ROOT / "data/cache/observations" / f"{project.dam_id}.json"
    if cache.exists() and not refresh:
        return {**json.loads(cache.read_text(encoding="utf-8")), "cached": True}
    ee_project = os.getenv("EE_PROJECT")
    if not ee_project:
        return {
            "status": "disabled",
            "reason": "Set EE_PROJECT and authenticate Earth Engine; no observations fabricated",
        }
    if importlib.util.find_spec("ee") is None:
        return {
            "status": "unavailable",
            "reason": "Optional earthengine-api package is not installed",
        }
    try:
        import ee

        ee.Initialize(project=ee_project)
        point = ee.Geometry.Point([project.longitude, project.latitude])
        region = point.buffer(10000).bounds()
        end = date.today()
        start = end - timedelta(days=30)
        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(region)
            .filterDate(start.isoformat(), end.isoformat())
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
            .sort("system:time_start", False)
        )
        if collection.size().getInfo() == 0:
            return {
                "status": "unavailable",
                "reason": "No cloud-filtered Sentinel-2 scene in the last 30 days",
            }
        image = ee.Image(collection.first())
        properties = image.toDictionary(
            ["system:index", "system:time_start", "CLOUDY_PIXEL_PERCENTAGE"]
        ).getInfo()
        value = {
            "status": "available",
            "dataset": "COPERNICUS/S2_SR_HARMONIZED",
            "properties": properties,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "cached": False,
            "source": "https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED",
            "note": "Recent imagery metadata only; not a flood observation or a 1979 validation dataset",
        }
        cache.parent.mkdir(parents=True, exist_ok=True)
        write_json(cache, value)
        return value
    except Exception as exc:
        return {
            "status": "unavailable",
            "reason": f"Earth Engine request failed: {type(exc).__name__}; check credentials, project permissions, and network",
        }
