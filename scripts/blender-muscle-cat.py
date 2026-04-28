"""Build a GameMaker muscle cat in Blender via the MCP addon socket.

Sends one big `execute_code` command to Blender on :9876 which:
  - cleans any previous MC_* objects/materials
  - builds head/ears/eyes/nose/torso/arms/legs/tail as primitives + Subsurf
  - applies cheese-orange material with proper Principled BSDF
  - adds 3-point lighting (warm key + pink rim + purple fill) matching the Three.js version
  - sets up camera + world background for render-ready preview
"""
import socket, json, sys

HOST, PORT = "127.0.0.1", 9876

BLENDER_CODE = r"""
import bpy
import math

PREFIX = "MC_"
MUSCLE = 0.55   # 0 = baby (새끼), 0.55 ~ 근육 stage, 1.0 = GigaChad
COLOR   = (0.95, 0.65, 0.29, 1.0)  # 치즈 orange
ACCENT  = (0.76, 0.44, 0.12, 1.0)
BELLY   = (1.00, 0.85, 0.66, 1.0)
PINK    = (1.00, 0.48, 0.66, 1.0)
EYE     = (0.04, 0.04, 0.06, 1.0)

# -- Clean up any previous MC_* objects/materials --
for o in list(bpy.data.objects):
    if o.name.startswith(PREFIX):
        bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.materials):
    if m.name.startswith(PREFIX):
        bpy.data.materials.remove(m)
for c in list(bpy.data.curves):
    if c.name.startswith(PREFIX):
        bpy.data.curves.remove(c)

# -- Helpers --
def mat(name, base_color, roughness=0.55, metallic=0.05):
    m = bpy.data.materials.new(PREFIX + name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    if b:
        for k, v in (("Base Color", base_color),
                     ("Roughness", roughness),
                     ("Metallic", metallic)):
            try: b.inputs[k].default_value = v
            except (KeyError, TypeError): pass
    return m

def mat_emit(name, color, strength=3.0):
    m = bpy.data.materials.new(PREFIX + name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = color
    em.inputs[1].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs[0])
    return m

def sphere(name, loc, scale=(1,1,1), subdiv=2, material=None):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=loc)
    o = bpy.context.active_object
    o.name = PREFIX + name
    o.scale = scale
    if subdiv > 0:
        s = o.modifiers.new("Subsurf", type="SUBSURF")
        s.levels = subdiv
        s.render_levels = subdiv
    bpy.ops.object.shade_smooth()
    if material: o.data.materials.append(material)
    return o

def cone(name, loc, r1=0.2, depth=0.4, rot=(0,0,0), material=None):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = PREFIX + name
    s = o.modifiers.new("Subsurf", type="SUBSURF")
    s.levels = 1
    bpy.ops.object.shade_smooth()
    if material: o.data.materials.append(material)
    return o

# -- Materials --
M_BODY   = mat("Body", COLOR)
M_BELLY  = mat("Belly", BELLY, roughness=0.5)
M_ACCENT = mat("Accent", ACCENT, roughness=0.6)
M_EYE    = mat("Eye", EYE, roughness=0.1, metallic=0.3)
M_NOSE   = mat("Nose", PINK, roughness=0.4)
M_SHINE  = mat_emit("Shine", (1,1,1,1), strength=4.0)
M_FLOOR  = mat("Floor", (0.07, 0.08, 0.11, 1.0), roughness=0.35, metallic=0.25)

# -- Head --
HY = 2.5 - MUSCLE * 0.08
sphere("Head", (0, 0, HY), (0.62, 0.62, 0.62), subdiv=2, material=M_BODY)

# -- Ears --
for side, suf in [(-1, "L"), (1, "R")]:
    ear = cone(f"Ear_{suf}", (side*0.36, -0.02, HY + 0.52),
               r1=0.2, depth=0.42,
               rot=(math.radians(-15), side*math.radians(-12), 0),
               material=M_BODY)
    inner = cone(f"EarInner_{suf}", (side*0.36, 0.03, HY + 0.52),
                 r1=0.13, depth=0.3,
                 rot=(math.radians(-15), side*math.radians(-12), 0),
                 material=M_ACCENT)

# -- Eyes + shine --
for side, suf in [(-1, "L"), (1, "R")]:
    sphere(f"Eye_{suf}", (side*0.2, 0.56, HY + 0.05),
           (0.08, 0.08, 0.08), subdiv=1, material=M_EYE)
    sphere(f"Shine_{suf}", (side*0.2 + 0.015, 0.62, HY + 0.08),
           (0.025, 0.025, 0.025), subdiv=0, material=M_SHINE)

# -- Nose --
sphere("Nose", (0, 0.6, HY - 0.1),
       (0.065, 0.045, 0.06), subdiv=1, material=M_NOSE)

# -- Torso (V-taper) --
torso_scale = (
    0.92 + MUSCLE * 0.85,  # shoulders wide
    0.70 + MUSCLE * 0.35,  # chest depth
    1.45,                   # height
)
sphere("Torso", (0, 0, 1.25), torso_scale, subdiv=3, material=M_BODY)

# -- Belly patch (lighter spot on front) --
sphere("Belly", (0, 0.45, 1.10), (0.40, 0.16, 0.48), subdiv=2, material=M_BELLY)

# -- Arms --
for side, suf in [(-1, "L"), (1, "R")]:
    arm_r = 0.22 + MUSCLE * 0.28
    arm_h = 0.40 + MUSCLE * 0.20 + arm_r
    sphere(f"Arm_{suf}",
           (side*(0.88 + MUSCLE*0.55), 0, 1.20),
           (arm_r, arm_r, arm_h), subdiv=2, material=M_BODY)
    # Bicep bump
    if MUSCLE > 0.25:
        sphere(f"Bicep_{suf}",
               (side*(0.88 + MUSCLE*0.55) - side*0.06, 0, 1.50),
               (arm_r*0.75, arm_r*0.75, arm_r*0.75), subdiv=2, material=M_BODY)
    # Paw at bottom
    sphere(f"Paw_{suf}",
           (side*(0.88 + MUSCLE*0.55), 0, 0.50),
           (arm_r*1.05, arm_r*0.9, arm_r*0.65), subdiv=2, material=M_BODY)

# -- Legs --
for side, suf in [(-1, "L"), (1, "R")]:
    sphere(f"Leg_{suf}", (side*0.32, 0.05, 0.20),
           (0.24, 0.24, 0.30), subdiv=2, material=M_BODY)
    sphere(f"Foot_{suf}", (side*0.32, 0.20, -0.02),
           (0.26, 0.34, 0.13), subdiv=2, material=M_BODY)

# -- Tail (bezier curve with bevel) --
curve_data = bpy.data.curves.new(PREFIX + "TailCurve", type="CURVE")
curve_data.dimensions = "3D"
curve_data.resolution_u = 24
curve_data.bevel_depth = 0.12 + MUSCLE * 0.04
curve_data.bevel_resolution = 8
spline = curve_data.splines.new("BEZIER")
spline.bezier_points.add(3)
pts = [(0, -0.55, 0.5), (0.55, -0.75, 0.85),
       (0.95, -0.5, 1.6), (0.75, -0.1, 2.4)]
for i, pt in enumerate(pts):
    spline.bezier_points[i].co = pt
    spline.bezier_points[i].handle_left_type = "AUTO"
    spline.bezier_points[i].handle_right_type = "AUTO"
tail_obj = bpy.data.objects.new(PREFIX + "Tail", curve_data)
bpy.context.scene.collection.objects.link(tail_obj)
tail_obj.data.materials.append(M_BODY)

# -- Floor disc --
bpy.ops.mesh.primitive_cylinder_add(radius=3, depth=0.15, location=(0, 0, -0.15))
floor = bpy.context.active_object
floor.name = PREFIX + "Floor"
floor.data.materials.append(M_FLOOR)

# -- Lights: warm key + pink rim + purple fill --
bpy.ops.object.light_add(type="SUN", location=(4, -3, 6))
key = bpy.context.active_object
key.name = PREFIX + "KeyLight"
key.data.energy = 3.0
key.data.color = (1.0, 0.95, 0.82)
key.rotation_euler = (math.radians(-60), math.radians(25), math.radians(35))

bpy.ops.object.light_add(type="POINT", location=(-3.2, 2.5, 1.5))
rim = bpy.context.active_object
rim.name = PREFIX + "RimLight"
rim.data.energy = 350
rim.data.color = (1.0, 0.24, 0.53)
if hasattr(rim.data, "shadow_soft_size"): rim.data.shadow_soft_size = 0.5

bpy.ops.object.light_add(type="POINT", location=(3.0, 2.0, 0.6))
fill = bpy.context.active_object
fill.name = PREFIX + "FillLight"
fill.data.energy = 200
fill.data.color = (0.49, 0.36, 1.0)

# -- Camera: low/front hero angle --
bpy.ops.object.camera_add(location=(0, -6.5, 2.2),
                           rotation=(math.radians(82), 0, 0))
cam = bpy.context.active_object
cam.name = PREFIX + "Camera"
cam.data.lens = 50
bpy.context.scene.camera = cam

# -- Dark world background --
world = bpy.context.scene.world
if world:
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.04, 0.04, 0.06, 1.0)
        bg.inputs["Strength"].default_value = 0.3

# -- Stats --
mc_objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
print(f"DONE MC_COUNT={len(mc_objs)} MUSCLE={MUSCLE}")
for o in mc_objs:
    print(f"  {o.name:28s} loc={tuple(round(v,2) for v in o.location)}")
"""


def send(cmd):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    s.connect((HOST, PORT))
    s.sendall(json.dumps(cmd).encode("utf-8"))
    s.settimeout(60)
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
    print("→ sending muscle cat build command...")
    result = send({"type": "execute_code", "params": {"code": BLENDER_CODE}})
    print("\n--- RESULT ---")
    status = result.get("status")
    if status != "success":
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(1)
    print("status:", status)
    print("executed:", result.get("result", {}).get("executed"))
    print("\nstdout from Blender:")
    print(result.get("result", {}).get("result", ""))
    # Final scene check
    info = send({"type": "get_scene_info"})
    obj_count = info.get("result", {}).get("object_count", "?")
    print(f"→ scene now has {obj_count} total objects")
