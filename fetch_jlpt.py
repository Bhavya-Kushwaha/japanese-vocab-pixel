"""
fetch_jlpt.py — Downloads complete JLPT vocabulary (N5–N1) from Jisho API
and saves them as static/jlpt/n{level}.json in the app's format.

Usage:
    python fetch_jlpt.py            # fetch all levels
    python fetch_jlpt.py n5         # fetch only N5
"""

import requests
import json
import time
import sys
import os

OUTPUT_DIR = os.path.join("static", "jlpt")
DELAY = 0.6          # seconds between API calls (be polite to Jisho)
MAX_EMPTY_PAGES = 2  # stop after this many consecutive empty pages


def fetch_level(level_num: int) -> list:
    """Paginate through all Jisho results for a given JLPT level."""
    tag = f"%23jlpt-n{level_num}"
    words = []
    seen = set()
    page = 1
    empty_streak = 0

    while True:
        url = f"https://jisho.org/api/v1/search/words?keyword={tag}&page={page}"
        try:
            resp = requests.get(url, timeout=60)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"  WARNING: Error on page {page}: {e}. Retrying in 5 s...")
            time.sleep(5)
            continue

        entries = data.get("data", [])

        if not entries:
            empty_streak += 1
            if empty_streak >= MAX_EMPTY_PAGES:
                break
            page += 1
            time.sleep(DELAY)
            continue

        empty_streak = 0

        for entry in entries:
            jp = entry.get("japanese", [{}])[0]
            kanji   = jp.get("word") or jp.get("reading", "")
            reading = jp.get("reading") or kanji
            senses  = entry.get("senses", [])
            meaning = senses[0]["english_definitions"][0] if senses else ""

            if not kanji or kanji in seen:
                continue
            seen.add(kanji)

            words.append({
                "kanji":   kanji,
                "reading": reading,
                "meaning": meaning
            })

        print(f"  Page {page:3d} -> {len(entries)} entries  |  total so far: {len(words)}")
        page += 1
        time.sleep(DELAY)

    return words


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Determine which levels to fetch
    arg = sys.argv[1].lower() if len(sys.argv) > 1 else "all"
    if arg == "all":
        levels = [5, 4, 3, 2, 1]
    elif arg.startswith("n") and arg[1:].isdigit():
        levels = [int(arg[1:])]
    else:
        print(f"Unknown argument '{arg}'. Use: all | n5 | n4 | n3 | n2 | n1")
        sys.exit(1)

    for n in levels:
        print(f"\n{'='*50}")
        print(f"Fetching JLPT N{n} vocabulary from Jisho...")
        print(f"{'='*50}")

        words = fetch_level(n)

        out_path = os.path.join(OUTPUT_DIR, f"n{n}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(words, f, ensure_ascii=False, indent=2)

        print(f"  OK: N{n}: {len(words)} words saved -> {out_path}")

    print("\nDone! All levels fetched.")


if __name__ == "__main__":
    main()
