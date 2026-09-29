# 02 — Architecture

## The one decision everything else follows from

**Content is not code.** The archive, the timeline, the galleries, the museum layout, the exhibits,
the memorial reconstructions, the questions, the missions, the achievements, the glossary, the
localization tables and the character specification are thirteen JSON files in
`UnityProject/Assets/Resources/Content/`. Both builds read those files at runtime; the Unity editor
builders read them at build time to generate scenes and prefabs.

```
                        UnityProject/Assets/Resources/Content/*.json
                        (archive · timeline · zones · museum · exhibits · memorials ·
                         questions · quests · achievements · glossary · guide ·
                         localization · character_spec)
                                        │
              ┌─────────────────────────┴─────────────────────────┐
              │                                                   │
      UNITY BUILD (Windows / Android)                      BROWSER BUILD (web/)
              │                                                   │
  ContentDatabase.Load()                              Content.load()
  JsonUtility + MiniJson for dictionaries              fetch() of ./content/*.json
              │                                                   │
  GameState · QuestSystem · QuizSystem                State · Quests · Quiz
  ArchiveGuide · ExhibitionSystem                     Content.search/answer · Panels
  MuseumBuilder (museum, props, memorials)            World (museum, props, memorials)
  CharacterBuilder (editor) + clips                   buildCharacter + Animator
              │                                                   │
        UIManager (uGUI + TMP)                             DOM panels + HUD
```

The consequence is inspectable in one command: `python3 Tools/validate_content.py` walks every
cross-reference in that folder and fails the build if a mission names an exhibit that does not exist,
if a record has no source, or if a seventh door appears.

## Layers

### 1. Content (`Assets/Resources/Content/`)

Each file declares a schema (`heritage.<name>.v1`), a version and a `note`. The validator enforces:

* unique ids inside every file, and across the id spaces that reference each other
* every archive record, glossary entry, memorial and quiz item carries a non-empty `source`
* every `archiveIds`, `quizIds`, `conceptRefs`, `timelineIds`, `memorialId` and `exhibitIds` reference
  resolves
* `zones.json` has exactly six galleries, and `museum.json` exactly six doors whose index and zone
  match them
* every quiz item is answerable (a valid `answerId`, a non-empty `explanation`, a citation)
* every reconstruction is flagged and annotated
* localization: the default locale is complete; other locales declare their status and translator
* the Archive Guide's answer-policy flags are on (`useOnlyRetrievedPassages`, `alwaysCiteSources`,
  `refuseWhenUnsure`, `labelOfflineMode`)

### 2. Data layer

* **Unity** — `ContentDatabase.cs` loads the JSON, indexes it, and exposes typed lookups plus search
  and the Guide. Dictionary-valued fields (guide architecture, character proportions, memorial scene
  parameters, exhibit parameters) are read by `MiniJson.cs`, because `JsonUtility` silently drops
  dictionaries — a content edit must never be quietly ignored.
* **Browser** — `web/src/core/content.js` does the same in JavaScript, including the same ranking and
  the same answer policy.

### 3. Game rules

`QuestSystem`/`quests.js`, `QuizSystem`/`quiz.js`, `GameState`/`state.js` are pure logic: no scene
objects, no DOM. That is why they are covered by tests that run in Node without a browser.

Both implementations interpret the same data:

| Rule | Where it lives |
| --- | --- |
| Objective types (`reach`, `interact`, `collect`, `quiz`, `search`, `ask_guide`, `minigame`, `final`) | `quests.json` → interpreted, never hard-coded per mission |
| Anything countable completes when its counter fills | one generic check in `notify()`, so no objective type can be silently unfinishable |
| Achievement triggers | `achievements.json` → `TriggerMet` / `triggerMet` |
| Door unlocking | `zones.json → unlockRule` |
| Quiz grading, points, explanations | `questions.json`; the engine returns the explanation and citation with every answer |
| Guide coverage floor, top-K, synonym table | `guide.json → architecture.retrieval` |

### 4. Presentation

