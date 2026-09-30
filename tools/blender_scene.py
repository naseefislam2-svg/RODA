"""Build RODA's original neo-industrial ring study in Blender 4.x.

Run manually: blender --background --python tools/blender_scene.py
The matching SVG artwork used by the app is code-native so the frontend remains fast.
"""

import math
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts" / "blender"
OUTPUT.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, metallic=0.0, roughness=0.45):
    item = bpy.data.materials.new(name)
    item.diffuse_color = (*color, 1)
    item.metallic = metallic
    item.roughness = roughness
    return item


clay = material("Sun-baked alloy", (0.64, 0.21, 0.08), 0.72, 0.25)
ink = material("Industrial ink", (0.025, 0.034, 0.026), 0.35, 0.32)
lime = material("Commons signal", (0.62, 0.73, 0.27), 0.08, 0.48)

for index in range(15):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=2.5,
        minor_radius=0.27,
        major_segments=96,
        minor_segments=18,
        location=(0, 0, (index - 7) * 0.09),
        rotation=(math.radians(67), 0, math.radians(-27)),
    )
    ring = bpy.context.object
    ring.name = f"Community ring {index + 1:02d}"
    ring.scale = (1, 0.72, 1)
    ring.data.materials.append(clay if index % 3 else ink)

for x in (-3.7, 3.7):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.14, depth=2.6, location=(x, 0, 0.5))
    bpy.context.object.data.materials.append(lime)

bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -2.05))
floor = bpy.context.object
floor.data.materials.append(material("Warm concrete", (0.72, 0.69, 0.59), 0, 0.82))

bpy.ops.object.light_add(type="AREA", location=(-4, -4, 6))
bpy.context.object.data.energy = 1100
bpy.context.object.data.shape = "DISK"
bpy.context.object.data.size = 5
bpy.ops.object.light_add(type="AREA", location=(5, 1, 4))
bpy.context.object.data.energy = 800
bpy.context.object.data.color = (1.0, 0.35, 0.12)
bpy.context.object.data.size = 4

bpy.ops.object.camera_add(location=(8.2, -10.5, 6.5))
camera = bpy.context.object
bpy.context.scene.camera = camera


def track(obj, point):
    obj.rotation_euler = (mathutils.Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


import mathutils  # Blender module; imported after reset for clearer standalone errors.

track(camera, (0, 0, 0))
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x = 1600
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(OUTPUT / "roda-ring.png")
scene.world.color = (0.055, 0.066, 0.052)
scene.view_settings.look = "AgX - Medium High Contrast"

bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / "roda-ring.blend"))
bpy.ops.render.render(write_still=True)
