"""Local MCP connector for portable dam scene packages. stdout is protocol only."""
import json
import sys
from pathlib import Path
from typing import Annotated

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mcp.server.fastmcp import FastMCP
from pydantic import Field
from src.dam_scene import ScenePackage, import_package, list_packages, load_package, package_path, validate_assets

mcp = FastMCP("dam_scene_mcp")
READ = {"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False}


@mcp.tool(annotations=READ)
def dam_list_packages(offset: Annotated[int, Field(ge=0)] = 0,
                      limit: Annotated[int, Field(ge=1, le=100)] = 20) -> dict:
    """List installed portable scene packages with a next_offset for pagination."""
    return list_packages(offset, limit)


@mcp.tool(annotations=READ)
def dam_get_package(package_id: str = "spillway-reference") -> dict:
    """Read dimensions, provenance, authored assets and replay bindings for one package."""
    return load_package(package_id).model_dump()


@mcp.tool(annotations=READ)
def dam_validate_package(package_id: str) -> dict:
    """Verify units, asset hashes, GLB self-containment and named gate bindings."""
    return validate_assets(load_package(package_id), package_path(package_id))


@mcp.tool(annotations={**READ, "readOnlyHint": False, "idempotentHint": False})
def dam_import_package(inbox_folder: str) -> dict:
    """Import scene.json and listed assets from data/scene-inbox/<folder> into a new immutable package. Never overwrites a package or changes project scientific inputs."""
    return import_package(inbox_folder)


@mcp.resource("dam-scene://schema")
def scene_schema() -> str:
    """JSON Schema for a portable scene package; dimensions in metres, Y up."""
    return json.dumps(ScenePackage.model_json_schema())


@mcp.resource("dam-scene://packages/{package_id}")
def scene_resource(package_id: str) -> str:
    return load_package(package_id).model_dump_json(indent=2)


if __name__ == "__main__":
    mcp.run(transport="stdio")
