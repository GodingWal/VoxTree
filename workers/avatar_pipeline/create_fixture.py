"""Create a geometric smoke-test scene; this is not a production avatar."""
from pathlib import Path
import sys
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from contract import MORPHS, VISEMES

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.object.armature_add()
rig = bpy.context.object
rig.name = "VT_Rig"
for name, z, radius in (("VT_Body", 0.8, 0.65), ("VT_Face", 1.8, 0.45)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=radius, location=(0, 0, z))
    obj = bpy.context.object
    obj.name = name
    group = obj.vertex_groups.new(name=rig.data.bones[0].name)
    group.add(list(range(len(obj.data.vertices))), 1, "REPLACE")
    modifier = obj.modifiers.new(name="Rig", type="ARMATURE")
    modifier.object = rig
    obj.shape_key_add(name="Basis")
    names = {"body_build"} if name == "VT_Body" else MORPHS - {"body_build"}
    for morph in sorted(names):
        key = obj.shape_key_add(name="VT_" + morph)
        for vertex in key.data:
            vertex.co.x *= 1.2
    if name == "VT_Face":
        for viseme in sorted(VISEMES):
            key = obj.shape_key_add(name="VT_viseme_" + viseme)
            if viseme != "sil":
                for vertex in key.data:
                    if vertex.co.z < 0:
                        vertex.co.z *= 1.15
bpy.ops.object.camera_add(location=(0, -6, 2))
camera = bpy.context.object
from mathutils import Vector
camera.rotation_euler = (Vector((0, 0, 1.2)) - camera.location).to_track_quat("-Z", "Y").to_euler()
scene = bpy.context.scene
scene.camera = camera
scene["voxtree_rig_version"] = "voxtree-adult-v1"
scene.render.resolution_x = 640
scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
bpy.ops.object.light_add(type="AREA", location=(0, -3, 4))
bpy.context.object.data.energy = 500
destination = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
if destination.exists():
    raise FileExistsError(destination)
bpy.ops.wm.save_as_mainfile(filepath=str(destination))
