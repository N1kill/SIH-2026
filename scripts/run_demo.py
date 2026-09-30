"""Prepare cached terrain and serve the local dashboard. Run scenarios in the UI."""

import sys
import re
import shutil
import subprocess
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
    missing = any(not (ROOT / path).is_file() for path in required)
    index = ROOT / "frontend/dist/index.html"
    if index.is_file():
        html = index.read_text(encoding="utf-8")
        assets = re.findall(r'(?:src|href)="/simulation/([^"]+)"', html)
        missing |= any(
            not (ROOT / "frontend/dist" / asset).is_file() for asset in assets
        )
    if missing:
        print("Building missing frontend assets from the npm lockfiles...")
        npm = shutil.which("npm")
        if not npm:
            raise SystemExit(
                "npm is required to build the frontend. Install Node.js, then run npm ci."
            )
        try:
            subprocess.run([npm, "run", "build"], cwd=ROOT, check=True)
        except subprocess.CalledProcessError as exc:
            raise SystemExit(
                "Frontend build failed. Run npm ci, then npm run build."
            ) from exc
    build_twin(projects()["machhu-ii"])
    import uvicorn

    print("Open http://127.0.0.1:8050 and select Run scenario.")
    uvicorn.run("server:app", host="127.0.0.1", port=8050)
