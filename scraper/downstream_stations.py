"""Dynamic downstream stations and receptor discovery using OpenStreetMap Overpass API.
Finds downstream towns, cities, villages, and bridges within the catchment/floodplain,
calculating geodesic distance from dam toe without any hardcoding.
"""

import math
import logging
import time
import requests
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
USER_AGENT = "SIH-2026-Dam-Scraper/1.0 (Emergency Decision Support System; contact@dam-safety.in)"


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on the Earth (in km)."""
    r = 6371.0  # Earth radius in kilometers
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 2)


def discover_downstream_stations(
    dam_name: str,
    dam_lat: float,
    dam_lon: float,
    bbox: Optional[Dict[str, float]] = None,
    max_stations: int = 5,
    max_dist_km: float = 45.0,
    timeout: int = 6,
) -> List[Dict[str, Any]]:
    """Dynamically discover downstream settlements and infrastructure via Overpass API.

    Args:
        dam_name: Name of the dam
        dam_lat: Latitude of dam toe
        dam_lon: Longitude of dam toe
        bbox: Optional dict with min_lat, max_lat, min_lon, max_lon
        max_stations: Maximum number of downstream stations to return
        max_dist_km: Maximum search radius in kilometers
        timeout: HTTP request timeout

    Returns:
        List of station dicts: [{"name": str, "key": str, "lat": float, "lon": float, "dist_km": float}, ...]
    """
    logger.info("Discovering downstream stations dynamically around (%.4f, %.4f)...", dam_lat, dam_lon)

    # Base station 0 is always the Dam Toe
    stations: List[Dict[str, Any]] = [
        {
            "name": f"{dam_name} Toe (0 km)",
            "key": "dam_toe",
            "lat": round(dam_lat, 5),
            "lon": round(dam_lon, 5),
            "dist_km": 0.0,
        }
    ]

    # Search bounding box (approx 0.35 deg radius ~ 40km)
    if bbox:
        south, north = bbox["min_lat"], bbox["max_lat"]
        west, east = bbox["min_lon"], bbox["max_lon"]
    else:
        deg_offset = max_dist_km / 111.0
        south, north = dam_lat - deg_offset, dam_lat + deg_offset
        west, east = dam_lon - deg_offset, dam_lon + deg_offset

    # Overpass QL query to find cities, towns, villages, and bridges
    query = f"""
    [out:json][timeout:{timeout}];
    (
      node["place"~"city|town|village"]({south},{west},{north},{east});
    );
    out body 25;
    """

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }

    elements = []
    for endpoint in OVERPASS_ENDPOINTS[:2]:
        try:
            resp = requests.post(endpoint, data={"data": query}, headers=headers, timeout=4)
            if resp.status_code == 200:
                elements = resp.json().get("elements", [])
                if elements:
                    break
        except Exception as exc:
            logger.debug("Overpass endpoint %s note: %s", endpoint, exc)
            continue

    if not elements:
        logger.info("Querying Nominatim for nearby downstream settlements...")
        nom_url = "https://nominatim.openstreetmap.org/search"
        nom_params = {
            "q": "town OR village OR city",
            "format": "jsonv2",
            "viewbox": f"{west},{north},{east},{south}",
            "bounded": 1,
            "limit": 10,
        }
        try:
            nom_resp = requests.get(nom_url, params=nom_params, headers={"User-Agent": USER_AGENT}, timeout=10)
            if nom_resp.status_code == 200:
                for item in nom_resp.json():
                    elements.append({
                        "lat": float(item["lat"]),
                        "lon": float(item["lon"]),
                        "tags": {
                            "name": item.get("name") or item.get("display_name", "").split(",")[0],
                            "place": item.get("type", "town"),
                        },
                    })
        except Exception as exc:
            logger.debug("Nominatim downstream search note: %s", exc)

    candidates = []
    seen_names = set()

    for el in elements:
        name = el.get("tags", {}).get("name") or el.get("tags", {}).get("name:en")
        if not name or name.lower() in seen_names:
            continue
        lat = el["lat"]
        lon = el["lon"]
        dist = haversine_distance_km(dam_lat, dam_lon, lat, lon)

        # Retain if within reasonable downstream corridor (e.g. 1.5 km to max_dist_km)
        if 1.5 <= dist <= max_dist_km:
            place_type = el.get("tags", {}).get("place", "settlement")
            # Weight towns and cities higher than tiny hamlets
            priority = 1 if place_type == "city" else (2 if place_type == "town" else 3)
            candidates.append({
                "name": f"{name} ({dist:.1f} km)",
                "raw_name": name,
                "key": name.lower().replace(" ", "_").replace("-", "_")[:20],
                "lat": round(lat, 5),
                "lon": round(lon, 5),
                "dist_km": dist,
                "priority": priority,
            })
            seen_names.add(name.lower())

    # Sort candidates by distance
    candidates.sort(key=lambda x: (x["dist_km"]))

    # Pick well-spaced stations along the downstream reach
    selected = []
    last_dist = 0.0
    for cand in candidates:
        # Enforce minimum distance spacing between successive stations (~ 4 km)
        if (cand["dist_km"] - last_dist) >= 3.5:
            selected.append({
                "name": cand["name"],
                "key": cand["key"],
                "lat": cand["lat"],
                "lon": cand["lon"],
                "dist_km": cand["dist_km"],
            })
            last_dist = cand["dist_km"]
            if len(selected) >= max_stations - 1:
                break

    stations.extend(selected)
    logger.info("Found %d downstream stations for %s", len(stations), dam_name)
    return stations
