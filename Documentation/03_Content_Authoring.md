# 03 — Content authoring

Every kind of content in this project is a JSON edit. No gameplay code changes are needed to add an
archive record, a question, an exhibit, a mission, an achievement, a glossary term, a memorial scene or
a language.

The rule that keeps this true: **if a number or a sentence appears in the game, it belongs in
`UnityProject/Assets/Resources/Content/`.** If you find yourself editing a `.cs` or `.js` file to add
content, that is a bug in the architecture, not a shortcut.

After any content edit:

```bash
python3 Tools/validate_content.py                 # must print PASSED
cp UnityProject/Assets/Resources/Content/*.json web/content/     # mirror for the browser build
bash web/tools/run_tests.sh                       # gameplay logic still agrees with the data
```

---

## 1. Adding an archive record

File: `archive.json` → `records[]`.

```json
{
  "id": "arc_example_1935",
  "title": "Short, factual title",
  "category": "manuscript",
  "description": "Two to five sentences of vetted, neutral historical description.",
  "date": "1935-04-14",
  "location": "Place name, City, Country",
  "author": "Author or institution",
  "source": "Book, journal, archive or museum with enough detail to be looked up",
  "keywords": ["keyword one", "keyword two"],
  "zone": "manuscripts",
  "media": [
    { "kind": "image", "caption": "What the picture shows",
      "isReconstruction": true,
      "reconstructionNote": "Digital Reconstruction — generated illustration, not an authentic photograph." }
  ],
  "relatedRecords": ["arc_other_id"]
}
```

Rules the validator enforces:

* `id` is unique and matches the prefix for its kind (`arc_` for archive records)
* `source` is non-empty — an uncited record fails the build
* `category` is one of the categories in `archive.json → categories`
* `zone` is one of the six gallery ids in `zones.json`
* every id in `relatedRecords` exists
* if a media item is generated, it carries `isReconstruction: true` and a `reconstructionNote`

Never invent an event, a quotation, a date or a manuscript. If a document is reconstructed for
illustration, label it as a reconstruction in the record; the record text and the label both matter.

**Workflow for a new item**: write the record, cite the source you actually read, set
`isReconstruction` honestly, add it to the gallery that owns the topic, then run the validator. If the
source is not in hand, the record does not go in.

---

## 2. Adding a quiz question

File: `questions.json` → `questions[]`. Five types are supported, all answered and graded by the same
engine:

| `type` | Fields | Grading |
| --- | --- | --- |
| `multiple_choice` | `options[]`, `answerId` | exact option |
| `true_false` | `answerId` = `"true"`/`"false"` | exact |
| `ordering` | `items[]` in the **correct** order is authored; player reorders | longest correct ordered run in proportion |
| `matching` | `pairs[]` = `{leftId, rightId}` | proportion of correct pairs |
| `image_identification` | `imagePrompt`, `options[]`, `answerId` | exact option |

Every item must also carry:

```json
{
  "id": "q_example_01",
  "type": "multiple_choice",
  "zone": "law_constitution",
  "prompt": "The question as the player reads it.",
  "difficulty": "medium",
  "points": 10,
  "explanation": "Why the answer is right, and the context that makes it worth knowing.",
  "source": "The reference that justifies the question.",
  "archiveIds": ["arc_the_record_it_comes_from"]
}
```

The validator fails an item with no `explanation` or no `source`, or whose `answerId` is not one of its
options. The engine returns the explanation and the citation with every answer, right or wrong — the
player is never simply told "wrong".

For `image_identification`, the picture is a generated diagram; the item's `explanation` or
`imagePrompt` must say so, e.g. *"Digital Reconstruction — diagram generated for this archive, not an
authentic document."*

---

## 3. Adding an exhibit

File: `exhibits.json` → `exhibits[]`.

