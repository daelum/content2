#!/usr/bin/env python3
"""Parse Project store markdown into data.js for Walk Film Kit."""
from __future__ import annotations

import json
import re
from pathlib import Path

DOCS = Path("/cursor/stores/self/docs")
OUT = Path(__file__).resolve().parent / "data.js"


def read(name: str) -> str:
    return (DOCS / name).read_text(encoding="utf-8")


def parse_hooks(text: str) -> list[dict]:
    categories: list[dict] = []
    parts = re.split(r"^## ", text, flags=re.M)[1:]
    for part in parts:
        lines = part.strip().splitlines()
        if not lines:
            continue
        title = lines[0].strip()
        if title.lower().startswith("usage"):
            continue
        why = ""
        items: list[str] = []
        for line in lines[1:]:
            m = re.match(r"^\*\*Why it works:\*\*\s*(.*)$", line)
            if m:
                why = m.group(1).strip()
                continue
            m = re.match(r"^(\d+)\.\s+(.+)$", line)
            if m:
                items.append(m.group(2).strip())
        if items:
            categories.append({"name": title, "why": why, "items": items})
    return categories


def parse_scripts(text: str) -> list[dict]:
    categories: list[dict] = []
    parts = re.split(r"^## ", text, flags=re.M)[1:]
    for part in parts:
        lines = part.strip().splitlines()
        if not lines:
            continue
        cat = lines[0].strip()
        body = "\n".join(lines[1:]).strip()
        scripts: list[dict] = []
        blocks = re.split(r"^\*\*(\d+)\.\s+(.+?)\*\*\s*$", body, flags=re.M)
        # blocks: [pre, num, title, text, num, title, text, ...]
        i = 1
        while i + 2 <= len(blocks):
            num = blocks[i]
            title_raw = blocks[i + 1].strip()
            script_body = blocks[i + 2].strip()
            i += 3
            dur = ""
            title = title_raw
            dm = re.search(r"^(.*?)\s*\(\s*~\s*(\d+)\s*s\s*\)\s*$", title_raw)
            if dm:
                title = dm.group(1).strip()
                dur = f"~{dm.group(2)}s"
            # First line is usually the hook/opening; rest is body
            paras = [p.strip() for p in re.split(r"\n\s*\n", script_body) if p.strip()]
            if not paras:
                # single paragraph block
                text_lines = [ln.strip() for ln in script_body.splitlines() if ln.strip()]
                full = " ".join(text_lines)
            else:
                full = "\n\n".join(paras)
            # Prefer: first sentence = hook if multi-sentence single para
            scripts.append(
                {
                    "n": int(num),
                    "title": title,
                    "duration": dur,
                    "text": full,
                }
            )
        if scripts:
            categories.append({"name": cat, "scripts": scripts})
    return categories


def parse_cue_sheet(text: str) -> dict:
    howto = ""
    reels: list[dict] = []
    # How to use section
    hm = re.search(r"## How to use\n(.*?)(?=\n---|\n## Reel )", text, flags=re.S)
    if hm:
        howto = hm.group(1).strip()

    parts = re.split(r"^## Reel ", text, flags=re.M)[1:]
    for part in parts:
        lines = part.strip().splitlines()
        header = lines[0].strip()
        # "1 — Lose 10kg starter plan — @lukenovella"
        hm2 = re.match(r"^(\d+)\s*[—\-]\s*(.+?)\s*[—\-]\s*(@?\S+)\s*$", header)
        if hm2:
            num, title, handle = hm2.group(1), hm2.group(2).strip(), hm2.group(3)
        else:
            hm3 = re.match(r"^(\d+)\s*[—\-]\s*(.+)$", header)
            num = hm3.group(1) if hm3 else "?"
            title = hm3.group(2).strip() if hm3 else header
            handle = ""

        body = "\n".join(lines[1:])
        duration = ""
        source = ""
        dm = re.search(r"\*\*Duration:\*\*\s*(.+)", body)
        if dm:
            duration = dm.group(1).strip()
        sm = re.search(r"\*\*Source:\*\*\s*(\S+)", body)
        if sm:
            source = sm.group(1).strip()

        listen = ""
        say: list[str] = []
        lm = re.search(r"### Listen\n(.*?)(?=\n### |\Z)", body, flags=re.S)
        if lm:
            listen = lm.group(1).strip()
            # strip trailing ---
            listen = re.sub(r"\n---\s*$", "", listen).strip()
        sm2 = re.search(r"### Say in your words\n(.*?)(?=\n---|\n### |\Z)", body, flags=re.S)
        if sm2:
            for line in sm2.group(1).splitlines():
                m = re.match(r"^-\s+(.+)$", line.strip())
                if m:
                    say.append(m.group(1).strip())

        reels.append(
            {
                "n": int(num) if str(num).isdigit() else num,
                "title": title,
                "handle": handle,
                "duration": duration,
                "source": source,
                "listen": listen,
                "say": say,
            }
        )
    return {"howto": howto, "reels": reels}


