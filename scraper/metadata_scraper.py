"""Metadata scraper to dynamically extract dam physical parameters
(height, crest length, reservoir capacity, spillway discharge, dam type, river)
from live Wikidata and Wikipedia APIs with unit normalization.
NO HARDCODED VALUES.
"""

import re
import logging
import time
import requests
from bs4 import BeautifulSoup
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

USER_AGENT = "SIH-2026-Dam-Scraper/1.0 (Emergency Decision Support System; contact@dam-safety.in)"
WIKIDATA_SEARCH_URL = "https://www.wikidata.org/w/api.php"
WIKIDATA_ENTITY_URL = "https://www.wikidata.org/wiki/Special:EntityData/{entity_id}.json"
WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"
ELEVATION_API_URL = "https://api.open-meteo.com/v1/elevation"


# --- Unit Conversion Helpers ---

def _clean_number(text: str) -> Optional[float]:
    """Extract first floating-point number from string."""
    if not text:
        return None
    # Remove commas and non-numeric garbage
    cleaned = text.replace(",", "").replace("\xa0", " ").strip()
    match = re.search(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", cleaned)
    if match:
        try:
            return float(match.group(0))
        except ValueError:
            return None
    return None


def _parse_height_meters(text: str) -> Optional[float]:
    """Parse height string and convert to meters."""
    if not text:
        return None
    text_lower = text.lower()
    # Check for meters
    m_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:m\b|meter|metre)", text_lower)
    if m_match:
        return float(m_match.group(1))
    # Check for feet
    ft_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:ft\b|feet|foot)", text_lower)
    if ft_match:
        return round(float(ft_match.group(1)) * 0.3048, 2)
    # Generic number fallback
    num = _clean_number(text)
    return num if num and num < 500 else None


def _parse_length_meters(text: str) -> Optional[float]:
    """Parse crest length string and convert to meters."""
    if not text:
        return None
    text_lower = text.lower()
    # Check km
    km_match = re.search(r"(\d+(?:\.\d+)?)\s*km\b", text_lower)
    if km_match:
        return round(float(km_match.group(1)) * 1000.0, 1)
    # Check meters
    m_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:m\b|meter|metre)", text_lower)
    if m_match:
        return float(m_match.group(1))
    # Check feet
    ft_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:ft\b|feet)", text_lower)
    if ft_match:
        return round(float(ft_match.group(1)) * 0.3048, 1)
    num = _clean_number(text)
    return num if num and num < 50000 else None


def _parse_volume_m3(text: str) -> Optional[float]:
    """Parse reservoir capacity string and convert to cubic meters (m³)."""
    if not text:
        return None
    text_lower = text.lower().replace(",", "")
    # Check TMC / TMCft (Thousand Million Cubic Feet - standard in India: 1 TMC ≈ 28.3168 MCM)
    tmc_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:tmc\b|tmcft|tmc\s*ft|thousand\s*million\s*cubic\s*f[eo]+t)", text_lower)
    if tmc_match:
        return round(float(tmc_match.group(1)) * 28316846.592, 1)
    # Check MCM / Million Cubic Meters / 10^6 m3
    mcm_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:mcm\b|million\s*m[³3]|million\s*cubic\s*m)", text_lower)
    if mcm_match:
        return float(mcm_match.group(1)) * 1_000_000.0
    # Check km³ / Cubic kilometers / BCM
    bcm_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:km[³3]|bcm\b|billion\s*m[³3]|billion\s*cubic\s*m)", text_lower)
    if bcm_match:
        return float(bcm_match.group(1)) * 1_000_000_000.0
    # Check acre-feet
    acft_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:acre[\s-]*f[eo]+t|ac[\s-]*ft)", text_lower)
    if acft_match:
        return round(float(acft_match.group(1)) * 1233.4818375475, 1)
    # Check m³ / cubic meters
    m3_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:m[³3]|cubic\s*m)", text_lower)
    if m3_match:
        return float(m3_match.group(1))
    num = _clean_number(text)
    # If reasonable volume in m3 (e.g. > 10,000)
    if num and num > 1000:
        return num
    return None


