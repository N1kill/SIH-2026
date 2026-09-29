# Dam scene connector

MCP manages scene packages; Three.js renders them inside the existing FastAPI/static
architecture. MCP is not itself a rendering engine or a photorealistic asset generator.

## Start the viewer

```powershell
npm run build
.\.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8050
```

Open http://127.0.0.1:8050/studio.html. Restart an older server for the new routes.

## Connect MCP

Install optional dependency with `.\.venv\Scripts\python.exe -m pip install -r requirements-mcp.txt`.
Use this entry in a compatible MCP client (adapt enclosing configuration to the client):

```json
{"mcpServers":{"dam-scene":{
  "command":"C:/Users/DELL/SIH-2026/.venv/Scripts/python.exe",
  "args":["C:/Users/DELL/SIH-2026/scripts/dam_scene_mcp.py"]
}}}
```

Tools: `dam_list_packages`, `dam_get_package`, `dam_validate_package`, and explicit
write tool `dam_import_package`. Resources: `dam-scene://schema` and
`dam-scene://packages/{package_id}`. Official Python MCP SDK; local stdio only.

## Import

1. Read schema resource and built-in `spillway-reference` manifest.
2. Create `data/scene-inbox/<folder>/scene.json` with a new versioned package ID.
3. Place a self-contained GLB alongside it: metres, Y-up, local origin, embedded
   buffers/textures. Embedded PBR, Draco, Meshopt and KTX2 are supported. Optional
   HDR environment uses role `environment`.
4. Declare filename, SHA-256, role and license for each asset. Supply provenance,
   classification and assumptions. Named gate nodes need explicit bindings.
5. Call `dam_import_package(inbox_folder="<folder>")`. Open returned preview_path.

Imports never overwrite IDs or modify scientific project inputs. Geometry fields
configure the fallback and camera; provide representative dimensions for GLBs.
No automatic scale fitting occurs. Standalone KTX2 files are retained, but textures
must be embedded in GLB for material assignment; no arbitrary slot mapping occurs.

## Plug-in contract

`DamScenePlugin(renderer)` exposes `load(manifest, assetBaseURL)`, `root`,
`setPreview(fraction)`, `applyReplayFrame(frame)`, `update(timeSeconds)`, `dispose()`.

```json
{"time_s":60,"gates":[{"gate_id":"gate-1","opening_m":1.2,"discharge_m3s":35}]}
```

Gate movement is clamped to maximum opening. Missing discharge hides parametric flow
sheets; aggregate release is never divided into invented per-gate flows. Studio
controls are illustrative, not solver states. The main dashboard displays the
reference package as a default-on architectural study at the dam centre before
breach replay. Its horizontal bay dimensions remain authored, but the procedural
vertical section is rebuilt in metre units: the gate sill follows the configured
starting water elevation, and the deck follows the configured crest. This is a
visual fit, not a measurement of spillway geometry. It is hidden
when a breach begins, leaving the project's parametric dam and existing hydraulic
replay. In the intact engineering view only, a local DEM-clipped, inferred water
connection spans the gap to the supplied shoreline polygon at the unchanged
configured level. The study and water connection do not supply solver geometry,
shoreline data or gate flows. The main saved-run
adapter is not yet connected to this module. Real node animation currently supports
translation only.

## Acceptance

The nine-bay reference is inspired by the user image, not surveyed Machhu-II. It adds
curved chutes, piers, braced gates, bridge, railings, lamps, catwalk, procedural concrete,
shadow lighting and water. Visual material/water refinement, LODs, integrated replay,
authored-GLB visual fixtures and target-GPU performance remain open. No Unity/Unreal
parity, engineering approval or operational certification is claimed.

Run `.\.venv\Scripts\python.exe -m unittest tests.test_dam_scene -v` for package,
API and real MCP stdio transport tests (optional MCP dependency required).

Renderer state test: `node --test tests/dam_scene_plugin.test.mjs`.
With a local server on port 8052, `scripts/check_dam_studio.py` launches an isolated
Chrome test profile, verifies exact desktop/mobile viewports and console errors,
and writes screenshots under `.tmp/visual-check/`. It requires the existing
`websockets` package and Windows Chrome; it never attaches to a user browser.
