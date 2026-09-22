"""Deterministic tests for the generic dam research evidence pipeline."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import requests

from src.dam_research import (
    ArchivedEvidence, DamResearchSeed, EvidenceWorkspace,
    compile_findings, make_research_plan,
)
from src.dam_research_agent import _focused_excerpt, provider_web_search
from src.dam_research_local import (
    ExtractedClaim, nonfatal_source_error, run_local_research, source_access_policy,
)


def candidate(**updates):
    values = {
        "title": "Official sample dam register",
        "source_url": "https://water.example.gov/dams/sample",
        "publisher_or_author": "Example Water Authority",
        "evidence_category": "identity_geometry",
        "source_tier": "official_primary",
        "license_or_usage_status": "Public factual record; reuse not assessed",
        "relevant_measurements": {"dam_height_m": 42.0},
        "estimated_uncertainty": {"precision_m": 0.1},
        "status": "verified",
        "exact_quote": "The dam height is 42.0 metres.",
        "source_locator": "Dam register table",
        "quality_note": "Official owner record.",
    }
    values.update(updates)
    return ArchivedEvidence(**values)


class DamResearchTests(unittest.TestCase):
    def test_restricted_publishers_are_skipped_before_fetch(self):
        self.assertIsNotNone(source_access_policy("https://www.sciencedirect.com/article"))
        self.assertIsNotNone(source_access_policy("https://www.diva-portal.org/report.pdf"))
        self.assertIsNone(source_access_policy("https://water.example.gov/report.pdf"))

    def test_size_limited_document_is_a_nonfatal_source_skip(self):
        self.assertIn("20 MB", nonfatal_source_error(ValueError("Source exceeds 20971520 bytes")))
        self.assertIn("timed out", nonfatal_source_error(requests.Timeout("read timeout")))
        self.assertIsNone(nonfatal_source_error(ValueError("Exact quote was not found")))

    def test_equivalent_evidence_is_deduplicated_by_source_category_and_quote(self):
        seed = DamResearchSeed(dam_id="sample", dam_name="Sample Dam")
        with tempfile.TemporaryDirectory() as directory:
            workspace = EvidenceWorkspace(seed, Path(directory))
            body = b"The dam height is 42.0 metres."
            first = workspace.archive_bytes(candidate(), body, "text/plain")
            second = workspace.archive_bytes(candidate(title="Renamed official register"), body, "text/plain")
            workspace.save_records([first, second])
            self.assertEqual(len(workspace.load_records()), 1)

    def test_partial_tracker_freezes_elapsed_and_clears_transient_error(self):
        from server import ResearchRequest, ResearchTracker
        tracker = ResearchTracker()
        with patch("server.time.monotonic", return_value=10):
            tracker.begin(ResearchRequest(project_id="sample"))
        tracker.update({"event": "search_failed", "error": "temporary"})
        with patch("server.time.monotonic", return_value=20):
            tracker.finish({"status": "partial", "evidence_count": 1})
        with patch("server.time.monotonic", return_value=100):
            state = tracker.snapshot()
        self.assertEqual(state["elapsed_s"], 10)
        self.assertEqual(state["status"], "partial")
        self.assertIsNone(state["error"])

    @patch.dict("os.environ", {"DAM_RESEARCH_RATE_LIMIT_DELAY_S": "0"})
    @patch("src.dam_research_local.extract_claim")
    @patch("src.dam_research_local.fetch_public_source")
    @patch("src.dam_research_local.provider_web_search")
    def test_local_workflow_archives_all_tracks_without_promoting_claims(self, search, fetch, extract):
        seed = DamResearchSeed(dam_id="sample", dam_name="Sample Dam")
        url = "https://example.gov/dam"
        search.return_value = {"sources": [{"title": "Sample Dam registry", "url": url}]}
        body = b"Sample Dam has a height of 42 metres. " * 10
        fetch.return_value = (body, "text/plain", url)
        extract.return_value = ExtractedClaim(relevant=True, exact_quote="Sample Dam has a height of 42 metres.", summary="Height recorded.")
        with tempfile.TemporaryDirectory() as directory:
            result = run_local_research(seed, None, "ollama:test", root=Path(directory))
            self.assertEqual(result["status"], "partial")
            self.assertEqual(result["new_evidence_count"], 4)
            records = EvidenceWorkspace(seed, Path(directory)).load_records()
            self.assertEqual(len(records), 4)
            self.assertTrue(all(r.status == "discovery_only" for r in records))
            self.assertEqual(compile_findings(seed, records)["candidate_project_patch"], {})
            fetch.assert_called_once()

    @patch.dict("os.environ", {"DAM_RESEARCH_RATE_LIMIT_DELAY_S": "0"})
    @patch("src.dam_research_local.provider_web_search", side_effect=RuntimeError("provider unavailable"))
    def test_failed_run_cannot_claim_success_from_old_evidence(self, search):
        seed = DamResearchSeed(dam_id="sample", dam_name="Sample Dam")
        with tempfile.TemporaryDirectory() as directory:
            workspace = EvidenceWorkspace(seed, Path(directory))
            record = workspace.archive_bytes(candidate(), b"The dam height is 42.0 metres.", "text/plain")
            workspace.save_records([record])
            result = run_local_research(seed, None, "ollama:test", root=Path(directory))
            self.assertEqual(result["status"], "failed")
            self.assertEqual(result["new_evidence_count"], 0)
            self.assertEqual(result["evidence_count"], 1)

    def test_rejected_quote_does_not_delete_existing_artifact(self):
        seed = DamResearchSeed(dam_id="sample", dam_name="Sample Dam")
        with tempfile.TemporaryDirectory() as directory:
            workspace = EvidenceWorkspace(seed, Path(directory))
            body = b"The dam height is 42.0 metres."
            record = workspace.archive_bytes(candidate(), body, "text/plain")
            with self.assertRaises(ValueError):
                workspace.archive_bytes(candidate(exact_quote="This is an invented quote."), body, "text/plain")
            self.assertEqual((Path(directory) / record.artifact_path).read_bytes(), body)

    def test_source_excerpt_centers_on_dam_name(self):
        text = "Unrelated preface. " * 1000 + "Machhu-II Dam has a masonry spillway."
        excerpt, matches = _focused_excerpt(text, ["Machhu-II Dam"], limit=1000)
        self.assertIn("Machhu-II Dam has a masonry spillway.", excerpt)
        self.assertEqual(matches, ["Machhu-II Dam"])

    @patch("src.dam_research_agent.requests.get")
    def test_searxng_search_returns_direct_source_links(self, get):
        response = get.return_value
        response.json.return_value = {"results": [{
            "title": "Official dam register", "url": "https://example.gov/dam",
            "content": "Registry entry",
        }]}
        result = provider_web_search("sample dam", "searxng")
        response.raise_for_status.assert_called_once()
        self.assertEqual(result["provider"], "searxng")
        self.assertEqual(result["sources"][0]["url"], "https://example.gov/dam")

    def test_sparse_seed_builds_all_research_tracks(self):
        seed = DamResearchSeed(dam_id="sample", dam_name="Sample Dam", country="India")
        plan = make_research_plan(seed)
        self.assertEqual(len(plan["tracks"]), 4)
        self.assertIn("reservoir_capacity_m3", plan["missing_project_fields"])
        self.assertTrue(all(track["starter_queries"] for track in plan["tracks"]))

    def test_archived_quote_and_hash_are_reproducible(self):
        seed = DamResearchSeed(dam_id="sample", dam_name="Sample Dam")
        with tempfile.TemporaryDirectory() as directory:
            workspace = EvidenceWorkspace(seed, Path(directory))
            body = b"<html><body><p>The dam height is 42.0 metres.</p></body></html>"
            record = workspace.archive_bytes(candidate(), body, "text/html")
            manifest_path = workspace.save_records([record])
            self.assertTrue((Path(directory) / record.artifact_path).is_file())
            self.assertIn(record.id, manifest_path.read_text(encoding="utf-8"))

    def test_quote_must_exist_in_archived_source(self):
        seed = DamResearchSeed(dam_id="sample", dam_name="Sample Dam")
        with tempfile.TemporaryDirectory() as directory:
            workspace = EvidenceWorkspace(seed, Path(directory))
            with self.assertRaisesRegex(ValueError, "Exact quote"):
                workspace.archive_bytes(candidate(), b"Different page", "text/plain")

    def test_secondary_source_cannot_be_verified(self):
        with self.assertRaisesRegex(ValueError, "cannot be marked verified"):
            candidate(source_tier="reputable_secondary")

    def test_conflicts_are_preserved_and_not_promoted(self):
        seed = DamResearchSeed(dam_id="sample", dam_name="Sample Dam")
        with tempfile.TemporaryDirectory() as directory:
            workspace = EvidenceWorkspace(seed, Path(directory))
            first = workspace.archive_bytes(
                candidate(), b"The dam height is 42.0 metres.", "text/plain"
            )
            second = workspace.archive_bytes(
                candidate(title="Second official register", exact_quote="Height: 41 metres.",
                          relevant_measurements={"dam_height_m": 41.0}),
                b"Height: 41 metres.", "text/plain",
            )
            report = compile_findings(seed, [first, second])
            self.assertIn("dam_height_m", report["conflicts"])
            self.assertNotIn("dam_height_m", report["candidate_project_patch"])


if __name__ == "__main__":
    unittest.main()
