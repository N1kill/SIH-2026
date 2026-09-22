"""Replay-v2 contracts, progressive failure, and deterministic forecast tests."""
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import numpy as np
from rasterio.transform import from_origin

from src.breach import BreachGeometry, PhysicallyBasedBreachGrowth, StructuralMaterial
from src.forecast import ForecastRequest, generate_forecast
from src.project import Project, Scenario
from src.replay import asset_manifest
from src.run_engine import Run
from src.terrain import Terrain


def terrain_fixture():
    dem = np.tile(np.linspace(12, 0, 20)[:, None], (1, 20))
    return Terrain(dem, np.ones((20, 20), bool), from_origin(500000, 2500000, 10, 10),
                   "EPSG:32642", (500100, 2499900, 6), (10, 10), {"crs": "EPSG:32642"})


def project_fixture():
    return Project(dam_id="replay-test", dam_name="Replay test", latitude=22, longitude=69,
                   dam_height_m=10, dam_length_m=200, reservoir_capacity_m3=10000,
                   dem_path="unused", catchment_area_km2=1)


def test_asset_manifest_never_promotes_missing_geometry_to_fact():
    manifest = asset_manifest(project_fixture(), bed_elevation_m=6)
    assert manifest["scale"] == {"horizontal": 1.0, "vertical": 1.0}
    assert manifest["reconstruction_label"] == "reconstructed archetype"
    assert manifest["specification"]["spillway_type"]["status"] == "unavailable"
    crest = manifest["components"][0]["dimensions"]["crest_width_m"]
    assert crest["status"] == "assumed"
    assert crest["source_id"] == "dam-type template"


def test_progressive_breach_records_state_transitions_and_material_volume():
    breach = PhysicallyBasedBreachGrowth(
        StructuralMaterial(critical_shear_stress_pa=0, erodibility_coeff=1e-4,
                           ultimate_shear_capacity_pa=1e9),
        BreachGeometry(1, 8, 1, 10), 10, 9, 2,
        initiation_mode="seeded", breach_thickness_m=6,
    )
    states = [breach.step(1, 10)["failure_state"] for _ in range(4)]
    assert states[0] in {"erosion", "incipient"}
    assert states == sorted(states, key=lambda value: ["intact", "incipient", "erosion", "mass_failure", "widening", "stabilizing", "final"].index(value))
    assert breach.eroded_volume_m3 > 0
    assert breach.events[0]["from"] == "intact"


def test_run_manifest_and_forecast_are_reproducible():
    with tempfile.TemporaryDirectory() as directory, patch(
        "src.run_engine.load_terrain", return_value=terrain_fixture()
    ):
        run = Run(project_fixture(), Scenario(project_id="replay-test", duration_s=4, dt_s=1,
                                              output_interval_s=1, breach_depth_m=5), directory)
        run.execute()
        assert run.status()["status"] == "COMPLETE"
        manifest = json.loads((run.directory / "run-manifest.json").read_text(encoding="utf-8"))
        assert manifest["schema_version"] == "2.0"
        assert manifest["deterministic"] is True
        request = ForecastRequest(horizon_s=12, ensemble_size=3, seed=7, max_workers=2)
        first = generate_forecast(run.directory, request)
        second = generate_forecast(run.directory, request)
        assert first["input_hash"] == second["input_hash"]
        assert first["bands"] == second["bands"]
        for row in first["bands"]:
            for field in ("reservoir_level_m", "breach_width_m", "breach_invert_m", "discharge_m3s"):
                assert row[field]["p10"] <= row[field]["p50"] <= row[field]["p90"]
        assert first["downstream_uncertainty"]["arrival_time_s"]["status"] == "unavailable"
        with patch("src.forecast.load_terrain", return_value=terrain_fixture()):
            routed = generate_forecast(
                run.directory,
                ForecastRequest(horizon_s=3, ensemble_size=3, seed=7, max_workers=2,
                                include_far_field=True),
            )
        assert routed["downstream_uncertainty"]["status"] == "simulated"
        assert len(routed["downstream_uncertainty"]["depth_m"]["p50"]) == 400