```json
{
  "id": "exhibit_zone_shortname",
  "zone": "manuscripts",
  "kind": "vitrine",
  "label": "Label shown above the exhibit",
  "interaction": "examine",
  "position": [0, 0, -6],
  "rotation": [0, 0, 0],
  "scale": [1, 1, 1],
  "prompt": "One line the interaction prompt shows.",
  "archiveIds": ["arc_example_1935"],
  "quizIds": ["q_example_01"],
  "parameters": { "openable": true }
}
```

* `zone` must be `hub` or one of the six galleries.
* `kind` selects the geometry: `vitrine`, `shelf`, `bookshelf`, `document_table`, `kiosk`, `plinth`,
  `panel`, `audiovisual`, `media_wall`, `rights_wall`, `achievement_wall`, `wall`, `timeline_wall`,
  `map_table`, `monument`, `stupa`, `colonnade`, `lakefront`, `garden_memorial`. Unknown kinds are
  reported loudly by both builders rather than skipped silently — if you add a kind, add its builder in
  `Props.cs` and `web/src/world/props.js` (a three-line change each) or reuse an existing one.
* `interaction` is one of the nine kinds the player experiences: `press`, `read`, `examine`, `sit`,
  `book`, `notes`, `listen`, `search`, `ask`.
* `archiveIds`, `quizIds`, `memorialId` and `parameters.timelineId` are validated.

Room shells live in `exhibits.json → rooms`: `size`, `ceilingHeight`, `style`, `palette`, `spawn`. To
re-arrange a gallery, edit the exhibit positions only.

---

## 4. Adding a mission or an achievement

`quests.json → missions[]`:

```json
{
  "id": "mission_09_optional",
  "order": 9,
  "title": "Mission title",
  "briefing": "What the player is asked to do, in the curator's voice.",
  "zone": "legacy",
  "objectives": [
    { "id": "obj_09_reach", "type": "reach", "target": "legacy_exhibit_area",
      "count": 1, "label": "Walk to the Legacy gallery" },
    { "id": "obj_09_quiz", "type": "quiz", "target": "q_legacy_01", "count": 3,
      "label": "Answer three legacy questions", "minAccuracy": 0.6 }
  ],
  "reward": { "xp": 200, "knowledgePoints": 40 },
  "next": "mission_10_optional"
}
```

* `type` is `reach`, `interact`, `collect`, `quiz`, `search`, `ask_guide`, `minigame` or `final`.
* No objective can be unfinishable: anything with a `count` completes automatically when the counter
  fills, in both implementations.
* A `quiz` objective whose `target` names one question expands to that question's group — set `count`
  accordingly.
* Completion of the whole game is declared once, in `quests.json → completion`: badge id
  `heritage_archivist`, the list of required missions, and the minimum quiz accuracy (0.6). The
  dashboard fields shown on the certificate are the eight in `progressDashboard.fields`.

`achievements.json → achievements[]` items carry a `trigger`:

```json
{ "id": "ach_example", "title": "Achievement name", "description": "How it is earned.",
  "icon": "book", "xp": 50,
  "trigger": { "type": "source_opened", "count": 5 } }
```

Trigger types: `mission_complete`, `completion`, `collect`, `interact`, `ask_guide`, `search`,
`source_opened`, `quiz_perfect`, `memorial`, `zone_entered`. Achievement ids keep the `ach_` prefix;
the quiz-perfect counter counts sessions.

---

## 5. Adding or moving anything in the museum

`museum.json` holds the hall (`width`, `depth`, `height`), the spawn point, the six doors, the set
dressing, the lighting and the named materials.

```json
{ "doorId": "door_04", "index": 4, "label": "Books, Manuscripts & Scholarship",
  "zone": "manuscripts", "position": [-3, 0, 15], "size": [3.4, 4.8],
  "accentColor": "#7A5C3E", "icon": "book" }
```

* Exactly six doors, indices 1–6, each with a `label` shown above it in world space.
  `doorCountRule` in the same file states the rule; the validator enforces it.
