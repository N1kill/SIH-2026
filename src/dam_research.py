"""Provider-neutral evidence workspace for researching any dam.

The LLM/search runtime lives in :mod:`src.dam_research_agent`.  This module is
deliberately deterministic: it validates sparse dam seeds, archives bounded public
sources, verifies quoted evidence, hashes every artifact, and reports conflicts.
"""
from __future__ import annotations

from datetime import datetime, timezone
from html.parser import HTMLParser
import hashlib
import io
import ipaddress
import json
import re
import socket
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urljoin, urlparse

import requests
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .project import Project, ROOT
from .reconstruction import EvidenceManifest, EvidenceRecord, sha256_file


RESEARCH_DISCLAIMER = (
    "Machine-assisted public-source research. Every value must be reviewed before "
    "it is promoted into a simulation project; absence of evidence is not evidence "
    "that a structure, capacity, or hazard does not exist."
)
MAX_SOURCE_BYTES = 20 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {
    "application/json", "application/pdf", "application/xml", "application/geo+json",
    "text/csv", "text/html", "text/plain", "text/xml",
}

# Canonical SI-valued fields understood by the project schema. Agents may retain
# additional measurements in evidence records, but only these can enter a patch.
PROJECT_FIELDS = {
    "latitude", "longitude", "dam_type", "dam_height_m", "dam_length_m",
    "crest_width_m", "crest_elevation_m", "reservoir_capacity_m3",
    "reservoir_surface_area_m2", "initial_water_level_m", "maximum_water_level_m",
    "spillway_width_m", "spillway_crest_elevation_m", "catchment_area_km2",
}
RESEARCH_TRACKS = {
    "identity_geometry": (
        "official name and aliases, coordinates, owner/operator, river, dam type, "
        "height, lengths, crest geometry, completion year, drawings and CRS"
    ),
    "reservoir_hydrology": (
        "gross/live storage, surface area, FRL/MWL/dead-storage levels and datum, "
        "stage-area-storage, catchment, design flood and inflow records"
    ),
    "spillway_breach_history": (
        "spillway type/dimensions/capacity, gates, incidents, observed breach geometry, "
        "hydrographs, inundation extents, depths and timestamps"
    ),
    "safety_context": (
        "official dam-safety records, emergency action plans, shelters, capacities, "
        "critical infrastructure, roads and route restrictions"
    ),
}


