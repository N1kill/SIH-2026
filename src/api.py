"""Versioned simulation lifecycle API. Only one active simulation per process."""
import asyncio
import json
import os
import re
import shutil
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from .project import ROOT, Project, Scenario, projects
from .terrain import build_twin
from .run_engine import RunManager, RUNS, write_json
from .results import make_archive
from .observations import satellite_context
from .forecast import ForecastRequest, generate_forecast, list_forecasts
from .replay import REPLAY_SCHEMA_VERSION, RENDERER_VERSION, asset_manifest, frame_index

router = APIRouter()
manager = RunManager()


def project_for(key):
    try:
        return projects()[key]
    except KeyError:
        raise HTTPException(404,"Unknown project")


def run_dir(run_id):
    if not re.fullmatch(r"[a-f0-9]{32}",run_id):
        raise HTTPException(404,"Invalid simulation ID")
    path = manager.output_root/run_id
    if not path.is_dir():
        raise HTTPException(404,"Simulation not found")
    return path


def run_status(run_id):
    if manager.active and manager.active.id==run_id:
        return manager.active.status()
    path = run_dir(run_id)/"status.json"
    if not path.exists():
        return {"simulation_id":run_id,"status":"FAILED","error":"Run interrupted by server restart","frame_count":0}
    return json.loads(path.read_text(encoding="utf-8"))


@router.get("/api/health")
def health():
    checks = {
        "dashboard_available": (ROOT/"outputs/3d/dashboard/twin.html").is_file(),
        "demo_dem_available": (ROOT/"data/processed/dem_conditioned.tif").is_file(),
        "threejs_available": (ROOT/"outputs/3d/dashboard/vendor/three.module.js").is_file(),
    }
    project_error = None
    try:
        checks["project_configs_valid"] = bool(projects())
    except (OSError, ValueError) as exc:
        checks["project_configs_valid"] = False
        project_error = str(exc)
    core_ready = all(checks.values())
    return {"status":"ok" if core_ready else "degraded","protocol_version":1,
            "core_simulator":"available" if core_ready else "configuration incomplete",
            "single_worker_required":True, **checks, "project_error":project_error,
            "optional":{"openfoam":"installed" if shutil.which("foamRun") else "not installed",
                        "delft3d":"installed" if shutil.which("dflowfm-cli") else "not installed",
                        "gee":"configured, not authenticated" if os.getenv("EE_PROJECT") else "disabled: EE_PROJECT not set"}}


@router.get("/api/project")
def list_projects():
    return [p.model_dump() for p in projects().values()]


@router.get("/api/project/{project_id}/assets")
def project_assets(project_id:str):
    return asset_manifest(project_for(project_id))


@router.get("/api/observations")
def observations(project_id:str="machhu-ii"):
    return satellite_context(project_for(project_id))


@router.get("/api/reconstruction/{project_id}")
def reconstruction_draft(project_id:str):
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}",project_id):
        raise HTTPException(404,"Invalid project ID")
    path=ROOT/"data/candidates"/project_id/"reconstruction-draft.json"
    if not path.is_file():
        raise HTTPException(404,"No reconstruction draft")
    return json.loads(path.read_text(encoding="utf-8"))


@router.get("/api/reconstruction/{project_id}/preview")
def reconstruction_preview(project_id:str):
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}",project_id):
        raise HTTPException(404,"Invalid project ID")
    path=ROOT/"data/candidates"/project_id/"reconstruction-preview.png"
    if not path.is_file():
        raise HTTPException(404,"No reconstruction preview")
    return FileResponse(path,media_type="image/png")


@router.post("/api/observations/refresh")
def refresh_observations(project_id:str="machhu-ii"):
    return satellite_context(project_for(project_id),refresh=True)


@router.post("/api/project")
def save_project(project: Project):
    directory = ROOT/"data/projects"; directory.mkdir(parents=True,exist_ok=True)
    write_json(directory/f"{project.dam_id}.json",project.model_dump())
    return project


