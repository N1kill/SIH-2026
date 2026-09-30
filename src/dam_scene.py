"""Versioned portable scene packages, shared by MCP and the dashboard API."""

from __future__ import annotations

import hashlib
import json
import re
import struct
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ROOT = Path(__file__).resolve().parents[1]
STORE = ROOT / "data/scene-packages"
INBOX = ROOT / "data/scene-inbox"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class SpillwayGeometry(StrictModel):
    bays: int = Field(default=9, ge=1, le=40)
    bay_width_m: float = Field(default=12, ge=1, le=40)
    pier_width_m: float = Field(default=2.8, ge=0.5, le=12)
    height_m: float = Field(default=32, ge=5, le=150)
    chute_length_m: float = Field(default=44, ge=8, le=180)
    deck_width_m: float = Field(default=8, ge=2, le=25)
    gate_height_m: float = Field(default=9, ge=1, le=30)
    basin_length_m: float = Field(default=55, ge=10, le=300)

    @model_validator(mode="after")
    def proportions(self):
        if self.gate_height_m >= self.height_m:
            raise ValueError("gate_height_m must be below height_m")
        return self


class Asset(StrictModel):
    filename: str = Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}\.(glb|hdr|ktx2)$")
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    role: Literal["model", "environment", "texture"]
    license: str = Field(min_length=1, max_length=500)


class GateBinding(StrictModel):
    gate_id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    node: str = Field(min_length=1, max_length=100)
    axis: Literal["x", "y", "z"] = "y"
    maximum_opening_m: float = Field(gt=0, le=100)


class ScenePackage(StrictModel):
    schema_version: Literal["1.0"] = "1.0"
    package_id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,63}$")
    title: str = Field(min_length=1, max_length=120)
    classification: Literal["reconstructed", "surveyed"]
    source: str = Field(min_length=1, max_length=2000)
    assumptions: list[str] = Field(min_length=1, max_length=50)
    units: Literal["metres"] = "metres"
    up_axis: Literal["Y"] = "Y"
    geometry: SpillwayGeometry = Field(default_factory=SpillwayGeometry)
    assets: list[Asset] = Field(default_factory=list, max_length=20)
    gate_bindings: list[GateBinding] = Field(default_factory=list, max_length=100)
    project_id: str | None = Field(default=None, pattern=r"^[a-zA-Z0-9_-]{1,64}$")

    @model_validator(mode="after")
    def unique_assets(self):
        names = [asset.filename for asset in self.assets]
        if len(names) != len(set(names)):
            raise ValueError("Asset filenames must be unique")
        if sum(asset.role == "model" for asset in self.assets) > 1:
            raise ValueError("Use one assembled GLB per package")
        if any(
            asset.role == "environment" and not asset.filename.endswith(".hdr")
            for asset in self.assets
        ):
            raise ValueError("Environment assets must be HDR")
        if self.gate_bindings and not any(
            asset.role == "model" for asset in self.assets
        ):
            raise ValueError("Named node bindings require an authored GLB")
        for attr in ("gate_id", "node"):
            values = [getattr(binding, attr) for binding in self.gate_bindings]
            if len(values) != len(set(values)):
                raise ValueError(f"Duplicate gate binding {attr}")
        return self


def reference_package() -> ScenePackage:
    return ScenePackage(
        package_id="spillway-reference",
        title="Spillway architectural study",
        classification="reconstructed",
        source="User-supplied spillway photograph: visual reference only; site and dimensions unverified.",
        assumptions=[
            "All dimensions are explicit template parameters, not Machhu-II measurements.",
            "Nine repeated bays illustrate the supplied architectural reference; count is not a site claim.",
            "Preview discharge is an illustrative control, not a hydraulic prediction.",
            "Weathering and surface detail are authored appearance, not condition assessment.",
        ],
    )


def package_path(package_id: str) -> Path:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", package_id):
        raise ValueError(
            "Invalid package ID; use lowercase letters, digits and hyphens"
        )
    result = (STORE / package_id).resolve()
    if not result.is_relative_to(STORE.resolve()):
        raise ValueError("Package path escapes registry")
    return result


def load_package(package_id: str) -> ScenePackage:
    if package_id == "spillway-reference":
        return reference_package()
    path = package_path(package_id) / "scene.json"
    if not path.resolve().is_relative_to(package_path(package_id)):
        raise ValueError("Unsafe manifest path")
    if not path.is_file():
        raise ValueError("Scene package not found. Use dam_list_packages first.")
    return ScenePackage.model_validate_json(path.read_text(encoding="utf-8"))