class DamResearchSeed(BaseModel):
    """Minimum reusable input; name is the only mandatory real-world identifier."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    dam_id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    dam_name: str = Field(min_length=2, max_length=200)
    country: str | None = Field(default=None, max_length=100)
    region: str | None = Field(default=None, max_length=200)
    river: str | None = Field(default=None, max_length=200)
    latitude: float | None = Field(default=None, ge=-80, le=84)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    aliases: list[str] = Field(default_factory=list)
    project_path: str | None = None

    @model_validator(mode="after")
    def coordinate_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be supplied together")
        return self

    @classmethod
    def from_project(cls, project: Project, project_path: str | None = None):
        return cls(
            dam_id=project.dam_id, dam_name=project.dam_name,
            latitude=project.latitude, longitude=project.longitude,
            river=_provenance_hint(project.provenance, "river"),
            project_path=project_path,
        )


def _provenance_hint(items: list[dict], key: str) -> str | None:
    for item in items:
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


class ArchivedEvidence(BaseModel):
    """Strict input accepted from research subagents before a source is archived."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=2, max_length=500)
    source_url: str
    publisher_or_author: str = Field(min_length=2, max_length=300)
    evidence_category: Literal[
        "identity_geometry", "reservoir_hydrology", "spillway_breach_history",
        "safety_context", "imagery", "other",
    ]
    source_tier: Literal[
        "official_primary", "primary_non_government", "peer_reviewed",
        "reputable_secondary", "discovery_only",
    ]
    license_or_usage_status: str = Field(min_length=2, max_length=500)
    geographic_coordinates_or_crs: str = "Not stated"
    relevant_measurements: dict[str, Any] = Field(default_factory=dict)
    estimated_uncertainty: dict[str, Any] = Field(default_factory=dict)
    status: Literal["verified", "approximate", "discovery_only"]
    exact_quote: str = Field(min_length=8, max_length=4000)
    source_locator: str = Field(default="Page/section not stated", max_length=300)
    quality_note: str = Field(min_length=3, max_length=1000)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("source_url")
    @classmethod
    def http_url(cls, value: str):
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("Evidence URL must be HTTP(S)")
        return value

    @model_validator(mode="after")
    def conservative_status(self):
        if self.status == "verified" and self.source_tier not in {
            "official_primary", "primary_non_government", "peer_reviewed"
        }:
            raise ValueError("Secondary/discovery sources cannot be marked verified")
        unknown = set(self.relevant_measurements) - PROJECT_FIELDS
        if any(key.startswith("project_") for key in unknown):
            raise ValueError("Unknown project fields must not use the project_ prefix")
        return self


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self._hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript", "svg"}:
            self._hidden += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "svg"} and self._hidden:
            self._hidden -= 1

    def handle_data(self, data):
        if not self._hidden:
            self.parts.append(data)


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def extract_text(data: bytes, content_type: str, artifact: Path | None = None) -> str:
    """Extract searchable text without pretending OCR has occurred."""
    if content_type == "application/pdf":
        import pdfplumber
        with pdfplumber.open(artifact or io.BytesIO(data)) as document:
            return _clean_text(" ".join(page.extract_text() or "" for page in document.pages))
    decoded = data.decode("utf-8", errors="replace")
    if content_type == "text/html":
        parser = _TextExtractor()
        parser.feed(decoded)
        return _clean_text(" ".join(parser.parts))
    return _clean_text(decoded)


def _assert_public_host(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Only HTTP(S) public sources can be archived")
    if parsed.username or parsed.password:
        raise ValueError("Credential-bearing URLs are not allowed")
    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError(f"Source host cannot be resolved: {parsed.hostname}") from exc
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise ValueError(f"Source resolves to a non-public address: {ip}")


def _safe_slug(value: str, limit: int = 70) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:limit]
    return slug or "source"


def fetch_public_source(url: str, max_bytes: int = MAX_SOURCE_BYTES) -> tuple[bytes, str, str]:
    """Fetch a bounded public document while rechecking every redirect target."""
    current = url
    headers = {"User-Agent": "InundaX-dam-evidence-agent/1.0 (+public research)"}
    for _ in range(6):
        _assert_public_host(current)
        response = requests.get(current, headers=headers, timeout=(10, 45), stream=True,
                                allow_redirects=False)
        if response.status_code in {301, 302, 303, 307, 308}:
            location = response.headers.get("Location")
            if not location:
                raise ValueError("Source redirect has no Location header")
            current = urljoin(current, location)
            continue
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise ValueError(f"Unsupported evidence content type: {content_type or 'missing'}")
        declared = response.headers.get("Content-Length")
        if declared and int(declared) > max_bytes:
            raise ValueError(f"Source exceeds {max_bytes} bytes")
        chunks, size = [], 0
        for chunk in response.iter_content(64 * 1024):
            if not chunk:
                continue
            size += len(chunk)
            if size > max_bytes:
                raise ValueError(f"Source exceeds {max_bytes} bytes")
            chunks.append(chunk)
        return b"".join(chunks), content_type, current
    raise ValueError("Too many source redirects")


