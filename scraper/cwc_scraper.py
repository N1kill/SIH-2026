"""Scraper for Central Water Commission (CWC) and India-WRIS real-time
reservoir storage, water level, and flood forecasting bulletins.
Strict provenance tracking; no synthetic values fabricated if telemetry is unavailable.
"""

import logging
import time
import requests
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
CWC_FLOOD_API = "https://ffs.india-water.gov.in/api/v1/stations"
WRIS_TELEMETRY_URL = "https://indiawris.gov.in/wris/#/telemetry"


def scrape_cwc_reservoir_status(
    dam_name: str,
    state: Optional[str] = None,
    river: Optional[str] = None,
    timeout: int = 15,
) -> Dict[str, Any]:
    """Query live CWC / India-WRIS reservoir telemetry if available.

    Adheres strictly to project rules:
    - Never generates synthetic water levels.
    - If live telemetry is unreachable or station is not in CWC telemetry list,
      reports status as 'telemetry_offline' or 'not_monitored' with explicit provenance.
    """
    logger.info("Checking live CWC reservoir telemetry for '%s'...", dam_name)

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/plain, */*",
    }

    # Clean dam name for matching
    clean_name = dam_name.lower().replace("dam", "").replace("reservoir", "").strip()

    result: Dict[str, Any] = {
        "dam_name": dam_name,
        "telemetry_available": False,
        "water_level_m": None,
        "full_reservoir_level_frl_m": None,
        "live_storage_mcm": None,
        "storage_pct_of_frl": None,
        "inflow_cumecs": None,
        "outflow_cumecs": None,
        "status_message": "Telemetry not found in real-time public portal or portal requires session token",
        "provenance": {
            "source": "Central Water Commission (CWC) / India-WRIS Telemetry",
            "url": CWC_FLOOD_API,
            "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    }

    try:
        # Query CWC flood forecast station index
        resp = requests.get(CWC_FLOOD_API, headers=headers, timeout=timeout)
        if resp.status_code == 200:
            stations = resp.json()
            if isinstance(stations, list):
                for st in stations:
                    st_name = (st.get("stationName") or st.get("name") or "").lower()
                    if clean_name in st_name:
                        result["telemetry_available"] = True
                        result["water_level_m"] = st.get("waterLevel") or st.get("currentLevel")
                        result["full_reservoir_level_frl_m"] = st.get("warningLevel") or st.get("dangerLevel")
                        result["inflow_cumecs"] = st.get("inflow")
                        result["outflow_cumecs"] = st.get("outflow")
                        result["status_message"] = "Live CWC telemetry successfully matched and retrieved"
                        logger.info("Found live CWC telemetry for %s: %s", dam_name, st)
                        break
        else:
            result["status_message"] = f"CWC API returned HTTP status {resp.status_code}"
    except Exception as e:
        logger.debug("CWC API lookup note: %s", e)
        result["status_message"] = f"Live CWC API request timed out or unavailable ({type(e).__name__})"

    return result
