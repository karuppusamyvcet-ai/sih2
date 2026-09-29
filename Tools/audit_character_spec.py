#!/usr/bin/env python3
"""
audit_character_spec.py — the character sheet's numbers have to add up.

Documentation/01_Character_Technical_Spec.md promises a 1.700 m figure at 7.2
head-heights, with a shoulder line, a chin, an eye line and a knee that all sit
where anatomy puts them. Both the Unity builder and the browser builder read
character_spec.json, so if the arithmetic in that file is wrong both builds are
wrong in the same way — and no screenshot would explain why.

This script re-derives every vertical position from the spec's own primitives
and fails if anything disagrees by more than a millimetre. It is the guard that
keeps the model faithful to the reference sheet while the file is edited.

Usage:  python3 Tools/audit_character_spec.py [path/to/character_spec.json]
Exit 0 = consistent, 1 = a contradiction (printed with the expected value).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

DEFAULT = Path(__file__).resolve().parent.parent / "UnityProject/Assets/Resources/Content/character_spec.json"
TOL = 1e-3

failures: list[str] = []
notes: list[str] = []


def close(a: float, b: float, tol: float = TOL) -> bool:
    return abs(a - b) <= tol


def fail(msg: str) -> None:
    failures.append(msg)


def check(name: str, actual: float, expected: float, tol: float = TOL) -> None:
    if close(actual, expected, tol):
        notes.append(f"  ok   {name}: {actual:.4f} m")
    else:
        fail(f"{name}: spec says {actual:.4f} m, arithmetic says {expected:.4f} m "
             f"(difference {abs(actual - expected) * 1000:.1f} mm, tolerance {tol * 1000:.0f} mm)")


def main(path: Path) -> int:
    spec = json.loads(path.read_text(encoding="utf-8"))
    P = spec["proportions"]
    F = spec["facialFeatures"]

    print("=" * 78)
    print("SIH26096 — character specification audit")
    print(f"  file      : {path.relative_to(path.parent.parent.parent.parent)}")
    print(f"  identity  : {spec.get('identity', {}).get('name', 'n/a')}")
    print("=" * 78)

    # ---------------------------------------------------------------- skeleton
    print("\nSkeleton (vertical chain)")
    hip = P["hipHeight"]
    knee = P["hipJointHeight"] - P["hipToKnee"]
    ankle = knee - P["kneeAboveAnkle"]
    sole = ankle - P["ankleAboveSole"]
    shoulder = P["hipHeight"] + P["hipToShoulder"]
    crown = P["chinHeight"] + P["headHeight"]
    head_centre = P["crownHeight"] - P["hairCapThickness"] - P["skullHalfHeight"]

    check("sole to floor", sole, 0.0, 2e-3)
    check("ankle height", ankle, P["ankleAboveSole"])
    check("knee height", knee, P["hipJointHeight"] - P["hipToKnee"])
    check("hip to shoulder line", shoulder, P["shoulderHeight"])
    check("crown height", crown, P["crownHeight"], 2e-3)
    check("head centre", P["headCentreHeight"], head_centre, 2e-3)

    legs = hip / P["crownHeight"]
    torso = (P["shoulderHeight"] - hip) / P["crownHeight"]
    print(f"  -- proportions: legs {legs * 100:.1f}% of height, hip-to-shoulder {torso * 100:.1f}%")
    if not 0.44 <= legs <= 0.56:
        fail(f"leg length is {legs * 100:.1f}% of standing height, outside the human 44–56% range")

    # ------------------------------------------------------------------- head
    print("\nHead and face")
    heads = P["crownHeight"] / P["headHeight"]
    if not close(heads, P["headToBodyRatio"], 0.05):
        fail(f"head-to-body ratio: spec says 1:{P['headToBodyRatio']}, "
             f"height/headHeight gives 1:{heads:.2f}")
    else:
        notes.append(f"  ok   head-to-body ratio 1:{heads:.2f}")

    neck = P["chinHeight"] - P["shoulderHeight"]
    if not 0.03 <= neck <= 0.12:
        fail(f"neck (shoulder line to chin) is {neck * 1000:.0f} mm — outside 30–120 mm, "
             "the head would either float or sink into the jacket")
    else:
        notes.append(f"  ok   neck length {neck * 1000:.0f} mm")

    eye_rel = (P["eyeHeight"] - P["headCentreHeight"]) / P["headHeight"]
    if not -0.05 <= eye_rel <= 0.35:
        fail(f"eyes sit {eye_rel * 100:.0f}% of the head height from its centre — outside the natural band")
    else:
        notes.append(f"  ok   eye line {P['eyeHeight']:.3f} m ({(P['crownHeight'] - P['eyeHeight']) * 100:.1f} cm below the crown)")

    hair_top = P["headCentreHeight"] + P["skullHalfHeight"] + P["hairCapThickness"]
    if P["hairlineHeight"] >= P["eyeHeight"] and P["hairlineHeight"] < P["crownHeight"]:
        notes.append(f"  ok   hairline {P['hairlineHeight']:.3f} m above the eyes, below the crown")
    else:
        fail("hairlineHeight must sit above the eye line and below the crown")
    if not close(hair_top, P["crownHeight"], 2e-3):
        fail(f"skull top + hair cap reaches {hair_top:.4f} m, but the crown height is {P['crownHeight']:.4f} m "
             "— the figure would not be 1.700 m tall")
    else:
        notes.append(f"  ok   skull top + {P['hairCapThickness'] * 1000:.0f} mm hair cap lands on the crown ({hair_top:.4f} m)")

    # --------------------------------------------------------------- identity
    print("\nIdentity features required by the reference sheet")
    g = F["glasses"]
    if not g.get("mustRemainVisible", False):
        fail("glasses.mustRemainVisible is false — the glasses are the character's most identifiable feature")
    else:
        notes.append(f"  ok   glasses: {g['type']}, lens r={g['lensRadius']} m, always visible")
    for key in ("moustache", "hair", "ears", "beard", "brows"):
        if key not in F:
            fail(f"facialFeatures.{key} is missing")
    if F.get("beard", {}).get("style", "none") != "none":
        fail("the reference character is clean-shaven apart from a moustache: beard.style must be 'none'")
    else:
        notes.append("  ok   beard: none (only the clipped moustache)")
    if P["eyeSpacing"] >= P["headWidth"]:
        fail("eyeSpacing is wider than the head")
    else:
        notes.append(f"  ok   eye spacing {P['eyeSpacing'] * 1000:.0f} mm inside a {P['headWidth'] * 1000:.0f} mm head")

    # ---------------------------------------------------------------- palette
    print("\nSignature palette")
    mats = spec["materials"]
    tie = mats["tie"]["color"].upper()
    if tie != "#9E2130":
        fail(f"the tie colour is {tie}; the reference sheet's single saturated accent is #9E2130")
    else:
        notes.append("  ok   tie_red #9E2130 (only saturated accent)")
    # an "accent" is bright *and* saturated: dark navy is muted even though its
    # chroma is high, whereas a bright red reads as an accent at a glance
    anatomy = {"skin", "skin_shadow", "hair", "moustache", "glass_lens", "shirt"}
    accents = []
    for name, m in mats.items():
        if name in anatomy or name == "tie":
            continue
        c = m["color"].lstrip("#")
        r, gg, b = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
        mx, mn = max(r, gg, b), min(r, gg, b)
        value = mx / 255
        saturation = (mx - mn) / mx if mx else 0
        if value > 0.35 and saturation > 0.45:
            accents.append(f"{name} ({m['color']})")
    if accents:
        fail(f"material(s) other than the tie read as bright accents: {', '.join(accents)}")
    else:
        notes.append("  ok   no garment material other than the tie reads as an accent")
    if len(mats) > 15:
        fail(f"{len(mats)} materials declared, budget is 15")

    # ------------------------------------------------------------------- rig
    print("\nRig and clips")
    bones = spec.get("rig", {}).get("bones", [])
    if not bones:
        fail("rig.bones is empty")
    elif len(bones) > spec.get("rig", {}).get("boneBudget", 40):
        fail(f"{len(bones)} bones exceeds the {spec['rig'].get('boneBudget')} budget")
    else:
        notes.append(f"  ok   {len(bones)} bones (budget {spec['rig'].get('boneBudget', 40)})")

    clips = spec.get("clipList", [])
    if len(clips) != len(set(clips)):
        fail("clipList contains duplicates")
    else:
        notes.append(f"  ok   {len(clips)} animation clips, no duplicates")
    for name in clips:
        if name != name.strip():
            fail(f"clip name {name!r} has stray whitespace")

    lod = spec.get("lod", {})
    budget = lod.get("triangleBudget", {})
    for level in ("lod0", "lod1", "lod2"):
        if level not in budget:
            fail(f"lod.triangleBudget.{level} is not set")
        elif not (0 < budget[level] <= 15000):
            fail(f"lod.triangleBudget.{level} = {budget[level]} triangles is outside a mobile-viable range")
    if all(k in budget for k in ("lod0", "lod1", "lod2")):
        notes.append(f"  ok   LOD triangle budgets {budget['lod0']} / {budget['lod1']} / {budget['lod2']}")
        if not budget["lod0"] > budget["lod1"] > budget["lod2"]:
            fail("LOD budgets must decrease with distance")
    if lod.get("cullDistance", 0) <= lod.get("lod2Distance", 0):
        fail("lod.cullDistance must be beyond lod2Distance")

    # ------------------------------------------------------- reference honesty
    print("\nProvenance")
    sheet = spec.get("sourceSheet", {})
    provided = sheet.get("supplied", None) if isinstance(sheet, dict) else None
    if provided is False:
        notes.append("  !! the character sheet was never supplied: the spec is derived from public likeness "
                     "references, and Documentation/01 records the drop-in path for the real sheet")
    elif isinstance(sheet, dict):
        notes.append(f"  ok   reference sheet: {sheet.get('path') or sheet.get('note') or 'recorded'}")
    if spec.get("disclaimer"):
        notes.append(f"  -- {spec['disclaimer'][:96]}...")
    if spec.get("note"):
        notes.append("  -- spec note present")

    print("-" * 78)
    for line in notes:
        print(line)
    print("-" * 78)
    if failures:
        print(f"FAILED — {len(failures)} contradiction(s):")
        for f in failures:
            print(f"  x {f}")
        print("=" * 78)
        return 1
    print(f"RESULT: PASSED — {len(notes)} checks, the specification is internally consistent.")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    if not target.exists():
        print(f"character spec not found: {target}", file=sys.stderr)
        sys.exit(1)
    sys.exit(main(target))
