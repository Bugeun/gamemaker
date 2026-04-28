"""Verify the whale asset: confirm material, voxel mesh stats, and try a viewport screenshot."""
import socket, json, sys, os, base64

HOST, PORT = "127.0.0.1", 9876
OUT_DIR = r"C:\Users\bugeu\Documents\gamemaker\scripts\verify"


def send(cmd, timeout=30):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    s.connect((HOST, PORT))
    s.sendall(json.dumps(cmd).encode("utf-8"))
    s.settimeout(timeout)
    data = b""
    while True:
        chunk = s.recv(16384)
        if not chunk:
            break
        data += chunk
        try:
            return json.loads(data.decode("utf-8"))
        except json.JSONDecodeError:
            continue
    raise RuntimeError("no parseable response")


# Verification query: inspect the Whale object + its material
VERIFY_CODE = r"""
import bpy, json

whale = bpy.data.objects.get("WH_Whale")
if not whale:
    print("FAIL no WH_Whale found"); import sys; sys.exit()

mesh = whale.data
mats = [m.name for m in mesh.materials]

# Inspect crystal material
mat = bpy.data.materials.get("WH_Crystal")
mat_info = {}
if mat and mat.use_nodes:
    b = mat.node_tree.nodes.get("Principled BSDF")
    if b:
        for key in ("Base Color", "Metallic", "Roughness", "IOR",
                    "Transmission", "Transmission Weight",
                    "Emission", "Emission Color", "Emission Strength", "Alpha"):
            try:
                v = b.inputs[key].default_value
                if hasattr(v, '__len__'):
                    mat_info[key] = [round(x, 3) for x in v]
                else:
                    mat_info[key] = round(float(v), 3)
            except (KeyError, TypeError):
                pass

wh_objs = sorted([o.name for o in bpy.data.objects if o.name.startswith("WH_")])

report = {
    "whale_name": whale.name,
    "vertex_count": len(mesh.vertices),
    "face_count": len(mesh.polygons),
    "materials_on_whale": mats,
    "material_crystal_bsdf": mat_info,
    "total_WH_objects": len(wh_objs),
    "object_names": wh_objs,
    "world_location": [round(v, 2) for v in whale.location],
}
print("REPORT:", json.dumps(report, ensure_ascii=False, indent=2))
"""


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)

    # 1. Detailed object/material verification
    print("→ querying whale object + material...")
    r = send({"type": "execute_code", "params": {"code": VERIFY_CODE}})
    out = r.get("result", {}).get("result", "") if r.get("status") == "success" else ""
    print(out[:2500])

    # 2. Viewport screenshot
    print("\n→ capturing viewport screenshot...")
    screenshot_path = os.path.join(OUT_DIR, "whale-viewport.png")
    try:
        r2 = send({"type": "get_viewport_screenshot",
                   "params": {"max_size": 1200, "filepath": screenshot_path}},
                  timeout=30)
        print("screenshot response:", json.dumps(r2, ensure_ascii=False)[:500])
        # some versions return base64; some write to filepath; try both
        res = r2.get("result", {}) if r2.get("status") == "success" else {}
        if isinstance(res, dict):
            b64 = res.get("base64") or res.get("image_data") or res.get("data")
            if b64 and not os.path.exists(screenshot_path):
                with open(screenshot_path, "wb") as f:
                    f.write(base64.b64decode(b64))
        if os.path.exists(screenshot_path):
            sz = os.path.getsize(screenshot_path)
            print(f"✓ screenshot saved: {screenshot_path} ({sz} bytes)")
    except Exception as e:
        print(f"screenshot skipped: {e}")