def inspect_glb(path: Path) -> dict:
    """Reject side-loading URLs; a portable GLB must embed buffers and images."""
    with path.open("rb") as stream:
        header = stream.read(20)
        if len(header) != 20:
            raise ValueError("Truncated GLB header")
        magic, version, length, chunk_length, chunk_type = struct.unpack(
            "<4sIIII", header
        )
        if (
            magic != b"glTF"
            or version != 2
            or length != path.stat().st_size
            or chunk_type != 0x4E4F534A
        ):
            raise ValueError("Expected a valid glTF 2 binary file")
        if chunk_length > 16 * 1024 * 1024:
            raise ValueError("GLB JSON chunk exceeds 16 MiB")
        document = json.loads(stream.read(chunk_length))
    for item in document.get("buffers", []) + document.get("images", []):
        if "uri" in item:
            raise ValueError(
                "GLB must embed all buffers and images; external and data URIs are rejected"
            )
    return {
        "nodes": [node.get("name", "") for node in document.get("nodes", [])],
        "meshes": len(document.get("meshes", [])),
        "materials": len(document.get("materials", [])),
        "extensions": document.get("extensionsUsed", []),
    }


def validate_assets(package: ScenePackage, directory: Path) -> dict:
    result = []
    for asset in package.assets:
        path = (directory / asset.filename).resolve()
        if not path.is_relative_to(directory.resolve()) or not path.is_file():
            raise ValueError(f"Missing or unsafe asset: {asset.filename}")
        if path.stat().st_size > 128 * 1024 * 1024:
            raise ValueError(f"Asset exceeds 128 MiB: {asset.filename}")
        with path.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest != asset.sha256:
            raise ValueError(f"SHA-256 mismatch: {asset.filename}")
        if (asset.role == "model") != (path.suffix == ".glb"):
            raise ValueError("Model assets must be GLB; other roles cannot be GLB")
        info = inspect_glb(path) if path.suffix == ".glb" else {}
        if asset.role == "model":
            absent = [
                binding.node
                for binding in package.gate_bindings
                if binding.node not in info["nodes"]
            ]
            if absent:
                raise ValueError(f"Gate nodes missing from GLB: {absent}")
        result.append(
            {"filename": asset.filename, "bytes": path.stat().st_size, **info}
        )
    return {
        "valid": True,
        "package_id": package.package_id,
        "assets": result,
        "classification": package.classification,
        "units": package.units,
        "reference_width_m": package.geometry.bays
        * (package.geometry.bay_width_m + package.geometry.pier_width_m)
        + package.geometry.pier_width_m,
    }


def import_package(inbox_folder: str) -> dict:
    """Copy a validated package to a new immutable directory; never overwrite."""
    import shutil
    import tempfile

    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", inbox_folder):
        raise ValueError("Use a single folder name under data/scene-inbox")
    source = (INBOX / inbox_folder).resolve()
    if not source.is_relative_to(INBOX.resolve()):
        raise ValueError("Inbox path escapes allowed directory")
    manifest = source / "scene.json"
    if not manifest.resolve().is_relative_to(source):
        raise ValueError("Unsafe manifest path")
    if not manifest.is_file() or manifest.stat().st_size > 1024 * 1024:
        raise ValueError("Provide scene.json (at most 1 MiB) in the inbox folder")
    package = ScenePackage.model_validate_json(manifest.read_text(encoding="utf-8"))
    if package.package_id == "spillway-reference":
        raise ValueError("The built-in reference ID is reserved")
    report = validate_assets(package, source)
    destination = package_path(package.package_id)
    if destination.exists():
        raise ValueError("Package ID already exists; use a new versioned ID")
    STORE.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".import-", dir=STORE) as temporary:
        staging = Path(temporary) / "package"
        staging.mkdir()
        for asset in package.assets:
            shutil.copyfile(source / asset.filename, staging / asset.filename)
        validate_assets(package, staging)
        (staging / "scene.json").write_text(
            package.model_dump_json(indent=2), encoding="utf-8"
        )
        staging.rename(destination)
    return {**report, "preview_path": f"/studio.html?package={package.package_id}"}


def list_packages(offset: int = 0, limit: int = 20) -> dict:
    ids = ["spillway-reference"]
    if STORE.exists():
        ids += sorted(
            path.parent.name
            for path in STORE.glob("*/scene.json")
            if not path.parent.name.startswith(".")
        )
    selected = ids[offset : offset + limit]
    return {
        "items": [
            {"package_id": key, "title": load_package(key).title} for key in selected
        ],
        "total": len(ids),
        "next_offset": offset + limit if offset + limit < len(ids) else None,
    }
