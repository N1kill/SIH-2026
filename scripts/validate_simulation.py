"""Check the mass ledger and optionally compare a supplied observed flood raster."""
import argparse
import json
import re
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from src.run_engine import RUNS, write_json
from src.results import validate_result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--simulation",required=True)
    parser.add_argument("--observed",type=Path)
    args=parser.parse_args()
    if not re.fullmatch(r"[a-f0-9]{32}",args.simulation):parser.error("Expected simulation ID")
    result=validate_result(RUNS/args.simulation,args.observed)
    write_json(RUNS/args.simulation/"validation.json",result)
    print(json.dumps(result,indent=2))
    return 0 if result["mass_balance_pass"] else 1


if __name__=="__main__":
    raise SystemExit(main())
