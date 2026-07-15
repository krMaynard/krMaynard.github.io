#!/usr/bin/env python3
"""Build an Anki .apkg deck of U.S.-regulation facts, with TTS audio embedded.

Reads build/cards.json (from cards.py) and produces build/cipp-us-regulations.apkg:
one structured "US Reg" note per regulation, from which Anki generates up to four
targeted cards — Scenario -> Law, Acronym -> Name+Year, Law -> Year+Citation,
Law -> Enforcer. Each note carries a spoken-answer MP3 (edge-tts) played on the
back, with acronyms spelled out so the name/date cements aurally.

Deck + model IDs are fixed, and each note's GUID is derived from its slug, so
re-importing an updated deck UPDATES cards in place instead of duplicating them
(your review scheduling is preserved).

Usage:
    python pipeline/build_anki.py --build build
    python pipeline/build_anki.py --build build --no-audio   # skip TTS
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import tempfile
from pathlib import Path


# --- edge-tts must trust the agent proxy's TLS interception (see tts.py) ------
def _trust_proxy_ca() -> None:
    ca = Path("/root/.ccr/ca-bundle.crt")
    if not ca.exists():
        return
    try:
        import certifi
        bundle = Path(certifi.where())
        if ca.read_text() not in bundle.read_text():
            with bundle.open("a") as fh:
                fh.write("\n" + ca.read_text())
    except Exception:  # noqa: BLE001
        pass


_trust_proxy_ca()

import genanki  # noqa: E402

# Fixed IDs — do NOT change once the deck is in use (Anki keys scheduling to them).
MODEL_ID = 1841027431
DECK_ID = 1841027432
VOICE = "en-US-AvaMultilingualNeural"

CSS = """
.card { font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
  font-size: 19px; line-height: 1.5; color: #1b2333; background: #f6f4ee;
  text-align: left; padding: 18px 20px; }
