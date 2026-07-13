# CIPP/US Audio-First Study Pipeline

A small pipeline that turns the IAPP **CIPP/US** study textbook (an EPUB) into
**study materials optimized for auditory learning** — spoken lectures, spoken
key-term reviews, and hands-free active-recall drills you can listen to while
walking, driving, or commuting.

The emphasis is deliberately on **listening, not reading**: every artifact is
built to be consumed with your eyes closed.

## What it produces (per chapter)

| Track | What it is | How to use it |
|-------|------------|---------------|
| **Lecture** (`chNN-lecture.mp3`) | A ~15-minute spoken walkthrough written for the ear — no bullet lists, heavy signposting, built-in "Quick recap" checkpoints, and a closing 60-second summary. | First pass. Listen once or twice per chapter. |
| **Key Terms** (`chNN-terms.mp3`) | "Term … *pause* … definition" in two voices. | Vocabulary reinforcement. |
| **Recall Drill** (`chNN-drill.mp3`) | A question in one voice, a **4-second silent gap** to answer aloud, then "The answer is…" in a second voice. | Last, and repeatedly — this is where exam recall is built. |

Plus text sources for each (`build/lectures/*.txt`, `build/studypacks/*.json`),
M3U playlists, and a listening guide with durations (`build/audio/README.md`).

Two voices are used throughout (`en-US-AndrewMultilingualNeural` for
narration/questions, `en-US-AvaMultilingualNeural` for answers/definitions) so
your ear can tell "prompt" from "answer" without looking.

## Pipeline stages

```
 EPUB ──extract.py──▶ chapters/*.md ──generate.py──▶ lectures/*.txt
                                          │            studypacks/*.json
                                          └──tts.py──▶ audio/*.mp3 ──playlist.py──▶ *.m3u + guide
```

1. **`extract.py`** — reads the EPUB as a zip, converts each `Chapter_N.xhtml`
   into clean markdown, writes `build/book.json`.
2. **`generate.py`** — for each chapter, calls the headless `claude -p` CLI with
   the prompts in `prompts/` to produce an audio-lecture script and a
   `{key_terms, qa}` study pack (JSON-validated).
3. **`tts.py`** — synthesizes narrated MP3s with `edge-tts`, assembling
   segments and silent gaps with `ffmpeg`.
4. **`playlist.py`** — writes M3U playlists and a listening guide.

## Usage

```bash
cd exam-study
make setup                       # install deps; checks ffmpeg + claude CLI

# put the textbook at source/book.epub (not committed), then:
make all EPUB=source/book.epub   # extract + generate + audio + playlists

# iterate on a single chapter while tuning prompts/voices:
make generate ONLY=1
make audio    ONLY=1 KINDS=drill
```

Outputs land in `build/` (git-ignored). A committed `samples/` folder holds a
few tracks and text artifacts so the pipeline's output is reviewable without
regenerating everything.

## One-page master sheet

`cheatsheet.html` is a self-contained, print-ready quick-reference distilled
from the generated study packs — the four analysis lenses, the core federal
sector laws (scope / trigger / enforcer each), state + international
essentials, and the commonly-confused pairs and exam traps. Open it in a
browser; `Cmd/Ctrl-P` prints a compact reference. Light/dark aware.

## Requirements

- **Python 3.11+** with the packages in `requirements.txt`
  (`beautifulsoup4`, `lxml`, `edge-tts`).
- **ffmpeg** on `PATH` (audio assembly).
- The **`claude` CLI**, authenticated (generation). No API key handling lives in
  the code — it shells out to `claude -p`.
- Network access for `edge-tts` (Microsoft neural voices). Behind the agent
  proxy, `tts.py` appends the proxy CA bundle to `certifi` automatically.

## Notes

- **Model id**: generation uses `claude-opus-4-8`, set in `pipeline/generate.py`.
  Per repo policy, confirm the current model id before changing it.
- **Copyright**: the textbook is a purchased IAPP publication. Keep the source
  EPUB and full generated audio out of version control (see `.gitignore`); the
  committed `samples/` are short excerpts for demonstrating the pipeline.
- **Grounding**: prompts instruct the model to teach only from the chapter text
  and not invent statutes, dates, or thresholds. Still, verify anything
  exam-critical against the book — this is a study aid, not an authority.
