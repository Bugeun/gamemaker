"""Build a crystalline voxel whale referencing 고래.png.

Strategy:
  1) Assemble whale silhouette from primitives (body/head/fins/flukes)
  2) Join + Remesh(Blocks) to voxelize into ice cubes
  3) Apply Principled BSDF with Transmission + tinted Emission for crystal glow
  4) Dedicated rim + key lights so the whale reads as a hero subject

Positioned at x=9 to sit alongside the muscle cat without overlap.
"""
import socket, json, sys

HOST, PORT = "127.0.0.1", 9876

BLENDER_CODE = r"""
import bpy
import math

PREFIX = "WH_"
OFFSET_X = 9.0       # sit to the right of muscle cat
BODY_Z = 3.0
VOXEL_DEPTH = 5      # octree depth for Remesh(Blocks). 5 = chunky, 6 = fine

# ---- Clean previous whale ----
for o in list(bpy.data.objects):
    if o.name.startswith(PREFIX):
        bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.materials):
    if m.name.startswith(PREFIX):
        bpy.data.materials.remove(m)

# ---- Helpers ----
def add_sphere(name, loc, scale):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=loc)
    o = bpy.context.active_object
    o.name = PREFIX + name
    o.scale = scale
    return o

def add_cube(name, loc, scale, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = PREFIX + name
    o.scale = scale
    return o

# ---- Body silhouette parts ----
add_sphere("Body",      (OFFSET_X,       0,  BODY_Z),        (2.5, 1.05, 0.95))
add_sphere("Head",      (OFFSET_X - 2.0, 0,  BODY_Z),        (1.2, 1.0,  0.9))
add_sphere("Peduncle",  (OFFSET_X + 2.5, 0,  BODY_Z),        (1.0, 0.6,  0.55))

# Underbelly bump
add_sphere("Belly",     (OFFSET_X - 0.3, 0,  BODY_Z - 0.6),  (1.6, 0.85, 0.5))

# Pectoral fins (flattened, swept back/out)
for side, suf in [(-1, "L"), (1, "R")]:
    add_cube(f"PecFin_{suf}",
             (OFFSET_X - 0.8, side * 1.6, BODY_Z - 0.4),
             (1.0, 0.75, 0.12),
             rot=(0, math.radians(-12), side * math.radians(-28)))

# Dorsal fin (vertical slab on top)
add_cube("Dorsal",
         (OFFSET_X + 0.3, 0, BODY_Z + 1.3),
         (0.55, 0.14, 0.75),
         rot=(0, math.radians(18), 0))

# Tail flukes (horizontal, splayed)
for side, suf in [(-1, "L"), (1, "R")]:
    add_cube(f"Fluke_{suf}",
             (OFFSET_X + 3.9, side * 0.95, BODY_Z),
             (0.9, 0.95, 0.12),
             rot=(0, 0, side * math.radians(-38)))

# Small body frills (give it more spiky outline like the ref)
for i, (x_off, y_off, z_off) in enumerate([
    (-0.5,  0,    BODY_Z + 1.0),
    ( 0.6,  0,    BODY_Z + 1.05),
    ( 1.5,  0,    BODY_Z + 0.9),
]):
    add_cube(f"Spine_{i}",
             (OFFSET_X + x_off, y_off, z_off),
             (0.18, 0.3, 0.45),
             rot=(math.radians(15), 0, 0))

# ---- Join all whale parts ----
bpy.ops.object.select_all(action='DESELECT')
body_obj = bpy.data.objects.get(PREFIX + "Body")
for o in bpy.data.objects:
    if o.name.startswith(PREFIX):
        o.select_set(True)
bpy.context.view_layer.objects.active = body_obj
bpy.ops.object.join()
whale = bpy.context.active_object
whale.name = PREFIX + "Whale"

# ---- Voxelize via Remesh(Blocks) ----
rm = whale.modifiers.new(name="Voxelize", type='REMESH')
rm.mode = 'BLOCKS'
rm.octree_depth = VOXEL_DEPTH
rm.scale = 0.9
rm.use_remove_disconnected = False
# Apply modifier (bake into mesh)
bpy.context.view_layer.objects.active = whale
bpy.ops.object.modifier_apply(modifier=rm.name)

# ---- Crystalline cyan material ----
mat = bpy.data.materials.new(PREFIX + "Crystal")
mat.use_nodes = True
try: mat.blend_method = 'HASHED'
except AttributeError: pass

b = mat.node_tree.nodes.get("Principled BSDF")
if b:
    settings = [
        ("Base Color",            (0.30, 0.75, 1.00, 1.0)),
        ("Metallic",              0.0),
        ("Roughness",             0.15),
        ("IOR",                   1.45),
        ("Transmission",          0.85),              # Blender < 4.0
        ("Transmission Weight",   0.85),              # Blender 4.0+
        ("Alpha",                 1.0),
        ("Emission",              (0.20, 0.65, 1.0, 1.0)),   # Blender < 4.0
        ("Emission Color",        (0.20, 0.65, 1.0, 1.0)),   # Blender 4.0+
        ("Emission Strength",     0.45),
    ]
    for key, val in settings:
        try:
            b.inputs[key].default_value = val
        except (KeyError, TypeError):
            pass

whale.data.materials.clear()
whale.data.materials.append(mat)
bpy.ops.object.shade_flat()  # keep the chunky voxel read

# ---- Scatter a few emissive "glow accents" on random voxels ----
# Pick ~6 face centers and place tiny emissive cubes there (eyes + sparkle)
import random
random.seed(42)
mat_glow = bpy.data.materials.new(PREFIX + "Glow")
mat_glow.use_nodes = True
nt = mat_glow.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
em = nt.nodes.new("ShaderNodeEmission")
em.inputs[0].default_value = (0.8, 0.95, 1.0, 1.0)
em.inputs[1].default_value = 12.0
out = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(em.outputs[0], out.inputs[0])

# Eyes (two known positions on the head area)
for side in [-1, 1]:
    bpy.ops.mesh.primitive_cube_add(
        size=0.28,
        location=(OFFSET_X - 2.4, side * 0.55, BODY_Z + 0.3),
    )
    eye = bpy.context.active_object
    eye.name = PREFIX + f"Eye_{'L' if side<0 else 'R'}"
    eye.data.materials.append(mat_glow)

# Random sparkles on the body
poly_count = len(whale.data.polygons)
if poly_count > 0:
    sample_n = min(8, poly_count)
    sampled = random.sample(range(poly_count), sample_n)
    for i, p_idx in enumerate(sampled):
        p = whale.data.polygons[p_idx]
        # world coord of face center
        local = p.center
        wc = whale.matrix_world @ local
        # offset outward along normal
        normal_world = whale.matrix_world.to_3x3() @ p.normal
        wc = wc + normal_world * 0.05
        bpy.ops.mesh.primitive_cube_add(size=0.22, location=(wc.x, wc.y, wc.z))
        sp = bpy.context.active_object
        sp.name = PREFIX + f"Spark_{i}"
        sp.data.materials.append(mat_glow)

# ---- Dedicated whale lights ----
# Cool rim light from behind-left
bpy.ops.object.light_add(type='POINT', location=(OFFSET_X - 3.5, -2.5, BODY_Z + 2))
rim = bpy.context.active_object
rim.name = PREFIX + "RimLight"
rim.data.energy = 800
rim.data.color = (0.35, 0.75, 1.0)

# Soft fill
bpy.ops.object.light_add(type='POINT', location=(OFFSET_X + 4, 2.5, BODY_Z + 1))
fill = bpy.context.active_object
fill.name = PREFIX + "FillLight"
fill.data.energy = 300
fill.data.color = (0.5, 0.8, 1.0)

# ---- Stats ----
wh_objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
print(f"DONE WHALE_COUNT={len(wh_objs)} voxel_faces={poly_count} sparkles={min(8, poly_count)}")
for o in wh_objs[:30]:
    print(f"  {o.name:20s} loc={tuple(round(v,2) for v in o.location)}")
"""


def send(cmd):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    s.connect((HOST, PORT))
    s.sendall(json.dumps(cmd).encode("utf-8"))
    s.settimeout(90)
    data = b""
    while True:
        chunk = s.recv(8192)
        if not chunk:
            break
        data += chunk
        try:
            return json.loads(data.decode("utf-8"))
        except json.JSONDecodeError:
            continue
    raise RuntimeError("no parseable response")


if __name__ == "__main__":
    print("→ sending whale build command...")
    result = send({"type": "execute_code", "params": {"code": BLENDER_CODE}})
    print("\n--- RESULT ---")
    status = result.get("status")
    if status != "success":
        print(json.dumps(result, ensure_ascii=False, indent=2)[:1500])
        sys.exit(1)
    print("status:", status)
    print("executed:", result.get("result", {}).get("executed"))
    print("\nstdout from Blender:")
    print(result.get("result", {}).get("result", ""))
    info = send({"type": "get_scene_info"})
    obj_count = info.get("result", {}).get("object_count", "?")
    print(f"→ scene now has {obj_count} total objects")
