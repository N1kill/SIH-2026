"""Deep Agents runtime for generic, evidence-backed dam research."""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import threading
import time
from typing import Any, Callable

from pydantic import ValidationError
import requests

from .dam_research import (
    ArchivedEvidence,
    DamResearchSeed,
    EvidenceWorkspace,
    RESEARCH_TRACKS,
    compile_findings,
    extract_text,
    fetch_public_source,
    make_research_plan,
)
from .project import Project, ROOT


SYSTEM_PROMPT = """You are the InundaX dam evidence coordinator.

Your job is to research one dam from a sparse seed and create auditable evidence,
not to produce a plausible narrative from memory. Begin by planning all four research
tracks and delegate each track to its named specialist. Search globally and adapt
government/regulator terminology to the dam's country. Prefer dam owner/operator,
regulator and official water-resource records, then primary engineering/environmental
reports, then peer-reviewed work. Secondary sources are discovery leads.

For each promising search result call read_public_source before using it, then call
archive_dam_evidence with a short verbatim quote from that returned text. A measurement
is accepted only when the archived page contains the supplied exact quote. Never treat
a search-result snippet as archived evidence. Convert numeric project
measurements to the canonical SI keys described by the tool, but preserve the original
unit and datum in uncertainty/notes. Do not infer an unstated vertical datum, CRS,
geometry, shelter capacity or route safety. Preserve conflicts; never average them.
Do not modify data/projects. Finish by summarizing coverage, conflicts, inaccessible
sources, and the evidence still needed from humans.
"""

SPECIALISTS = {
    "identity-geometry": "Research identity_geometry only. Resolve aliases and location first; distinguish inventory attributes from survey geometry.",
    "reservoir-hydrology": "Research reservoir_hydrology only. Require the vertical datum for elevations and distinguish gross, live and dead storage.",
    "spillway-history": "Research spillway_breach_history only. Separate design discharge, event inflow and breach outflow; prioritize observed records.",
    "safety-context": "Research safety_context only. Never label a candidate building an official shelter or a road safe without an official source.",
}


class AgentUnavailable(RuntimeError):
    pass


ProgressCallback = Callable[[dict[str, Any]], None]


def _emit(callback: ProgressCallback | None, event: str, **details: Any) -> None:
    """Report best-effort progress without letting UI telemetry break research."""
    if callback is not None:
        try:
            callback({"event": event, **details})
        except Exception:
            pass


def _load_runtime():
    try:
        from deepagents import create_deep_agent
        from deepagents.backends import FilesystemBackend
        from langchain.agents.middleware import TodoListMiddleware
        from langchain.chat_models import init_chat_model
        from langchain_core.rate_limiters import InMemoryRateLimiter
        from langchain.tools import tool
        from langgraph.checkpoint.memory import MemorySaver
    except ImportError as exc:
        raise AgentUnavailable(
            "Dam research agent dependencies are missing. Install requirements.txt "
            "(deepagents and langchain-openai)."
        ) from exc
    return (
        create_deep_agent,
        FilesystemBackend,
        TodoListMiddleware,
        init_chat_model,
        InMemoryRateLimiter,
        tool,
        MemorySaver,
    )


def _collect_urls(value: Any, output: dict[str, str]) -> None:
    if isinstance(value, dict):
        url = value.get("url") or value.get("uri")
        if isinstance(url, str) and url.startswith(("http://", "https://")):
            output[url] = str(value.get("title") or value.get("name") or url)
        for child in value.values():
            _collect_urls(child, output)
    elif isinstance(value, list):
        for child in value:
            _collect_urls(child, output)


def _focused_excerpt(
    text: str, terms: list[str], limit: int = 8000
) -> tuple[str, list[str]]:
    """Return bounded source text centered on dam-name matches when possible."""
    matches: list[tuple[int, str]] = []
    folded = text.casefold()
    for term in terms:
        clean = term.strip()
        if len(clean) < 3:
            continue
        start = 0
        while len(matches) < 8:
            index = folded.find(clean.casefold(), start)
            if index < 0:
                break
            matches.append((index, clean))
            start = index + len(clean)
    if not matches:
        return text[:limit], []
    parts: list[str] = []
    used: list[str] = []
    budget = limit
    for index, term in sorted(matches):
        start = max(0, index - 900)
        end = min(len(text), index + 1900, start + budget)
        excerpt = text[start:end].strip()
        if excerpt and excerpt not in parts:
            parts.append(excerpt)
            budget -= len(excerpt)
            if term not in used:
                used.append(term)
        if budget <= 0:
            break
    return "\n\n[...]\n\n".join(parts)[:limit], used