@router.get("/api/terrain/metadata")
def terrain_metadata(project_id:str="machhu-ii",grid_size:int=100,half_width_m:float=6000):
    if not 20<=grid_size<=200 or not 500<=half_width_m<=30000:
        raise HTTPException(422,"Terrain grid must be 20..200 and half-width 500..30000 m")
    try:
        return build_twin(project_for(project_id),half_width_m,grid_size)
    except (ValueError,OSError) as exc:
        raise HTTPException(422,str(exc))


@router.post("/api/data/prepare")
def prepare_data(scenario: Scenario):
    return terrain_metadata(scenario.project_id,scenario.grid_size,scenario.domain_half_width_m)


@router.get("/api/terrain/texture/{key}")
def texture(key:str):
    if not re.fullmatch(r"[a-f0-9]{20}",key):
        raise HTTPException(404)
    path=ROOT/"data/cache/twins"/key/"texture.png"
    if not path.exists():
        raise HTTPException(404,"Texture unavailable")
    return FileResponse(path)


@router.post("/api/simulation/start",status_code=202)
def start(scenario: Scenario):
    project=project_for(scenario.project_id)
    if not project.dem_path:
        raise HTTPException(422,"Supply a DEM for this project before running")
    try:
        return manager.start(project,scenario).status()
    except RuntimeError as exc:
        raise HTTPException(409,str(exc))


@router.post("/api/simulation/stop")
def stop():
    if manager.active:
        manager.active.cancel.set()
        return manager.active.status()
    raise HTTPException(409,"No simulation is active")


@router.get("/api/simulation/status")
def status():
    return manager.active.status() if manager.active else {"status":"IDLE"}


@router.get("/api/simulation/results")
def list_results():
    values = [json.loads(p.read_text(encoding="utf-8"))
              for p in manager.output_root.glob("*/summary.json")]
    return sorted(values,key=lambda value:value.get("started_at", ""),reverse=True)[:50]


@router.get("/api/simulation/results/{run_id}")
def result(run_id:str):
    path=run_dir(run_id)/"summary.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else run_status(run_id)


@router.get("/api/simulation/results/{run_id}/metadata")
def replay_metadata(run_id:str):
    directory=run_dir(run_id)
    manifest=directory/"run-manifest.json"
    if manifest.exists():
        return json.loads(manifest.read_text(encoding="utf-8"))
    frames=frame_index(directory)
    return {"schema_version":"1.0","renderer_version":"legacy","simulation_id":run_id,
            "legacy":True,"compatibility":"read-only adapter","frames":frames}


@router.get("/api/simulation/results/{run_id}/assets")
def replay_assets(run_id:str):
    directory=run_dir(run_id);path=directory/"assets.json"
    if path.exists():return json.loads(path.read_text(encoding="utf-8"))
    inputs=directory/"inputs.json"
    if not inputs.exists():raise HTTPException(404,"Replay asset manifest unavailable")
    project=Project.model_validate(json.loads(inputs.read_text(encoding="utf-8"))["project"])
    result=asset_manifest(project)
    result["legacy_adapter"]=True
    return result


@router.post("/api/simulation/results/{run_id}/forecasts")
def create_forecast(run_id:str,request:ForecastRequest):
    directory=run_dir(run_id)
    if not (directory/"summary.json").exists():
        raise HTTPException(409,"Forecasting requires a completed run")
    try:return generate_forecast(directory,request)
    except ValueError as exc:raise HTTPException(422,str(exc))


@router.get("/api/simulation/results/{run_id}/forecasts")
def forecasts(run_id:str):
    return list_forecasts(run_dir(run_id))


@router.get("/api/simulation/results/{run_id}/forecasts/{vintage_id}")
def forecast_vintage(run_id:str,vintage_id:str,trajectory:str="p50"):
    if not re.fullmatch(r"[0-9T._+-]{10,80}-[a-f0-9]{8}",vintage_id):
        raise HTTPException(404,"Invalid forecast vintage")
    if not re.fullmatch(r"p10|p50|p90|member:[0-9]+",trajectory):
        raise HTTPException(422,"Trajectory must be p10, p50, p90, or member:N")
    path=run_dir(run_id)/"forecasts"/f"{vintage_id}.json"
    if not path.exists():raise HTTPException(404,"Forecast vintage not found")
    value=json.loads(path.read_text(encoding="utf-8"))
    if trajectory.startswith("member:"):
        index=int(trajectory.split(":",1)[1])
        if index>=len(value["members"]):raise HTTPException(404,"Ensemble member not found")
        selected=value["members"][index]["records"]
    else:
        percentile=trajectory
        selected=[{"time_s":row["time_s"],**{key:band[percentile]
                  for key,band in row.items() if key!="time_s"}} for row in value["bands"]]
    return {**value,"members":None,"selected_trajectory":trajectory,"selected_records":selected}


