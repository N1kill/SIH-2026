import os
import sys
import subprocess
import asyncio
from pathlib import Path
from pydantic import BaseModel
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

app = FastAPI(title="InundaX Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DASHBOARD_DIR = Path("outputs/3d/dashboard").resolve()
if not DASHBOARD_DIR.exists():
    DASHBOARD_DIR.mkdir(parents=True, exist_ok=True)


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
    
    # Save config
    import json
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
        
    process = subprocess.Popen(
        [sys.executable, "scripts/10_hydrodynamic_simulation.py", "--dam_config", "custom_dam"],
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
    simulation_status["log"].append("Simulation finished.")

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
                # One last flush
                yield {"data": "EOF"}
                break
                
            await asyncio.sleep(0.5)
            
    return EventSourceResponse(event_generator())

@app.get("/")
async def serve_index():
    return FileResponse(DASHBOARD_DIR / "index.html")

# Mount static files at root
app.mount("/", StaticFiles(directory=str(DASHBOARD_DIR)), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8050, reload=True)