def _parse_discharge_m3s(text: str) -> Optional[float]:
    """Parse spillway discharge capacity and convert to m³/s (cumecs)."""
    if not text:
        return None
    text_lower = text.lower().replace(",", "")
    # Check cumecs / m3/s
    cumec_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:m[³3]/s|cumec)", text_lower)
    if cumec_match:
        return float(cumec_match.group(1))
    # Check cfs / cusec
    cfs_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:cusec|cfs|ft[³3]/s)", text_lower)
    if cfs_match:
        return round(float(cfs_match.group(1)) * 0.028316846592, 1)
    return _clean_number(text)


# --- Live API Query Functions ---

def fetch_wikidata_id(dam_name: str, timeout: int = 10) -> Optional[str]:
    """Search Wikidata for the dam's Q-identifier."""
    params = {
        "action": "wbsearchentities",
        "search": dam_name,
        "language": "en",
        "format": "json",
        "limit": 5,
    }
    headers = {"User-Agent": USER_AGENT}
    try:
        resp = requests.get(WIKIDATA_SEARCH_URL, params=params, headers=headers, timeout=timeout)
        resp.raise_for_status()
        results = resp.json().get("search", [])
        for item in results:
            desc = item.get("description", "").lower()
            label = item.get("label", "").lower()
            if "dam" in desc or "reservoir" in desc or "dam" in label:
                return item["id"]
        if results:
            return results[0]["id"]
    except Exception as e:
        logger.warning("Wikidata search failed for '%s': %s", dam_name, e)
    return None


def fetch_wikidata_claims(entity_id: str, timeout: int = 10) -> Dict[str, Any]:
    """Fetch structured claims for a Wikidata entity ID."""
    url = WIKIDATA_ENTITY_URL.format(entity_id=entity_id)
    headers = {"User-Agent": USER_AGENT}
    try:
        resp = requests.get(url, headers=headers, timeout=timeout)
        resp.raise_for_status()
        data = resp.json().get("entities", {}).get(entity_id, {})
        claims = data.get("claims", {})
        results = {}

        # Helper to extract quantity value
        def _get_quantity(prop_id):
            prop_claims = claims.get(prop_id, [])
            for c in prop_claims:
                mainsnak = c.get("mainsnak", {})
                datavalue = mainsnak.get("datavalue", {})
                if datavalue.get("type") == "quantity":
                    amount = datavalue.get("value", {}).get("amount")
                    unit = datavalue.get("value", {}).get("unit", "")
                    if amount:
                        return float(amount), unit
            return None, None

        # P2048: Height
        height_val, height_unit = _get_quantity("P2048")
        if height_val:
            # Q11573 is meter
            if "Q11573" in height_unit or not height_unit:
                results["dam_height_m"] = height_val
            elif "Q3710" in height_unit:  # foot
                results["dam_height_m"] = round(height_val * 0.3048, 2)

        # P2043: Length
        length_val, length_unit = _get_quantity("P2043")
        if length_val:
            if "Q11573" in length_unit or not length_unit:
                results["crest_length_m"] = length_val
            elif "Q828224" in length_unit:  # km
                results["crest_length_m"] = length_val * 1000.0

        # P2234: Capacity / Volume
        vol_val, vol_unit = _get_quantity("P2234")
        if vol_val:
            if "Q25517" in vol_unit or not vol_unit:  # cubic meter
                results["reservoir_volume_m3"] = vol_val
            elif "Q5151" in vol_unit:  # cubic kilometer
                results["reservoir_volume_m3"] = vol_val * 1_000_000_000.0

        # P4614: Maximum discharge capacity / spillway
        spill_val, spill_unit = _get_quantity("P4614")
        if spill_val:
            results["spillway_capacity_m3s"] = spill_val

        # P177: Crosses / River
        p177_claims = claims.get("P177", [])
        if p177_claims:
            river_id = p177_claims[0].get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id")
            if river_id:
                results["river_wikidata_id"] = river_id

        # P31: Instance of (e.g. arch dam, gravity dam, embankment dam)
        p31_claims = claims.get("P31", [])
        if p31_claims:
            type_id = p31_claims[0].get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id")
            if type_id:
                results["type_wikidata_id"] = type_id

        return results
    except Exception as e:
        logger.warning("Failed fetching claims for entity %s: %s", entity_id, e)
        return {}


