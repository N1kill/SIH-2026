"""Run the same scenario engine used by the API, without a browser."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from src.project import Project, Scenario, projects
from src.run_engine import Run


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project",default="machhu-ii")
    parser.add_argument("--scenario",type=Path)
    parser.add_argument("--duration",type=float)
    args=parser.parse_args()
    p=Path(args.project)
    project=Project.model_validate_json(p.read_text(encoding="utf-8")) if p.is_file() else projects()[args.project]
    values=json.loads(args.scenario.read_text(encoding="utf-8")) if args.scenario else {}
    values["project_id"]=project.dam_id
    if args.duration is not None:values["duration_s"]=args.duration
    run=Run(project,Scenario(**values))
    run.execute()
    print(json.dumps(run.status(),indent=2))
    print(f"Results: {run.directory}")
    return 0 if run.status()["status"]=="COMPLETE" else 1


if __name__=="__main__":
    raise SystemExit(main())