* **Unity** — `MuseumBuilder` generates the hall, the six galleries and the eight memorial scenes from
  `museum.json`, `zones.json`, `exhibits.json` and `memorials.json`; `Props.cs` builds furniture and
  memorial geometry from primitives; `ProceduralTextures.cs` generates every material; readable
  in-world text is TextMeshPro, not a rasterised font. `Assets/Editor/SceneBuilder.cs` can bake the
  same result into a saved scene, and it calls the *same* methods, so the editor view and the build
  cannot disagree.
* **Browser** — `web/src/world/*` mirrors that construction with three.js; `web/src/ui/*` binds the DOM
  panels in `index.html`.

## Runtime shape (both builds)

```
boot → load content → build renderer/scene → build character → build world → wire systems
menu ⇄ intro (skippable) ⇄ play
play: player + camera + interaction focus → exhibit dispatch → panels (archive, viewer, quiz,
      guide, map, memorials, objectives, settings, certificate, pause)
hub ⇄ six galleries ⇄ eight memorial reconstructions   (one room resident at a time)
autosave; save on every meaningful change
```

Only the hub and the current room are resident: entering a gallery disposes the previous room's
geometry and materials. That is what keeps the Android memory profile flat, and it is why the browser
build can run on an integrated GPU.

## Why the Archive Guide cannot hallucinate

The Guide is a retrieval system, not a language model, and the difference is enforced:

1. the question is tokenised, stop-worded and expanded with the synonym table in `guide.json`
2. documents are scored by presence-weighted term match (strongest field wins), a bounded
   inverse-document-frequency factor, a 1.4× bonus for terms in the record's title, and 0.22× weight
   for synonym-only matches
3. hits below `minScore` are discarded and the Guide answers *"the archive does not cover that"* with
   the topics it does cover; between `minScore` and `lowConfidenceAt` it answers with a visible
   low-confidence notice
4. the answer text is assembled from the retrieved passages only, and the records used are printed
   underneath, each with its own citation
5. an optional cloud model can be enabled by environment variable; its output is discarded unless
   every entity it names appears in the retrieved records, and it is always labelled when the answer
   comes from the local index instead

`web/tools/test_content.js` and `web/tools/test_gameplay.js` hold this behaviour in place: an
off-topic question such as a cricket score must return `noResults`, and every citation must carry a
source string.

## Performance approach

* one realtime shadow-casting light per room; the rest are shadowless fills and spots
* only one room resident; instanced book and column sets; LOD budget for the character
  (LOD0 ≈ 9 300 / LOD1 ≈ 4 300 / LOD2 ≈ 1 700 triangles) with a two-step LOD switch
* texture generation scaled by quality preset (128 / 256 / 512 px) rather than shipped at one size
* quality presets LOW/MEDIUM/HIGH on Android and LOW→ULTRA-equivalent on desktop, plus the
  accessibility "reduced effects" switch that forces the low preset
* no physics-heavy gameplay: interaction is a forward probe, not a rigidbody simulation

## Repository layout

```
UnityProject/
  Assets/Resources/Content/     13 content files (shared source of truth)
  Assets/Scripts/Core/          ContentDatabase, MiniJson, GameState
  Assets/Scripts/World/         MuseumBuilder, Props, DoorController, ProceduralTextures
  Assets/Editor/                CharacterBuilder, SceneBuilder, ProjectConfigurator, BuildScript
  Packages/manifest.json        URP, Input System, TextMeshPro, uGUI
  ProjectSettings/              created on first open; configured by ProjectConfigurator
web/
  index.html  styles/ui.css
  src/core/   content, state, input, audio
  src/world/  materials, props, builder
  src/char/   builder, animator
  src/systems/ player, quests, quiz
  src/ui/     hud, panels
  src/main.js
  vendor/three.module.js        vendored so the demo never needs a CDN
  tools/                        validation and test harnesses
Tools/                          validate_content, audit_character_spec, check_csharp, build.sh
Documentation/                  this set
```