def scrape_wikipedia_infobox(
    title_or_name: str,
    timeout: int = 15,
) -> Dict[str, Any]:
    """Dynamically scrape dam infobox table from English Wikipedia."""
    # Clean language prefix if present (e.g., 'en:Idukki Dam' -> 'Idukki Dam')
    cleaned_title = re.sub(r"^[a-z]{2,3}:", "", title_or_name).strip()
    headers = {"User-Agent": USER_AGENT}

    # First attempt: Try to parse page directly with cleaned title
    parse_params = {
        "action": "parse",
        "page": cleaned_title,
        "prop": "text",
        "redirects": 1,
        "format": "json",
    }
    html_content = ""
    page_title = cleaned_title
    try:
        pr = requests.get(WIKIPEDIA_API_URL, params=parse_params, headers=headers, timeout=timeout).json()
        if "error" not in pr:
            html_content = pr.get("parse", {}).get("text", {}).get("*", "")
            page_title = pr.get("parse", {}).get("title", cleaned_title)
        else:
            # Second attempt: Search query
            search_params = {
                "action": "query",
                "list": "search",
                "srsearch": f"{cleaned_title} dam",
                "format": "json",
            }
            sr = requests.get(WIKIPEDIA_API_URL, params=search_params, headers=headers, timeout=timeout).json()
            search_hits = sr.get("query", {}).get("search", [])
            if search_hits:
                page_title = search_hits[0]["title"]
                parse_params["page"] = page_title
                pr2 = requests.get(WIKIPEDIA_API_URL, params=parse_params, headers=headers, timeout=timeout).json()
                html_content = pr2.get("parse", {}).get("text", {}).get("*", "")
    except Exception as e:
        logger.warning("Wikipedia API request error for '%s': %s", title_or_name, e)
        return {}

    if not html_content:
        return {}

    try:
        soup = BeautifulSoup(html_content, "html.parser")
        infobox = soup.find("table", class_=lambda c: c and ("infobox" in c))
        if not infobox:
            return {}

        extracted = {}
        for tr in infobox.find_all("tr"):
            th = tr.find(["th", "td"], class_=lambda c: c and ("header" in c or "label" in c)) or tr.find("th")
            td = tr.find("td", class_=lambda c: c and ("data" in c)) or tr.find("td")
            if not th or not td:
                continue
            label = th.get_text(separator=" ", strip=True).lower()
            val = td.get_text(separator=" ", strip=True)

            if any(k in label for k in ["height", "crest height", "structural height", "hydraulic height"]):
                if "dam_height_m" not in extracted:
                    parsed_h = _parse_height_meters(val)
                    if parsed_h:
                        extracted["dam_height_m"] = parsed_h

            elif any(k in label for k in ["length", "crest length"]):
                if "crest_length_m" not in extracted:
                    parsed_l = _parse_length_meters(val)
                    if parsed_l:
                        extracted["crest_length_m"] = parsed_l

            elif any(k in label for k in ["capacity", "volume", "reservoir volume", "total capacity", "active capacity", "gross storage", "storage capacity", "live storage", "gross capacity"]):
                if "reservoir_volume_m3" not in extracted:
                    parsed_v = _parse_volume_m3(val)
                    if parsed_v:
                        extracted["reservoir_volume_m3"] = parsed_v

            elif any(k in label for k in ["spillway", "discharge", "maximum discharge", "spillway capacity"]):
                if "spillway_capacity_m3s" not in extracted:
                    parsed_q = _parse_discharge_m3s(val)
                    if parsed_q:
                        extracted["spillway_capacity_m3s"] = parsed_q

            elif any(k in label for k in ["impounds", "river", "crosses", "waterway"]):
                if "river" not in extracted:
                    extracted["river"] = val.split(",")[0].strip()

            elif any(k in label for k in ["type of dam", "dam type", "structure type"]):
                # Ensure value is an engineering dam type, not an administrative body
                val_lower = val.lower()
                if any(dt in val_lower for dt in ["arch", "gravity", "earth", "embankment", "masonry", "rock", "buttress", "composite", "barrage"]):
                    if "dam_type" not in extracted:
                        extracted["dam_type"] = val.strip()

        extracted["wikipedia_page"] = page_title
        extracted["wikipedia_url"] = f"https://en.wikipedia.org/wiki/{page_title.replace(' ', '_')}"
        return extracted
    except Exception as e:
        logger.warning("Wikipedia infobox parsing failed for '%s': %s", title_or_name, e)
        return {}