def provider_web_search(query: str, provider: str | None = None) -> dict:
    """Run grounded search separately from the coordinator model.

    This keeps the agent portable: the coordinating model and search provider can be
    selected independently. Both implementations use provider-native search tools.
    """
    selected = (provider or os.getenv("DAM_SEARCH_PROVIDER") or "auto").lower()
    if selected == "auto":
        available = []
        if os.getenv("OPENAI_API_KEY"):
            available.append("openai")
        if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
            available.append("google")
        available.append("searxng")
        errors = []
        for candidate in available:
            try:
                return provider_web_search(query, candidate)
            except Exception as exc:
                errors.append(f"{candidate}: {type(exc).__name__}: {exc}")
        raise RuntimeError(
            "All configured search providers failed: " + " | ".join(errors)
        )
    if selected == "openai":
        from openai import OpenAI

        client = OpenAI()
        response = client.responses.create(
            model=os.getenv("DAM_SEARCH_MODEL", "gpt-5-mini"),
            tools=[{"type": "web_search"}],
            input=(
                "Search the public web for authoritative evidence relevant to this "
                "dam research query. Return factual findings with source links.\n"
                + query
            ),
        )
        payload = response.model_dump()
        urls: dict[str, str] = {}
        _collect_urls(payload, urls)
        return {
            "provider": "openai",
            "summary": response.output_text,
            "sources": [{"title": title, "url": url} for url, title in urls.items()],
        }
    if selected == "google":
        from google import genai
        from google.genai import types

        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        client = genai.Client(api_key=api_key) if api_key else genai.Client()
        response = client.models.generate_content(
            model=os.getenv("DAM_SEARCH_MODEL", "gemini-3.6-flash"),
            contents=(
                "Search the public web for authoritative evidence relevant to this "
                "dam research query. Return factual findings with citations.\n" + query
            ),
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())]
            ),
        )
        sources: dict[str, str] = {}
        metadata = getattr(response.candidates[0], "grounding_metadata", None)
        for chunk in getattr(metadata, "grounding_chunks", None) or []:
            web = getattr(chunk, "web", None)
            if web and web.uri:
                sources[web.uri] = web.title or web.uri
        return {
            "provider": "google",
            "summary": response.text,
            "sources": [{"title": title, "url": url} for url, title in sources.items()],
        }
    if selected == "ollama":
        if not os.getenv("OLLAMA_API_KEY"):
            return provider_web_search(query, "searxng")
        from ollama import web_search

        response = web_search(query=query, max_results=5)
        items = getattr(
            response,
            "results",
            response.get("results", []) if isinstance(response, dict) else [],
        )
        sources = []
        for item in items:
            if isinstance(item, dict):
                title, url, content = (
                    item.get("title", ""),
                    item.get("url", ""),
                    item.get("content", ""),
                )
            else:
                title = getattr(item, "title", "")
                url = getattr(item, "url", "")
                content = getattr(item, "content", "")
            if url:
                sources.append({"title": title or url, "url": url, "content": content})
        return {
            "provider": "ollama",
            "summary": json.dumps(sources, ensure_ascii=False),
            "sources": [
                {"title": item["title"], "url": item["url"]} for item in sources
            ],
        }
    if selected == "searxng":
        base_url = os.getenv("SEARXNG_URL", "http://localhost:8888").rstrip("/")
        normalized = " ".join(query.replace("_", " ").split())
        search_queries = [normalized]
        dam_match = re.search(
            r"[A-Za-z0-9][A-Za-z0-9-]*(?:\s+[IVX0-9-]+)?\s+Dam", normalized, re.I
        )
        if dam_match and dam_match.group(0).casefold() != normalized.casefold():
            search_queries.append(f'"{dam_match.group(0)}"')
        sources = []
        for search_query in search_queries:
            response = requests.get(
                f"{base_url}/search",
                params={"q": search_query, "format": "json", "categories": "general"},
                timeout=30,
                headers={"User-Agent": "InundaX evidence research/1.0"},
            )
            response.raise_for_status()
            payload = response.json()
            for item in payload.get("results", [])[:5]:
                url = item.get("url", "")
                if url.startswith(("http://", "https://")):
                    sources.append(
                        {
                            "title": item.get("title") or url,
                            "url": url,
                            "content": item.get("content", ""),
                        }
                    )
            if sources:
                break
        if not sources:
            raise RuntimeError("SearXNG returned no usable results")
        return {
            "provider": "searxng",
            "summary": json.dumps(sources, ensure_ascii=False),
            "sources": [
                {"title": item["title"], "url": item["url"]} for item in sources
            ],
        }
    raise ValueError(
        "DAM_SEARCH_PROVIDER must be auto, openai, google, ollama, or searxng"
    )


