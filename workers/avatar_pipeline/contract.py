"""Strict, dependency-free contract for the synthetic avatar pipeline prototype."""
import json
import math
import re
from pathlib import Path

MORPHS = {"face_width", "jaw_width", "nose_width", "nose_length", "eye_spacing",
          "cheek_fullness", "body_build"}
VISEMES = {"sil", "PP", "FF", "TH", "DD", "kk", "CH", "SS", "nn", "RR",
           "aa", "E", "ih", "oh", "ou"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number(value, low, high):
    return type(value) in (int, float) and math.isfinite(value) and low <= value <= high


def fields(value, names):
    require(type(value) is dict and set(value) == set(names),
            "Missing or unknown contract fields")


def validate(job):
    fields(job, {"version", "synthetic", "job_id", "rig_version", "morphs",
                 "fps", "frame_start", "frame_end", "visemes"})
    require(type(job["version"]) is int and job["version"] == 1, "Unsupported version")
    require(job["synthetic"] is True, "Prototype accepts synthetic fixtures only")
    require(isinstance(job["job_id"], str) and
            re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", job["job_id"]), "Invalid job_id")
    require(job["rig_version"] == "voxtree-adult-v1", "Unsupported rig")
    require(type(job["morphs"]) is dict and set(job["morphs"]) <= MORPHS,
            "Unknown morph")
    require(all(number(v, 0, 1) for v in job["morphs"].values()), "Invalid morph weight")
    for key, low, high in (("fps", 24, 30), ("frame_start", 1, 28800),
                           ("frame_end", 1, 28800)):
        require(type(job[key]) is int and low <= job[key] <= high, "Invalid " + key)
    require(job["frame_end"] >= job["frame_start"], "Reversed frame range")
    require(type(job["visemes"]) is list and len(job["visemes"]) <= 10000,
            "Invalid viseme list")
    previous_end = 0
    duration = (job["frame_end"] - job["frame_start"] + 1) / job["fps"]
    for cue in job["visemes"]:
        fields(cue, {"start", "end", "name", "weight"})
        require(isinstance(cue["name"], str) and cue["name"] in VISEMES, "Unknown viseme")
        require(number(cue["start"], previous_end, duration), "Overlapping/invalid cue")
        require(number(cue["end"], cue["start"], duration) and cue["end"] > cue["start"],
                "Invalid cue end")
        require(number(cue["weight"], 0, 1), "Invalid cue weight")
        previous_end = cue["end"]
    return job


def load(path):
    path = Path(path)
    require(path.stat().st_size <= 2_000_000, "Manifest too large")
    return validate(json.loads(path.read_text()))
