"""Versioned replay/asset contracts shared by the API and Three.js client."""
from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Any
import json

from .project import EvidenceValue, Project, ReplaySpecification

REPLAY_SCHEMA_VERSION = "2.0"
RENDERER_VERSION = "three-parametric-2"
ALLOWED_EVIDENCE_STATUSES = {
    "surveyed", "official", "derived", "reconstructed", "assumed", "unavailable"
}


def canonical_hash(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return sha256(payload.encode("utf-8")).hexdigest()


def evidence(value: Any, unit: str | None, source_id: str | None,
             status: str, uncertainty: Any = None,
             approved_by: str | None = None) -> dict:
    if status not in ALLOWED_EVIDENCE_STATUSES:
        raise ValueError(f"Unsupported provenance status: {status}")
    return EvidenceValue(
        value=value, unit=unit, source_id=source_id, status=status,
        uncertainty=uncertainty, approved_by=approved_by,
    ).model_dump()


def _approved_reconstruction(project: Project) -> dict | None:
    for item in reversed(project.provenance):
        if item.get("approved_by") and item.get("status") in {"approximate", "reconstructed"}:
            return item
    return None


def replay_specification(project: Project, bed_elevation_m: float | None = None) -> dict:
    """Return a complete contract, explicitly marking every data gap.

    Existing scalar project fields are adapted for legacy projects. Missing
    geometry remains unavailable; the client may show a labelled archetype but
    cannot present its dimensions as surveyed fact.
    """
    if project.replay_specification:
        return project.replay_specification.model_dump()

    approved = _approved_reconstruction(project)
    source = "project configuration"
    status = "reconstructed" if approved else "derived"
    approver = approved.get("approved_by") if approved else None
    uncertainty = approved.get("uncertainty") if approved else None
    crest_elevation = project.crest_elevation_m
    if crest_elevation is None and bed_elevation_m is not None:
        crest_elevation = bed_elevation_m + project.dam_height_m
    return ReplaySpecification(
        reconstruction_label="reconstructed archetype",
        crest_elevation=EvidenceValue(
            value=crest_elevation, unit="m", source_id=source,
            status=status if crest_elevation is not None else "unavailable",
            uncertainty=uncertainty, approved_by=approver,
        ),
        crest_width=EvidenceValue(
            value=project.crest_width_m, unit="m", source_id=source,
            status=status if project.crest_width_m is not None else "unavailable",
            uncertainty=uncertainty, approved_by=approver,
        ),
        toe_elevation=EvidenceValue(
            value=bed_elevation_m, unit="m", source_id="DEM sample" if bed_elevation_m is not None else None,
            status="derived" if bed_elevation_m is not None else "unavailable",
            uncertainty="DEM elevation is not surveyed toe geometry" if bed_elevation_m is not None else None,
        ),
        spillway_type=EvidenceValue(status="unavailable"),
        stilling_basin_length=EvidenceValue(status="unavailable"),
    ).model_dump()


def asset_manifest(project: Project, bed_elevation_m: float | None = None) -> dict:
    spec = replay_specification(project, bed_elevation_m)
    crest_width = spec["crest_width"]["value"]
    fallback_width = crest_width if crest_width is not None else max(6.0, project.dam_height_m * 0.3)
    components = [
        {
            "id": "embankment", "kind": "continuous_embankment", "lod": ["high", "medium", "low"],
            "dimensions": {
                "length_m": evidence(project.dam_length_m, "m", "project configuration", "derived" if project.dam_length_m else "unavailable"),
                "height_m": evidence(project.dam_height_m, "m", "project configuration", "derived"),
                "crest_width_m": evidence(fallback_width, "m", "dam-type template" if crest_width is None else "project configuration", "assumed" if crest_width is None else spec["crest_width"]["status"]),
            },
            "rendering": "parametric_fallback", "pickable": True,
        },
        {
            "id": "crest-road", "kind": "crest_road", "lod": ["high", "medium"],
            "dimensions": {"width_m": evidence(fallback_width, "m", "dam-type template", "assumed")},
            "rendering": "parametric_fallback", "pickable": True,
        },
        {
            "id": "drainage-toe", "kind": "toe_drainage", "lod": ["high", "medium"],
            "dimensions": {}, "rendering": "parametric_fallback", "pickable": True,
        },
    ]
    gates = spec.get("gates", [])
    if gates:
        components.extend({
            "id": gate["gate_id"], "kind": "gate", "lod": ["high", "medium", "low"],
            "dimensions": {k: gate[k] for k in ("width", "height", "sill_elevation", "maximum_opening", "opening_rate")},
            "state": gate["status"], "rendering": "instanced_parametric", "pickable": True,
        } for gate in gates)
    else:
        components.append({
            "id": "spillway-unavailable", "kind": "spillway", "lod": [],
            "dimensions": {}, "state": "unavailable", "rendering": "none", "pickable": False,
        })
    return {
        "schema_version": REPLAY_SCHEMA_VERSION,
        "renderer_version": RENDERER_VERSION,
        "coordinate_system": {"horizontal": "project CRS", "vertical": "metres", "local_origin_reversible": True},
        "scale": {"horizontal": 1.0, "vertical": 1.0},
        "reconstruction_label": spec["reconstruction_label"],
        "components": components,
        "external_assets": [],
        "compression": {"meshopt": "supported when authored GLB exists", "ktx2": "supported when textures exist"},
        "specification": spec,
        "manifest_hash": canonical_hash({"project": project.model_dump(), "specification": spec}),
    }


def frame_index(directory: Path) -> list[dict]:
    entries = []
    for path in sorted(directory.glob("frame-*.json")):
        frame = json.loads(path.read_text(encoding="utf-8"))
        entries.append({"index": frame["index"], "time_s": frame["time_s"], "file": path.name})
    return entries