def build_agent(
    seed: DamResearchSeed,
    project: Project | None = None,
    model_name: str | None = None,
    progress_callback: ProgressCallback | None = None,
):
    """Build a CLI-only Deep Agent; no filesystem backend is exposed by the web API."""
    (
        create_deep_agent,
        FilesystemBackend,
        TodoListMiddleware,
        init_chat_model,
        InMemoryRateLimiter,
        tool,
        MemorySaver,
    ) = _load_runtime()
    workspace = EvidenceWorkspace(seed)
    staged = workspace.load_records()
    runtime_stats = {
        "searches": 0,
        "search_failures": 0,
        "source_reads": 0,
        "archive_rejections": 0,
        "last_error": None,
    }
    delay_s = float(os.getenv("DAM_RESEARCH_RATE_LIMIT_DELAY_S", "12.5"))
    search_lock = threading.Lock()
    last_search = [0.0]

    @tool
    def search_web(query: str) -> str:
        """Search the live public web and return grounded findings plus source URLs."""
        _emit(progress_callback, "search_started", query=query)
        runtime_stats["searches"] += 1
        try:
            with search_lock:
                wait = delay_s - (time.monotonic() - last_search[0])
                if wait > 0:
                    time.sleep(wait)
                result = provider_web_search(query)
                last_search[0] = time.monotonic()
            _emit(
                progress_callback,
                "search_completed",
                query=query,
                provider=result.get("provider"),
                source_count=len(result.get("sources", [])),
            )
            return json.dumps(result, ensure_ascii=False)
        except (
            Exception
        ) as exc:  # Provider exceptions are useful feedback to the agent.
            runtime_stats["search_failures"] += 1
            runtime_stats["last_error"] = f"{type(exc).__name__}: {exc}"
            _emit(
                progress_callback,
                "search_failed",
                query=query,
                error=f"{type(exc).__name__}: {exc}",
            )
            return json.dumps({"error": f"{type(exc).__name__}: {exc}"})

    @tool
    def read_public_source(source_url: str) -> str:
        """Open one public search result and return bounded extracted text for quoting.

        Only HTTP(S) public hosts are allowed. Redirects, content type, and download
        size are validated. The returned text is inspection material, not evidence;
        call archive_dam_evidence to persist and hash an accepted source.
        """
        _emit(progress_callback, "source_read_started", source_url=source_url)
        try:
            data, content_type, final_url = fetch_public_source(source_url)
            text = extract_text(data, content_type)
            if not text:
                raise ValueError("Source has no extractable text")
            runtime_stats["source_reads"] += 1
            excerpt, matched_terms = _focused_excerpt(
                text, [seed.dam_name, *seed.aliases], limit=8000
            )
            _emit(
                progress_callback,
                "source_read_completed",
                source_url=final_url,
                content_type=content_type,
                characters=len(text),
            )
            return json.dumps(
                {
                    "source_url": final_url,
                    "content_type": content_type,
                    "characters": len(text),
                    "matched_terms": matched_terms,
                    "text": excerpt,
                },
                ensure_ascii=False,
            )
        except Exception as exc:
            runtime_stats["last_error"] = f"{type(exc).__name__}: {exc}"
            _emit(
                progress_callback,
                "source_read_failed",
                source_url=source_url,
                error=runtime_stats["last_error"],
            )
            return json.dumps({"error": runtime_stats["last_error"]})

    @tool
    def archive_dam_evidence(
        title: str,
        source_url: str,
        publisher_or_author: str,
        evidence_category: str,
        source_tier: str,
        license_or_usage_status: str,
        exact_quote: str,
        quality_note: str,
        relevant_measurements_json: str = "{}",
        estimated_uncertainty_json: str = "{}",
        geographic_coordinates_or_crs: str = "Not stated",
        status: str = "discovery_only",
        source_locator: str = "Page/section not stated",
        notes: str = "",
    ) -> str:
        """Archive one public source and record only quote-supported evidence.

        evidence_category must be identity_geometry, reservoir_hydrology,
        spillway_breach_history, safety_context, imagery, or other. source_tier must
        be official_primary, primary_non_government, peer_reviewed,
        reputable_secondary, or discovery_only. Unknown classifications are retained
        conservatively as other/discovery_only rather than treated as verified.

        relevant_measurements_json is a JSON object. Use canonical SI project keys
        where applicable: latitude, longitude, dam_type, dam_height_m, dam_length_m,
        crest_width_m, crest_elevation_m, reservoir_capacity_m3,
        reservoir_surface_area_m2, initial_water_level_m, maximum_water_level_m,
        spillway_width_m, spillway_crest_elevation_m, catchment_area_km2.
        """
        try:
            category_aliases = {
                "identity": "identity_geometry",
                "geometry": "identity_geometry",
                "structural_integrity": "safety_context",
                "dam_safety": "safety_context",
                "safety": "safety_context",
                "reservoir": "reservoir_hydrology",
                "hydrology": "reservoir_hydrology",
                "spillway": "spillway_breach_history",
                "breach_history": "spillway_breach_history",
            }
            allowed_categories = {
                "identity_geometry",
                "reservoir_hydrology",
                "spillway_breach_history",
                "safety_context",
                "imagery",
                "other",
            }
            evidence_category = category_aliases.get(
                evidence_category, evidence_category
            )
            if evidence_category not in allowed_categories:
                evidence_category = "other"
            tier_aliases = {
                "primary": "discovery_only",
                "secondary": "discovery_only",
                "tertiary": "discovery_only",
                "government": "official_primary",
            }
            source_tier = tier_aliases.get(source_tier, source_tier)
            allowed_tiers = {
                "official_primary",
                "primary_non_government",
                "peer_reviewed",
                "reputable_secondary",
                "discovery_only",
            }
            if source_tier not in allowed_tiers:
                source_tier = "discovery_only"
            if source_tier == "discovery_only":
                status = "discovery_only"
            candidate = ArchivedEvidence(
                title=title,
                source_url=source_url,
                publisher_or_author=publisher_or_author,
                evidence_category=evidence_category,
                source_tier=source_tier,
                license_or_usage_status=license_or_usage_status,
                exact_quote=exact_quote,
                quality_note=quality_note,
                relevant_measurements=json.loads(relevant_measurements_json),
                estimated_uncertainty=json.loads(estimated_uncertainty_json),
                geographic_coordinates_or_crs=geographic_coordinates_or_crs,
                status=status,
                source_locator=source_locator,
                notes=notes or None,
            )
            record = workspace.archive(candidate)
            staged.append(record)
            workspace.save_records(staged)
            _emit(
                progress_callback,
                "source_archived",
                title=record.title,
                evidence_id=record.id,
                category=candidate.evidence_category,
                evidence_count=len(staged),
            )
            return json.dumps(
                {
                    "archived": True,
                    "evidence_id": record.id,
                    "artifact_path": record.artifact_path,
                }
            )
        except (ValueError, ValidationError, json.JSONDecodeError) as exc:
            runtime_stats["archive_rejections"] += 1
            runtime_stats["last_error"] = str(exc)
            _emit(progress_callback, "archive_rejected", title=title, error=str(exc))
            return json.dumps({"archived": False, "error": str(exc)})

    model_id = model_name or os.getenv("DAM_RESEARCH_MODEL", "google_genai:gemini-1.5-flash")
    system_prompt = SYSTEM_PROMPT
    model_options: dict[str, Any] = {"temperature": 0}
    if model_id.startswith("google_genai:"):
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if api_key:
            model_options["api_key"] = api_key
    if model_id.startswith("ollama:"):
        model_options["base_url"] = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        model_options["reasoning"] = False
        model_options["num_ctx"] = int(os.getenv("DAM_RESEARCH_OLLAMA_NUM_CTX", "8192"))
        model_options["num_predict"] = int(
            os.getenv("DAM_RESEARCH_OLLAMA_NUM_PREDICT", "768")
        )
        system_prompt += (
            "\n\n/no_think\nYou are the only coordinator for this local run. Execute the "
            "four supplied dam-research tracks sequentially; do not invent or delegate "
            "different topics. Use concise tool calls and findings."
        )
        system_prompt = system_prompt.replace(
            "Begin by planning all four research tracks and delegate each track to its named specialist.",
            "Execute all four supplied research tracks sequentially.",
        )
    model_delay_s = float(os.getenv("DAM_MODEL_RATE_LIMIT_DELAY_S", "0.5"))
    model_options["rate_limiter"] = InMemoryRateLimiter(
        requests_per_second=(1.0 / model_delay_s if model_delay_s > 0 else 1000.0),
        check_every_n_seconds=0.5,
        max_bucket_size=1,
    )
    model = init_chat_model(model=model_id, **model_options)
    tools = [search_web, read_public_source, archive_dam_evidence]
    subagents = (
        [
            {
                "name": name,
                "description": prompt,
                "system_prompt": system_prompt
                + "\n\nYour bounded assignment: "
                + prompt,
                "tools": tools,
            }
            for name, prompt in SPECIALISTS.items()
        ]
        if not model_id.startswith("ollama:")
        else []
    )
    backend = FilesystemBackend(root_dir=str(workspace.directory), virtual_mode=True)
    agent = create_deep_agent(
        name="dam-evidence-coordinator",
        model=model,
        tools=tools,
        system_prompt=system_prompt,
        subagents=subagents,
        middleware=[TodoListMiddleware()],
        backend=backend,
        checkpointer=MemorySaver(),
    )
    return agent, workspace, runtime_stats


