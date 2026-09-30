"""Evidence and approval-gate tests for approximate reconstruction."""

import unittest

from src.project import Project, ROOT
from src.reconstruction import verify_evidence, RECONSTRUCTION_DISCLAIMER
from scripts.reconstruct_dam import approve, validate_draft


class ReconstructionTests(unittest.TestCase):
    def test_evidence_files_are_hashed_and_valid(self):
        manifest = verify_evidence(ROOT / "data/evidence/machhu-ii/evidence.json")
        self.assertGreaterEqual(len(manifest.items), 8)
        statuses = {item.status for item in manifest.items}
        self.assertTrue({"verified", "approximate", "discovery_only"} <= statuses)

    def test_draft_is_valid_unapproved_and_does_not_change_project(self):
        project_path = ROOT / "data/projects/machhu-ii.json"
        before = project_path.read_bytes()
        draft = validate_draft("machhu-ii")
        self.assertFalse(draft["approved"])
        self.assertEqual(draft["disclaimer"], RECONSTRUCTION_DISCLAIMER)
        self.assertEqual(before, project_path.read_bytes())

    def test_approval_requires_exact_human_acceptance(self):
        with self.assertRaises(ValueError):
            approve("machhu-ii", "automated-test", "not-approved")

    def test_project_rejects_bad_stage_storage(self):
        base = {
            "dam_id": "test",
            "dam_name": "Test",
            "latitude": 22,
            "longitude": 70,
            "dam_height_m": 10,
            "reservoir_capacity_m3": 100,
        }
        with self.assertRaises(ValueError):
            Project(**base, stage_storage=[(1, 10), (1, 20)])
        with self.assertRaises(ValueError):
            Project(**base, crest_coordinates=[(70, 22)])


if __name__ == "__main__":
    unittest.main()
