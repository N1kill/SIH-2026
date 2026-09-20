# Real-Time Dam Data Scraper

This standalone package dynamically retrieves structural specifications, real-time hydrometeorology, downstream receptors, and reservoir status for any given dam name.

**Zero hardcoded values.** All information is retrieved in real-time from open public APIs and semantic databases with full scientific provenance and licensing metadata.

---

## 🚀 Key Features

1. **Dynamic Geocoding (`geocoding.py`)**:
   - Locates any dam via OpenStreetMap Nominatim.
   - Extracts exact `lat`, `lon`, state, district, bounding box, and OpenStreetMap/Wikidata identifiers.

2. **Structural & Hydraulic Extraction (`metadata_scraper.py`)**:
   - Queries live Wikidata entities and English Wikipedia Infoboxes.
   - Parses dam height ($m$), crest length ($m$), reservoir capacity ($m^3$), spillway discharge ($m^3/s$), dam type, and impounded river.
   - Handles unit conversions automatically (MCM, BCM, acre-feet, cubic meters, feet, meters, cumecs, cfs).
   - Samples ground elevation (m MSL) via the Open-Meteo Global Elevation API.

3. **Real-Time Hydrometeorology & Inflow Risk (`realtime_weather.py`)**:
   - Fetches live weather telemetry from Open-Meteo (ECMWF/GFS):
     - Current rainfall rate ($mm/h$) and IMD classification.
     - Antecedent precipitation: past 24-hour, 48-hour, and 72-hour accumulation ($mm$) to compute Antecedent Moisture Condition (AMC-I, AMC-II, AMC-III).
     - Storm forecast: next 24-hour and 72-hour forecast precipitation ($mm$) and peak hourly intensity.
     - Surface soil moisture and runoff indicator.
     - Inflow surge risk categorization.

4. **Downstream Receptors Discovery (`downstream_stations.py`)**:
   - Queries OpenStreetMap Overpass API for downstream settlements, towns, and bridges within the river basin.
   - Computes geodesic distances (Haversine formula) from the dam toe.
   - Outputs ready-to-use downstream monitoring stations.

5. **Reservoir Telemetry Checker (`cwc_scraper.py`)**:
   - Queries Central Water Commission (CWC) / India-WRIS real-time flood monitoring endpoints.
   - Explicitly preserves data provenance; never hallucinates or injects synthetic values if telemetry is offline.

6. **Direct Integration with Simulation Pipeline**:
   - Generates configuration blocks conforming to `config.json` and `data/projects/{dam_id}.json`.

---

## 🛠️ Usage

### CLI Usage

Scrape data for any dam:
```bash
python -m scraper.cli "Idukki Dam"
```

Scrape and automatically register into `config.json`:
```bash
python -m scraper.cli "Tehri Dam" --update-config
```

Interactive prompt:
```bash
python -m scraper.cli --interactive
```

Specify custom output JSON:
```bash
python -m scraper.cli "Bhakra Dam" --out data/scraped/bhakra.json
```

### Python API Usage

```python
from scraper import DamDataScraper, scrape_dam_data

# Simple functional call
dossier = scrape_dam_data("Idukki Dam")
print("Location:", dossier["geography"]["lat"], dossier["geography"]["lon"])
print("Height:", dossier["structural_parameters"]["dam_height_m"], "meters")
print("Real-time Rain:", dossier["realtime_weather"]["current_conditions"]["precipitation_rate_mmh"], "mm/h")

# Object-oriented pipeline with automatic config.json registration
scraper = DamDataScraper()
dossier = scraper.scrape("Panshet Dam")
scraper.save_dossier(dossier)
scraper.update_config_json(dossier)
```

---

## 📂 Output Structure

Scraped records are saved to `data/scraped/{dam_id}_realtime_dossier.json`.

```json
{
  "dam_id": "idukki",
  "dam_name": "Idukki Dam",
  "scrape_timestamp_utc": "2026-09-20T10:15:00Z",
  "elapsed_seconds": 3.42,
  "geography": {
    "lat": 9.84352,
    "lon": 76.97624,
    "state": "Kerala",
    "district": "Idukki",
    "bbox": { "min_lat": 9.59, "max_lat": 10.09, "min_lon": 76.72, "max_lon": 77.22 }
  },
  "structural_parameters": {
    "dam_height_m": 168.91,
    "crest_length_m": 365.85,
    "reservoir_volume_m3": 1996000000.0,
    "dam_type": "Concrete double curvature parabolic arch dam",
    "surface_elevation_m": 724.0
  },
  "realtime_weather": {
    "current_conditions": {
      "precipitation_rate_mmh": 0.0,
      "rainfall_classification": "No Rain",
      "temperature_c": 22.4
    },
    "antecedent_rainfall": {
      "past_24h_mm": 4.2,
      "antecedent_moisture_condition": "AMC-I (Dry)"
    },
    "precipitation_forecast": {
      "next_24h_mm": 12.8,
      "peak_hourly_intensity_mmh": 2.4
    },
    "inflow_risk_assessment": {
      "level": "NORMAL"
    }
  },
  "downstream_monitoring_stations": [
    { "name": "Idukki Dam Toe (0 km)", "key": "dam_toe", "lat": 9.84352, "lon": 76.97624, "dist_km": 0.0 },
    { "name": "Cheruthoni (2.4 km)", "key": "cheruthoni", "lat": 9.8512, "lon": 76.9582, "dist_km": 2.4 }
  ],
  "simulation_config_entry": { ... }
}
```
