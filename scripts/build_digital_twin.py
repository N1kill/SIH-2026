"""Build/cache local metric terrain from a project ID or a supplied project JSON."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from src.project import Project, projects
from src.terrain import build_twin


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project",default="machhu-ii")
    parser.add_argument("--grid-size",type=int,default=100)
    parser.add_argument("--half-width",type=float,default=6000)
    args=parser.parse_args()
    if not 20<=args.grid_size<=200 or not 500<=args.half_width<=30000:
        parser.error("grid-size must be 20..200; half-width 500..30000 m")
    p=Path(args.project)
    project=Project.model_validate_json(p.read_text(encoding="utf-8")) if p.is_file() else projects()[args.project]
    data=build_twin(project,args.half_width,args.grid_size)
    print(json.dumps({k:v for k,v in data.items() if k not in {"elevation","valid","reservoir_mask","river_lines","detail","crest_local"}},indent=2))


if __name__=="__main__":
    main()
