"""Real-time and static dam data scraping module for SIH-2026.
Dynamically extracts dam geometry, location, real-time meteorology,
downstream receptors, and reservoir status from live open web APIs.
"""

from .pipeline import DamDataScraper, scrape_dam_data

__all__ = ["DamDataScraper", "scrape_dam_data"]
