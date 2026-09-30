"""Read-only scene delivery: authored files stay behind package validation."""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from .dam_scene import list_packages, load_package, package_path, validate_assets

router = APIRouter(prefix="/api/dam-scene", tags=["dam-scene"])


@router.get("/packages")
def packages(offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100)):
    return list_packages(offset, limit)


@router.get("/packages/{package_id}")
def package(package_id: str):
    try:
        item = load_package(package_id)
        report = validate_assets(item, package_path(package_id))
        return {**item.model_dump(), "validation": report}
    except ValueError as error:
        raise HTTPException(404, str(error)) from error


@router.get("/packages/{package_id}/assets/{filename}")
def asset(package_id: str, filename: str):
    try:
        item = load_package(package_id)
        if filename not in {asset.filename for asset in item.assets}:
            raise ValueError("Asset is not in the package manifest")
        directory = package_path(package_id)
        validate_assets(item, directory)
        return FileResponse(directory / filename)
    except ValueError as error:
        raise HTTPException(404, str(error)) from error
