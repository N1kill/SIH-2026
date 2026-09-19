"""Validated scenario inputs and explicit, traceable demonstration assumptions."""
from pathlib import Path
import json
import math
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

ROOT = Path(__file__).resolve().parents[1]


class Inputs(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Project(Inputs):
    dam_id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    dam_name: str
    latitude: float = Field(ge=-80, le=84)
    longitude: float = Field(ge=-180, le=180)
    dam_type: str | None = None
    dam_height_m: float = Field(gt=0, le=500)
    dam_length_m: float | None = Field(default=None, gt=0)
    crest_width_m: float | None = Field(default=None, gt=0)
    crest_elevation_m: float | None = None
    reservoir_capacity_m3: float = Field(gt=0)
    reservoir_surface_area_m2: float | None = Field(default=None, gt=0)
    initial_water_level_m: float | None = None
    maximum_water_level_m: float | None = None
    spillway_width_m: float | None = Field(default=None, ge=0)
    spillway_crest_elevation_m: float | None = None
    dem_path: str | None = None
    imagery_path: str | None = None
    reservoir_polygon_path: str | None = None
    river_path: str | None = None
    land_use_path: str | None = None
    facilities_path: str | None = None
    dam_images_manifest: str | None = None
    crest_coordinates: list[tuple[float, float]] | None = None
    downstream_bearing_deg: float = 330
    catchment_area_km2: float | None = Field(default=None, gt=0)
    stage_storage: list[tuple[float, float]] | None = None
    provenance: list[dict] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_evidence_geometry(self):
        if self.crest_coordinates is not None:
            if len(self.crest_coordinates) < 2 or len(set(self.crest_coordinates)) < 2:
                raise ValueError("Crest coordinates require at least two distinct WGS84 points")
            for longitude, latitude in self.crest_coordinates:
                if not -180 <= longitude <= 180 or not -80 <= latitude <= 84:
                    raise ValueError("Crest coordinates must be valid WGS84 longitude/latitude pairs")
        if self.stage_storage is not None:
            if len(self.stage_storage) < 2:
                raise ValueError("Stage-storage data require at least two points")
            elevations = [point[0] for point in self.stage_storage]
            storages = [point[1] for point in self.stage_storage]
            if any(not math.isfinite(value) for value in elevations + storages):
                raise ValueError("Stage-storage values must be finite")
            if any(b <= a for a, b in zip(elevations, elevations[1:])):
                raise ValueError("Stage elevations must be strictly increasing")
            if storages[0] < 0 or any(b <= a for a, b in zip(storages, storages[1:])):
                raise ValueError("Stage storage must be nonnegative and strictly increasing")
        if (self.initial_water_level_m is not None and self.maximum_water_level_m is not None
                and self.initial_water_level_m > self.maximum_water_level_m):
            raise ValueError("Initial water level cannot exceed maximum water level")
        return self


class Scenario(Inputs):
    project_id: str = "machhu-ii"
    name: str = Field(default="Baseline", max_length=120)
    duration_s: float = Field(default=1800, gt=0, le=86400)
    dt_s: float = Field(default=2, gt=0, le=30)
    output_interval_s: float = Field(default=30, ge=1, le=3600)
    domain_half_width_m: float = Field(default=6000, ge=500, le=30000)
    grid_size: int = Field(default=100, ge=20, le=200)
    initial_level_fraction: float = Field(default=0.9, gt=0, le=1.2)
    inflow_m3s: float = Field(default=0, ge=0, le=100000)
    rainfall_mm: float = Field(default=0, ge=0, le=3000)
    curve_number: float = Field(default=75, gt=0, le=100)
    breach_width_m: float = Field(default=20, gt=0, le=5000)
    max_breach_width_m: float = Field(default=150, gt=0, le=5000)
    breach_depth_m: float = Field(default=5, gt=0, le=500)
    breach_side_slope: float = Field(default=1, ge=0, le=5)
    formation_time_s: float = Field(default=1800, gt=0, le=86400)
    erosion_coefficient: float = Field(default=4e-5, ge=0, le=0.01)
    critical_shear_pa: float = Field(default=25, ge=0)
    collapse_shear_pa: float = Field(default=4000, gt=0)
    breach_model: Literal["erosion", "parametric"] = "erosion"
    manning_n: float = Field(default=0.04, ge=0.01, le=0.3)
    wet_depth_m: float = Field(default=0.1, gt=0, le=2)
    risk_depths_m: tuple[float, float, float] = (0.5, 1.5, 3.0)
    risk_velocity_ms: float = Field(default=2, gt=0)
    near_field: Literal["hydraulic", "sph"] = "hydraulic"

    @model_validator(mode="after")
    def check_limits(self):
        if self.max_breach_width_m < self.breach_width_m:
            raise ValueError("Maximum breach width must be at least the initial width")
        if self.duration_s / self.dt_s > 100000:
            raise ValueError("Choose dt/duration requiring at most 100000 macro steps")
        if list(self.risk_depths_m) != sorted(self.risk_depths_m) or min(self.risk_depths_m) <= 0:
            raise ValueError("Risk depth thresholds must be positive and increasing")
        return self


def input_path(value: str) -> Path:
    path = (ROOT / value).resolve()
    if not path.is_relative_to(ROOT):
        raise ValueError("Input paths must be inside the project; copy supplied data into data/raw")
    if not path.is_file():
        raise ValueError(f"Input file does not exist: {value}")
    return path


def projects() -> dict[str, Project]:
    legacy = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
    result = {}
    for key, dam in legacy.items():
        is_machhu = key == "machhu-ii"
        result[key] = Project(
            dam_id=key, dam_name=dam["dam_name"], latitude=dam["lat"], longitude=dam["lon"],
            dam_height_m=dam["dam_height_m"], dam_length_m=3542 if is_machhu else dam.get("crest_length_m"),
            reservoir_capacity_m3=dam["reservoir_volume_m3"],
            dem_path="data/processed/dem_conditioned.tif" if is_machhu else None,
            river_path="data/raw/rivers/hydrorivers_clip.shp" if is_machhu else None,
            land_use_path="data/raw/lulc/lulc_raw.tif" if is_machhu else None,
            dam_type="earthfill" if is_machhu else None,
            catchment_area_km2=1928 if is_machhu else None,
            provenance=[{"source": "config.json and data/raw/dams/nrld_machhu.csv", "verified_survey": False}],
            assumptions=["Bed elevation sampled from DEM is an approximation, not surveyed bathymetry.",
                         "Dam axis inferred from downstream bearing unless crest coordinates are supplied.",
                         "Power-law stage/storage relation calibrated to configured capacity; exponent 1.7.",
                         "Unspecified spillway is disabled; rainfall runoff is a uniform-duration SCS-CN inflow."])
    for path in sorted((ROOT / "data/projects").glob("*.json")):
        project = Project.model_validate_json(path.read_text(encoding="utf-8"))
        result[project.dam_id] = project
    return result
