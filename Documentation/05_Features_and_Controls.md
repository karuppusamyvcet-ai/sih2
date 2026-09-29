# 05 — Feature list and controls

## The loop

EXPLORE → DISCOVER → INTERACT → LISTEN → READ → SOLVE → LEARN → UNLOCK → PROGRESS

There is no combat, no timer pressure, no monetisation and no loot boxes anywhere in the design. The
only currency is knowledge points, and the only thing they buy is the completion certificate.

## Museum

| Feature | Detail |
| --- | --- |
| Central hall | 44 × 30 × 9.2 m colonnaded hall with a timeline wall, an obelisk, benches and the Archive Guide desk |
| Six labelled doors | Early Life & Education · Social Reform · Law & Constitution · Books, Manuscripts & Scholarship · Memorials & Historical Places · Legacy & Digital Archive. Labels sit above the doors in world space. Exactly six exist; the validator enforces it |
| Galleries | Each door opens a room built from `exhibits.json`: a ramp and dioramas, a rotunda with the constitutional table, shelf walls for manuscripts, a floor map with eight memorial plinths, a curved legacy wall |
| Memorial reconstructions | Eight sites (Janmabhoomi, Rajgruha, Chaityabhoomi, Deekshabhoomi, Alipore, Lucknow, Hyderabad, Centre Delhi) generated from `sceneStyle` and `sceneParams`, each carrying an in-scene label: *Digital Reconstruction — not an authentic photograph* |
| Minimap | 90 m scale plan of the current room with doors, exhibits, the player arrow and completed galleries |
| Set dressing | Reception desk, terminals, glass cases, bookshelves, archive cabinet, stelae, planters, benches, label rail — all from `museum.json` |

## Archive and exhibits

| Feature | Detail |
| --- | --- |
| 69 archive records | Title, category, description, date, location, author, keywords, media and a **source citation**. Filter by category and gallery; search across every field |
| Document viewer | Page turning, magnification, transcription view, provenance panel and the source citation, with reconstructions labelled |
| Exhibit system | Nine interaction kinds: press · read · examine · sit · book · notes · listen · search · ask, mapped to the correct animation and panel |
| Audio-visual exhibits | TEXT · IMAGE · AUDIO · VIDEO · DOCUMENT · 3D MODEL. Generated media is labelled; missing recordings say so rather than playing silence |
| MY DIGITAL ARCHIVE | Every record opened can be added to the player's own collection, which is what the certificate reports |
| Glossary | 20 concepts with long definitions, each citing records |

## Learning

| Feature | Detail |
| --- | --- |
| Five question types | Multiple choice, true/false, timeline ordering, matching, image identification (42 items) |
| Explanations, never just "wrong" | Every answer — right or wrong — returns the explanation and the citation from `questions.json` |
| Ordering and matching graded by proportion | A nearly-correct timeline still scores and still explains itself |
| Mini-games | Match the Event and Sort the Timeline stations are composed from the question bank; the legacy wall runs the six-stage Final Knowledge Challenge |
| Missions | Eight missions with counted objectives; six galleries unlock one after another as the previous mission completes |
| Achievements | Sixteen, data-driven triggers (first steps, six galleries, eight memorials, research, perfect sessions) |
| HERITAGE ARCHIVIST | Awarded when all eight missions are complete and quiz accuracy is at least 60%, followed by a printable certificate with the eight dashboard statistics |

## The Archive Guide

| Feature | Detail |
| --- | --- |
| Answers only from the archive | Retrieval with IDF weighting, title bonus and synonym expansion; the answer text is composed from retrieved passages |
| Always cites | Every answer lists the records it used, each with its own citation |
| Admits ignorance | Below the coverage floor it says the archive does not cover the question and lists what it does cover |
| Labelled | Answers from the local index are labelled **Offline Archive Guide** |
| Optional cloud model | Off by default, enabled by environment variables, and discarded unless every entity it names appears in the retrieved records |
| 12 suggested questions, 6 guided routes | So a first-time visitor is never stuck for something to ask |

## Systems

| Feature | Detail |
| --- | --- |
| Save system | Local autosave plus explicit save on meaningful actions; a corrupt save is quarantined to `save_v1.corrupt.json` and reported instead of crashing |
| Settings | Volume (master/music/voice/sfx), subtitles, narration, text size, high contrast, reduced effects, simplified controls, invert Y, V-Sync, quality, minimap, language, mouse and touch sensitivity |
| Pause menu | Resume, settings, archive, map, objectives, restart, main menu |
| Loading | Screens between rooms with progress, never a frozen frame |
| Main menu | NEW JOURNEY · CONTINUE · DIGITAL ARCHIVE · SETTINGS · CREDITS · EXIT, plus DEMO MODE and PRESENTATION MODE |
| DEMO / PRESENTATION MODE | A guided five-to-ten minute run for judges: the camera visits the hall, one gallery and one memorial, and the scripted highlights fire in order |
| Cinematic intro | Skippable at any moment; the skip is remembered |
| Credits | Team, institution, mentor, problem statement and the reconstruction disclaimer |

## Computing requirements

| | Windows | Android |
| --- | --- | --- |
| Minimum | Windows 10 x64, DX11 GPU, 4 GB RAM, 2 GB storage | Android 7.0 (API 24), ARM64, 2 GB RAM, 1.5 GB storage |
| Recommended | Discrete GPU or modern integrated GPU, 8 GB RAM | Android 10+, 4 GB RAM |
| Offline | Fully playable offline | Fully playable offline |
| Quality tiers | LOW · MEDIUM · HIGH · ULTRA | LOW · MEDIUM · HIGH |

## Controls

| Action | Windows | Android |
| --- | --- | --- |
| Move | W A S D / arrow keys | On-screen joystick (left) |
| Run | Left Shift | RUN toggle |
| Look | Mouse (hold right button) | Drag anywhere on the 3D view |
| Interact | **E** / Space | **INTERACT** button |
| Archive | Tab | ARCHIVE button |
| Map | M | MAP button |
| Objectives | J | — (pause menu) |
| Archive Guide | G | GUIDE button |
| Skip intro / continue dialogue | Space / Enter | Tap the subtitle bar |
| Pause / back | Esc | MENU button and the system back button |

The interaction prompt names what is in reach — *Read — The Preamble panel* — and switches to the
touch wording automatically on Android. Turning on **simplified controls** enlarges every button and
removes the run toggle.
