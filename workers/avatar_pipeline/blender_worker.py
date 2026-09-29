"""Run only in Blender, against a trusted studio-authored scene. See README."""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from contract import MORPHS, VISEMES, load, require
from shot_pipeline import require_locked_frame_rate


def personalize(bpy, job):
    scene = bpy.context.scene
    require(scene.get("voxtree_rig_version") == job["rig_version"], "Scene rig mismatch")
    body = scene.objects.get("VT_Body")
    face = scene.objects.get("VT_Face")
    rig = scene.objects.get("VT_Rig")
    require(rig is not None and rig.type == "ARMATURE", "Missing VT_Rig armature")
    require(scene.camera is not None, "Scene needs a camera")
    bindings = {}
    for obj, names in ((body, {"body_build"}), (face, MORPHS - {"body_build"})):
        require(obj is not None and obj.type == "MESH", "Missing character mesh")
        require(any(m.type == "ARMATURE" and m.object == rig for m in obj.modifiers),
                "Character mesh is not bound to VT_Rig")
        require(obj.data.shape_keys is not None, "Missing shape keys")
        keys = obj.data.shape_keys
        # Dedicated identity/lip shapes must not inherit master lip animation or drivers.
        require(keys.animation_data is None, "Shape keys must have no existing animation/drivers")
        for name in names:
            key = keys.key_blocks.get("VT_" + name)
            require(key is not None, "Missing shape key VT_" + name)
            bindings[name] = key
    mouth = {}
    for name in VISEMES:
        key = face.data.shape_keys.key_blocks.get("VT_viseme_" + name)
        require(key is not None, "Missing viseme " + name)
        mouth[name] = key
    # Complete validation precedes mutation; omitted identity values reset to neutral.
    for name, key in bindings.items():
        key.value = job["morphs"].get(name, 0)
    # Blender animation timing is absolute in frames: adopting a new rate here
    # would drift authored body/camera motion against the viseme cues built below.
    require_locked_frame_rate(scene.render.fps, scene.render.fps_base,
                              job["fps"], "Template frame rate")
    scene.render.fps = job["fps"]
    scene.render.fps_base = 1
    scene.frame_start = job["frame_start"]
    scene.frame_end = job["frame_end"]
    for key in mouth.values():
        key.value = 0
        key.keyframe_insert(data_path="value", frame=scene.frame_start)
    # Each cue has a triangular envelope: silence at boundaries, peak at midpoint.
    for cue in job["visemes"]:
        if cue["name"] == "sil":
            continue
        key = mouth[cue["name"]]
        start = scene.frame_start + cue["start"] * job["fps"]
        end = scene.frame_start + cue["end"] * job["fps"]
        for frame, weight in ((start, 0), ((start + end) / 2, cue["weight"]), (end, 0)):
            key.value = weight
            key.keyframe_insert(data_path="value", frame=frame)
    scene.frame_set(scene.frame_start)


def main():
    import bpy
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--render", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    job = load(args.manifest)
    personalize(bpy, job)
    if args.render:
        try:
            bpy.context.scene.render.engine = "PRMAN_RENDER"
        except (TypeError, ValueError) as exc:
            raise RuntimeError("RenderMan for Blender must be installed and enabled") from exc
    root = Path(args.output_root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    output = root / job["job_id"]
    output.mkdir()  # Never overwrite a previous job, including partial failures.
    scene = bpy.context.scene
    scene.render.filepath = str(output / "frame_")
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "personalized.blend"))
    if args.render:
        # RenderMan display/output configuration also belongs in the authored template.
        bpy.ops.render.render(animation=True)
    (output / "result.json").write_text(json.dumps({
        "job_id": job["job_id"],
        "status": "render_operator_finished" if args.render else "scene_prepared",
        "scene": "personalized.blend",
        "note": "Render outputs require validation before publication."
    }, indent=2) + "\n")


if __name__ == "__main__":
    main()
