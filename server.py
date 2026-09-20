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

app = FastAPI(title="PRALAYA Backend")
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

SCRAPER_OUTPUT_DIR = Path("scraper/output").resolve()
if not SCRAPER_OUTPUT_DIR.exists():
    SCRAPER_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

from scraper.pipeline import DamDataScraper

class ScrapeRequest(BaseModel):
    dam_name: str
    country_code: str = "in"
    update_config: bool = False

@app.post("/api/scrape-dam")
async def scrape_dam_endpoint(req: ScrapeRequest):
    dam_name = req.dam_name.strip()
    if not dam_name:
        return {"status": "error", "message": "Dam name cannot be empty"}
    try:
        scraper = DamDataScraper()
        dossier = await asyncio.to_thread(scraper.scrape, dam_name, country_code=req.country_code)
        saved_path = scraper.save_dossier(dossier)
        if req.update_config:
            scraper.update_config_json(dossier)
        rel_path = os.path.relpath(saved_path, Path.cwd()) if str(saved_path).startswith(str(Path.cwd())) else str(saved_path)
        return {
            "status": "success",
            "dam_name": dam_name,
            "dam_id": dossier.get("dam_id"),
            "saved_file": saved_path.name,
            "saved_path": rel_path.replace("\\", "/"),
            "output_folder": "/scraper/output",
            "dossier": dossier
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/scrape-dam")
async def scrape_dam_get(dam_name: str, country_code: str = "in", update_config: bool = False):
    return await scrape_dam_endpoint(ScrapeRequest(dam_name=dam_name, country_code=country_code, update_config=update_config))

@app.get("/api/scraped-files")
async def list_scraped_files():
    """List all saved dam dossiers in /scraper/output."""
    if not SCRAPER_OUTPUT_DIR.exists():
        SCRAPER_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    import json
    files = []
    for f in sorted(SCRAPER_OUTPUT_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            with open(f, "r", encoding="utf-8") as jf:
                data = json.load(jf)
                d_name = data.get("dam_name", f.stem)
                ts = data.get("scrape_timestamp_utc", "")
                st_count = len(data.get("downstream_monitoring_stations", []))
        except Exception:
            d_name = f.stem
            ts = ""
            st_count = 0
        files.append({
            "filename": f.name,
            "path": f"/scraper/output/{f.name}",
            "dam_name": d_name,
            "stations_count": st_count,
            "size_bytes": f.stat().st_size,
            "modified_time": f.stat().st_mtime,
            "timestamp": ts,
        })
    return {"status": "success", "folder": "/scraper/output", "files": files}

@app.get("/api/scraped-files/{filename}")
async def get_scraped_file(filename: str):
    """Serve a specific scraped dossier from /scraper/output."""
    target_file = (SCRAPER_OUTPUT_DIR / filename).resolve()
    if not target_file.is_file() or not str(target_file).startswith(str(SCRAPER_OUTPUT_DIR)):
        return {"status": "error", "message": "File not found"}
    return FileResponse(target_file, media_type="application/json")

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
