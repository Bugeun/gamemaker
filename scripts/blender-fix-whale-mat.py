"""Fix the WH_Crystal material using localization-agnostic node lookup,
switch viewport to Material Preview, and re-screenshot."""
import socket, json, os, sys

HOST, PORT = "127.0.0.1", 9876
OUT = r"C:\Users\bugeu\Documents\gamemaker\scripts\verify\whale-viewport-fixed.png"

FIX_CODE = r"""
import bpy

# --- Find Principled BSDF by bl_idname (language-independent) ---
def apply_crystal(mat_name, settings):
    mat = bpy.data.materials.get(mat_name)
    if not mat or not mat.use_nodes:
        print(f"[{mat_name}] no material or no use_nodes"); return
    bsdf = next((n for n in mat.node_tree.nodes
                 if n.bl_idname == 'ShaderNodeBsdfPrincipled'), None)
    if not bsdf:
        print(f"[{mat_name}] no Principled BSDF node"); return
    # Debug: print all input identifiers
    print(f"[{mat_name}] {len(bsdf.inputs)} inputs")
    set_count = 0
    for inp in bsdf.inputs:
        if inp.identifier in settings:
            try:
                inp.default_value = settings[inp.identifier]
                set_count += 1
            except Exception as e:
                print(f"  FAIL {inp.identifier}: {e}")
    print(f"[{mat_name}] set {set_count} inputs")

apply_crystal("WH_Crystal", {
    "Base Color":          (0.30, 0.75, 1.00, 1.0),
    "Metallic":            0.0,
    "Roughness":           0.15,
    "IOR":                 1.45,
    "Transmission Weight": 0.85,
    "Emission Color":      (0.20, 0.65, 1.0, 1.0),
    "Emission Strength":   0.45,
    "Alpha":               1.0,
})

# Blend mode for transparency in viewport
mat = bpy.data.materials.get("WH_Crystal")
if mat:
    try: mat.blend_method = 'HASHED'
    except Exception: pass
    try: mat.use_screen_refraction = True
    except Exception: pass

# --- Switch all 3D viewports to Material Preview ---
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        for space in area.spaces:
            if space.type == 'VIEW_3D':
                space.shading.type = 'MATERIAL'
                # Stronger look
                try: space.shading.use_scene_lights = True
                except Exception: pass
                try: space.shading.use_scene_world = True
                except Exception: pass

# --- Frame the whale in view ---
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.name.startswith("WH_") and o.type == 'MESH':
        o.select_set(True)
# Focus view on selected — needs area override
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        with bpy.context.temp_override(area=area, region=area.regions[-1]):
            try:
                bpy.ops.view3d.view_selected(use_all_regions=False)
            except Exception as e:
                print(f"view_selected failed: {e}")
        break

# --- Diagnostic: confirm the BSDF state after fix ---
m = bpy.data.materials.get("WH_Crystal")
b = next((n for n in m.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled'), None) if m else None
if b:
    keys = ("Base Color", "Roughness", "IOR", "Transmission Weight", "Emission Color", "Emission Strength")
    out = {}
    for inp in b.inputs:
        if inp.identifier in keys:
            v = inp.default_value
            if hasattr(v, '__len__'):
                out[inp.identifier] = [round(x, 3) for x in v]
            else:
                out[inp.identifier] = round(float(v), 3)
    print("AFTER_FIX:", out)
"""


def send(cmd, timeout=30):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    s.connect((HOST, PORT))
    s.sendall(json.dumps(cmd).encode("utf-8"))
    s.settimeout(timeout)
    data = b""
    while True:
        chunk = s.recv(16384)
        if not chunk: break
        data += chunk
        try:
            return json.loads(data.decode("utf-8"))
        except json.JSONDecodeError:
            continue
    raise RuntimeError("no response")


if __name__ == "__main__":
    print("-> applying material fix...")
    r = send({"type": "execute_code", "params": {"code": FIX_CODE}})
    if r.get("status") != "success":
        print(json.dumps(r, ensure_ascii=False, indent=2)[:1200]); sys.exit(1)
    print(r.get("result", {}).get("result", ""))

    print("\n-> capturing new viewport screenshot...")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    r2 = send({"type": "get_viewport_screenshot",
               "params": {"max_size": 1200, "filepath": OUT}},
              timeout=30)
    if r2.get("status") == "success":
        res = r2.get("result", {})
        if os.path.exists(OUT):
            print(f"saved: {OUT} ({os.path.getsize(OUT)} bytes, {res.get('width')}x{res.get('height')})")
        else:
            print("response but file missing:", json.dumps(res, ensure_ascii=False)[:400])
    else:
        print("screenshot failed:", json.dumps(r2, ensure_ascii=False)[:400])
