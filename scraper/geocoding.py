"""Geocoding module to resolve dam name to geographic coordinates,
bounding box, administrative region, and OSM/Wikidata identifiers without hardcoding.
"""

import logging
import time
import requests
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

USER_AGENT = "SIH-2026-Dam-Scraper/1.0 (Emergency Decision Support System; contact@dam-safety.in)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


def geocode_dam(
    dam_name: str,
    country_code: str = "in",
    max_retries: int = 3,
    timeout: int = 15,
) -> Dict[str, Any]:
    """Dynamically geocode a dam name to lat/lon, bounding box, and metadata.

    Args:
        dam_name: Name of the dam (e.g., "Idukki Dam", "Tehri Dam", "Machhu-II Dam")
        country_code: Country ISO code (default: "in" for India, can be empty for worldwide)
        max_retries: Number of retry attempts on network failure
        timeout: HTTP request timeout in seconds

    Returns:
        Dictionary with lat, lon, bbox, state, district, display_name, extratags, and provenance.
    """
    # Clean query
    query = dam_name.strip()
    if not any(kw in query.lower() for kw in ["dam", "reservoir", "barrage"]):
        search_query = f"{query} Dam"
    else:
        search_query = query

    params = {
        "q": search_query,
        "format": "jsonv2",
        "addressdetails": 1,
        "extratags": 1,
        "limit": 5,
    }
    if country_code:
        params["countrycodes"] = country_code

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }

    last_err = None
    data = []
    for attempt in range(1, max_retries + 1):
        try:
            logger.info("Geocoding '%s' via Nominatim (attempt %d)...", search_query, attempt)
            resp = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=timeout)
            resp.raise_for_status()
            data = resp.json()
            break
        except Exception as err:
            last_err = err
            logger.warning("Geocoding attempt %d failed: %s", attempt, err)
            if attempt < max_retries:
                time.sleep(2.0 * attempt)

    if not data:
        # Fallback search without country filter if initially restricted
        if country_code:
            logger.info("Retrying geocoding without country restrictions...")
            params.pop("countrycodes", None)
            try:
                resp = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=timeout)
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                logger.warning("Unrestricted geocoding failed: %s", e)

    if not data:
        raise ValueError(f"Could not locate dam '{dam_name}' via live geocoding: {last_err or 'no matches found'}")

    # Prioritize result with waterway=dam or place containing dam
    best_match = data[0]
    for item in data:
        extratags = item.get("extratags", {})
        category = item.get("category", "")
        item_type = item.get("type", "")
        if category == "waterway" or item_type == "dam" or "dam" in extratags.get("waterway", ""):
            best_match = item
            break

    lat = float(best_match["lat"])
    lon = float(best_match["lon"])
    raw_bbox = best_match.get("boundingbox", [])

    # OSM bbox format is [min_lat, max_lat, min_lon, max_lon]
    if len(raw_bbox) == 4:
        s_lat, n_lat, w_lon, e_lon = [float(x) for x in raw_bbox]
        # Expand slightly if the box is too narrow (e.g. point feature) to cover downstream domain
        lat_span = n_lat - s_lat
        lon_span = e_lon - w_lon
        if lat_span < 0.2:
            s_lat -= (0.2 - lat_span) / 2
            n_lat += (0.2 - lat_span) / 2
        if lon_span < 0.2:
            w_lon -= (0.2 - lon_span) / 2
            e_lon += (0.2 - lon_span) / 2
    else:
        # Default ~35km domain around the dam
        s_lat, n_lat = lat - 0.25, lat + 0.25
        w_lon, e_lon = lon - 0.25, lon + 0.25

    address = best_match.get("address", {})
    state = address.get("state") or address.get("region") or address.get("province") or "Unknown"
    district = address.get("state_district") or address.get("county") or address.get("city") or "Unknown"
    extratags = best_match.get("extratags", {})

    return {
        "dam_name": dam_name,
        "matched_name": best_match.get("display_name", ""),
        "lat": round(lat, 5),
        "lon": round(lon, 5),
        "state": state,
        "district": district,
        "country": address.get("country", ""),
        "osm_id": best_match.get("osm_id"),
        "osm_type": best_match.get("osm_type"),
        "wikidata_id": extratags.get("wikidata"),
        "wikipedia_title": extratags.get("wikipedia"),
        "extratags": extratags,
        "bbox": {
            "min_lat": round(s_lat, 4),
            "max_lat": round(n_lat, 4),
            "min_lon": round(w_lon, 4),
            "max_lon": round(e_lon, 4),
        },
        "provenance": {
            "source": "OpenStreetMap Nominatim Live Geocoding API",
            "url": NOMINATIM_URL,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "license": "ODbL 1.0",
        },
    }
