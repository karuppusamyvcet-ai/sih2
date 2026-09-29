# 08 — Accessibility and localization

## Accessibility

The brief asks for subtitles, text size, contrast, a narration toggle and reduced effects. All five are
implemented, tested in the boot harness, and stored in `settings_v1.json` so they survive a save.

| Setting | What it does | Where it lives |
| --- | --- | --- |
| **Subtitles** | Draws every narration, exhibit script and intro line as text, in a high-contrast bar. On by default | `settings.subtitles` |
| **Narration** | Speaks the same text where the device provides speech synthesis (Android TextToSpeech); never required for comprehension, because the subtitles carry it | `settings.narration` |
| **Text size** | Scales every panel's text from 85% to 150% without breaking layout; the interaction prompt and subtitles scale too | `settings.textScale` |
| **High contrast** | Switches the interface to a light-on-dark scheme with stronger borders, and desaturates the museum lighting so the text wins | `settings.contrast` |
| **Reduced effects** | Forces the low quality tier, disables motion blur-style camera smoothing extras and removes animated transitions | `settings.reduceEffects` |
| **Simplified controls** | Enlarges buttons and the interaction target, and removes the run toggle so the same movement works with one hand | `settings.simplifiedControls` |
| **Invert Y** | For players used to flight-style cameras | `settings.invertY` |
| **Sensitivity** | Separate mouse and touch sliders | `settings.sensitivityMouse`, `settings.sensitivityTouch` |
| **Minimap** | Optional, because a busy corner is noise for some readers | `settings.showMinimap` |

Beyond the settings:

* **Subtitles are always available**, never only in cutscenes, and the intro is skippable from the
  first frame and remembered afterwards.
* **Everything is reachable from the keyboard**: Tab archive, M map, G guide, J objectives, Esc pause,
  Space/Enter advance, arrow keys as an alternative to WASD.
* **Android safe area** is respected — the HUD and the touch controls are laid out inside
  `Screen.safeArea`, so nothing hides under a notch or a gesture bar, and the game is locked to
  landscape.
* **The system back button** behaves exactly like Esc: it closes the open panel, then pauses, then
  returns to the main menu.
* **Colour is never the only signal.** A locked door is locked in its prompt and its label, not just in
  its tint; correct and incorrect answers are marked with a word and a symbol as well as a colour.
* **No flashing, no rapid motion, no combat.** There is no strobe, no gore and no fail state that
  punishes the player; the camera never shakes.
* **Reading comfort**: body text is set at a comfortable measure with generous line spacing, and every
  long passage is also available as a document page with magnification.

## Localization

| Locale | Code | Status in this submission | Coverage |
| --- | --- | --- | --- |
| English | `en` | complete (154 interface keys) | 100% |
| Tamil | `ta` | scaffolded | ~8% |
| Hindi | `hi` | scaffolded | ~8% |
| Telugu | `te` | scaffolded | ~8% |
| Malayalam | `ml` | scaffolded | ~8% |
| Kannada | `kn` | scaffolded | ~8% |
| Marathi | `mr` | scaffolded | ~8% |

Each locale entry declares its own `status`, `coverage` and `translator` in `localization.json`, so the
project states what it has rather than implying more.

### Why the archival text is not machine-translated

The interface is translated; the *archive* is not. A record description, a mission briefing or a quiz
explanation that has been machine-translated into Tamil is a factual document rendered with the wrong
words — for a project whose central claim is historical accuracy, that is a defect rather than a
feature. The text stays in the source language until a named human translator supplies it, and the
`translator` field records who did.

### How to add or finish a language

1. Add or extend the locale in `localization.json` → `locales[]` and `strings[code]`.
2. Keys missing from a locale fall back locale → English → the key itself, so an unfinished language
   never renders an empty label.
3. Run `python3 Tools/validate_content.py` — it fails if the **default** locale is incomplete, and
   reports each locale's declared coverage.
4. Mirror the file to `web/content/` (`cp UnityProject/Assets/Resources/Content/*.json web/content/`)
   and run `bash web/tools/run_tests.sh`, which checks that every `t()` call resolves and that the
   fallback chain works.

Fonts: TextMeshPro's default font atlas covers Latin. Tamil, Telugu, Malayalam, Kannada and Devanagari
need a font asset with those glyph ranges — the pipeline is documented here so that adding a language
is a two-step job (font asset plus string table), and the interface's layout is already built to accept
larger script metrics without breaking.
