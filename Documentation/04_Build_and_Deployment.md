# 04 — Build and deployment

Two deliverables come out of one codebase:

| Target | Artefact | Path declared in the brief |
| --- | --- | --- |
| Windows x64 | `AmbedkarDigitalHeritage.exe` | `Builds/Windows/AmbedkarDigitalHeritage.exe` |
| Android ARM64 | `AmbedkarDigitalHeritage.apk` | `Builds/Android/AmbedkarDigitalHeritage.apk` |

Both are produced by Unity 6 (URP). This repository contains the complete project sources, the editor
builders that generate the scene and the character, and the batchmode/CI scripts that produce those two
files on a machine that has Unity installed. The sandbox that authored this code has **no Unity editor
and no .NET toolchain**, so the artefacts themselves are produced by the steps below — see
`Documentation/06_Known_Limitations.md` for exactly what that means and does not mean.

---

## 1. Prerequisites

* **Unity 6000.0.23f1** with the *Windows Build Support (IL2CPP)* and *Android Build Support*
  modules (SDK/NDK/OpenJDK included with the module).
* The packages listed in `UnityProject/Packages/manifest.json` — Universal RP 17.0.3, Input System
  1.11.2, TextMeshPro 3.2.0-pre.10, uGUI 2.0.0. Unity resolves them on first open.
* A signing keystore for release Android builds. Debug builds use the built-in debug key.

The project is a normal Unity project folder: open `UnityProject/` directly with Unity Hub, or let CI
do it headlessly.

## 2. First-time configuration

On first open, run the menu item:

```
Heritage ▸ Configure Project
```

It applies the settings the brief asks for and that Unity otherwise only exposes through the UI:

* company/product name, bundle identifier `com.teamname.ambedkardigitalheritage`, version string
* landscape-only orientation, safe-area-friendly render, Android `minSdkVersion` 24, target ARM64 only
* IL2CPP scripting backend for Android and Windows, managed stripping level *Low*
* Linear colour space, URP asset assigned with shadows and a single main light
* Input System package set as the active input handler
* quality presets: desktop `LOW · MEDIUM · HIGH · ULTRA`, Android `LOW · MEDIUM · HIGH`
* VSync off (frame-rate cap applied at runtime per preset), fullscreen mode left to the player
* graphics APIs: DX11 for Windows, Vulkan with GLES3 fallback for Android

Then generate the content into the editor, in either order:

```
Heritage ▸ Build Character        # assets/character from character_spec.json
Heritage ▸ Build Museum Scene     # the hub, six galleries and eight memorial scenes
```

Both menu items are idempotent: they rebuild the generated assets from the JSON every time, so a
content edit plus a re-run is the whole workflow. The game does not depend on them having been run —
at runtime the same builders run if the baked assets are absent — which is why the JSON is the source
of truth rather than the scene file.

## 3. Editor builds (interactive)

* **Windows** — `File ▸ Build Settings ▸ Windows, Mac, Linux ▸ Target Platform: Windows`,
  Architecture `x86_64`, then *Build*, choosing `Builds/Windows`.
* **Android** — switch platform to Android, set *Scripting Backend: IL2CPP*,
  *Target Architectures: ARM64* only, then *Build*, choosing `Builds/Android`.

## 4. Command-line builds (what CI runs)

```bash
# Windows x64
Unity -quit -batchmode -nographics -projectPath UnityProject \
      -executeMethod Heritage.Editor.BuildScript.BuildWindows \
      -logFile Builds/Windows/build.log

# Android ARM64
Unity -quit -batchmode -nographics -projectPath UnityProject \
      -executeMethod Heritage.Editor.BuildScript.BuildAndroid \
      -logFile Builds/Android/build.log
```

`Tools/build.sh` wraps both and is the script the repository documents:

```bash
Tools/build.sh            # both targets
Tools/build.sh windows    # Windows only
Tools/build.sh android    # Android only
Tools/build.sh check      # run the content, character and C# gates; no Unity needed
```

`Heritage.Editor.BuildScript` runs the gates and the builders first (content validation, character
build, scene build), then builds, then verifies that the artefact exists and is non-trivially sized.
A failed gate fails the build: bad content cannot reach a deliverable.

`Tools/build.sh check` is the offline-safe subset — it runs `validate_content.py`,
`audit_character_spec.py`, `check_csharp.py` and the browser test suites, and is what to run on a
machine without Unity.

## 5. Continuous integration

`.github/workflows/build-unity.yml` runs on every push and pull request:

1. `ubuntu-latest`, Python 3 **content, character and C# gates** (`Tools/build.sh check` style) —
   fast, no Unity, catches content regressions immediately.
2. `game-ci/unity-builder` with a matrix over `StandaloneWindows64` and `Android` (ARM64, IL2CPP),
   Unity **6000.0.23f1**, uploading the resulting `.exe`/`.apk` as workflow artefacts.

Required repository secrets (set in GitHub, never in the repository): `UNITY_LICENSE`,
`UNITY_EMAIL`, `UNITY_PASSWORD`. Until they are configured the Unity jobs are skipped with a notice
and the content gates still run — the workflow never reports a false green.

## 6. What the shipped artefacts contain

* The museum hub, the six galleries and the eight memorial reconstructions, generated from the JSON
  at runtime (so the scene builds are small and the content stays editable).
* The character generated from `character_spec.json`, with the 25 procedural clips and the LOD chain.
* The full archive, quiz bank, missions, achievements, glossary, guide and localization data.
* No network dependency: the game is fully playable in flight mode. The optional cloud hook for the
  Archive Guide is off unless the environment variables are set, and the game labels its answers
  "Offline Archive Guide" when it runs locally.

## 7. Player-facing settings

* **Windows** — fullscreen, windowed and borderless windowed; V-Sync on/off; quality LOW → ULTRA;
  mouse sensitivity; subtitles, text size, high contrast, narration toggle, reduced effects.
* **Android** — LOW/MEDIUM/HIGH quality presets, on-screen controls with safe-area insets, hardware
  back button wired to the same navigation as Esc, touch look with a drag threshold so taps do not
  rotate the camera.

## 8. Verifying a build before submission

```bash
Tools/build.sh check                                   # gates
ls -l Builds/Windows/AmbedkarDigitalHeritage.exe       # exists, plausible size
ls -l Builds/Android/AmbedkarDigitalHeritage.apk       # exists, plausible size
```

Then, on the machine that will do the presenting:

1. Launch with the network disabled and confirm the game boots and the Guide answers.
2. Confirm six labelled doors and no seventh; walk into each gallery and back.
3. Open an archive record, a document with page turning, one quiz of each type and a memorial scene.
4. Complete mission 1 so a save is written; kill the game; relaunch and confirm **CONTINUE** resumes.
5. On Android: rotate nothing (landscape locked), press the back button in a panel and from the hub,
   and check that the on-screen buttons do not overlap the notch area.
