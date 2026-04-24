"""Send a 'create mascot scene' command to the running Blender MCP addon on :9876."""
import socket, json, sys

HOST, PORT = "127.0.0.1", 9876

BLENDER_CODE = r"""
import bpy
import math

# --- Clear existing demo objects (idempotent re-runs) ---
for name in ("GameMaker_Mascot", "Halo", "Pedestal"):
    obj = bpy.data.objects.get(name)
    if obj:
        bpy.data.objects.remove(obj, do_unlink=True)

# --- Suzanne (Blender's monkey) as the mascot ---
bpy.ops.mesh.primitive_monkey_add(size=2, location=(0, 0, 1.5))
suz = bpy.context.active_object
suz.name = "GameMaker_Mascot"
bpy.ops.object.shade_smooth()

mat_gold = bpy.data.materials.new("GM_Gold")
mat_gold.use_nodes = True
bsdf = mat_gold.node_tree.nodes.get("Principled BSDF")
if bsdf:
    for k, v in (("Base Color", (1.0, 0.77, 0.2, 1.0)),
                 ("Metallic", 1.0),
                 ("Roughness", 0.15)):
        try: bsdf.inputs[k].default_value = v
        except (KeyError, TypeError): pass
suz.data.materials.append(mat_gold)

# --- Pink/magenta glowing halo torus ---
bpy.ops.mesh.primitive_torus_add(
    major_radius=2.2, minor_radius=0.08,
    location=(0, 0, 2.9),
    rotation=(math.radians(90), 0, 0),
)
ring = bpy.context.active_object
ring.name = "Halo"

mat_glow = bpy.data.materials.new("GM_Glow")
mat_glow.use_nodes = True
nt = mat_glow.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
em = nt.nodes.new("ShaderNodeEmission")
em.inputs[0].default_value = (0.95, 0.24, 0.53, 1.0)  # accent-2 pink from the game
em.inputs[1].default_value = 8.0
out = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(em.outputs[0], out.inputs[0])
ring.data.materials.append(mat_glow)

# --- Pedestal (dark slab under the mascot) ---
bpy.ops.mesh.primitive_cube_add(size=3, location=(0, 0, -0.3))
ped = bpy.context.active_object
ped.name = "Pedestal"
ped.scale = (1.3, 1.3, 0.2)

mat_dark = bpy.data.materials.new("GM_Dark")
mat_dark.use_nodes = True
b2 = mat_dark.node_tree.nodes.get("Principled BSDF")
if b2:
    for k, v in (("Base Color", (0.05, 0.06, 0.09, 1.0)),
                 ("Roughness", 0.35)):
        try: b2.inputs[k].default_value = v
        except (KeyError, TypeError): pass
ped.data.materials.append(mat_dark)

print(f"OBJECTS={len(bpy.context.scene.objects)} MASCOT={suz.name} HALO={ring.name} PEDESTAL={ped.name}")
"""

def send(cmd):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    s.connect((HOST, PORT))
    s.sendall(json.dumps(cmd).encode("utf-8"))
    s.settimeout(30)
    data = b""
    while True:
        chunk = s.recv(8192)
        if not chunk: break
        data += chunk
        try:
            return json.loads(data.decode("utf-8"))
        except json.JSONDecodeError:
            continue
    s.close()
    raise RuntimeError("no parseable response")

if __name__ == "__main__":
    # 1) Scene info sanity check
    info = send({"type": "get_scene_info"})
    print("--- BEFORE ---")
    print(json.dumps(info, indent=2, ensure_ascii=False)[:500])

    # 2) Create mascot scene
    result = send({"type": "execute_code", "params": {"code": BLENDER_CODE}})
    print("--- CREATE ---")
    print(json.dumps(result, indent=2, ensure_ascii=False)[:800])

    # 3) Re-check scene
    info2 = send({"type": "get_scene_info"})
    print("--- AFTER ---")
    print(json.dumps(info2, indent=2, ensure_ascii=False)[:800])
