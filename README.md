# AMBEDKAR: THE DIGITAL HERITAGE JOURNEY

**Explore. Discover. Learn.**

Smart India Hackathon 2026 · **Problem Statement SIH26096** — *Digital Heritage Archive for
Memorials, Manuscripts & Ambedkar: AI-Powered Institutional Archive and Audio-Visual Knowledge
Platform* · Theme **Smart Education** · Organisation **Ministry of Social Justice and Empowerment**

A third-person 3D educational game in which the player walks a digital museum of Dr. B. R. Ambedkar's
life and work, reads the archive records behind every exhibit, answers knowledge checks that explain
themselves, and collects what they learn into a personal digital archive. One codebase runs on
**Windows (EXE)** and **Android (APK)**; a browser build of the same content and systems is included so
the demo can be shown on any laptop without installing anything.

---

## What is in this repository

| Path | What it is |
| --- | --- |
| `UnityProject/Assets/Resources/Content/` | **The single source of truth.** Thirteen JSON files: the archive, timeline, galleries, museum layout, exhibits, memorial reconstructions, questions, missions, achievements, glossary, Archive Guide config, localization and the character specification. Both the Unity build and the browser build read these files. |
| `UnityProject/Assets/Scripts/` | C# systems: content database, game state and saves, museum and prop generation, doors, procedural textures. |
| `UnityProject/Assets/Editor/` | Code-generated scene and character builders plus the project configurator (see `Documentation/04`). |
| `web/` | The browser build: a complete, offline, playable version of the same game (vendored three.js — no CDN, no network). |
| `Tools/` | Validation gates: content, character specification, C# sources, and the Windows/Android build driver. |
| `Documentation/` | Character technical specification, architecture, content authoring, build and deployment, features, accessibility, demo script, limitations and the submission checklist. |

Nothing in this repository is concept art or a mockup: the browser build is a running game
(`web/index.html`), and the Unity project builds the same museum from the same data.

The boot log prints the build stamp (for example `[heritage] build 2026-09-29 · char-3 · movement-2`).
If that line is missing or shows an older stamp, the browser is running a cached page — reload, or use
`web/tools/serve.py`, which sends `no-store`.

Two tools render the generated content on the CPU so it can be reviewed without a browser or a device:
`node web/tools/render_character.mjs [dir]` (front, side, three-quarter and head views) and
`node web/tools/render_museum.mjs [dir]` (the hall, a gallery and a memorial reconstruction).

---

## Run the demo in 30 seconds (no install, no internet)

```bash
python3 web/tools/serve.py 8000                 # no-cache server: a reload always runs current code
# then open http://localhost:8000/
```

Everything is served from the folder: three.js is vendored, all textures are generated at runtime, and
all content is local JSON. The page works offline once loaded, and it is the same archive the Unity
build loads.

Controls (browser and Unity): **W A S D** move · **Shift** run · **E** interact · **Tab** archive ·
**M** map · **G** Archive Guide · **Esc** pause · mouse or touch-drag to look. On Android the same
actions are on-screen buttons (INTERACT, ARCHIVE, MAP, MENU, GUIDE).

---

## Build the two deliverables

Windows x64 and Android ARM64 come from the Unity project.

```bash
Tools/build.sh            # both targets in one go
Tools/build.sh windows    # Builds/Windows/AmbedkarDigitalHeritage.exe
Tools/build.sh android    # Builds/Android/AmbedkarDigitalHeritage.apk
```

`Documentation/04_Build_and_Deployment.md` has the prerequisites, the exact editor version, the
headless (batchmode) commands and the CI workflow that produces the same two artefacts on every push.
If you prefer to open the project by hand: create a Unity 6 project, copy `UnityProject/Assets` and
`UnityProject/Packages` into it, then run **Heritage → Configure Project**, **Heritage → Build
Character**, **Heritage → Build Museum Scene** from the menu bar.

---

## Verification — what was actually run

No claim in this repository is unverified where it can be checked automatically. Every gate below
exits non-zero on failure and is wired into the CI workflow.

```bash
python3 Tools/validate_content.py        # every record cited, every cross-reference resolves,
                                         # six doors and six galleries, quiz items answerable
python3 Tools/audit_character_spec.py    # the character's numbers are internally consistent
python3 Tools/check_csharp.py            # Unity sources lex, brackets balance, ids exist
bash   web/tools/run_tests.sh            # character build + all 25 clips + gameplay logic + archive
python3 -m http.server 8000 --directory web   # then web/tools/run_boot_test.sh (needs jsdom once)
```

