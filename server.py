"""Local single-user digital-twin API and static dashboard.

Start with: python -m uvicorn server:app --host 127.0.0.1 --port 8050 --workers 1
The historical dashboard is retained at /index.html for reference only.
"""
import asyncio
import json
import os
import threading
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from src.api import router, manager
from src.dam_research import DamResearchSeed, EvidenceWorkspace
from src.dam_research_agent import run_research
from src.project import projects

ROOT=Path(__file__).resolve().parent
DASHBOARD_DIR=ROOT/"outputs/3d/dashboard"


def load_local_env():
    """Use repository-local runtime settings without returning secret values."""
    path=ROOT/".env"
    if not path.is_file():return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line=raw.strip()
        if not line or line.startswith("#") or "=" not in line:continue
        key,value=line.split("=",1)
        if key.strip():os.environ[key.strip()]=value.strip().strip('"').strip("'")


class ResearchRequest(BaseModel):
    project_id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    country: str | None = Field(default=None,max_length=100)
    region: str | None = Field(default=None,max_length=200)
    model: str | None = Field(default=None,max_length=200)


class ResearchTracker:
    """Single-process status store for the one local research worker."""
    def __init__(self):
        self.lock=threading.Lock();self.task=None
        self.state={"status":"idle","events":[],"evidence_count":0}

    def snapshot(self):
        with self.lock:
            state={**self.state,"events":[*self.state.get("events",[])]}
        if state.get("started_monotonic") is not None:
            state["elapsed_s"]=round(time.monotonic()-state["started_monotonic"],1)
        state.pop("started_monotonic",None)
        return state

    def begin(self,request:ResearchRequest):
        with self.lock:
            if self.state.get("status") in {"planning","running","compiling"}:
                raise RuntimeError("A dam research run is already active")
            now=datetime.now(timezone.utc).isoformat()
            self.state={"run_id":uuid.uuid4().hex,"project_id":request.project_id,
                        "status":"planning","stage":"Planning research tracks",
                        "started_at":now,"updated_at":now,"started_monotonic":time.monotonic(),
                        "evidence_count":0,"query":None,"error":None,"result":None,"events":[]}
        self.update({"event":"queued","message":"Research run queued"})

    def update(self,event):
        now=datetime.now(timezone.utc).isoformat();kind=event.get("event","update")
        stage={"queued":"Queued","planning":"Planning research tracks",
               "agent_started":"Coordinator and specialists running",
               "search_started":"Searching authoritative sources",
               "search_completed":"Reviewing search results",
               "source_read_started":"Opening candidate source",
               "source_read_completed":"Source text inspected",
               "source_read_failed":"Candidate source inaccessible",
               "source_skipped":"Skipping restricted source",
               "source_restricted":"Publisher access restricted",
               "source_archived":"Archiving quote-supported evidence",
               "archive_rejected":"Rejecting unsupported evidence",
               "search_failed":"Search provider error","agent_failed":"Agent failed",
               "compiling":"Compiling evidence and conflicts","complete":"Complete",
               "failed":"Failed"}.get(kind,kind.replace("_"," ").title())
        if kind=="partial":stage="Finished with evidence gaps"
        item={**event,"timestamp":now,"stage":stage}
        with self.lock:
            self.state["updated_at"]=now;self.state["stage"]=stage
            if "query" in event:self.state["query"]=event["query"]
            if "evidence_count" in event:self.state["evidence_count"]=event["evidence_count"]
            for key in ("completed_tracks","total_tracks"):
                if key in event:self.state[key]=event[key]
            if kind in {"complete","partial"}:self.state["error"]=None
            elif event.get("error"):self.state["error"]=event["error"]
            if kind in {"planning","queued"}:self.state["status"]="planning"
            elif kind in {"compiling"}:self.state["status"]="compiling"
            elif kind in {"complete","partial","failed"}:self.state["status"]=kind
            elif kind in {"agent_failed","search_failed"}:
                self.state["status"]="running" if kind=="search_failed" else "failed"
            else:self.state["status"]="running"
            if kind in {"complete","partial","failed"} and self.state.get("started_monotonic") is not None:
                self.state["elapsed_s"]=round(
                    time.monotonic()-self.state["started_monotonic"],1
                )
                self.state["started_monotonic"]=None
            self.state["events"]=(self.state.get("events",[])+[item])[-80:]

    def finish(self,result):
        with self.lock:self.state["result"]=result
        self.update({"event":result["status"],"evidence_count":result["evidence_count"],
                     "error":result.get("error")})


research_tracker=ResearchTracker()
research_tasks:set[asyncio.Task]=set()


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


@app.post("/api/research/start",status_code=202)
async def start_research(request:ResearchRequest):
    available=projects()
    if request.project_id not in available:raise HTTPException(404,"Unknown project")
    try:research_tracker.begin(request)
    except RuntimeError as exc:raise HTTPException(409,str(exc))
    project=available[request.project_id]
    seed_data=DamResearchSeed.from_project(project,f"data/projects/{project.dam_id}.json").model_dump()
    if request.country:seed_data["country"]=request.country
    if request.region:seed_data["region"]=request.region
    seed=DamResearchSeed.model_validate(seed_data)

    def worker():
        load_local_env()
        try:
            result=run_research(seed,project,request.model,
                                thread_id=f"web-{research_tracker.snapshot().get('run_id')}",
                                progress_callback=research_tracker.update)
        except Exception as exc:
            result={"status":"failed","evidence_count":0,"error":f"{type(exc).__name__}: {exc}",
                    "manifest":None,"findings":None,"summary":None}
        research_tracker.finish(result)

    task=asyncio.create_task(asyncio.to_thread(worker));research_tasks.add(task)
    task.add_done_callback(research_tasks.discard)
    return research_tracker.snapshot()


@app.get("/api/research/status")
def research_status():
    return research_tracker.snapshot()


@app.get("/api/research/report/{project_id}")
def research_report(project_id: str):
    available=projects()
    if project_id not in available:raise HTTPException(404,"Unknown project")
    workspace=EvidenceWorkspace(DamResearchSeed.from_project(available[project_id]))
    path=workspace.directory/"research-findings.json"
    if not path.is_file():raise HTTPException(404,"No research report exists for this project yet")
    return {"findings":json.loads(path.read_text(encoding="utf-8")),
            "evidence":[item.model_dump() for item in workspace.load_records()]}


@app.websocket("/ws/research")
async def research_stream(ws:WebSocket):
    await ws.accept()
    try:
        while True:
            await ws.send_json(research_tracker.snapshot())
            await asyncio.sleep(.5)
    except WebSocketDisconnect:
        pass


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


from src.dam_scene_api import router as dam_scene_router
app.include_router(dam_scene_router)
app.mount("/",StaticFiles(directory=str(DASHBOARD_DIR)),name="dashboard")

if __name__=="__main__":
    import uvicorn
    uvicorn.run("server:app",host="127.0.0.1",port=8050)