def parse_transcripts(text: str) -> list[dict]:
    items: list[dict] = []
    # Check for newer Dfqq transcript file
    extra_path = DOCS / "instagram-reel-DfqqRuFRgmW-transcript.md"
    parts = re.split(r"^## (?=\d+\.)", text, flags=re.M)[1:]
    for part in parts:
        lines = part.strip().splitlines()
        header = lines[0].strip()
        # "1. DfPJdLyy3Y0 — @lukenovella"
        hm = re.match(r"^(\d+)\.\s+(\S+)\s*[—\-]\s*(.+)$", header)
        if not hm:
            continue
        num, reel_id, handle = hm.group(1), hm.group(2), hm.group(3).strip()
        body = "\n".join(lines[1:])
        meta: dict[str, str] = {}
        for key in ("Source", "Approximate duration", "Duration", "Language", "Uploader"):
            m = re.search(rf"-\s+\*\*{key}:\*\*\s*(.+)", body)
            if m:
                meta[key.lower().replace(" ", "_")] = m.group(1).strip()
        # Transcript text: after blank line following metadata
        tm = re.search(r"(?:\n\n|\n)([A-Za-z\"'].*)$", body, flags=re.S)
        transcript = ""
        if tm:
            transcript = tm.group(1).strip()
            transcript = re.sub(r"\n---\s*$", "", transcript).strip()
        # Better: strip leading metadata bullets
        cleaned_lines = []
        past_meta = False
        for line in body.splitlines():
            if not past_meta:
                if re.match(r"^-\s+\*\*", line) or not line.strip():
                    continue
                past_meta = True
            if line.strip() == "---":
                break
            cleaned_lines.append(line)
        transcript = "\n".join(cleaned_lines).strip()
        items.append(
            {
                "n": int(num),
                "id": reel_id,
                "handle": handle,
                "source": meta.get("source", ""),
                "duration": meta.get("duration") or meta.get("approximate_duration", ""),
                "uploader": meta.get("uploader", ""),
                "text": transcript,
            }
        )

    if extra_path.exists():
        extra = extra_path.read_text(encoding="utf-8")
        # Avoid duplicate if already in combined
        if "DfqqRuFRgmW" not in text:
            # Parse simple single transcript
            title_m = re.search(r"^#\s+(.+)$", extra, flags=re.M)
            source_m = re.search(r"(https://www\.instagram\.com/reel/\S+)", extra)
            # body after frontmatter-ish
            body_lines = []
            past = False
            for line in extra.splitlines():
                if line.startswith("#"):
                    past = True
                    continue
                if past:
                    body_lines.append(line)
            body = "\n".join(body_lines).strip()
            # drop metadata bullets at top
            cleaned = []
            started = False
            for line in body.splitlines():
                if not started and (line.startswith("- ") or not line.strip()):
                    continue
                started = True
                cleaned.append(line)
            items.append(
                {
                    "n": len(items) + 1,
                    "id": "DfqqRuFRgmW",
                    "handle": "",
                    "source": source_m.group(1) if source_m else "",
                    "duration": "",
                    "uploader": title_m.group(1).strip() if title_m else "",
                    "text": "\n".join(cleaned).strip(),
                    "newer": True,
                }
            )
    return items


def howto_film() -> dict:
    return {
        "title": "How to film",
        "steps": [
            {
                "n": 1,
                "title": "Pick one hook",
                "body": "Open Hooks. Choose a single opening line that matches the reel’s idea. One hook per reel — don’t stack.",
            },
            {
                "n": 2,
                "title": "Grab the matching script",
                "body": "In Scripts, find the same category and number. Say it as written, or keep the hook and paraphrase the body. Swap [number] / [result] before you walk.",
            },
            {
                "n": 3,
                "title": "Osmo walk & film",
                "body": "Pocket on a short grip, AirPods in, natural walk. Glance at camera — don’t stare at the phone. Film one reel, then next.",
            },
        ],
        "cue": "For paraphrase-from-listen reels, use the Cue sheet: Listen → pause → say it in your words → next.",
        "voice": "Optional: Voice Film Player for hands-free AirPods control while filming.",
    }


def main() -> None:
    hooks = parse_hooks(read("opening-line-hooks.md"))
    scripts = parse_scripts(read("opening-line-reel-scripts-film-ready.md"))
    cue = parse_cue_sheet(read("walk-film-cue-sheet.md"))
    transcripts = parse_transcripts(read("instagram-reels-transcripts.md"))

    voice_exists = Path("/cursor/stores/self/apps/voice-film-player/index.html").exists()

    hook_count = sum(len(c["items"]) for c in hooks)
    script_count = sum(len(c["scripts"]) for c in scripts)

    data = {
        "brand": "Walk Film Kit",
        "for": "Daelum Marx",
        "hookCount": hook_count,
        "scriptCount": script_count,
        "hooks": hooks,
        "scripts": scripts,
        "cue": cue,
        "transcripts": transcripts,
        "howto": howto_film(),
        "voiceFilmPlayer": {
            "available": voice_exists,
            "label": "Voice Film Player",
            "note": "Hands-free AirPods player for cue-sheet reels (Safari + mic).",
            "relativeHint": "../voice-film-player/ (store copy) — open published URL when available.",
        },
    }

    OUT.write_text(
        "window.REEL_KIT_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {OUT.name}: {hook_count} hooks, {script_count} scripts, "
        f"{len(cue['reels'])} cue reels, {len(transcripts)} transcripts"
    )


if __name__ == "__main__":
    main()
