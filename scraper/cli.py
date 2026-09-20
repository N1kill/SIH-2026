"""Command Line Interface (CLI) for dynamic real-time dam data scraper.

Usage:
    python -m scraper.cli "Idukki Dam"
    python -m scraper.cli "Tehri Dam" --update-config
    python -m scraper.cli "Bhakra Dam" --out bhakra_dossier.json
    python -m scraper.cli --interactive
"""

import argparse
import json
import logging
import sys
from pprint import pprint

from .pipeline import DamDataScraper

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)


def main():
    parser = argparse.ArgumentParser(
        description="Scrape real-time weather, structural specs, and downstream receptors for any dam (No hardcoded data)."
    )
    parser.add_argument(
        "dam_name",
        type=str,
        nargs="?",
        help="Name of the dam to scrape (e.g. 'Idukki Dam', 'Tehri Dam', 'Hirakud Dam')",
    )
    parser.add_argument(
        "--interactive", "-i",
        action="store_true",
        help="Prompt interactively for dam name",
    )
    parser.add_argument(
        "--country",
        type=str,
        default="in",
        help="Country ISO code for geocoding search (default: 'in')",
    )
    parser.add_argument(
        "--update-config",
        action="store_true",
        help="Automatically register/update the dam in config.json",
    )
    parser.add_argument(
        "--out",
        type=str,
        default=None,
        help="Custom output file path for the scraped JSON dossier",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress verbose logs",
    )

    args = parser.parse_args()

    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)

    dam_name = args.dam_name
    if not dam_name or args.interactive:
        try:
            dam_name = input("Enter Dam Name (e.g., 'Idukki Dam', 'Tehri Dam'): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(0)

    if not dam_name:
        print("Error: Dam name is required. Example: python -m scraper.cli 'Idukki Dam'")
        sys.exit(1)

    scraper = DamDataScraper()
    try:
        dossier = scraper.scrape(dam_name, country_code=args.country)
    except Exception as err:
        print(f"\n[ERROR] Scraping failed for '{dam_name}': {err}")
        sys.exit(1)

    # Save to disk
    out_path = scraper.save_dossier(dossier, output_path=args.out)

    if args.update_config:
        cfg_path = scraper.update_config_json(dossier)
        print(f"\n[OK] Updated project configuration: {cfg_path}")

    # Display clean summary
    print("\n" + "=" * 60)
    print(f" SCRAPED DATA SUMMARY: {dossier['dam_name']}")
    print("=" * 60)
    geo = dossier["geography"]
    meta = dossier["structural_parameters"]
    weather = dossier["realtime_weather"] or {}
    curr_cond = weather.get("current_conditions", {})
    inflow = weather.get("inflow_risk_assessment", {})
    stations = dossier["downstream_monitoring_stations"]

    print(f"• Location:      {geo['lat']}° N, {geo['lon']}° E ({geo['state']}, {geo['district']})")
    print(f"• Surface Elev:  {meta.get('surface_elevation_m')} m MSL")
    print(f"• Dam Height:    {meta.get('dam_height_m')} m")
    print(f"• Crest Length:  {meta.get('crest_length_m')} m")
    print(f"• Storage Vol:   {meta.get('reservoir_volume_m3')} m³")
    print(f"• Spillway Cap:  {meta.get('spillway_capacity_m3s')} m³/s")
    print(f"• Dam Type:      {meta.get('dam_type') or 'Not specified'}")
    print(f"• River:         {meta.get('river') or 'Not specified'}")

    print("\n[REAL-TIME METEOROLOGY & INFLOW]")
    print(f"• Current Rain:  {curr_cond.get('precipitation_rate_mmh')} mm/h ({curr_cond.get('rainfall_classification')})")
    print(f"• Temperature:   {curr_cond.get('temperature_c')} °C | Wind: {curr_cond.get('wind_speed_kmh')} km/h")
    print(f"• Past 24h Rain: {weather.get('antecedent_rainfall', {}).get('past_24h_mm')} mm ({weather.get('antecedent_rainfall', {}).get('antecedent_moisture_condition')})")
    print(f"• Next 24h Rain: {weather.get('precipitation_forecast', {}).get('next_24h_mm')} mm (Peak: {weather.get('precipitation_forecast', {}).get('peak_hourly_intensity_mmh')} mm/h)")
    print(f"• Inflow Alert:  {inflow.get('level')} -> {inflow.get('summary')}")

    print(f"\n[DOWNSTREAM MONITORING STATIONS ({len(stations)})]")
    for st in stations:
        print(f"  [{st['dist_km']:>4.1f} km] {st['name']} ({st['lat']}°, {st['lon']}°)")

    print(f"\n• Full Dossier:  {out_path}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