* `setDressing[]` places furniture by `kind` (`reception_desk`, `terminal`, `monument`,
  `timeline_wall`, `screen`, `glass_case`, `bookshelf`, `cabinet`, `stele`, `planter`, `bench`,
  `label_rail`) with `position`, `rotation` and `scale`. Unknown kinds are reported loudly.
* `spotGroups[]` and `ambientIntensity` control the lighting budget.

### Memorial reconstructions

`memorials.json` holds the eight sites. Each has real coordinates (validated as inside India),
`sceneStyle` + `sceneParams` that select and parameterise a generated scene, a `palette`, a
`narration` script and three `tour` waypoints.

```json
{ "id": "deekshabhoomi", "name": "Deekshabhoomi", "city": "Nagpur", "state": "Maharashtra",
  "coordinates": { "latitude": 21.1322, "longitude": 79.0553 },
  "sceneStyle": "stupa_complex", "sceneParams": { "domeRadius": 9, "gateCount": 8 },
  "reconstructionLabel": "Digital Reconstruction — not a photograph of the site.",
  "archiveId": "arc_mem_deekshabhoomi", "tour": [ { "id": "arrival", "label": "...", "position": [0,0,10] } ] }
```

`sceneStyle` selects the builder: `garden_memorial`, `house_library`, `plaza_memorial`,
`stupa_complex`, `colonial_house_memorial`, `colonnade_park`, `lakefront_monument`,
`institution_atrium`. Every scene carries its reconstruction label in world space.

---

## 6. Adding a language

File: `localization.json`.

```json
{ "id": "ta", "name": "தமிழ்", "englishName": "Tamil",
  "status": "in_progress", "translator": "", "coverage": 0.08,
  "strings": { "menu.new_journey": "…" } }
```

* The default locale (`meta.defaultLocale`, currently `en`) must be complete; the validator fails
  otherwise.
* Missing keys fall back locale → English → the key itself, so an unfinished language never shows a
  blank label.
* Only interface strings are localized. Archival text — record descriptions, briefings, question
  prompts — is not machine-translated; it stays in the source language until a named translator
  supplies it. The `translator` field exists so a submission can state who did the work.
* Planned locales: Tamil, Hindi, Telugu, Malayalam, Kannada, Marathi.

---

## 7. Editing the Archive Guide

`guide.json` controls the retrieval engine's behaviour: index fields and weights, `topK`, `minScore`,
`lowConfidenceAt`, `maxSentences`, the synonym table, the suggested questions and the zone pointers.
Weights and thresholds are data — tune them without touching `ContentDatabase.cs` or `content.js`, then
re-run `web/tools/test_content.js`, which holds the ranking regression anchors in place.

The `answerPolicy` flags are the honesty contract of this project. Do not turn them off:
`useOnlyRetrievedPassages`, `alwaysCiteSources`, `refuseWhenUnsure`, `labelOfflineMode`.

---

## 8. Changing the character

`character_spec.json` is the master: 1.700 m tall, 7.20 head-heights, and the derived segment lengths
(`hipJointHeight`, `hipToKnee`, `kneeAboveAnkle`, `ankleAboveSole`, `hipToShoulder`) that both
builders use for the rig.

* Change the numbers in the spec, never in the builders.
* If the builder needs a length that is not in the spec, **add the field to the spec** and mirror it to
  `web/content/`. Inventing a field inside a builder is how the two builds drift apart.
* Run `python3 Tools/audit_character_spec.py` (20 consistency checks) and
  `bash web/tools/run_tests.sh` (bone positions, glasses, tie colour, anatomy).
* The supplied character sheet is the single visual authority. If the sheet itself is replaced, drop it
  at `UnityProject/Assets/Art/Characters/Reference/ambedkar_character_sheet.png`, set
  `sourceSheet.supplied` to `true`, and re-measure the spec against it.
