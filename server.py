"""
server.py
---------
FastAPI backend for InundaX.

Endpoints:
    WS  /ws/physics         — streams physics frames as the simulation runs
    GET /api/physics/snapshot — returns a precomputed full simulation run
    POST /api/simulate       — existing pipeline trigger (unchanged)
    GET /api/status           — SSE for pipeline logs (unchanged)
    GET /                    — serves the dashboard
"""

import os
import sys
import json
import subprocess
import asyncio
from pathlib import Path

from pydantic import BaseModel
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from src.physics_service import PhysicsService, SimulationConfig, generate_downstream_hydrograph

app = FastAPI(title="InundaX Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DASHBOARD_DIR = Path("outputs/3d/dashboard").resolve()
D_FLOW_RENDER_PATH = DASHBOARD_DIR / "delft3d_fm_latest.json"
if not DASHBOARD_DIR.exists():
    DASHBOARD_DIR.mkdir(parents=True, exist_ok=True)


# ── Existing pipeline simulation (unchanged) ────────────────────────────

simulation_status = {"running": False, "log": []}

class SimRequest(BaseModel):
    dam_name: str
    lat: float
    lon: float
    height: float
    volume: float

async def run_simulation_task(req: SimRequest):
    simulation_status["running"] = True
    simulation_status["log"] = [f"Starting simulation for {req.dam_name}..."]

    config_path = Path("config.json")
    if config_path.exists():
        with open(config_path, "r") as f:
            config = json.load(f)
    else:
        config = {}

    config["custom_dam"] = {
        "dam_name": req.dam_name,
        "state": "Custom",
        "lat": req.lat,
        "lon": req.lon,
        "dam_height_m": req.height,
        "reservoir_volume_m3": req.volume,
        "downstream_stations": [
            {"name": "Dam Toe", "key": "dam_toe", "lat": req.lat, "lon": req.lon, "dist_km": 0}
        ],
        "bbox": {
            "min_lat": req.lat - 0.2,
            "max_lat": req.lat + 0.2,
            "min_lon": req.lon - 0.2,
            "max_lon": req.lon + 0.2
        }
    }
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)

    # The reservoir/breach/SPH model supplies the release hydrograph; the
    # downstream field is then solved by D-Flow FM, not MockGridAdapter.
    simulation_status["log"].append("Generating reservoir and breach release hydrograph...")
    hydraulic_cfg = SimulationConfig(
        dam_height_m=req.height,
        dam_crest_elevation_m=req.height,
        initial_elevation_m=req.height + 0.01,
    )
    hydrograph = generate_downstream_hydrograph(hydraulic_cfg)
    model_dir = Path("outputs/simulation/delft3d_fm")
    model_dir.mkdir(parents=True, exist_ok=True)
    hydrograph_path = model_dir / "release_hydrograph.csv"
    hydrograph_path.write_text(
        "time_s,discharge_m3s\n" + "\n".join(
            f"{time_s:.3f},{discharge_m3s:.6f}"
            for time_s, discharge_m3s in hydrograph
        ) + "\n",
        encoding="utf-8",
    )
    simulation_status["log"].append("Running D-Flow FM 2D shallow-water model...")
    process = subprocess.Popen(
        [sys.executable, "scripts/10b_delft3d_comparison.py", "--hydrograph", str(hydrograph_path),
         "--lat", str(req.lat), "--lon", str(req.lon)],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    while True:
        line = process.stdout.readline()
        if not line and process.poll() is not None:
            break
        if line:
            simulation_status["log"].append(line.strip())

    simulation_status["running"] = False
    if process.returncode == 0:
        simulation_status["log"].append("D-Flow FM simulation finished; map output is ready.")
    else:
        simulation_status["log"].append(f"D-Flow FM failed (exit code {process.returncode}).")

@app.post("/api/simulate")
async def start_simulation(req: SimRequest):
    if simulation_status["running"]:
        return {"status": "error", "message": "Simulation already running."}
    asyncio.create_task(run_simulation_task(req))
    return {"status": "started"}

@app.get("/api/status")
async def get_status(request: Request):
    async def event_generator():
        last_idx = 0
        while True:
            if await request.is_disconnected():
                break

            if last_idx < len(simulation_status["log"]):
                for i in range(last_idx, len(simulation_status["log"])):
                    yield {"data": simulation_status["log"][i]}
                last_idx = len(simulation_status["log"])

            if not simulation_status["running"] and last_idx >= len(simulation_status["log"]):
                yield {"data": "EOF"}
                break

            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


# ── Physics WebSocket endpoint ──────────────────────────────────────────

@app.websocket("/ws/physics")
async def ws_physics(websocket: WebSocket):
    """Stream physics frames as the simulation runs.

    Accepts an optional JSON config message immediately after connection.
    If none is received within 1 second, uses defaults.
    """
    await websocket.accept()

    # Try to receive optional config.
    cfg = SimulationConfig()
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
        data = json.loads(raw)
        cfg = SimulationConfig(**{k: v for k, v in data.items()
                                   if hasattr(cfg, k)})
    except (asyncio.TimeoutError, Exception):
        pass  # Use defaults.

    service = PhysicsService(cfg)
    service.initialize()

    # Notify client that simulation is starting.
    await websocket.send_json({
        "type": "simulation_start",
        "config": {
            "dt_s": cfg.dt_s,
            "total_steps": cfg.total_steps,
            "dam_height_m": cfg.dam_height_m,
            "dam_length_m": cfg.dam_length_m,
            "sph_slice_width_m": cfg.sph_slice_width_m,
        }
    })

    try:
        while not service.completed:
            frame = service.step()
            await websocket.send_json(frame)
            # Yield control so the event loop stays responsive.
            await asyncio.sleep(0)

        # Send completion.
        await websocket.send_json({
            "type": "simulation_complete",
            "simulation": {
                "time_s": service.sim.reservoir.time_s,
                "time_hours": round(service.sim.reservoir.time_s / 3600, 4),
                "status": "completed",
                "total_steps": service.step_index,
            }
        })
    except WebSocketDisconnect:
        pass  # Client disconnected, nothing to clean up.


@app.websocket("/ws/dflowfm")
async def ws_dflowfm(websocket: WebSocket):
    """Stream actual D-Flow FM map timesteps to the renderer.

    FM is a batch solver in this deployment.  Once its NetCDF map exists,
    send each stored solver timestep in order; the browser must render on
    arrival, rather than inventing a local water replay.
    """
    await websocket.accept()
    try:
        if not D_FLOW_RENDER_PATH.is_file():
            await websocket.send_json({"type": "dflow_unavailable"})
            return
        result = json.loads(D_FLOW_RENDER_PATH.read_text(encoding="utf-8"))
        frames = result.get("frames", [])
        await websocket.send_json({
            "type": "dflow_start",
            "coordinate_bounds": result.get("coordinate_bounds"),
            "frame_count": len(frames),
        })
        for index, frame in enumerate(frames):
            await websocket.send_json({
                "type": "dflow_frame",
                "frame_index": index,
                "frame": frame,
            })
            await asyncio.sleep(0.35)
        await websocket.send_json({"type": "dflow_complete"})
    except WebSocketDisconnect:
        pass


# ── Physics REST snapshot ───────────────────────────────────────────────

@app.get("/api/physics/snapshot")
async def physics_snapshot():
    """Run a full simulation and return the complete result as JSON.

    Useful for:
    - Offline / demo mode pre-computation
    - Programmatic access to simulation results
    """
    service = PhysicsService()
    service.initialize()

    # Run in executor to avoid blocking the event loop for ~2-5 seconds.
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, service.run_full)

    return JSONResponse(content=service.snapshot_summary())


# ── Dashboard static serving ────────────────────────────────────────────

@app.get("/")
async def serve_index():
    return FileResponse(DASHBOARD_DIR / "index.html")

# Mount static files at root
app.mount("/", StaticFiles(directory=str(DASHBOARD_DIR)), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8050, reload=True)
