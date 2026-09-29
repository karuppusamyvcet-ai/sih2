#!/usr/bin/env python3
"""Content validation for the SIH26096 Digital Heritage Archive platform.

Checks the single source of truth used by both the Unity project and the WebGL
build:  UnityProject/Assets/Resources/Content/*.json

Rules enforced
  1. Every file parses as JSON and declares the expected schema id.
  2. All record ids are unique across the whole content set.
  3. Every archive record carries a non-empty `source` (institutional rule: no
     uncited content) and a reviewStatus.
  4. Every cross-reference resolves: related[], archiveIds[], archiveRefs[],
     timelineRefs[], conceptIds[], quizIds[], memorialIds[], archiveId.
  5. Zone names are one of the six galleries.
  6. The museum has exactly six doors, matching zones.json exactly (no seventh).
  7. Quiz items are answerable: the answer key refers to an existing option /
     the ordering lists exactly the given items / matching pairs are complete.
  8. Every generated (isReconstruction) media item carries an explanatory note,
     so nothing generated can be mistaken for a genuine holding.
  9. Localization: every locale has a code and status; the default locale is
     complete; every declared locale is either complete or explicitly scaffolded.
 10. Timeline years are ordered and within a plausible range.

Exit code 0 = clean, 1 = failures found.  Run:  python3 Tools/validate_content.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "UnityProject" / "Assets" / "Resources" / "Content"

ZONES = {"early_life", "social_reform", "law_constitution", "manuscripts", "memorials", "legacy"}

errors: list[str] = []
warnings: list[str] = []


def fail(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def load(name: str):
    path = CONTENT / name
    if not path.exists():
        fail(f"{name}: missing")
        return None
    try:
        with path.open(encoding="utf-8") as fh:
            return json.load(fh)
    except json.JSONDecodeError as exc:
        fail(f"{name}: invalid JSON at line {exc.lineno} column {exc.colno}: {exc.msg}")
        return None


def main() -> int:
    archive = load("archive.json")
    timeline = load("timeline.json")
    zones = load("zones.json")
    questions = load("questions.json")
    quests = load("quests.json")
    achievements = load("achievements.json")
    memorials = load("memorials.json")
    glossary = load("glossary.json")
    museum = load("museum.json")
    localization = load("localization.json")
    exhibits = load("exhibits.json")
    guide = load("guide.json")
    character = load("character_spec.json")

    if not all([archive, timeline, zones, questions, quests, achievements,
                memorials, glossary, museum, localization, exhibits, guide, character]):
        return report()

    # ---------------------------------------------------------------- ids
    ids: dict[str, str] = {}

    def register(kind: str, ident: str) -> None:
        if ident in ids:
            fail(f"duplicate id '{ident}' in {kind} (already defined in {ids[ident]})")
        else:
            ids[ident] = kind

    archive_ids = set()
    for rec in archive["records"]:
        for field in ("id", "title", "category", "zone", "description", "source", "reviewStatus"):
            if not rec.get(field):
                fail(f"archive '{rec.get('id', '?')}': missing required field '{field}'")
        register("archive", rec["id"])
        archive_ids.add(rec["id"])
        if rec["zone"] not in ZONES:
            fail(f"archive '{rec['id']}': unknown zone '{rec['zone']}'")
        if not rec["source"].strip():
            fail(f"archive '{rec['id']}': empty source citation")
        for media in rec.get("media", []):
            if media.get("isReconstruction") and not media.get("note"):
                fail(f"archive '{rec['id']}': reconstruction media '{media.get('label')}' has no note")
            if media.get("type") not in {"text", "image", "audio", "video", "document", "model"}:
                fail(f"archive '{rec['id']}': media type '{media.get('type')}' not one of the six exhibit types")

    timeline_ids = set()
    years = []
    for ev in timeline["events"]:
        register("timeline", ev["id"])
        timeline_ids.add(ev["id"])
        if ev["zone"] not in ZONES:
            fail(f"timeline '{ev['id']}': unknown zone '{ev['zone']}'")
        years.append(ev["year"])
        if not (1800 <= ev["year"] <= 2100):
            fail(f"timeline '{ev['id']}': implausible year {ev['year']}")
    if years != sorted(years):
        fail("timeline: events are not in chronological order")

    concept_ids = set()
    for con in glossary["concepts"]:
        register("glossary", con["id"])
        concept_ids.add(con["id"])
        if not con.get("source"):
            fail(f"glossary '{con['id']}': missing source")
        if con["zone"] not in ZONES:
            fail(f"glossary '{con['id']}': unknown zone '{con['zone']}'")

    quiz_ids = set()
    for q in questions["questions"]:
        register("question", q["id"])
        quiz_ids.add(q["id"])
        if q["zone"] not in ZONES:
            fail(f"question '{q['id']}': unknown zone '{q['zone']}'")
        if not q.get("explanation"):
            fail(f"question '{q['id']}': no explanation (the engine must teach, not just mark)")
        if not q.get("source"):
            fail(f"question '{q['id']}': no source citation")
        qtype = q["type"]
        if qtype == "multiple_choice":
            opt_ids = {o["id"] for o in q.get("options", [])}
            if len(opt_ids) < 2:
                fail(f"question '{q['id']}': fewer than two options")
            if q.get("answerId") not in opt_ids:
                fail(f"question '{q['id']}': answerId '{q.get('answerId')}' is not one of the options")
        elif qtype == "true_false":
            if not isinstance(q.get("answerBool"), bool):
                fail(f"question '{q['id']}': true_false without boolean answerBool")
        elif qtype == "ordering":
            item_ids = [i["id"] for i in q.get("items", [])]
            if sorted(item_ids) != sorted(q.get("correctOrder", [])):
                fail(f"question '{q['id']}': correctOrder does not list exactly the given items")
        elif qtype == "matching":
            pairs = q.get("pairs", [])
            if len(pairs) < 3:
                fail(f"question '{q['id']}': matching needs at least three pairs")
            lefts = [p["left"] for p in pairs]
            rights = [p["right"] for p in pairs]
            if len(set(lefts)) != len(lefts) or len(set(rights)) != len(rights):
                fail(f"question '{q['id']}': matching pairs are not unambiguous (duplicate left/right values)")
        elif qtype == "image_identification":
            if not q.get("imageRef") or not q.get("answerId"):
                fail(f"question '{q['id']}': image_identification needs imageRef and answerId")
        else:
            fail(f"question '{q['id']}': unknown type '{qtype}'")

    mission_ids = set()
    for m in quests["missions"]:
        register("mission", m["id"])
        mission_ids.add(m["id"])
        if not m.get("objectives"):
            fail(f"mission '{m['id']}': no objectives")
        for obj in m["objectives"]:
            register("objective", obj["id"])
            if obj["type"] not in quests["objectiveTypes"]:
                fail(f"objective '{obj['id']}': unknown type '{obj['type']}'")

    for a in achievements["achievements"]:
        register("achievement", a["id"])
        if not a.get("description"):
            fail(f"achievement '{a['id']}': no description")

    memorial_ids = set()
    for site in memorials["sites"]:
        register("memorial", site["id"])
        memorial_ids.add(site["id"])
        lat, lon = site["coordinates"]
        if not (6.0 <= lat <= 38.0 and 68.0 <= lon <= 98.0):
            fail(f"memorial '{site['id']}': coordinates outside India ({lat}, {lon})")
        if not site.get("tour"):
            fail(f"memorial '{site['id']}': no guided tour waypoints")
        if site["archiveId"] not in archive_ids:
            fail(f"memorial '{site['id']}': archiveId '{site['archiveId']}' not in archive")

    # ------------------------------------------------------- zone / doors
    zone_ids = {z["id"] for z in zones["zones"]}
    if zone_ids != ZONES:
        fail(f"zones.json: zones {sorted(zone_ids)} do not match the six galleries {sorted(ZONES)}")

    doors = museum["doors"]
    if len(doors) != 6:
        fail(f"museum.json: {len(doors)} doors found — exactly six are required")
    if sorted(d["index"] for d in doors) != [1, 2, 3, 4, 5, 6]:
        fail("museum.json: door indexes must be 1..6 with no gaps")
    door_zones = {d["zone"] for d in doors}
    if door_zones != ZONES:
        fail(f"museum.json: door zones {sorted(door_zones)} do not match the six galleries")
    door_zone_by_id = {d["zone"]: d for d in doors}
    for z in zones["zones"]:
        door = door_zone_by_id.get(z["id"])
        if door is None:
            fail(f"zones.json: zone '{z['id']}' has no door in museum.json")
            continue
        if door["index"] != z["doorIndex"]:
            fail(f"zone '{z['id']}': doorIndex {z['doorIndex']} != museum door index {door['index']}")

    # ------------------------------------------------------------ exhibits
    kinds = {"timeline_wall", "guide_terminal", "archive_kiosk", "projection_screen", "display_case",
             "document_table", "panel", "audio_pillar", "quiz_kiosk", "reconstruction_diorama",
             "reading_table", "paired_extract", "minigame_station", "constitution_table",
             "comparison_panel", "article_wall", "book_shelf", "magnifier_station", "scanning_station",
             "reading_desk", "map_table", "search_terminal", "ai_terminal", "media_wall",
             "achievement_wall", "digital_timeline", "final_challenge_dais"}
    exhibit_zone_rooms = set(exhibits["rooms"].keys())
    if exhibit_zone_rooms != ZONES | {"hub"}:
        fail(f"exhibits.json: rooms {sorted(exhibit_zone_rooms)} must cover the six galleries and the hub")
    for ex in exhibits["exhibits"]:
        register("exhibit", ex["id"])
        if ex["zone"] not in exhibit_zone_rooms:
            fail(f"exhibit '{ex['id']}': unknown zone '{ex['zone']}'")
        if ex["kind"] not in kinds:
            fail(f"exhibit '{ex['id']}': unknown kind '{ex['kind']}'")
        if ex["interaction"] not in exhibits["interactionKinds"]:
            fail(f"exhibit '{ex['id']}': unknown interaction '{ex['interaction']}'")
        for aid in ex.get("archiveIds", []):
            if aid not in archive_ids:
                fail(f"exhibit '{ex['id']}': archiveId '{aid}' not in archive")
        for qid in ex.get("quizIds", []):
            if qid not in quiz_ids:
                fail(f"exhibit '{ex['id']}': quizId '{qid}' not in questions")
        for cid in ex.get("conceptIds", []):
            if cid not in concept_ids:
                fail(f"exhibit '{ex['id']}': conceptId '{cid}' not in glossary")
        for mid in ex.get("memorialIds", []):
            if mid not in memorial_ids:
                fail(f"exhibit '{ex['id']}': memorialId '{mid}' not in memorials")
        for tref in ex.get("timelineRefs", []):
            if tref not in timeline_ids:
                fail(f"exhibit '{ex['id']}': timelineRef '{tref}' not in timeline")

    # --------------------------------------------------- cross references
    for rec in archive["records"]:
        for rel in rec.get("related", []):
            if rel not in archive_ids:
                fail(f"archive '{rec['id']}': related '{rel}' does not resolve")
        for tref in rec.get("timelineRefs", []):
            if tref not in timeline_ids:
                fail(f"archive '{rec['id']}': timelineRef '{tref}' does not resolve")

    for z in zones["zones"]:
        for aid in z.get("archiveIds", []):
            if aid not in archive_ids:
                fail(f"zone '{z['id']}': archiveId '{aid}' does not resolve")
        for qid in z.get("quizIds", []):
            if qid not in quiz_ids:
                fail(f"zone '{z['id']}': quizId '{qid}' does not resolve")

    for q in questions["questions"]:
        for aid in q.get("archiveRefs", []):
            if aid not in archive_ids:
                fail(f"question '{q['id']}': archiveRef '{aid}' does not resolve")
        for tref in q.get("timelineRefs", []):
            if tref not in timeline_ids:
                fail(f"question '{q['id']}': timelineRef '{tref}' does not resolve")

    for con in glossary["concepts"]:
        for aid in con.get("archiveIds", []):
            if aid not in archive_ids:
                fail(f"glossary '{con['id']}': archiveId '{aid}' does not resolve")

    for m in quests["missions"]:
        if m.get("zone") and m["zone"] not in ZONES | {"hub"}:
            fail(f"mission '{m['id']}': unknown zone '{m['zone']}'")
        rule = m.get("unlockRule", {})
        if rule.get("type") == "mission_complete" and rule.get("missionId") not in mission_ids:
            fail(f"mission '{m['id']}': unlockRule points at unknown mission '{rule.get('missionId')}'")

    for ach in achievements["achievements"]:
        trig = ach.get("trigger", {})
        target = trig.get("target")
        if trig.get("type") == "mission_complete" and target not in mission_ids:
            fail(f"achievement '{ach['id']}': trigger targets unknown mission '{target}'")

    # ------------------------------------------------------- localization
    locales = localization["locales"]
    codes = [l["code"] for l in locales]
    if localization["defaultLocale"] not in codes:
        fail("localization: defaultLocale is not among the declared locales")
    if localization["fallbackLocale"] not in codes:
        fail("localization: fallbackLocale is not among the declared locales")
    for loc in locales:
        if loc["status"] not in {"complete", "scaffolded", "planned"}:
            fail(f"localization '{loc['code']}': unknown status '{loc['status']}'")
        if loc["code"] == localization["defaultLocale"] and loc["status"] != "complete":
            fail("localization: the default locale must be marked complete")
        if loc["code"] not in localization["strings"]:
            fail(f"localization '{loc['code']}': no string table present")

    keys_en = set(localization["strings"]["en"].keys())
    for code, table in localization["strings"].items():
        missing = keys_en - set(table.keys())
        if missing:
            note = f"localization '{code}': {len(missing)} of {len(keys_en)} keys fall back to English"
            (warn if code != "en" else fail)(note)

    # ------------------------------------------------------------ guide
    policy = guide["architecture"]["answerPolicy"]
    for flag in ("alwaysCiteSources", "refuseWhenNoRetrieval", "noFabricatedQuotes",
                 "noFabricatedCitations", "labelGeneratedMedia"):
        if not policy.get(flag):
            fail(f"guide.json: answerPolicy '{flag}' must be true for an educational archive")

    # --------------------------------------------------------- character
    for item in character["identityChecklist"]:
        if not item.strip():
            fail("character_spec.json: empty identity checklist entry")
    if character["proportions"]["shoulderWidth"] / character["proportions"]["headWidth"] < 2.1:
        fail("character_spec.json: shoulder-to-head ratio no longer reads as the reference build")

    return report(len(archive["records"]), len(questions["questions"]), len(memorials["sites"]),
                  len(timeline["events"]), len(glossary["concepts"]), len(exhibits["exhibits"]))


def report(n_archive=0, n_questions=0, n_memorials=0, n_timeline=0, n_concepts=0, n_exhibits=0) -> int:
    print("=" * 74)
    print("SIH26096 — Digital Heritage Archive : content validation")
    print("=" * 74)
    print(f"  archive records      : {n_archive}")
    print(f"  timeline events      : {n_timeline}")
    print(f"  quiz questions       : {n_questions}")
    print(f"  constitutional terms : {n_concepts}")
    print(f"  exhibits placed      : {n_exhibits}")
    print(f"  memorial sites       : {n_memorials}")
    print("-" * 74)
    if warnings:
        print(f"WARNINGS ({len(warnings)})")
        for w in warnings:
            print(f"  ! {w}")
        print("-" * 74)
    if errors:
        print(f"FAILURES ({len(errors)})")
        for e in errors:
            print(f"  x {e}")
        print("=" * 74)
        print("RESULT: FAILED")
        return 1
    print("RESULT: PASSED — every reference resolves, every record is cited, "
          "six doors, six galleries, no seventh door.")
    print("=" * 74)
    return 0


if __name__ == "__main__":
    sys.exit(main())
