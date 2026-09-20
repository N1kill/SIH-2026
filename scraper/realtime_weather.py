"""Real-time weather and hydrometeorological telemetry scraper.
Fetches live rainfall, past 24h/72h precipitation accumulation, soil moisture,
and 72h storm forecast at dam coordinates via Open-Meteo real-time APIs.
"""

import logging
import time
import requests
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
USER_AGENT = "SIH-2026-Dam-Scraper/1.0 (Emergency Decision Support System; contact@dam-safety.in)"


def fetch_realtime_weather(
    lat: float,
    lon: float,
    timeout: int = 15,
) -> Dict[str, Any]:
    """Fetch live and recent hydrometeorological data for dam coordinates.

    Args:
        lat: Latitude of the dam
        lon: Longitude of the dam
        timeout: HTTP request timeout

    Returns:
        Structured dictionary containing:
        - Current conditions (temperature, humidity, precipitation rate, wind)
        - Antecedent rainfall (past 24h, 48h, 72h accumulation)
        - Upcoming forecast (next 24h, 72h total rainfall, peak intensity)
        - Inflow risk category based on rainfall intensity
    """
    logger.info("Fetching real-time weather & hydrological telemetry at (%.4f, %.4f)...", lat, lon)

    params = {
        "latitude": lat,
        "longitude": lon,
        "current": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "precipitation",
            "rain",
            "weather_code",
            "surface_pressure",
            "wind_speed_10m",
            "wind_direction_10m",
            "wind_gusts_10m",
        ]),
        "hourly": ",".join([
            "precipitation",
            "rain",
            "relative_humidity_2m",
            "temperature_2m",
        ]),
        "daily": ",".join([
            "precipitation_sum",
            "rain_sum",
            "precipitation_hours",
            "wind_speed_10m_max",
        ]),
        "past_days": 3,
        "forecast_days": 3,
        "timezone": "auto",
    }

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }

    try:
        resp = requests.get(OPEN_METEO_FORECAST_URL, params=params, headers=headers, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.error("Failed to fetch real-time weather telemetry: %s", e)
        raise RuntimeError(f"Live weather telemetry unavailable for ({lat}, {lon}): {e}")

    current = data.get("current", {})
    hourly = data.get("hourly", {})
    daily = data.get("daily", {})

    # Compute past cumulative rainfall from hourly data
    times = hourly.get("time", [])
    precip = hourly.get("precipitation", [])
    current_time_str = current.get("time", "")

    # Index of current hour in the hourly array
    current_idx = None
    if current_time_str and times:
        for i, t in enumerate(times):
            if t.startswith(current_time_str[:13]):  # match up to hour
                current_idx = i
                break

    if current_idx is None:
        current_idx = len(times) // 2  # fallback approx midpoint between past and future

    # Past 24h, 48h, 72h slices
    past_24h_slice = precip[max(0, current_idx - 24):current_idx]
    past_48h_slice = precip[max(0, current_idx - 48):current_idx]
    past_72h_slice = precip[max(0, current_idx - 72):current_idx]

    past_24h_mm = round(sum(p for p in past_24h_slice if p is not None), 2)
    past_48h_mm = round(sum(p for p in past_48h_slice if p is not None), 2)
    past_72h_mm = round(sum(p for p in past_72h_slice if p is not None), 2)

    # Next 24h, 72h forecast slices
    future_24h_slice = precip[current_idx:min(len(precip), current_idx + 24)]
    future_72h_slice = precip[current_idx:min(len(precip), current_idx + 72)]

    next_24h_forecast_mm = round(sum(p for p in future_24h_slice if p is not None), 2)
    next_72h_forecast_mm = round(sum(p for p in future_72h_slice if p is not None), 2)
    max_forecast_intensity_mmh = round(max((p for p in future_72h_slice if p is not None), default=0.0), 2)

    # Real-time rainfall categorization (IMD standards)
    curr_precip = current.get("precipitation", 0.0) or 0.0
    if curr_precip > 64.5:
        imd_rain_alert = "Very Heavy / Torrential Rain"
        inflow_risk = "HIGH"
    elif curr_precip > 15.5:
        imd_rain_alert = "Moderate to Heavy Rain"
        inflow_risk = "MODERATE"
    elif curr_precip > 2.5:
        imd_rain_alert = "Light Rain"
        inflow_risk = "LOW"
    elif curr_precip > 0.0:
        imd_rain_alert = "Very Light Rain / Drizzle"
        inflow_risk = "MINIMAL"
    else:
        imd_rain_alert = "No Rain"
        inflow_risk = "NORMAL"

    # Escalate risk if significant past or forecast rainfall is detected
    if past_24h_mm > 100.0 or next_24h_forecast_mm > 100.0:
        inflow_risk = "EXTREME_SURGE"
    elif past_24h_mm > 50.0 or next_24h_forecast_mm > 50.0:
        if inflow_risk in ["NORMAL", "MINIMAL", "LOW"]:
            inflow_risk = "ELEVATED"

    # Soil moisture (if available in future model)
    curr_soil_moisture = None

    return {
        "timestamp": current.get("time", time.strftime("%Y-%m-%dT%H:%M", time.gmtime())),
        "timezone": data.get("timezone", "UTC"),
        "current_conditions": {
            "temperature_c": current.get("temperature_2m"),
            "relative_humidity_pct": current.get("relative_humidity_2m"),
            "precipitation_rate_mmh": curr_precip,
            "rain_mmh": current.get("rain", 0.0),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "wind_direction_deg": current.get("wind_direction_10m"),
            "surface_pressure_hpa": current.get("surface_pressure"),
            "soil_moisture_surface_m3m3": curr_soil_moisture,
            "rainfall_classification": imd_rain_alert,
        },
        "antecedent_rainfall": {
            "past_24h_mm": past_24h_mm,
            "past_48h_mm": past_48h_mm,
            "past_72h_mm": past_72h_mm,
            "antecedent_moisture_condition": (
                "AMC-III (Wet)" if past_72h_mm > 50.0 else
                "AMC-II (Average)" if past_72h_mm > 20.0 else
                "AMC-I (Dry)"
            ),
        },
        "precipitation_forecast": {
            "next_24h_mm": next_24h_forecast_mm,
            "next_72h_mm": next_72h_forecast_mm,
            "peak_hourly_intensity_mmh": max_forecast_intensity_mmh,
        },
        "inflow_risk_assessment": {
            "level": inflow_risk,
            "summary": (
                f"Current rain: {curr_precip:.1f} mm/h ({imd_rain_alert}). "
                f"Past 24h: {past_24h_mm:.1f} mm, Next 24h: {next_24h_forecast_mm:.1f} mm."
            ),
        },
        "provenance": {
            "source": "Open-Meteo Global Numerical Weather Prediction (ECMWF/GFS)",
            "url": OPEN_METEO_FORECAST_URL,
            "retrieved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "license": "Non-commercial/Open-Data Attribution",
        },
    }