@router.get("/api/simulation/results/{run_id}/frames/{index}")
def frame(run_id:str,index:int):
    path=run_dir(run_id)/f"frame-{index:04d}.json"
    if index<0 or not path.exists():
        raise HTTPException(404,"Frame unavailable")
    return FileResponse(path,media_type="application/json")


@router.get("/api/simulation/results/{run_id}/fields")
def final_fields(run_id:str):
    import rasterio
    directory=run_dir(run_id)
    if not (directory/"summary.json").exists():raise HTTPException(409,"Results are not ready")
    fields={}
    for name in ["depth_max","velocity_max","arrival_time","risk"]:
        with rasterio.open(directory/f"{name}.tif") as raster:
            data=raster.read(1);fields[name]=data.ravel().round(4).tolist()
    return fields


@router.get("/api/risk/zones")
def risk(simulation_id:str):
    path=run_dir(simulation_id)/"risk_zones.geojson"
    if not path.exists():
        raise HTTPException(409,"Results are not ready")
    return FileResponse(path,media_type="application/geo+json")


@router.get("/api/simulation/results/{run_id}/flood-progression")
def flood_progression(run_id:str):
    path=run_dir(run_id)/"flood_progression.json"
    if not path.exists():
        raise HTTPException(409,"Flood progression is not available for this run")
    return FileResponse(path,media_type="application/json")


@router.get("/api/safe-zones")
def safe_zones(simulation_id:str):
    path=run_dir(simulation_id)/"safe_zones.geojson"
    if not path.exists():
        raise HTTPException(409,"Screened dry zones are not available for this run")
    return FileResponse(path,media_type="application/geo+json")


@router.get("/api/shelters")
def shelters(simulation_id:str):
    path=run_dir(simulation_id)/"shelters.geojson"
    if not path.exists():
        raise HTTPException(409,"Results are not ready")
    return FileResponse(path,media_type="application/geo+json")


@router.get("/api/evacuation-routes")
def evacuation_routes(simulation_id:str):
    path=run_dir(simulation_id)/"evacuation_routes.geojson"
    if not path.exists():
        raise HTTPException(409,"Evacuation-route status is not available for this run")
    return FileResponse(path,media_type="application/geo+json")


@router.get("/api/export/{run_id}")
def export(run_id:str):
    directory=run_dir(run_id)
    if not (directory/"summary.json").exists():
        raise HTTPException(409,"Only completed results can be exported")
    return FileResponse(make_archive(directory),filename=f"flood-{run_id}.zip")


@router.websocket("/ws/simulation/{run_id}")
async def stream(ws:WebSocket,run_id:str):
    await ws.accept()
    try:
        directory=run_dir(run_id)
        await ws.send_json({"protocol_version":1,"type":"simulation_started","simulation_id":run_id})
        index=0
        while True:
            state=run_status(run_id)
            while index<state.get("frame_count",0):
                value=await asyncio.to_thread((directory/f"frame-{index:04d}.json").read_text,encoding="utf-8")
                await ws.send_text(value)
                index+=1
                await asyncio.sleep(.03)
            if state["status"] in {"COMPLETE","FAILED","CANCELLED"}:
                await ws.send_json({"protocol_version":1,"type":"simulation_complete" if state["status"]=="COMPLETE" else "simulation_error",**state})
                break
            await ws.send_json({"protocol_version":1,"type":"simulation_progress",**state})
            await asyncio.sleep(.2)
    except WebSocketDisconnect:
        return
    except HTTPException as exc:
        await ws.send_json({"protocol_version":1,"type":"simulation_error","error":str(exc.detail)})
    finally:
        try:
            await ws.close()
        except RuntimeError:
            pass