.nightMode.card { color: #eef1f6; background: #141821; }
.cue { font-size: 12px; letter-spacing: .12em; text-transform: uppercase;
  color: #8c2f28; font-weight: 700; margin-bottom: 10px; }
.nightMode .cue { color: #e07a70; }
.scenario { font-size: 21px; line-height: 1.45; }
.acr { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 34px;
  font-weight: 700; letter-spacing: .04em; }
.law { font-size: 24px; font-weight: 700; font-family: Georgia, "Times New Roman", serif; }
hr { border: 0; border-top: 1px solid #d8d2c4; margin: 16px 0; }
.nightMode hr { border-top-color: #2c3444; }
.ans { font-size: 26px; font-weight: 700; font-family: Georgia, serif; margin-bottom: 4px; }
.ans .yr { color: #8c2f28; }
.nightMode .ans .yr { color: #e07a70; }
.cite { font-family: ui-monospace, Menlo, monospace; font-size: 15px;
  background: #f0e2df; color: #8c2f28; padding: 2px 7px; border-radius: 4px;
  display: inline-block; margin: 4px 0; }
.nightMode .cite { background: #3a2422; color: #e07a70; }
.facts { margin-top: 12px; font-size: 15px; }
.facts b { font-family: ui-monospace, Menlo, monospace; font-size: 11px;
  letter-spacing: .06em; text-transform: uppercase; color: #5d6675;
  display: inline-block; min-width: 74px; }
.nightMode .facts b { color: #8d97a7; }
.audio { margin-top: 10px; }
"""

# Shared answer detail shown on every card back.
_FACTS = """
<div class="facts">
  {{#Scope}}<div><b>Covers</b> {{Scope}}</div>{{/Scope}}
  {{#Trigger}}<div><b>Trigger</b> {{Trigger}}</div>{{/Trigger}}
  {{#Enforcer}}<div><b>Enforcer</b> {{Enforcer}}</div>{{/Enforcer}}
  {{#KeyFacts}}<div><b>Key fact</b> {{KeyFacts}}</div>{{/KeyFacts}}
</div>
{{#Audio}}<div class="audio">{{Audio}}</div>{{/Audio}}
<div class="facts"><b>Chapter</b> {{Chapter}}</div>
"""

_ANS_HEAD = (
    '<div class="ans">{{Law}} <span style="color:#5d6675">({{Acronym}})</span>'
    ' &middot; <span class="yr">{{Year}}</span></div>'
    '{{#Citation}}<div class="cite">{{Citation}}</div>{{/Citation}}'
)

MODEL = genanki.Model(
    MODEL_ID,
    "CIPP/US — US Regulation",
    fields=[
        {"name": "Law"}, {"name": "Acronym"}, {"name": "Year"}, {"name": "Citation"},
        {"name": "Scope"}, {"name": "Trigger"}, {"name": "Enforcer"},
        {"name": "KeyFacts"}, {"name": "Scenario"}, {"name": "Audio"}, {"name": "Chapter"},
    ],
    templates=[
        {
            "name": "1. Scenario -> Law",
            "qfmt": '{{#Scenario}}<div class="cue">Which U.S. regulation applies?</div>'
                    '<div class="scenario">{{Scenario}}</div>{{/Scenario}}',
            "afmt": '{{FrontSide}}<hr>' + _ANS_HEAD + _FACTS,
        },
        {
            "name": "2. Acronym -> Name & Year",
            "qfmt": '{{#Acronym}}<div class="cue">Full name &amp; year enacted?</div>'
                    '<div class="acr">{{Acronym}}</div>{{/Acronym}}',
            "afmt": '{{FrontSide}}<hr>' + _ANS_HEAD + _FACTS,
        },
        {
            "name": "3. Law -> Year & Citation",
            "qfmt": '{{#Citation}}<div class="cue">Year enacted &amp; citation?</div>'
                    '<div class="law">{{Law}} ({{Acronym}})</div>{{/Citation}}',
            "afmt": '{{FrontSide}}<hr>'
                    '<div class="ans"><span class="yr">{{Year}}</span></div>'
                    '<div class="cite">{{Citation}}</div>' + _FACTS,
        },
        {
            "name": "4. Law -> Enforcer",
            "qfmt": '{{#Enforcer}}<div class="cue">Who enforces it?</div>'
                    '<div class="law">{{Law}} ({{Acronym}})</div>{{/Enforcer}}',
            "afmt": '{{FrontSide}}<hr><div class="ans">{{Enforcer}}</div>' + _FACTS,
        },
    ],
    css=CSS,
)


def spoken(it: dict) -> str:
    """Build the spoken-answer line; spell acronyms so the name cements aurally."""
    parts = [it["law"] + "."]
    acr = it.get("acronym", "")
    if acr and acr.upper() != it["law"].upper():
        letters = ". ".join(acr.replace(".", "")) if acr.isupper() or len(acr) <= 6 else acr
        parts.append(letters + ".")
    if it.get("year"):
        parts.append(f"Enacted {it['year']}.")
    if it.get("citation"):
        cite = it["citation"].replace("§§", "Sections ").replace("§", "Section ")
        parts.append(cite + ".")
    if it.get("enforcer"):
        parts.append("Enforced by " + it["enforcer"])
    return " ".join(parts)


async def synth_all(items: list[dict], media_dir: Path) -> dict[str, str]:
    import edge_tts
    audio: dict[str, str] = {}
    for it in items:
        fname = "usreg_" + re.sub(r"[^A-Za-z0-9_]", "_", it["slug"]) + ".mp3"
        path = media_dir / fname
        text = spoken(it)
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text, VOICE, rate="-4%").save(str(path))
                if path.stat().st_size > 0:
                    break
                raise RuntimeError("empty audio")
            except Exception as e:  # noqa: BLE001
                if attempt == 3:
                    print(f"    audio FAILED for {it['slug']}: {e}", file=sys.stderr)
                    path = None
                    break
                await asyncio.sleep(2 ** attempt)
        if path:
            audio[it["slug"]] = fname
    return audio


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--build", default=Path("build"), type=Path)
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--out", default="")
    args = ap.parse_args()

    items = json.loads((args.build / "cards.json").read_text(encoding="utf-8"))
    if not items:
        raise SystemExit("no cards in build/cards.json — run cards.py first")

    with tempfile.TemporaryDirectory() as td:
        media_dir = Path(td)
        audio_map: dict[str, str] = {}
        if not args.no_audio:
            print(f"Synthesizing {len(items)} answer clips...", flush=True)
            audio_map = asyncio.run(synth_all(items, media_dir))
            print(f"    {len(audio_map)} clips ok")

        deck = genanki.Deck(DECK_ID, "CIPP/US · U.S. Regulations (names, dates, citations)")
        media_files: list[str] = []
        for it in items:
            fname = audio_map.get(it["slug"], "")
            deck.add_note(genanki.Note(
                model=MODEL,
                guid=genanki.guid_for(it["slug"]),
                fields=[
                    it.get("law", ""), it.get("acronym", ""), it.get("year", ""),
                    it.get("citation", ""), it.get("scope", ""), it.get("trigger", ""),
                    it.get("enforcer", ""), it.get("key_facts", ""), it.get("scenario", ""),
                    f"[sound:{fname}]" if fname else "", str(it.get("chapter", "")),
                ],
            ))
            if fname:
                media_files.append(str(media_dir / fname))

        out = Path(args.out) if args.out else args.build / "cipp-us-regulations.apkg"
        genanki.Package(deck, media_files=media_files).write_to_file(str(out))
        print(f"Wrote {out}  ({len(items)} notes, {len(media_files)} audio clips)")


if __name__ == "__main__":
    main()