class EvidenceWorkspace:
    """Append-only workspace for one dam research run."""

    def __init__(self, seed: DamResearchSeed, root: Path = ROOT):
        self.seed = seed
        self.root = Path(root)
        self.directory = self.root / "data" / "evidence" / seed.dam_id
        self.sources = self.directory / "sources"
        self.sources.mkdir(parents=True, exist_ok=True)

    def archive(self, candidate: ArchivedEvidence) -> EvidenceRecord:
        data, content_type, final_url = fetch_public_source(candidate.source_url)
        return self.archive_bytes(candidate, data, content_type, final_url)

    def archive_bytes(self, candidate: ArchivedEvidence, data: bytes,
                      content_type: str, final_url: str | None = None) -> EvidenceRecord:
        """Archive already-fetched bytes; exposed separately for deterministic tests."""
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise ValueError(f"Unsupported evidence content type: {content_type}")
        digest = hashlib.sha256(data).hexdigest()
        suffix = {
            "application/pdf": ".pdf", "application/json": ".json",
            "application/geo+json": ".geojson", "text/csv": ".csv",
            "text/html": ".html", "text/plain": ".txt",
            "application/xml": ".xml", "text/xml": ".xml",
        }[content_type]
        stem = f"{_safe_slug(candidate.title)}-{digest[:12]}"
        artifact = self.sources / f"{stem}{suffix}"
        text = extract_text(data, content_type)
        quote = _clean_text(candidate.exact_quote)
        if quote.casefold() not in text.casefold():
            raise ValueError(
                "Exact quote was not found in the archived source. Use a shorter verbatim "
                "quote, or mark an image-only document discovery_only without measurements."
            )
        if not artifact.exists():
            artifact.write_bytes(data)
        text_path = self.sources / f"{stem}.extracted.txt"
        text_path.write_text(text, encoding="utf-8")
        claim_digest = hashlib.sha256((candidate.evidence_category + quote).encode()).hexdigest()[:8]
        record_id = _safe_slug(candidate.title, 55) + "-" + digest[:8] + "-" + claim_digest
        relative = artifact.relative_to(self.root).as_posix()
        note = (
            f"{candidate.quality_note} Exact quote verified at {candidate.source_locator}. "
            f"Category={candidate.evidence_category}; tier={candidate.source_tier}; "
            f"final_url={final_url or candidate.source_url}; extracted_text={text_path.relative_to(self.root).as_posix()}"
        )
        return EvidenceRecord(
            id=record_id, title=candidate.title, source_url=final_url or candidate.source_url,
            publisher_or_author=candidate.publisher_or_author,
            retrieval_date=datetime.now(timezone.utc).date().isoformat(),
            license_or_usage_status=candidate.license_or_usage_status,
            artifact_path=relative, file_sha256=sha256_file(artifact),
            geographic_coordinates_or_crs=candidate.geographic_coordinates_or_crs,
            relevant_measurements=candidate.relevant_measurements,
            estimated_uncertainty=candidate.estimated_uncertainty,
            status=candidate.status, quality_note=note,
            notes=f"Exact quote: {candidate.exact_quote}\n{candidate.notes or ''}",
        )

    def load_records(self) -> list[EvidenceRecord]:
        path = self.directory / "agent-evidence.json"
        if not path.is_file():
            return []
        return EvidenceManifest.model_validate_json(path.read_text(encoding="utf-8")).items

    def save_records(self, records: list[EvidenceRecord]) -> Path:
        by_key: dict[tuple[str, str, str], EvidenceRecord] = {}
        for item in [*self.load_records(), *records]:
            category_match = re.search(r"Category=([^;]+);", item.quality_note)
            category = category_match.group(1) if category_match else "other"
            quote = (item.notes or "").split("\n", 1)[0].removeprefix("Exact quote:")
            key = (item.source_url.casefold(), category, _clean_text(quote).casefold())
            by_key.setdefault(key, item)
        manifest = EvidenceManifest(
            project_id=self.seed.dam_id,
            generated_at=datetime.now(timezone.utc).isoformat(),
            items=list(by_key.values()),
        )
        target = self.directory / "agent-evidence.json"
        target.write_text(manifest.model_dump_json(indent=2), encoding="utf-8")
        return target

    def write_seed(self) -> Path:
        path = self.directory / "research-seed.json"
        path.write_text(self.seed.model_dump_json(indent=2), encoding="utf-8")
        return path


