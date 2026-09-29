# 09 — Demo and presentation guide (5–10 minutes)

For judges, mentors and anyone presenting this project. Two ways to run it: the **browser build** on any
laptop (no install, no internet) or the **Windows executable** built from the Unity project.

```bash
# browser, from the repository root
python3 -m http.server 8000 --directory web
# open http://localhost:8000/   — then press DEMO MODE
```

## Before you start

* Turn the Wi-Fi **off** before the demo and say so out loud: it is the fastest way to prove the
  offline claim. Everything — textures, meshes, archive, Guide — is local.
* Set the window to 1080p if you can. The interface scales, but the museum reads best wide.
* If you have two minutes of slack, use **PRESENTATION MODE**; if you have under ten, use **DEMO MODE**
  and let it drive.

## The eight-minute script

**0:00 — Title (20 s).** The menu over the hall. Point out the two lines that matter:
*AMBEDKAR: THE DIGITAL HERITAGE JOURNEY — Explore. Discover. Learn.* and the problem statement ID
SIH26096 with the Ministry of Social Justice and Empowerment.

**0:20 — New Journey → intro (30 s).** Let the cinematic play for a few seconds, then skip it with
Space and mention that skipping is always allowed and remembered.

**0:50 — The hub (60 s).** You are Dr. B. R. Ambedkar, third person, in a 44 × 30 m hall. Walk a few
steps; talk about the six labelled doors and the fact that **there is no seventh door** — the content
validator fails the build if one appears. Note the colonnade, the skylights, the timeline wall.

**1:50 — Door 1, Early Life & Education (90 s).** Open the door (E). Walk the ramp, interact with the
Columbia display case. Show the interaction prompt naming the object, the character's reading
animation, and the archive record that opens with its **source citation** at the bottom.

**3:20 — The quiz (70 s).** Answer one question of each kind you can reach: multiple choice, a timeline
ordering, a true/false. The point to make: **a wrong answer is never just "wrong"** — it returns the
explanation and the citation.

**4:30 — Door 5, Memorials (90 s).** Use the floor map, then step onto the reconstruction. Note the
in-scene label: *Digital Reconstruction — not an authentic photograph of the site*. Show the guided
tour waypoints and the narrated subtitles.

**6:00 — The Archive Guide (90 s).** Press **G**. Ask something the archive covers — for example
*"What does Article 32 do?"* — and show the answer with its sources. Then ask something it does not
cover, and show that it **says so** instead of inventing an answer. Say the sentence a judging panel
remembers: *the Guide cannot fabricate history, because it is only allowed to speak from retrieved
passages and must print what it used.*

**7:30 — Progress, archive and certificate (60 s).** Tab into the archive, filter and search, then show
**MY DIGITAL ARCHIVE** and the objectives panel. If the run is short, jump to **PRESENTATION MODE**,
which plays the highlights and ends on the certificate with its eight statistics.

**8:30 — Close (30 s).** Two deliverables, one codebase: Windows `.exe` and Android ARM64 `.apk`, plus
this browser build of the same content. Six galleries, 69 cited records, 42 questions, eight memorial
reconstructions, and a hard rule that nothing is invented.

## What to say if you are asked

**"Is this really offline?"** Turn the network off and ask it something. The Guide's answer is labelled
*Offline Archive Guide* because that label is not decoration: it is the state the game is in.

**"Where does the AI come in?"** Retrieval, ranking, answer composition and citation enforcement all
run locally over the archive index. An optional cloud model can be attached by environment variable,
and its output is discarded unless every entity it mentions appears in the retrieved records.

**"How do you know the content is accurate?"** Every record carries a `source`. The validator refuses
to build the game if a record has none, if a mission points at an exhibit that does not exist, or if a
question has no explanation. Generated imagery is labelled as a reconstruction, in the record and in
the scene.

**"What is not finished?"** Answer with `Documentation/06_Known_Limitations.md` open: the character
sheet was never supplied (the specification is derived from public likeness references and says so),
the Windows and Android artefacts come from the documented build steps rather than being committed, the
Unity port has not been compiled here, and non-English locales are scaffolded rather than finished.

**"Can it scale to other institutions?"** Yes, and that is the point of the architecture: records,
galleries, exhibits, questions, missions, achievements and languages are JSON. Replacing
`Assets/Resources/Content/` with another archive — another memorial, another collection — produces a
different museum with no code change.

## If something goes wrong

| Symptom | What to do |
| --- | --- |
| A black screen on the browser build | The browser needs WebGL2. Try Chrome or Edge; the page shows a friendly message when the context cannot be created |
| No sound | Check the volume slider; audio is synthesised and starts after the first click, which browsers require |
| A door does not open | It is locked until the previous mission is complete — the prompt says which mission |
| The Guide says it cannot answer | That is the designed behaviour; ask one of the twelve suggested questions, or about a record you can see on screen |
