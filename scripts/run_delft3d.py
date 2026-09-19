"""Run an isolated D-Flow FM comparison forced by a completed scenario hydrograph.

No files in the historical Delft3D output folder are modified. This is an optional
comparison, not an automatic replacement of the conservative screening result.
"""
import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from src.project import ROOT, Project, input_path
from src.run_engine import RUNS


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulation',required=True)
    parser.add_argument('--build-only',action='store_true')
    parser.add_argument('--threads',type=int,default=2)
    args=parser.parse_args()
    import re
    if not re.fullmatch(r'[a-f0-9]{32}',args.simulation):parser.error('Expected simulation ID')
    directory=RUNS/args.simulation
    summary=json.loads((directory/'summary.json').read_text(encoding='utf-8'))
    project=Project.model_validate(summary['project'])
    spec=importlib.util.spec_from_file_location('dflow_adapter',ROOT/'scripts/10b_delft3d_comparison.py')
    adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter)
    model=directory/'delft3d';model.mkdir(exist_ok=True)
    adapter.DASHBOARD_RESULT_PATH=model/'replay.json'
    hydrograph=adapter.read_hydrograph(directory/'hydrograph.csv')
    if hydrograph[0][0]>0:hydrograph.insert(0,(0.,hydrograph[0][1]))
    size=summary['scenario']['grid_size'];half=summary['scenario']['domain_half_width_m'];cell=2*half/size
    _,dam_xy,outlet,bed,bounds=adapter.write_ugrid_mesh(input_path(project.dem_path),project.latitude,project.longitude,cell,half,model)
    a=math.radians(project.downstream_bearing_deg)
    source=(dam_xy[0]+math.sin(a)*cell*1.5,dam_xy[1]+math.cos(a)*cell*1.5)
    adapter.write_forcings(model,source,outlet,hydrograph)
    mdu=adapter.write_mdu(model,hydrograph[-1][0])
    # This is downstream release routing; do not introduce the legacy invented gated dam.
    text=mdu.read_text(encoding='ascii').replace('StructureFile = structures.ini','StructureFile =')
    mdu.write_text(text,encoding='ascii')
    metadata={
        'source_simulation':args.simulation,'source_hydrograph':'../hydrograph.csv',
        'solver':'D-Flow FM','domain_crs':summary['terrain']['crs'],
        'limitations':['Open boundary differs from closed screening model.',
                      'Reservoir not dynamically represented; prescribed released hydrograph only.',
                      'No surveyed dam structures or calibrated friction. Comparison is not validation.']}
    if not args.build_only:
        adapter.run_model(mdu,args.threads)
        stderr=(model/'dflowfm_stderr.log').read_text(encoding='utf-8',errors='replace')
        diagnostic=model/'DFM_OUTPUT_machhu_dambreak'/'machhu_dambreak.dia'
        dia=diagnostic.read_text(encoding='utf-8',errors='replace') if diagnostic.exists() else ''
        warnings=[]
        for line in (stderr+'\n'+dia).splitlines():
            stripped=line.strip()
            if stripped.startswith('** WARNING') or stripped.lower().startswith('proj_create'):
                if stripped not in warnings: warnings.append(stripped)
        metadata['runtime_warnings']=warnings
    (model/'comparison_metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    print(f"D-Flow FM {'inputs prepared' if args.build_only else 'completed'}: {model}")


if __name__=='__main__':main()
