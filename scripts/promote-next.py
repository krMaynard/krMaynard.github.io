#!/usr/bin/env python3
"""Promote the next staged dataset post to live.

For the next post in RELEASE_ORDER whose English file still has
`published: false`, this: removes that line (publishes it) in en/ja/zh/ko,
stamps today's date, and inserts a listing card atop each locale's blog.html.
Self-contained: card title/excerpt/tags are read from the post files.

Usage:  python3 scripts/promote-next.py [--date YYYY-MM-DD] [--slug SLUG] [--dry-run]
Commits but does NOT push. Prints the promoted slug ("" if none left).
Run once per day, then `git push` to publish (this also fires the LinkedIn workflow).
"""
import os, re, sys, subprocess, datetime

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RELEASE_ORDER = [
    "dsa-appeals-do-they-work", "dsa-moderator-headcount", "meta-cser-eight-years",
    "apple-transparency-report", "google-user-data-requests", "microsoft-law-enforcement-requests",
    "github-transparency-report", "tiktok-two-transparency-streams", "snap-transparency-report",
    "discord-transparency-report", "android-pha-rates", "singapore-online-safety-scores",
    "australia-bose-findings", "eu-tco-transparency", "turkey-5651-reports",
    "korea-naver-kakao-requests", "korea-network-act-report", "japan-johoplatform-act",
    "india-it-rules-compliance", "taiwan-anti-fraud-transparency", "china-report-hotlines",
    "texas-austria-youtube-reports", "linkedin-government-requests",
]

def _post_path(lang, slug):
    return f"{REPO}/blog/{slug}.html" if lang == "en" else f"{REPO}/{lang}/blog/{slug}.html"

def date_display(lang, d):
    if lang in ("ja", "zh"): return f"{d.year}年{d.month}月{d.day}日"
    if lang == "ko": return f"{d.year}년 {d.month}월 {d.day}일"
    return d.strftime("%B ") + f"{d.day}, {d.year}"

def card(lang, slug, d):
    s = open(_post_path(lang, slug)).read()
    title = re.search(r"<h1>(.*?)</h1>", s, re.S).group(1).strip()
    body = s.split('<div class="post-body">', 1)[1]
    exc = re.search(r"<p><em>(.*?)</em></p>", body, re.S).group(1).strip()
    tags_block = re.search(r'<div class="tags">(.*?)</div>', s, re.S).group(1)
    tags = re.findall(r'<span class="tag">(.*?)</span>', tags_block)
    href = f"/blog/{slug}.html" if lang == "en" else f"/{lang}/blog/{slug}.html"
    iso = d.isoformat()
    th = "\n".join(f'        <span class="tag">{t}</span>' for t in tags)
    return (f'  <div class="news-entry" id="{iso}-{slug}">\n'
            f'    <time class="news-date" datetime="{iso}">{date_display(lang, d)}</time>\n'
            f'    <div class="news-body">\n      <h3><a href="{href}">{title}</a></h3>\n'
            f'      <p>{exc}</p>\n      <div class="tags">\n{th}\n      </div>\n    </div>\n  </div>\n\n')

def promote(slug, d, dry):
    changed = []
    for lang in ("en", "ja", "zh", "ko"):
        post = _post_path(lang, slug)
        s = open(post).read()
        if "published: false" not in s:
            raise SystemExit(f"{post} is not a draft (already published?)")
        s = s.replace("published: false\n", "")
        s = re.sub(r"date: \d{4}-\d{2}-\d{2}", f"date: {d.isoformat()}", s, count=1)
        bl = f"{REPO}/blog.html" if lang == "en" else f"{REPO}/{lang}/blog.html"
        b = open(bl).read()
        idx = b.find('<div class="news-entry"')
        c = card(lang, slug, d)
        if not dry:
            open(post, "w").write(s)
            open(bl, "w").write(b[:idx] + c + b[idx:])
        changed += [post, bl]
    return changed

def main():
    args = sys.argv[1:]
    dry = "--dry-run" in args
    d = datetime.date.fromisoformat(args[args.index("--date")+1]) if "--date" in args else datetime.date.today()
    if "--slug" in args:
        slug = args[args.index("--slug")+1]
    else:
        slug = next((s for s in RELEASE_ORDER
                     if os.path.exists(_post_path("en", s))
                     and "published: false" in open(_post_path("en", s)).read()), None)
    if not slug:
        print(""); return
    changed = promote(slug, d, dry)
    if not dry:
        subprocess.run(["git", "-C", REPO, "add"] + changed, check=True)
        subprocess.run(["git", "-C", REPO, "commit", "-q", "-m",
                        f"Publish dataset post: {slug} ({d.isoformat()})"], check=True)
    print(slug)

if __name__ == "__main__":
    main()
