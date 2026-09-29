import copy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from contract import validate


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.job = json.loads((Path(__file__).resolve().parents[1] /
                               "examples/synthetic-avatar.json").read_text())

    def test_fixture(self):
        self.assertEqual(validate(self.job)["frame_end"], 240)

    def test_reject_invalid_jobs(self):
        for patch in ({"synthetic": False}, {"job_id": "../../escape"},
                      {"job_id": "/tmp/output"}, {"version": True},
                      {"morphs": {"face_width": float("nan")}},
                      {"morphs": {"face_width": True}},
                      {"morphs": {"face_width": 1.1}},
                      {"morphs": {"unknown": 0.2}}, {"frame_start": 241},
                      {"fps": 24.0}, {"rig_version": "other"}, {"command": "arbitrary"}):
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                validate(dict(self.job, **patch))

    def test_invalid_timing(self):
        for start, end in ((0.1, 0.8), (0.8, 0.8), (0.8, 11), (float("nan"), 1)):
            job = copy.deepcopy(self.job)
            job["visemes"][1].update(start=start, end=end)
            with self.subTest(start=start, end=end), self.assertRaises(ValueError):
                validate(job)

    def test_optional_morphs_and_silent_track(self):
        self.job.update(morphs={}, visemes=[])
        validate(self.job)


if __name__ == "__main__":
    unittest.main()