def missing_project_fields(project: Project | None) -> list[str]:
    if project is None:
        return sorted(PROJECT_FIELDS)
    values = project.model_dump()
    return sorted(field for field in PROJECT_FIELDS if values.get(field) is None)


def make_research_plan(seed: DamResearchSeed, project: Project | None = None) -> dict:
    identity = ", ".join(filter(None, [seed.dam_name, seed.region, seed.country]))
    location = (f"{seed.latitude}, {seed.longitude}" if seed.latitude is not None
                else "coordinates unknown")
    aliases = ", ".join(seed.aliases) or "none supplied"
    tracks = []
    for name, objective in RESEARCH_TRACKS.items():
        queries = [
            f'"{seed.dam_name}" {objective.split(",", 1)[0]}',
            f'"{seed.dam_name}" dam filetype:pdf {seed.country or ""}'.strip(),
            f'"{seed.dam_name}" {seed.river or "reservoir"} {seed.region or ""}'.strip(),
        ]
        tracks.append({"name": name, "objective": objective, "starter_queries": queries})
    return {
        "schema_version": 1, "dam_id": seed.dam_id, "identity": identity,
        "location_hint": location, "aliases": aliases,
        "missing_project_fields": missing_project_fields(project),
        "tracks": tracks, "source_priority": [
            "dam owner/operator and regulator", "national/state water and dam-safety agencies",
            "official environmental/engineering reports", "peer-reviewed literature",
            "reputable secondary discovery leads",
        ],
        "rules": [
            "Never fill an unknown value from model memory or a search snippet.",
            "Archive the source and verify an exact quote before recording a measurement.",
            "Preserve conflicting values and units; do not average them.",
            "Record vertical datum and CRS explicitly; use 'Not stated' when absent.",
            "Treat maps, imagery-derived geometry, shelters and routes as candidates until verified.",
        ],
    }


def compile_findings(seed: DamResearchSeed, records: list[EvidenceRecord],
                     project: Project | None = None) -> dict:
    values: dict[str, list[dict]] = {}
    for item in records:
        for field, value in item.relevant_measurements.items():
            if field in PROJECT_FIELDS:
                values.setdefault(field, []).append({
                    "value": value, "evidence_id": item.id, "status": item.status,
                    "source_url": item.source_url,
                })
    conflicts, candidates = {}, {}
    for field, claims in values.items():
        unique = {json.dumps(claim["value"], sort_keys=True) for claim in claims}
        if len(unique) > 1:
            conflicts[field] = claims
        elif any(claim["status"] == "verified" for claim in claims):
            candidates[field] = claims[0]["value"]
    existing = project.model_dump() if project else {}
    patch = {field: value for field, value in candidates.items()
             if existing.get(field) is None or existing.get(field) != value}
    candidate_project = None
    if project is None:
        initial = {
            "dam_id": seed.dam_id, "dam_name": seed.dam_name,
            "latitude": seed.latitude, "longitude": seed.longitude,
            **candidates,
        }
        required = ("latitude", "longitude", "dam_height_m", "reservoir_capacity_m3")
        if all(initial.get(field) is not None for field in required):
            initial["provenance"] = [{
                "dataset": "Dam evidence agent candidate",
                "source": f"data/evidence/{seed.dam_id}/agent-evidence.json",
                "status": "human-review-required",
            }]
            initial["assumptions"] = [
                "Public-source attributes are candidates until a named human approves them.",
                "Unknown geometry, bathymetry and vertical datums remain unset.",
            ]
            candidate_project = Project.model_validate(initial).model_dump()
    coverage = sorted(values)
    return {
        "schema_version": 1, "dam_id": seed.dam_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "disclaimer": RESEARCH_DISCLAIMER,
        "evidence_count": len(records), "covered_project_fields": coverage,
        "missing_project_fields": sorted(PROJECT_FIELDS - set(coverage)),
        "conflicts": conflicts,
        "candidate_project_patch": patch,
        "candidate_project": candidate_project,
        "promotion": {
            "automatic": False,
            "reason": "A named human must review evidence, conflicts, units, CRS and datums.",
        },
    }
