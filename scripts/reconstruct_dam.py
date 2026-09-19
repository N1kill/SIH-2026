"""Generate, verify, or explicitly approve an evidence-backed reconstruction draft."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.project import ROOT, Project, projects
from src.reconstruction import build_candidate, sha256_file, verify_evidence, RECONSTRUCTION_DISCLAIMER
from src.run_engine import write_json


def paths(project_id: str) -> tuple[Path, Path, Path]:
    directory = ROOT / "data/candidates" / project_id
    return directory, directory / "reconstruction-draft.json", directory / "reservoir-shoreline.geojson"


def load_project(value: str) -> Project:
    path = Path(value)
    return Project.model_validate_json(path.read_text(encoding="utf-8")) if path.is_file() else projects()[value]


def collect_imagery(project_id: str, latitude: float, longitude: float, date_range: str) -> Path:
    """Download a licensed Sentinel-2 RGB candidate without changing project config."""
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.transform import from_bounds
    from rasterio.vrt import WarpedVRT
    from pyproj import Transformer

    query = urlencode({
        "collections": "sentinel-2-l2a",
        "bbox": f"{longitude-.035},{latitude-.035},{longitude+.035},{latitude+.035}",
        "limit": 40,
        "datetime": date_range,
    })
    request = Request("https://earth-search.aws.element84.com/v1/search?" + query,
                      headers={"User-Agent": "SIH-2026-evidence/1.0"})
    with urlopen(request, timeout=45) as response:
        items = json.load(response)["features"]
    items = [item for item in items if "visual" in item.get("assets", {})]
    if not items:
        raise ValueError("No Sentinel-2 visual asset found for the requested date range")
    item = min(items, key=lambda value: value["properties"].get("eo:cloud_cover", 100))
    href = item["assets"]["visual"]["href"]
    zone = min(60, int((longitude + 180) // 6) + 1)
    crs = f"EPSG:{32600 + zone if latitude >= 0 else 32700 + zone}"
    x, y = Transformer.from_crs(4326, crs, always_xy=True).transform(longitude, latitude)
    transform = from_bounds(x-4000, y-4000, x+4000, y+4000, 1024, 1024)
    target = ROOT / "data/raw/imagery" / f"{project_id}-reconstruction-sentinel2-rgb.tif"
    target.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.Env(GDAL_HTTP_TIMEOUT=45, GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
                      CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
        with rasterio.open(href) as source, WarpedVRT(
            source, crs=crs, transform=transform, width=1024, height=1024,
            resampling=Resampling.bilinear) as vrt:
            rgb = vrt.read([1, 2, 3])
            with rasterio.open(target, "w", driver="GTiff", width=1024, height=1024,
                               count=3, dtype=rgb.dtype, crs=crs, transform=transform,
                               compress="deflate") as output:
                output.write(rgb)
    metadata = {
        "source_url": href,
        "publisher": "ESA/Copernicus; distributed by Element 84 Earth Search",
        "scene": item["id"],
        "acquisition_date": item["properties"].get("datetime"),
        "retrieval_date": datetime.now().astimezone().date().isoformat(),
        "cloud_cover_percent": item["properties"].get("eo:cloud_cover"),
        "license_or_usage_status": "Copernicus Sentinel data terms",
        "crs": crs,
        "candidate_location_wgs84": [longitude, latitude],
        "file_sha256": sha256_file(target),
        "status": "approximate",
    }
    write_json(target.with_suffix(".json"), metadata)
    return target


def create_draft(project: Project, manifest_path: Path) -> Path:
    manifest = verify_evidence(manifest_path)
    if manifest.project_id != project.dam_id:
        raise ValueError("Evidence manifest project does not match the requested project")
    directory, draft_path, shoreline_path = paths(project.dam_id)
    directory.mkdir(parents=True, exist_ok=True)
    draft, shoreline = build_candidate(project)
    reported_area = next((item.relevant_measurements.get("full_reservoir_area_m2")
                          for item in manifest.items
                          if item.relevant_measurements.get("full_reservoir_area_m2")), None)
    if reported_area:
        draft["measurements"]["reported_full_reservoir_area_m2"] = reported_area
        difference = abs(draft["measurements"]["estimated_shoreline_area_m2"] - reported_area) / reported_area
        draft["measurements"]["shoreline_area_difference_percent"] = difference * 100
        if difference > 0.25:
            draft["warnings"].append(
                "DEM shoreline area differs from the reported full-reservoir area by more than 25%; do not treat it as validated."
            )
    write_json(shoreline_path, shoreline)
    draft["evidence_manifest"] = str(manifest_path.relative_to(ROOT)).replace("\\", "/")
    draft["evidence_manifest_sha256"] = sha256_file(manifest_path)
    draft["evidence_ids"] = [item.id for item in manifest.items]
    draft["artifacts"] = {
        "reservoir_shoreline": {
            "path": str(shoreline_path.relative_to(ROOT)).replace("\\", "/"),
            "sha256": sha256_file(shoreline_path),
        }
    }
    write_json(draft_path, draft)
    return draft_path


def validate_draft(project_id: str) -> dict:
    _, draft_path, shoreline_path = paths(project_id)
    draft = json.loads(draft_path.read_text(encoding="utf-8"))
    if draft.get("approved"):
        raise ValueError("Candidate draft must remain unapproved; approval is recorded in the project provenance")
    if draft.get("disclaimer") != RECONSTRUCTION_DISCLAIMER:
        raise ValueError("Required reconstruction disclaimer is missing")
    manifest_path = ROOT / draft["evidence_manifest"]
    verify_evidence(manifest_path)
    if sha256_file(manifest_path) != draft["evidence_manifest_sha256"]:
        raise ValueError("Evidence manifest changed after draft generation")
    if sha256_file(shoreline_path) != draft["artifacts"]["reservoir_shoreline"]["sha256"]:
        raise ValueError("Candidate shoreline changed after draft generation")
    return draft


def approve(project_id: str, reviewer: str, acceptance: str) -> Path:
    if acceptance != "approximate-screening-only":
        raise ValueError("Approval requires --accept approximate-screening-only")
    draft = validate_draft(project_id)
    project_path = ROOT / "data/projects" / f"{project_id}.json"
    project = Project.model_validate_json(project_path.read_text(encoding="utf-8"))
    patch = draft["project_patch"]
    values = project.model_dump()
    for field in ("latitude", "longitude", "dam_length_m", "dam_height_m",
                  "reservoir_capacity_m3", "initial_water_level_m",
                  "maximum_water_level_m", "imagery_path", "crest_coordinates",
                  "reservoir_polygon_path", "stage_storage"):
        values[field] = patch[field]
    values["provenance"].append({
        "dataset": "Human-approved approximate reconstruction",
        "source": draft["evidence_manifest"],
        "approved_by": reviewer,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "status": "approximate",
        "uncertainty": draft["uncertainty"],
        "disclaimer": RECONSTRUCTION_DISCLAIMER,
    })
    project = Project.model_validate(values)
    write_json(project_path, project.model_dump())
    return project_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("collect-imagery", "draft", "validate", "approve"))
    parser.add_argument("--project", default="machhu-ii")
    parser.add_argument("--evidence", default="data/evidence/machhu-ii/evidence.json")
    parser.add_argument("--candidate-latitude", type=float)
    parser.add_argument("--candidate-longitude", type=float)
    parser.add_argument("--candidate-length-m", type=float)
    parser.add_argument("--candidate-capacity-m3", type=float)
    parser.add_argument("--candidate-initial-level-m", type=float)
    parser.add_argument("--candidate-maximum-level-m", type=float)
    parser.add_argument("--dates", default="2025-01-01T00:00:00Z/2025-02-01T00:00:00Z")
    parser.add_argument("--reviewer")
    parser.add_argument("--accept")
    args = parser.parse_args()
    if args.action == "collect-imagery":
        if args.candidate_latitude is None or args.candidate_longitude is None:
            parser.error("collect-imagery requires candidate latitude and longitude")
        output = collect_imagery(args.project, args.candidate_latitude,
                                 args.candidate_longitude, args.dates)
        print(f"Candidate imagery collected without project promotion: {output}")
    elif args.action == "draft":
        project = load_project(args.project)
        if (args.candidate_latitude is None) != (args.candidate_longitude is None):
            parser.error("candidate latitude and longitude must be supplied together")
        updates = {}
        for key, value in {
            "latitude": args.candidate_latitude,
            "longitude": args.candidate_longitude,
            "dam_length_m": args.candidate_length_m,
            "reservoir_capacity_m3": args.candidate_capacity_m3,
            "initial_water_level_m": args.candidate_initial_level_m,
            "maximum_water_level_m": args.candidate_maximum_level_m,
        }.items():
            if value is not None:
                updates[key] = value
        if updates:
            project = Project.model_validate({**project.model_dump(), **updates})
        output = create_draft(project, ROOT / args.evidence)
        print(f"Unapproved reconstruction draft: {output}")
    elif args.action == "validate":
        draft = validate_draft(args.project)
        print(json.dumps({"valid": True, "approved": False, "status": draft["status"], "warnings": draft["warnings"]}, indent=2))
    else:
        if not args.reviewer:
            parser.error("approve requires --reviewer")
        output = approve(args.project, args.reviewer, args.accept or "")
        print(f"Approved approximate reconstruction applied: {output}")


if __name__ == "__main__":
    main()