def fetch_surface_elevation(lat: float, lon: float, timeout: int = 10) -> Optional[float]:
    """Sample ground surface elevation (m MSL) at coordinates via Open-Meteo."""
    try:
        resp = requests.get(
            ELEVATION_API_URL,
            params={"latitude": lat, "longitude": lon},
            headers={"User-Agent": USER_AGENT},
            timeout=timeout,
        )
        resp.raise_for_status()
        elevations = resp.json().get("elevation", [])
        if elevations and isinstance(elevations, list):
            return float(elevations[0])
    except Exception as e:
        logger.warning("Elevation lookup failed at (%s, %s): %s", lat, lon, e)
    return None


def scrape_dam_metadata(
    dam_name: str,
    lat: float,
    lon: float,
    wikidata_id: Optional[str] = None,
    wikipedia_title: Optional[str] = None,
) -> Dict[str, Any]:
    """Orchestrate multi-source live scraping of dam metadata.

    Merges Wikidata, Wikipedia Infobox, and Elevation API data dynamically.
    NO HARDCODED VALUES.
    """
    logger.info("Scraping metadata for dam: '%s'...", dam_name)
    metadata: Dict[str, Any] = {
        "dam_height_m": None,
        "crest_length_m": None,
        "reservoir_volume_m3": None,
        "spillway_capacity_m3s": None,
        "dam_type": None,
        "river": None,
        "surface_elevation_m": None,
        "sources": [],
    }

    # 1. Query Wikidata if available or discoverable
    q_id = wikidata_id or fetch_wikidata_id(dam_name)
    if q_id:
        wd_claims = fetch_wikidata_claims(q_id)
        if wd_claims:
            metadata.update({k: v for k, v in wd_claims.items() if v is not None})
            metadata["wikidata_id"] = q_id
            metadata["sources"].append(f"Wikidata entity {q_id}")

    # 2. Query Wikipedia Infobox
    wiki_query = wikipedia_title or dam_name
    wiki_data = scrape_wikipedia_infobox(wiki_query)
    if wiki_data:
        for field in ["dam_height_m", "crest_length_m", "reservoir_volume_m3", "spillway_capacity_m3s", "dam_type", "river"]:
            # Fill if missing from Wikidata
            if metadata.get(field) is None and wiki_data.get(field) is not None:
                metadata[field] = wiki_data[field]
        if "wikipedia_url" in wiki_data:
            metadata["sources"].append(wiki_data["wikipedia_url"])

    # 3. Elevation lookup at dam coordinates
    elev = fetch_surface_elevation(lat, lon)
    if elev is not None:
        metadata["surface_elevation_m"] = elev
        metadata["sources"].append("Open-Meteo Global Elevation Model")

    return metadata
