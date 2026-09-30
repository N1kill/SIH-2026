"""Prepare cached terrain and serve the local dashboard. Run scenarios in the UI."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.project import ROOT, projects
from src.terrain import build_twin


if __name__ == "__main__":
    required = (
        "outputs/3d/dashboard/vendor/three.module.js",
        "frontend/dist/index.html",
        "frontend-dam/dist/index.html",
    )
    if any(not (ROOT / path).is_file() for path in required):
        raise SystemExit("Run npm ci and npm run build before the first demo")
    build_twin(projects()["machhu-ii"])
    import uvicorn

    print("Open http://127.0.0.1:8050 and select Run scenario.")
    uvicorn.run("server:app", host="127.0.0.1", port=8050)
