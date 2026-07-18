#!/usr/bin/env python3
"""Promote the next staged dataset post to live.

For the next post in RELEASE_ORDER whose English file still has
`published: false`, this: removes that line in en + every localized version,
stamps today's date, and inserts a listing card atop each locale's blog.html.
The English listing card carries `data-li-langs` telling the LinkedIn workflow
which languages to post that article in.

Web language set is per post (EU-topic posts add fr/de/it/es on top of
ja/zh/ko). Self-contained: card title/excerpt/tags are read from the posts.

Usage:  python3 scripts/promote-next.py [--date YYYY-MM-DD] [--slug SLUG] [--dry-run]
        python3 scripts/promote-next.py --list
Commits but does NOT push. Prints the promoted slug ("" if none left).
"""
import datetime
import json
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

QUEUE_PATH = os.path.join(REPO, "data", "dsa-publish-queue.json")


def release_order():
    with open(QUEUE_PATH, encoding="utf-8") as f:
        queue = json.load(f)
    items = queue.get("items")
    if not isinstance(items, list) or not items or not all(isinstance(s, str) and s for s in items):
        raise SystemExit(f"{QUEUE_PATH}: items must be a non-empty list of slugs")
    duplicates = sorted({slug for slug in items if items.count(slug) > 1})
    if duplicates:
        raise SystemExit(f"{QUEUE_PATH}: duplicate slugs: {', '.join(duplicates)}")
    return items
# EU-topic posts: localized into fr/de/it/es too, and posted to LinkedIn in de/fr/en.
EU_POSTS = {"eu-tco-transparency", "dsa-appeals-do-they-work", "dsa-moderator-headcount",
            "texas-austria-youtube-reports", "turkey-5651-reports"}

def web_langs(slug):
    return ["ja", "zh", "ko", "fr", "de", "it", "es"] if slug in EU_POSTS else ["ja", "zh", "ko"]
def li_langs(slug):
    return "de fr en" if slug in EU_POSTS else "ja zh ko en"

def _post_path(lang, slug):
    return f"{REPO}/blog/{slug}.html" if lang == "en" else f"{REPO}/{lang}/blog/{slug}.html"

MONTHS = {
    "en": "January February March April May June July August September October November December".split(),
    "fr": "janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split(),
    "de": "Januar Februar März April Mai Juni Juli August September Oktober November Dezember".split(),
    "it": "gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre".split(),
    "es": "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(),
}
def date_display(lang, d):
    if lang in ("ja", "zh"): return f"{d.year}年{d.month}月{d.day}日"
    if lang == "ko": return f"{d.year}년 {d.month}월 {d.day}일"
    if lang == "fr": return f"{d.day} {MONTHS['fr'][d.month-1]} {d.year}"
    if lang == "de": return f"{d.day}. {MONTHS['de'][d.month-1]} {d.year}"
    if lang == "it": return f"{d.day} {MONTHS['it'][d.month-1]} {d.year}"
    if lang == "es": return f"{d.day} de {MONTHS['es'][d.month-1]} de {d.year}"
    return f"{MONTHS['en'][d.month-1]} {d.day}, {d.year}"

def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def _write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def card(lang, slug, d):
    s = _read(_post_path(lang, slug))
    title = re.search(r"<h1>(.*?)</h1>", s, re.S).group(1).strip()
    body = s.split('<div class="post-body">', 1)[1]
    exc = re.search(r"<p><em>(.*?)</em></p>", body, re.S).group(1).strip()
    tags = re.findall(r'<span class="tag">(.*?)</span>', re.search(r'<div class="tags">(.*?)</div>', s, re.S).group(1))
    href = f"/blog/{slug}.html" if lang == "en" else f"/{lang}/blog/{slug}.html"
    iso = d.isoformat()
    li = f' data-li-langs="{li_langs(slug)}"' if lang == "en" else ""
    th = "\n".join(f'        <span class="tag">{t}</span>' for t in tags)
    return (f'  <div class="news-entry" id="{iso}-{slug}"{li}>\n'
            f'    <time class="news-date" datetime="{iso}">{date_display(lang, d)}</time>\n'
            f'    <div class="news-body">\n      <h3><a href="{href}">{title}</a></h3>\n'
            f'      <p>{exc}</p>\n      <div class="tags">\n{th}\n      </div>\n    </div>\n  </div>\n\n')

def promote(slug, d, dry):
    changed = []
    for lang in ["en"] + web_langs(slug):
        post = _post_path(lang, slug)
        s = _read(post)
        if "published: false" not in s:
            raise SystemExit(f"{post} is not a draft (already published?)")
        s = s.replace("published: false\n", "")
        s = re.sub(r"date: \d{4}-\d{2}-\d{2}", f"date: {d.isoformat()}", s, count=1)
        bl = f"{REPO}/blog.html" if lang == "en" else f"{REPO}/{lang}/blog.html"
        b = _read(bl)
        idx = b.find('<div class="news-entry"')
        if idx == -1:
            raise SystemExit(f"{bl} has no news-entry insertion point")
        c = card(lang, slug, d)
        if not dry:
            _write(post, s)
            _write(bl, b[:idx] + c + b[idx:])
        changed += [post, bl]
    return changed


def is_staged(slug):
    post = _post_path("en", slug)
    return os.path.exists(post) and "published: false" in _read(post)


def print_queue():
    for position, slug in enumerate(release_order(), 1):
        status = "queued" if is_staged(slug) else "published"
        print(f"{position:02d}\t{status}\t{slug}")

def main():
    args = sys.argv[1:]
    if "--list" in args:
        print_queue()
        return
    dry = "--dry-run" in args
    d = datetime.date.fromisoformat(args[args.index("--date")+1]) if "--date" in args else datetime.date.today()
    if "--slug" in args:
        slug = args[args.index("--slug")+1]
        if not is_staged(slug):
            raise SystemExit(f"{slug} is not a staged post")
    else:
        slug = next((s for s in release_order() if is_staged(s)), None)
    if not slug:
        print(""); return
    changed = promote(slug, d, dry)
    if not dry:
        subprocess.run(["git", "-C", REPO, "add"] + changed, check=True)
        subprocess.run(["git", "-C", REPO, "commit", "-q", "-m", f"Publish dataset post: {slug} ({d.isoformat()})"], check=True)
    print(slug)

if __name__ == "__main__":
    main()
