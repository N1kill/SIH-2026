"""Plan, run, and validate reusable public-source research for any dam."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.dam_research import (  # noqa: E402
    DamResearchSeed,
    EvidenceWorkspace,
    compile_findings,
    make_research_plan,
)
from src.dam_research_agent import run_research  # noqa: E402
from src.project import Project, ROOT, projects  # noqa: E402
from src.reconstruction import verify_evidence  # noqa: E402


def load_local_env() -> None:
    """Load simple KEY=VALUE settings without adding another runtime dependency."""
    path = ROOT / ".env"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip('"').strip("'")
        # The repository-local .env is the explicit configuration for this CLI.
        # Override stale inherited credentials so a newly rotated key is actually used.
        if key:
            os.environ[key] = value


def load_project(value: str | None) -> tuple[Project | None, str | None]:
    if not value:
        return None, None
    path = Path(value)
    if path.is_file():
        return Project.model_validate_json(path.read_text(encoding="utf-8")), str(path)
    return projects()[value], f"data/projects/{value}.json"


def seed_from_args(
    args, project: Project | None, project_path: str | None
) -> DamResearchSeed:
    if project:
        base = DamResearchSeed.from_project(project, project_path).model_dump()
        updates = {
            "country": args.country,
            "region": args.region,
            "river": args.river,
            "aliases": args.alias or [],
        }
        return DamResearchSeed.model_validate(
            {**base, **{k: v for k, v in updates.items() if v}}
        )
    if not args.dam_id or not args.name:
        raise ValueError("Supply --project, or both --dam-id and --name")
    return DamResearchSeed(
        dam_id=args.dam_id,
        dam_name=args.name,
        country=args.country,
        region=args.region,
        river=args.river,
        latitude=args.latitude,
        longitude=args.longitude,
        aliases=args.alias or [],
    )


def main():
    load_local_env()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("plan", "run", "validate", "report"))
    parser.add_argument("--project", help="Existing project ID or JSON path")
    parser.add_argument("--dam-id")
    parser.add_argument("--name")
    parser.add_argument("--country")
    parser.add_argument("--region")
    parser.add_argument("--river")
    parser.add_argument("--latitude", type=float)
    parser.add_argument("--longitude", type=float)
    parser.add_argument("--alias", action="append")
    parser.add_argument(
        "--model", help="LangChain provider:model; defaults to DAM_RESEARCH_MODEL"
    )
    parser.add_argument("--thread-id")
    args = parser.parse_args()

    project, project_path = load_project(args.project)
    seed = seed_from_args(args, project, project_path)
    workspace = EvidenceWorkspace(seed)
    if args.action == "plan":
        workspace.write_seed()
        plan = make_research_plan(seed, project)
        path = workspace.directory / "research-plan.json"
        path.write_text(json.dumps(plan, indent=2), encoding="utf-8")
        print(
            json.dumps(
                {"plan": str(path.relative_to(ROOT)), "tracks": len(plan["tracks"])},
                indent=2,
            )
        )
    elif args.action == "run":
        result = run_research(seed, project, args.model, args.thread_id)
        print(json.dumps(result, indent=2, default=str))
        if result["status"] not in {"complete", "partial"}:
            raise SystemExit(2)
    elif args.action == "validate":
        manifest = verify_evidence(workspace.directory / "agent-evidence.json")
        print(
            json.dumps(
                {
                    "valid": True,
                    "project_id": manifest.project_id,
                    "evidence_count": len(manifest.items),
                },
                indent=2,
            )
        )
    else:
        records = workspace.load_records()
        report = compile_findings(seed, records, project)
        path = workspace.directory / "research-findings.json"
        path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
