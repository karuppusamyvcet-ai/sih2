# 06 — Known limitations, stated plainly

A judging panel should be able to find every gap in this document rather than discover it. Nothing
below is hidden behind optimistic wording.

## 1. The character sheet was never supplied

The brief refers to a character sheet, but no image file reached this project. The specification in
`01_Character_Technical_Spec.md` was therefore derived from public likeness references (portrait and
full-length photographs) and from the written requirements: round dark-rimmed glasses, short neat
receding hair, clipped moustache, stocky build, three-piece dark suit, white shirt, red patterned tie,
dark lace-up shoes.

* `sourceSheet.supplied` is `false` in `character_spec.json`, and `Tools/audit_character_spec.py`
  prints a warning because of it.
* The moment the sheet is available, drop it at
  `UnityProject/Assets/Art/Characters/Reference/ambedkar_character_sheet.png`, set
  `sourceSheet.supplied` to `true`, and re-measure the specification against it. The generator reads
  the numbers, so the figure follows automatically.
* Until then the character is a faithful *digital reconstruction* of a well-documented public
  likeness, and is labelled as a reconstruction in the credits and in its archive record.

## 2. No Windows executable or Android APK is committed

Producing them requires the Unity editor with the Windows and Android modules. The environment this
project was written in has no Unity editor and no .NET toolchain, so it cannot run a build. What is
here instead:

* the complete Unity project (sources, packages, project version),
* `Tools/build.sh`, which runs the gates and then the two batchmode builds,
* `Heritage ▸ Configure Project`, `Heritage ▸ Build Character` and `Heritage ▸ Build Museum Scene`,
* `.github/workflows/build-unity.yml`, which produces both artefacts on a runner with a Unity licence.

`Documentation/04_Build_and_Deployment.md` gives the exact commands and the expected output paths
(`Builds/Windows/AmbedkarDigitalHeritage.exe`, `Builds/Android/AmbedkarDigitalHeritage.apk`).

## 3. The Unity layer is younger than the browser build

The browser build in `web/` is the reference implementation and is covered end to end by the test
suites (character, animation, archive engine, gameplay logic, and a jsdom boot harness that plays the
real `main.js`). The Unity port shares the same content, the same rules and the same builders, and its
data layer is guarded by `Tools/check_csharp.py`, including a schema gate that compares every content
key against its `[Serializable]` class. What it cannot do here is *run*: without a Unity editor the
code has never been compiled or executed, so the first editor session should be treated as the real
integration test. The C# is written conservatively (no C# 10 features, no editor-only APIs in runtime
code, direct Input System device reads with a legacy fallback) specifically to keep that first
compile uneventful.

Remaining Unity work, in order: the HUD and panel layer, the game bootstrap that wires the systems
together, and assembly definitions. The browser build already contains the equivalent of each, which
is why the Unity port is a port rather than a design.

## 4. Narration is subtitles plus optional device speech

There is no recorded narration audio in this project, and it cannot be generated offline. What the
game does instead:

* every memorial narration and exhibit script is displayed as timed subtitles, with the subtitle
  size controlled by the accessibility settings;
* where the platform offers speech synthesis (Android `TextToSpeech`), the narration setting speaks
  the same text, and the setting can be turned off;
* exhibit "AUDIO" media that the project does not hold is labelled as such in the record and in the
  viewer, instead of playing silence as if a recording existed.

Recording real narrators is a content-acquisition task, and the scripts in `memorials.json` and
`exhibits.json` are written to be read aloud.

## 5. No licensed historical media

The archive is text-first by design: it cites books, journals and institutional archives rather than
reproducing images the project has no licence for. Every generated illustration, diagram and
reconstruction is flagged `isReconstruction: true` and labelled *Digital Reconstruction — artistic
visualisation, not an authentic photograph*. Exporting the archive as a browsable certificate PDF is
not implemented; the certificate prints from the game window.

## 6. Unverified in this environment

* **WebGL rendering** — the browser build is validated structurally (modules, DOM contract, content,
  gameplay, boot) but no headless GPU was available, so frames have not been compared pixel by pixel.
* **Android device behaviour** — safe-area insets, the back button and touch look are implemented and
  reviewed, but have not been exercised on physical hardware here.
* **Performance numbers** — the budgets (LOD0 ≈ 9 300 triangles for the character, one shadow-casting
  light per room, 128/256/512 px procedural textures by tier) are design targets, not measurements.
  `Tools/build.sh` and the scene builder report the geometry they generate so the numbers can be
  checked on the target hardware in a few minutes.

## 7. Localization status

English is complete (154 keys). Tamil, Hindi, Telugu, Malayalam, Kannada and Marathi are scaffolded at
roughly 8% each, and each declares its own coverage and translator in `localization.json`. Only
interface strings are localized: the archival text, question text and mission briefings are not
machine-translated, because an incorrect translation of a historical record is a factual error, not a
cosmetic one. The `translator` field exists so that a submission can state who did the work.

## 8. Content that is deliberately absent

* **No invented history.** There are no fabricated quotations, no invented events and no fake
  manuscripts. Where a detail is contested or uncertain, the record says so in its description.
* **No seventh door, no combat, no buying anything.** These are content rules as much as design rules,
  and the validator fails the build if a seventh door appears.
* **Not a substitute for the primary sources.** The archive is a curated teaching collection with
  citations, not a scholarly edition; every record points to the work a reader should consult next.
