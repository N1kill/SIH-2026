"""Evidence records and human-gated approximate dam/reservoir reconstruction."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
from typing import Literal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pyproj import Geod
from rasterio.features import shapes
from rasterio.warp import transform_geom

from .project import Project, ROOT, input_path
from .terrain import Terrain, load_terrain


RECONSTRUCTION_DISCLAIMER = (
    "Approximate, evidence-backed reconstruction suitable for demonstration and "
    "screening; not suitable for engineering design, emergency operations, or certification."
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


class EvidenceRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]{1,79}$")
    title: str
    source_url: str
    publisher_or_author: str
    retrieval_date: str
    license_or_usage_status: str
    artifact_path: str
    file_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    geographic_coordinates_or_crs: str
    relevant_measurements: dict = Field(default_factory=dict)
    estimated_uncertainty: dict = Field(default_factory=dict)
    status: Literal["verified", "approximate", "discovery_only"]
    quality_note: str
    notes: str | None = None


class EvidenceManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: int = 1
    project_id: str
    generated_at: str
    items: list[EvidenceRecord]

    @model_validator(mode="after")
    def unique_ids(self):
        ids = [item.id for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Evidence IDs must be unique")
        return self


def verify_evidence(manifest_path: Path) -> EvidenceManifest:
    manifest = EvidenceManifest.model_validate_json(
        manifest_path.read_text(encoding="utf-8")
    )
    for item in manifest.items:
        artifact = input_path(item.artifact_path)
        actual = sha256_file(artifact)
        if actual != item.file_sha256:
            raise ValueError(f"Evidence hash mismatch for {item.id}: {artifact}")
    return manifest


def _crest(project: Project) -> list[list[float]]:
    if not project.dam_length_m:
        raise ValueError("Dam length is required to estimate a crest")
    geod = Geod(ellps="WGS84")
    axis_bearing = (project.downstream_bearing_deg + 90.0) % 360.0
    half = project.dam_length_m / 2.0
    lon1, lat1, _ = geod.fwd(project.longitude, project.latitude, axis_bearing, half)
    lon2, lat2, _ = geod.fwd(
        project.longitude, project.latitude, axis_bearing + 180.0, half
    )
    return [[lon1, lat1], [project.longitude, project.latitude], [lon2, lat2]]


def build_candidate(
    project: Project, terrain: Terrain | None = None
) -> tuple[dict, dict]:
    """Return a draft record and GeoJSON shoreline without modifying project config."""
    terrain = terrain or load_terrain(project, half_width=6000, size=200)
    bed = float(terrain.origin[2])
    top = project.maximum_water_level_m or bed + project.dam_height_m
    level = project.initial_water_level_m or bed + (top - bed) * 0.9
    if top <= bed:
        raise ValueError("Maximum water level must be above the DEM bed elevation")
    mask = terrain.reservoir_mask(project, level)
    if not mask.any():
        raise ValueError("DEM-derived reservoir candidate is empty")
    polygons = [
        geom
        for geom, value in shapes(
            mask.astype("uint8"), mask=mask, transform=terrain.transform
        )
        if value == 1
    ]
    polygons.sort(key=lambda geom: len(json.dumps(geom)), reverse=True)
    shoreline = transform_geom(terrain.crs, "EPSG:4326", polygons[0], precision=7)
    edge_touched = bool(
        mask[0].any() or mask[-1].any() or mask[:, 0].any() or mask[:, -1].any()
    )
    cell_area = abs(float(terrain.transform.a * terrain.transform.e))
    levels = np.linspace(bed, top, 10)
    raw = []
    for candidate_level in levels:
        candidate_mask = terrain.reservoir_mask(project, float(candidate_level))
        volume = float(
            np.maximum(candidate_level - terrain.elevation[candidate_mask], 0).sum()
            * cell_area
        )
        raw.append(volume)
    raw = [max(value - raw[0], 0.0) for value in raw]
    if raw[-1] <= 0:
        raise ValueError("DEM-derived stage-storage volume is empty")
    scale = project.reservoir_capacity_m3 / raw[-1]
    stage_storage = [
        [round(float(stage), 3), round(volume * scale, 3)]
        for stage, volume in zip(levels, raw)
    ]
    area_m2 = float(mask.sum() * cell_area)
    created = datetime.now(timezone.utc).isoformat()
    candidate_imagery = (
        ROOT / "data/raw/imagery" / f"{project.dam_id}-reconstruction-sentinel2-rgb.tif"
    )
    digitization_path = (
        ROOT / "data/candidates" / project.dam_id / "sentinel-digitization.json"
    )
    crest = _crest(project)
    crest_method = "Configured centre/length, perpendicular to downstream bearing."
    crest_uncertainty = [10, 30]
    digitized_length = None
    if digitization_path.is_file():
        digitization = json.loads(digitization_path.read_text(encoding="utf-8"))
        source_image = input_path(digitization["source_image"])
        if sha256_file(source_image) != digitization["source_image_sha256"]:
            raise ValueError("Sentinel source changed after crest digitization")
        if (
            digitization.get("approved") is not False
            or digitization.get("status") != "approximate"
        ):
            raise ValueError(
                "Candidate digitization must remain explicitly approximate and unapproved"
            )
        crest = digitization["crest_coordinates_wgs84"]
        crest_method = digitization["method"]
        crest_uncertainty = digitization["estimated_horizontal_uncertainty_m"]
        digitized_length = digitization["digitized_length_m"]
    draft = {
        "schema_version": 1,
        "project_id": project.dam_id,
        "created_at": created,
        "status": "approximate",
        "approved": False,
        "disclaimer": RECONSTRUCTION_DISCLAIMER,
        "promotion_rule": "Human review and explicit approve command required before project JSON is changed.",
        "methods": {
            "crest": crest_method,
            "shoreline": "DEM-connected upstream cells below the estimated initial water level.",
            "stage_storage": "DEM hypsometry scaled to configured capacity at the estimated maximum level.",
        },
        "project_patch": {
            "latitude": project.latitude,
            "longitude": project.longitude,
            "dam_length_m": project.dam_length_m,
            "dam_height_m": project.dam_height_m,
            "reservoir_capacity_m3": project.reservoir_capacity_m3,
            "initial_water_level_m": project.initial_water_level_m,
            "maximum_water_level_m": project.maximum_water_level_m,
            "imagery_path": (
                str(candidate_imagery.relative_to(ROOT)).replace("\\", "/")
                if candidate_imagery.is_file()
                else project.imagery_path
            ),
            "crest_coordinates": crest,
            "reservoir_polygon_path": f"data/candidates/{project.dam_id}/reservoir-shoreline.geojson",
            "stage_storage": stage_storage,
        },
        "measurements": {
            "candidate_dam_location_wgs84": [project.longitude, project.latitude],
            "estimated_initial_water_level_m": level,
            "estimated_maximum_water_level_m": top,
            "estimated_shoreline_area_m2": area_m2,
            "configured_capacity_m3": project.reservoir_capacity_m3,
            "digitized_crest_length_m": digitized_length,
            "stage_storage_scale_factor": scale,
        },
        "uncertainty": {
            "crest_alignment_m": crest_uncertainty,
            "dam_length_percent": [5, 10],
            "dam_height_m": [1, 3],
            "spillway_location_m": [20, 50],
            "shoreline_horizontal_m": max(abs(float(terrain.transform.a)), 30.0),
            "stage_storage": "High: DEM is not bathymetry and the curve is capacity-scaled.",
        },
        "warnings": (
            [
                "Reservoir candidate touches the model boundary; shoreline may be truncated."
            ]
            if edge_touched
            else []
        )
        + [
            "Published water levels have an unstated vertical datum; DEM alignment is approximate.",
            "Spillway location is not promoted because no sufficiently precise public geometry was verified.",
        ],
    }
    feature = {
        "type": "Feature",
        "geometry": shoreline,
        "properties": {
            "project_id": project.dam_id,
            "status": "approximate",
            "water_level_m": level,
            "area_m2": area_m2,
            "source_crs": terrain.crs,
            "uncertainty_m": draft["uncertainty"]["shoreline_horizontal_m"],
            "disclaimer": RECONSTRUCTION_DISCLAIMER,
        },
    }
    return draft, {"type": "FeatureCollection", "features": [feature]}
