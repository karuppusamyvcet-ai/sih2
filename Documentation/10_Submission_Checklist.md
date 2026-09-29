# 10 — Submission checklist and deliverable map

## Deliverables (§52) → where they are

| Deliverable | Location | Status |
| --- | --- | --- |
| Functional game (Windows x64) | Built from this repository: `Builds/Windows/AmbedkarDigitalHeritage.exe` | Build path complete; artefact produced by `Tools/build.sh windows` or CI |
| Functional game (Android ARM64) | `Builds/Android/AmbedkarDigitalHeritage.apk` | As above, `Tools/build.sh android` |
| Browser build of the same game | `web/`, run with any static server | Complete and playable |
| Source code | `UnityProject/`, `web/`, `Tools/` | Complete |
| Content archive (open format) | `UnityProject/Assets/Resources/Content/*.json` (13 files) | Complete, validated |
| Technical documentation | `Documentation/01` … `Documentation/10` | Complete |
| Working executable/APK | Produced by the documented build steps | See `04_Build_and_Deployment.md` and the CI workflow |
| User manual | `Documentation/05_Features_and_Controls.md` (features, controls, requirements) | Complete |
| Architecture diagram | `Documentation/02_Architecture.md` (layer diagram and module map) | Complete |
| Feature list | `Documentation/05` | Complete |
| Known limitations | `Documentation/06_Known_Limitations.md` | Complete |
| Demo/presentation flow | `Documentation/09_Demo_Presentation_Guide.md` | Complete |

## README (§73) → `README.md`

Present in the repository root, covering: what the project is, the problem statement and theme, what is
in the repository, how to run the demo in thirty seconds, how to build both deliverables, the
verification table with the actual gate results, the feature summary, the documentation index and the
team/credits section.

## Development phases (1–24) → status

| Phase | Deliverable | Status |
| --- | --- | --- |
| 1 | Content model and JSON schema | done — 13 files, validated |
| 2 | Archive dataset with citations | done — 69 records |
| 3 | Museum layout, six doors, lighting | done |
| 4 | Character specification | done — derived from public likeness references, gap documented |
| 5 | Procedural textures and materials | done — 9 generators, quality-scaled |
| 6 | Character generation and rig | done — 36 bones, A-pose bind, LOD tiers |
| 7 | Animation set | done — 25 clips as parametric poses |
| 8 | Third-person player and camera | done — obstacle avoidance, touch look |
| 9 | Interaction system and prompt | done — nine interaction kinds |
| 10 | Six galleries | done — rooms, exhibits and lighting from JSON |
| 11 | Memorial reconstructions | done — eight scenes from `sceneStyle`/`sceneParams` |
| 12 | Archive search, filter, viewer | done |
| 13 | Audio-visual exhibit system | done — six media kinds, procedural audio |
| 14 | Quiz system, five types | done — with explanations and citations |
| 15 | Missions and objectives | done — eight missions, counted objectives |
| 16 | Achievements and certificate | done — 16 achievements, eight dashboard fields |
| 17 | Archive Guide (RAG + citations) | done — local retrieval only, honesty flags enforced |
| 18 | Save system and corrupt-save handling | done |
| 19 | Settings, accessibility, localization | done — seven locales, English complete |
| 20 | Minimap, collectibles, progress | done |
| 21 | Intro cinematic and menus | done — skippable intro, demo and presentation modes |
| 22 | Windows build configuration | settings and build script done; artefact via Unity |
| 23 | Android build configuration | settings and build script done; artefact via Unity |
| 24 | Documentation and submission packaging | done |

## Before you submit

- [ ] Replace the team, institution, mentor and department names in the in-game **CREDITS** screen and
      in the README's team section. They are written as clearly-editable values, not as hidden text.
- [ ] Dismiss the character-sheet warning honestly: either supply the sheet and re-measure
      `character_spec.json`, or keep the documented statement that the specification is derived from
      public likeness references.
- [ ] Run `Tools/build.sh check` and keep the output with the submission — every gate must print
      PASSED.
- [ ] Run the Unity builds once on a machine with the editor and the two modules, and attach the
      `.exe` and `.apk`, or attach the green CI run that produced them.
- [ ] Launch with the network off and confirm the Guide answers and is labelled *Offline Archive Guide*.
- [ ] Walk all six doors and confirm no seventh exists.
- [ ] Open **DEMO MODE** on the presentation machine a day before, and rehearse the eight-minute script
      in `Documentation/09`.
- [ ] Check the Android build on the actual phone: landscape lock, back button, safe area, touch look.

## Evidence that travels with the repository

| Claim | Where it is proven |
| --- | --- |
| The content is internally consistent and cited | `Tools/validate_content.py` — PASSED |
| The character matches its specification | `Tools/audit_character_spec.py` — 20 checks PASSED |
| The Unity code names only things that exist | `Tools/check_csharp.py` — PASSED (ids, clips, schema) |
| The browser build is structurally sound | `web/tools/validate_build.js` — PASSED |
| The game rules hold under test | `web/tools/run_tests.sh` — 29 + 46 + 30 passing |
| The real game boots and plays | `web/tools/run_boot_test.sh` — 70 passing |
| The museum has exactly six doors | the two content gates above, on every run |
