# 07 — Testing and validation

Every gate below exits non-zero when it fails, and all of them run in CI on each push. Nothing in this
project is asserted in prose that is not also checked by a script.

```bash
python3 Tools/validate_content.py          # the archive and the museum rules
python3 Tools/audit_character_spec.py      # the character's numbers
python3 Tools/check_csharp.py              # the Unity sources
node    web/tools/validate_build.js        # the browser build's structure
bash    web/tools/run_tests.sh             # browser runtime suites (needs node)
bash    web/tools/run_boot_test.sh         # boots the real main.js in jsdom (needs jsdom)
Tools/build.sh check                       # all of the above in one step
```

## 1. `Tools/validate_content.py` — the content archive

Proves, over the thirteen JSON files that both builds read:

* every id is unique inside its file and inside the id spaces that reference each other
* every `archiveIds`, `quizIds`, `conceptRefs`, `timelineIds`, `memorialId`, `exhibitIds` and
  `related` reference resolves to something that exists
* every archive record, glossary entry, memorial and quiz item carries a non-empty `source`
* `zones.json` declares exactly six galleries and `museum.json` exactly six doors, whose index and
  zone match — there is no seventh door
* every quiz item is answerable (a valid answer key, an explanation and a citation)
* every generated media item is flagged and annotated as a reconstruction
* memorial coordinates fall inside India, and each site has a guided tour and an archive record
* localization: the default locale is complete; other locales declare status, coverage and translator
* the Archive Guide's honesty flags are on (`useOnlyRetrievedPassages`, `alwaysCiteSources`,
  `refuseWhenUnsure`, `labelOfflineMode`)

Current result: **PASSED** — 69 records, 38 timeline events, 42 questions, 48 exhibits, 8 memorials,
6 galleries, 6 doors.

## 2. `Tools/audit_character_spec.py` — the character

Twenty internal-consistency checks over `character_spec.json`: the crown, hairline, eye line, chin and
shoulder heights agree with the segment lengths; the sole sits on the floor; the head is 7.20
head-heights; the collar sits below the chin; the shoulder span matches the stated width; the red tie is
the only saturated colour in the palette; the clip list covers the required behaviours. It warns when
`sourceSheet.supplied` is `false`, which is the honest state of this project.

Current result: **PASSED — 20 checks.**

## 3. `Tools/check_csharp.py` — the Unity sources

A lexer (comments, verbatim strings and character literals are handled properly, so a `{` inside a
string cannot fool it) plus five rules:

| Rule | Why it exists |
| --- | --- |
| Brackets balance and files are UTF-8 without a BOM | a truncated paste is caught before the editor is opened |
| No placeholder tokens (`TODO`, `FIXME`, `NotImplementedException`, …) | the brief forbids shipping them |
| Every file declares a `Heritage.*` namespace | keeps the assembly definitions meaningful |
| Every content id used as a string literal exists in the content | a renamed mission or exhibit fails the build here |
| Every clip in `character_spec.json` has a C# implementation | a build cannot silently lose an animation |
| Every key in the mapped content containers has a field in its `[Serializable]` class | `JsonUtility` drops unknown keys without an error — this rule found real drift (exhibit rotations, sizes, panels, mini-game bindings and the museum's lighting layout were being ignored) |

Current result: **PASSED** — 21 files, ~5 700 lines, 79 types.

## 4. `web/tools/validate_build.js` — the browser build

Walks `web/src`: every module parses, every `import` resolves, every DOM id the code queries exists in
`index.html`, every `data-i18n` key and every `t()` call has a translation, every clip in the
specification is implemented in `char/animator.js`, and the museum still declares exactly six doors.

Current result: **PASSED.**

## 5. `web/tools/run_tests.sh` — the browser runtime

Builds a throwaway tree in `/tmp` that maps the bare `three` specifier to the vendored
`web/vendor/three.module.js` — the exact file the demo ships — and runs three suites:

| Suite | Checks | Covers |
| --- | --- | --- |
| `test_character.js` | 29 | the generated figure: bones and arm chains, shoulder span 0.414 m, glasses at the eye line, moustache, `#9E2130` tie, jacket/shirt colours, LOD triangle budget, 25 clips × 60 frames with no NaN, anatomy audit |
| `test_gameplay.js` | 46 | quests and achievements through a scripted playthrough, quiz grading for all five types, objectives that must self-complete, save/load/corrupt-save recovery, settings clamping |
| `test_content.js` | 30 | the archive engine: ranking anchors, the Guide's citations and refusals, the offline label, localization fallback |

Current result: **29 + 46 + 30 passing, 0 failing.**

## 6. `web/tools/run_boot_test.sh` — the real game, booted

Installs jsdom into a temporary tree, plants a renderer stand-in in place of three.js, and then loads
the **actual** `src/main.js` with the actual `index.html`. Seventy checks drive the game the way a
player would: boot to ready, no console errors, archive larger than sixty records, every menu action,
NEW JOURNEY → intro → skip → hub, six doors, six galleries with the expected interactable counts, a
memorial scene plus an unknown-id fallback, exhibit interaction, archive search and record open, quiz
grading with its explanation, Guide answers with citations and the offline label, every modal
(minimap, objectives, settings, credits, certificate, pause), mission 1 completion, walking through a
door, a locked door left locked with a toast, the frame loop, a save round-trip, the four quality
tiers, and text scale, contrast and reduced effects.

Two genuine crashes in `main.js` were found and fixed by this harness: an unknown memorial id, and a
door interactable without a zone.

Current result: **70 passed, 0 failed.**

## 7. What is not covered here

* **Unity compile and run.** No Unity editor or .NET toolchain exists in the environment this project
  was written in, so the C# is checked statically and conservatively rather than compiled. The first
  editor session is the real integration test; the code deliberately avoids C# 10 features and
  editor-only APIs in runtime code to keep that first compile quiet.
* **Rendered output.** No headless GPU was available, so frames are not compared pixel by pixel.
* **Device behaviour.** Safe-area insets, the Android back button and touch look are implemented and
  reviewed but untested on hardware here.
* **Performance.** The budgets are design targets; the builders log what they generate so they can be
  confirmed on the target machine.

## 8. How to check a build by hand in five minutes

1. `Tools/build.sh check` — all gates.
2. Launch with the network off; the game must boot and the Guide must answer.
3. Six doors, six galleries, no seventh door.
4. Open a record, a document with page turning, one question of each type, one memorial.
5. Complete mission 1 so a save is written, quit, relaunch, and confirm **CONTINUE** resumes.
6. On Android: landscape locked, back button behaves like Esc, buttons clear of the notch.