Current state, last run in this repository:

| Gate | Result |
| --- | --- |
| `Tools/validate_content.py` | **PASSED** — 69 archive records, 38 timeline events, 42 questions, 48 exhibits, 8 memorials, 6 galleries, exactly six doors |
| `Tools/audit_character_spec.py` | **PASSED** — 20 checks: 1.700 m tall, 7.20 head-heights, sole on the floor, collar under the chin, #9E2130 tie the only accent |
| `Tools/check_csharp.py` | **PASSED** — every Unity source lexes, every content id it names exists |
| `web/tools/run_tests.sh` | **PASSED** — 29 character/animation checks, 49 gameplay checks (including camera-relative movement), 30 archive-engine checks |
| `web/tools/run_boot_test.sh` | **PASSED** — 70 checks: the real `main.js` boots in jsdom and plays menu → intro → hub → six galleries → memorial → exhibit → archive → quiz → Guide → locked doors → save |

---

## Feature summary

* **Six labelled gallery doors** — Early Life & Education, Social Reform, Law & Constitution,
  Books/Manuscripts & Scholarship, Memorials & Historical Places, Legacy & Digital Archive. There is no
  seventh door; the layout is asserted by the content validator on every commit.
* **69 archive records**, each with title, category, description, date, location, author, keywords,
  media and a **citation**. Generated media is labelled *Digital Reconstruction*; nothing pretends to
  be an authentic photograph or manuscript the project does not hold.
* **The Archive Guide** — an offline retrieval assistant that answers *only* from retrieved passages
  and always prints the records it used. When the archive cannot answer, it says so instead of
  inventing something. An optional cloud model can be attached by environment variable and is dropped
  by policy if it names anything absent from the retrieved records.
* **An audio-visual exhibit system** — TEXT · IMAGE · AUDIO · VIDEO · DOCUMENT · 3D MODEL, plus a
  document viewer with magnification, page turning and source metadata.
* **Five question types** — multiple choice, true/false, timeline ordering, matching and image
  identification. Every answer returns an explanation and a citation, not the word "wrong".
* **Eight missions**, sixteen achievements and the **HERITAGE ARCHIVIST** certificate, driven entirely
  by `quests.json` and `achievements.json`.
* **Save system** with corrupt-save quarantine, settings, accessibility options (subtitles, text size,
  contrast, narration toggle, reduced effects, simplified controls), minimap, collectibles that fill
  *MY DIGITAL ARCHIVE*, knowledge points and DEMO/PRESENTATION modes for a five-to-ten minute judging
  run.
* **No monetisation, no loot boxes, no combat** anywhere in the design.
* **Procedural everything** — every texture and every mesh is generated at runtime from code, so the
  repository ships no binary art and the offline promise is real.

---

## Documentation index

| Document | Read it for |
| --- | --- |
| `Documentation/01_Character_Technical_Spec.md` | The character: reference analysis, proportions, palette, rig, 25 clips, acceptance criteria, rendered verification |
| `Documentation/02_Architecture.md` | How the systems fit together, and why the content sits outside the code |
| `Documentation/03_Content_Authoring.md` | Adding a record, a question, an exhibit, a mission or a language without touching gameplay code |
| `Documentation/04_Build_and_Deployment.md` | Windows and Android builds, CI, and what the shipped artefacts contain |
| `Documentation/05_Features_and_Controls.md` | Every feature and every input, per platform |
| `Documentation/06_Known_Limitations.md` | Exactly what is not finished or not verifiable here, stated plainly |
| `Documentation/07_Testing_and_Validation.md` | The gates, what each one proves, and how to reproduce the results |
| `Documentation/08_Accessibility_and_Localization.md` | Accessibility features; the six-locale plan and its honest status |
| `Documentation/09_Demo_Presentation_Guide.md` | A timed five-to-ten minute demo script for judges |
| `Documentation/10_Submission_Checklist.md` | Every deliverable mapped to its file, the phase-by-phase status, and the pre-submission checklist |

---

## Team

Names, institution, mentor and department are editable placeholders in the in-game **CREDITS**
screen (`web/index.html`, `web/src/ui/panels.js`) and in `Documentation/10`; replace them before
submission. No third-party assets are used: every mesh, texture and tone is generated by this
repository's own code, and the character is a digital reconstruction, labelled as such in the credits
and in its own archive record.
