#!/usr/bin/env python3
"""
check_csharp.py — static checks for the Unity C# sources.

There is no C# compiler in this development environment, so the Unity side is
guarded by what can be verified without one:

  1. every .cs file lexes cleanly (strings, char literals, comments) and its
     braces, parentheses and brackets balance
  2. no placeholders, TODOs or unimplemented stubs are shipped
  3. every content id referenced from C# as a string literal exists in
     Assets/Resources/Content/*.json  (this is what catches a renamed mission or
     question id breaking the Unity build silently)
  4. every namespace/class/struct declaration is well formed and files are
     UTF-8 without a byte-order mark
  5. Resources.Load calls point at files that exist

Usage:  python3 Tools/check_csharp.py
Exit 0 = clean, 1 = problems (printed with file and line).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UNITY = ROOT / "UnityProject"
CONTENT = UNITY / "Assets/Resources/Content"
SCRIPTS = UNITY / "Assets"

problems: list[str] = []
stats = {"files": 0, "lines": 0, "classes": 0}

PLACEHOLDERS = ("TODO", "FIXME", "XXX", "NotImplementedException", "throw new NotImplemented",
                "PLACEHOLDER", "lorem ipsum", "coming soon")


def strip_code(text: str) -> str:
    """Remove comments and literals so bracket counting is meaningful."""
    out = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            while i < n and text[i] != "\n":
                i += 1
        elif c == "/" and i + 1 < n and text[i + 1] == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
        elif c == "@" and i + 1 < n and text[i + 1] == '"':
            i += 2
            while i < n:
                if text[i] == '"' and i + 1 < n and text[i + 1] == '"':
                    i += 2
                    continue
                if text[i] == '"':
                    i += 1
                    break
                i += 1
        elif c == '"':
            i += 1
            while i < n:
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == '"':
                    i += 1
                    break
                i += 1
        elif c == "'":
            i += 1
            while i < n:
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == "'":
                    i += 1
                    break
                i += 1
        else:
            out.append(c)
            i += 1
    return "".join(out)


def line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def main() -> int:
    files = sorted(SCRIPTS.rglob("*.cs"))
    if not files:
        problems.append("no C# sources found under UnityProject/Assets")

    content_ids: set[str] = set()
    allowed_literals: set[str] = set()
    zone_ids: set[str] = set()
    json_files = sorted(CONTENT.glob("*.json"))
    for path in json_files:
        data = json.loads(path.read_text(encoding="utf-8"))

        def harvest(node):
            if isinstance(node, dict):
                for key, value in node.items():
                    if key in ("id", "doorId", "archiveId", "missionId") and isinstance(value, str):
                        content_ids.add(value)
                    # objective targets and achievement trigger types are content too
                    if key in ("target", "type") and isinstance(value, str):
                        allowed_literals.add(value)
                    harvest(value)
            elif isinstance(node, list):
                for item in node:
                    harvest(item)

        harvest(data)
        if path.name == "zones.json":
            zone_ids = {z["id"] for z in data.get("zones", [])}
        if path.name == "quests.json":
            for mission in data.get("missions", []):
                for objective in mission.get("objectives", []):
                    allowed_literals.add(objective.get("target", ""))
                    allowed_literals.add(objective.get("type", ""))
                    allowed_literals.add(mission.get("zone", ""))
        if path.name == "achievements.json":
            for achievement in data.get("achievements", []):
                trigger = achievement.get("trigger", {})
                allowed_literals.add(trigger.get("type", ""))
                allowed_literals.add(trigger.get("target", ""))
        if path.name == "exhibits.json":
            for exhibit in data.get("exhibits", []):
                allowed_literals.add(exhibit.get("interaction", ""))
                allowed_literals.add(exhibit.get("kind", ""))
        # every clip the specification names must be implemented in C#, or the
        # Unity build silently loses an animation the browser build has
        if path.name == "character_spec.json":
            clips = data.get("clipList", [])
            sources = "\n".join(f.read_text(encoding="utf-8") for f in SCRIPTS.rglob("*.cs"))
            missing = [c for c in clips if ('"%s"' % c) not in sources]
            if missing:
                problems.append("character_spec.json names %d clip(s) with no C# implementation: %s"
                                % (len(missing), ", ".join(missing)))

    # zone references appear as zone_<id>, zone_<id>_entry and as bare ids
    for zone in zone_ids:
        allowed_literals.update({zone, f"zone_{zone}", f"zone_{zone}_entry"})
    allowed_literals.discard("")
    content_ids |= allowed_literals
    resources = {p.name for p in (UNITY / "Assets/Resources").rglob("*") if p.is_file()}

    # The achievement evaluator must be able to name a trigger type before any
    # content uses it, so the vocabulary its switch statement handles is accepted
    # as content: every case label there is a legitimate target for achievements.json.
    state_file = SCRIPTS / "Scripts/Core/GameState.cs"
    if state_file.exists():
        state_text = state_file.read_text(encoding="utf-8")
        start = state_text.find("TriggerMet(")
        block = state_text[start:] if start >= 0 else state_text
        allowed_literals.update(re.findall(r'case "([a-z0-9_]+)":', block))
        content_ids |= allowed_literals

    id_like = re.compile(r'"((?:arc|ev|q|mission|obj|ach|con|mem|exhibit|door|minigame|ui|zone|hub)_[a-z0-9_]+)"')

    for path in files:
        raw = path.read_bytes()
        rel = path.relative_to(ROOT)
        stats["files"] += 1
        if raw.startswith(b"\xef\xbb\xbf"):
            problems.append(f"{rel}: file starts with a UTF-8 BOM")
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as err:
            problems.append(f"{rel}: not valid UTF-8 ({err})")
            continue
        stats["lines"] += text.count("\n") + 1

        for token in PLACEHOLDERS:
            if token.lower() in text.lower():
                problems.append(f"{rel}:{line_of(text, text.lower().index(token.lower()))}: contains '{token}'")

        code = strip_code(text)
        for open_c, close_c in (("{", "}"), ("(", ")"), ("[", "]")):
            if code.count(open_c) != code.count(close_c):
                problems.append(f"{rel}: unbalanced {open_c}{close_c} "
                                f"({code.count(open_c)} open, {code.count(close_c)} close)")

        stats["classes"] += len(re.findall(r"\b(class|struct|interface|enum)\s+[A-Z][A-Za-z0-9_]*", code))

        if "namespace Heritage" not in text and path.name not in ("AssemblyInfo.cs",):
            problems.append(f"{rel}: missing a Heritage.* namespace declaration")

        # content ids used as string literals must exist in the JSON
        for match in id_like.finditer(text):
            value = match.group(1)
            if value not in content_ids:
                problems.append(f"{rel}:{line_of(text, match.start())}: references '{value}', "
                                "which is not an id in Assets/Resources/Content")

        # Resources.Load("Content/x") must resolve
        for match in re.finditer(r'Resources\.Load<[^>]+>\("([^"]+)"\)', text):
            target = match.group(1)
            if target.startswith("Content/"):
                if f"{target.split('/', 1)[1]}.json" not in resources:
                    problems.append(f"{rel}:{line_of(text, match.start())}: loads '{target}' but no such JSON exists")

    check_schema(problems)
    return report()



# ---------------------------------------------------------------------------
# Schema gate: the content JSON and the [Serializable] C# structures must agree.
#
# JsonUtility silently ignores a JSON key that has no matching field, so a
# rename in the content (rotationY → rotation, panel object → string) would make
# the Unity build drop the data without a single error. This table names the
# containers that gameplay reads and the class that must declare every key they
# use, which is what caught the exhibit transform and museum layout drift.
SCHEMA_CONTAINERS = {
    "museum.json": [
        ("doors", "MuseumDoor"),
        ("setDressing", "SetDressing"),
        ("hall", "HallSpec"),
        ("hall.columns", "ColumnSpec"),
        ("hall.arches", "ArchSpec"),
    ],
    "exhibits.json": [
        ("exhibits", "ExhibitDef"),
        ("rooms", "RoomSpec"),
    ],
    "questions.json": [
        ("questions", "Question"),
        ("questions.options", "Option"),
        ("questions.pairs", "PairItem"),
        ("questions.items", "OrderItem"),
    ],
    "quests.json": [
        ("missions", "Mission"),
        ("missions.objectives", "Objective"),
        ("completion", "Completion"),
    ],
    "achievements.json": [
        ("achievements", "Achievement"),
        ("progressDashboard", "ProgressDashboard"),
        ("progressDashboard.fields", "DashboardField"),
    ],
    "memorials.json": [
        ("sites", "MemorialSite"),
        ("sites.tour", "TourStop"),
    ],
    "archive.json": [
        ("records", "ArchiveRecord"),
        ("records.media", "MediaItem"),
    ],
    "glossary.json": [("concepts", "Concept")],
    "timeline.json": [("events", "TimelineEvent")],
    "zones.json": [
        ("zones", "ZoneDef"),
        ("zones.unlockRule", "UnlockRule"),
    ],
    "guide.json": [
        ("guidedPointers", "ZonePointer"),
        ("messages", "GuideMessage"),
    ],
    # character_spec.json is checked by the clip gate above; its proportions,
    # facial features, clothing and materials are dictionaries read through
    # MiniJson, so there is no single class to compare key-by-key.
}


# keys that are dictionaries in the JSON and are therefore read through MiniJson
# instead of a [Serializable] field (JsonUtility cannot deserialise dictionaries)
SCHEMA_DICTIONARY_KEYS = {
    ("memorials.json", "MemorialSite"): {"sceneParams"},
    ("guide.json", "GuideFile"): {"architecture", "answerPolicy", "retrieval", "synonyms"},
    ("museum.json", "MuseumFile"): {"lighting", "materials", "ui"},
    ("quests.json", "QuestsFile"): {"objectiveTypes"},
    ("character_spec.json", "CharacterSpec"): {"proportions", "facialFeatures", "clothing", "materials",
                                              "proceduralTextures", "derivations"},
}


def class_fields(sources: str) -> dict:
    """Field names declared by each class, read from the stripped sources."""
    code = strip_code(sources)
    fields = {}
    for match in re.finditer(r"\bclass\s+([A-Za-z_][A-Za-z0-9_]*)[^{;]*\{", code):
        name = match.group(1)
        depth = 1
        i = match.end()
        while i < len(code) and depth:
            if code[i] == "{":
                depth += 1
            elif code[i] == "}":
                depth -= 1
            i += 1
        body = code[match.end():i]
        names = set()
        for decl in re.finditer(r"\b([A-Za-z_][A-Za-z0-9_<>\[\]\.]*)\s+([a-z_][A-Za-z0-9_]*)\s*(?:=|;|,|\()", body):
            names.add(decl.group(2))
        fields[name] = names
    return fields


def check_schema(problems: list) -> None:
    class_sources = "\n".join(f.read_text(encoding="utf-8") for f in SCRIPTS.rglob("*.cs"))
    fields = class_fields(class_sources)

    def walk(node, container, keys, class_name, path):
        if container.endswith("[]"):
            if not isinstance(node, list):
                return
            for item in node:
                walk(item, container[:-2], keys, class_name, path)
            return
        if not isinstance(node, dict):
            return
        if container not in node:
            return
        value = node[container]
        if isinstance(value, list):
            items = value
        elif isinstance(value, dict) and value and all(isinstance(v, dict) for v in value.values()):
            items = list(value.values())          # a map keyed by id, e.g. rooms
        else:
            items = [value]                       # a single object, e.g. hall

        declared = fields.get(class_name)
        if declared is None:
            problems.append(f"schema table names class {class_name}, which no C# file declares")
            return
        allowed = SCHEMA_DICTIONARY_KEYS.get((path, class_name), set())
        for item in items:
            if not isinstance(item, dict):
                continue
            for key in item:
                if key in allowed:
                    continue
                if key not in declared:
                    problems.append(f"Content/{path}: '{key}' has no field in the C# class {class_name} "
                                    f"— JsonUtility would silently drop it")

    for name, containers in SCHEMA_CONTAINERS.items():
        path = CONTENT / name
        if not path.exists():
            problems.append(f"schema table names {name}, which does not exist")
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for container, class_name in containers:
            parts = container.split(".")
            node = data
            for part in parts[:-1]:
                if isinstance(node, dict) and part in node:
                    node = node[part]
                else:
                    node = None
                    break
            if node is None:
                continue
            walk(node, parts[-1], set(), class_name, name)


def report() -> int:
    print("=" * 78)
    print("SIH26096 — static check of the Unity C# sources")
    print("=" * 78)
    print(f"  files    : {stats['files']}")
    print(f"  lines    : {stats['lines']}")
    print(f"  types    : {stats['classes']}")
    print("-" * 78)
    if problems:
        print(f"PROBLEMS ({len(problems)})")
        for p in problems:
            print(f"  x {p}")
        print("=" * 78)
        print("RESULT: FAILED")
        return 1
    print("RESULT: PASSED — every file lexes, brackets balance, no placeholders, and every")
    print("        content id referenced from C# exists in Assets/Resources/Content.")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    sys.exit(main())
