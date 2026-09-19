"""Local single-user digital-twin API and static dashboard.

Start with: python -m uvicorn server:app --host 127.0.0.1 --port 8050 --workers 1
The historical dashboard is retained at /index.html for reference only.
"""
import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from src.api import router, manager

ROOT=Path(__file__).resolve().parent
DASHBOARD_DIR=ROOT/"outputs/3d/dashboard"


@asynccontextmanager
async def lifespan(app):
    yield
    if manager.active:
        manager.active.cancel.set()
        for _ in range(100):
            if manager.active.status()["status"] in {"COMPLETE","FAILED","CANCELLED"}:
                break
            await asyncio.sleep(.05)


app=FastAPI(title="InundaX scenario laboratory",version="1.0",lifespan=lifespan)
app.include_router(router)


@app.get("/")
def index():
    return FileResponse(DASHBOARD_DIR/"twin.html")


@app.post("/api/simulate")
@app.get("/api/physics/snapshot")
def retired_physics():
    raise HTTPException(410,"Use /api/simulation/start and /api/simulation/results/{id}; legacy uncoupled runs are disabled")


@app.websocket("/ws/physics")
async def retired_stream(ws:WebSocket):
    await ws.accept()
    await ws.send_json({"type":"simulation_error","error":"Use /ws/simulation/{simulation_id}; legacy mock-grid stream is disabled"})
    await ws.close()


@app.websocket("/ws/dflowfm")
async def dflow_replay(ws:WebSocket):
    """Explicit archived D-Flow result playback, never part of a new run."""
    await ws.accept()
    path=DASHBOARD_DIR/"delft3d_fm_latest.json"
    try:
        if not path.is_file():
            await ws.send_json({"type":"dflow_unavailable"})
            return
        result=await asyncio.to_thread(lambda:json.loads(path.read_text(encoding="utf-8")))
        await ws.send_json({"type":"dflow_start","archived":True,"coordinate_bounds":result.get("coordinate_bounds"),"frame_count":len(result.get("frames",[]))})
        for index,frame in enumerate(result.get("frames",[])):
            await ws.send_json({"type":"dflow_frame","frame_index":index,"frame":frame,"archived":True})
            await asyncio.sleep(.1)
        await ws.send_json({"type":"dflow_complete"})
    except WebSocketDisconnect:
        pass
    finally:
        try:await ws.close()
        except RuntimeError:pass


app.mount("/",StaticFiles(directory=str(DASHBOARD_DIR)),name="dashboard")

if __name__=="__main__":
    import uvicorn
    uvicorn.run("server:app",host="127.0.0.1",port=8050)