def run_research(
    seed: DamResearchSeed,
    project: Project | None = None,
    model_name: str | None = None,
    thread_id: str | None = None,
    progress_callback: ProgressCallback | None = None,
) -> dict:
    selected_model = model_name or os.getenv("DAM_RESEARCH_MODEL", "google_genai:gemini-1.5-flash")
    if selected_model.startswith("ollama:"):
        from .dam_research_local import run_local_research

        return run_local_research(seed, project, selected_model, progress_callback)
    _emit(
        progress_callback,
        "planning",
        dam_id=seed.dam_id,
        message="Preparing four-track evidence plan",
    )
    plan = make_research_plan(seed, project)
    agent, workspace, runtime_stats = build_agent(
        seed, project, model_name, progress_callback
    )
    workspace.write_seed()
    plan_path = workspace.directory / "research-plan.json"
    plan_path.write_text(json.dumps(plan, indent=2), encoding="utf-8")
    prompt = (
        "Research only the dam and topics in the supplied plan. Use its starter_queries "
        "verbatim before trying any refinements. For every track: search, open a relevant "
        "result with read_public_source, and archive quote-supported evidence. Never invent "
        "an unrelated track. Complete all four tracks.\n\n" + json.dumps(plan, indent=2)
    )
    error, summary = None, None
    try:
        _emit(
            progress_callback,
            "agent_started",
            track_count=len(RESEARCH_TRACKS),
            message="Coordinator running; specialist searches may take several minutes",
        )
        result = agent.invoke(
            {"messages": [{"role": "user", "content": prompt}]},
            config={"configurable": {"thread_id": thread_id or f"dam-{seed.dam_id}"}},
        )
        final = result["messages"][-1]
        summary = final.content if hasattr(final, "content") else str(final)
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        _emit(progress_callback, "agent_failed", error=error)
    _emit(progress_callback, "compiling", message="Compiling evidence and conflicts")
    records = workspace.load_records()
    if not error and not records:
        error = (
            f"No evidence was archived. {runtime_stats['search_failures']} of "
            f"{runtime_stats['searches']} searches failed; "
            f"{runtime_stats['archive_rejections']} candidate records were rejected."
        )
        if runtime_stats["last_error"]:
            error += f" Last error: {runtime_stats['last_error']}"
    findings = compile_findings(seed, records, project)
    findings_path = workspace.directory / "research-findings.json"
    findings_path.write_text(json.dumps(findings, indent=2), encoding="utf-8")
    manifest_path = workspace.directory / "agent-evidence.json"
    result = {
        "status": "failed" if error else "complete",
        "manifest": str(manifest_path.relative_to(ROOT))
        if manifest_path.is_file()
        else None,
        "findings": str(findings_path.relative_to(ROOT)),
        "evidence_count": len(records),
        "summary": summary,
        "error": error,
    }
    return result
