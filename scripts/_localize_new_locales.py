#!/usr/bin/env python3
"""One-off scaffolder: add fr/es/de/it locales for parity with ja/zh/ko.

- Augments front matter of existing en/ja/zh/ko pages (and lzh/yue/bo index)
  with lang_url_fr/es/de/it cross-links.
- Scaffolds fr/es/de/it page files with correct plumbing front matter and the
  English body copied verbatim (to be translated in place afterwards).

Idempotent: re-running skips links/files that already exist.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NEW = ["fr", "es", "de", "it"]

# The 27 pages that get full fr/es/de/it translations (mirrors the ko set,
# minus the 6 long literary essays which are intentionally skipped).
CORE = [
    "index.html", "work.html", "consulting.html", "contact.html",
    "transparency.html", "vlop.html", "ny-tos.html", "google-removals.html",
    "privacy.html", "privacy-story-generator.html", "image-generator.html",
    "markdown-viewer.html", "blog.html", "rashomon.html",
]
BLOG = [
    "blog/ab587-vs-s895.html", "blog/chinese-language-trip-maps.html",
    "blog/dsa-transparency-requirements.html", "blog/dsa-vlop-data-limitations.html",
    "blog/fable-5-security-review.html", "blog/google-removal-dashboard.html",
    "blog/google-removal-observations.html", "blog/llms-compliance-pm.html",
    "blog/prompt-log-ai-workflows.html", "blog/roblox-ca-ny-reports.html",
    "blog/roblox-dsa-2025.html", "blog/vlop-dashboard-update.html",
    "blog/vlop-dashboard.html",
]
PAGES = CORE + BLOG


def url_for(locale, page):
    """URL of `page` in `locale`. index.html uses directory-style URLs."""
    if page == "index.html":
        return "/" if locale == "en" else "/%s/" % locale
    return ("/%s" % page) if locale == "en" else "/%s/%s" % (locale, page)


def split_front_matter(text):
    lines = text.splitlines()
    assert lines[0] == "---", "no front matter"
    end = lines.index("---", 1)
    fm = lines[1:end]
    body = "\n".join(lines[end + 1:])
    return fm, body


def lang_block(locale, page, index_extra):
    """Build the lang:/lang_url* lines for a target locale page."""
    out = ["lang: %s" % locale]
    # `lang_url` is the English URL (matches ja/zh/ko convention).
    out.append("lang_url: %s" % url_for("en", page))
    order = ["ja", "zh", "ko"]
    if index_extra:
        order += ["lzh", "yue", "bo"]
    order += [l for l in NEW]
    for x in order:
        if x == locale:
            continue
        out.append("lang_url_%s: %s" % (x, url_for(x, page)))
    return out


def scaffold():
    created = 0
    for page in PAGES:
        en_path = os.path.join(ROOT, page)
        if not os.path.exists(en_path):
            print("  SKIP (no en source):", page)
            continue
        with open(en_path, encoding="utf-8") as f:
            fm, body = split_front_matter(f.read())
        kept = [l for l in fm if not (l.startswith("lang:") or l.startswith("lang_url"))]
        index_extra = (page == "index.html")
        for locale in NEW:
            dst = os.path.join(ROOT, locale, page)
            if os.path.exists(dst):
                continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            new_fm = kept + lang_block(locale, page, index_extra)
            with open(dst, "w", encoding="utf-8") as f:
                f.write("---\n" + "\n".join(new_fm) + "\n---\n" + body)
            created += 1
    print("scaffolded %d files" % created)


def augment_existing():
    """Add lang_url_fr/es/de/it to en/ja/zh/ko pages (+ lzh/yue/bo index)."""
    changed = 0
    for page in PAGES:
        locales = ["", "ja", "zh", "ko"]
        if page == "index.html":
            locales += ["lzh", "yue", "bo"]
        for loc in locales:
            path = os.path.join(ROOT, loc, page) if loc else os.path.join(ROOT, page)
            if not os.path.exists(path):
                continue
            with open(path, encoding="utf-8") as f:
                text = f.read()
            fm, body = split_front_matter(text)
            add = []
            for x in NEW:
                key = "lang_url_%s:" % x
                if any(l.startswith(key) for l in fm):
                    continue
                add.append("lang_url_%s: %s" % (x, url_for(x, page)))
            if not add:
                continue
            new_fm = fm + add
            with open(path, "w", encoding="utf-8") as f:
                f.write("---\n" + "\n".join(new_fm) + "\n---\n" + body)
            changed += 1
    print("augmented %d existing files" % changed)


def fix_front_matter():
    """Re-assert correct lang/lang_url block on every new-locale file.

    Preserves whatever the translators changed above the lang block (title,
    description, date, etc.) and the body, but rewrites lang:/lang_url* to the
    canonical values — defends against any plumbing drift during translation.
    """
    fixed = 0
    for page in PAGES:
        index_extra = (page == "index.html")
        for locale in NEW:
            path = os.path.join(ROOT, locale, page)
            if not os.path.exists(path):
                continue
            with open(path, encoding="utf-8") as f:
                fm, body = split_front_matter(f.read())
            kept = [l for l in fm if not (l.startswith("lang:") or l.startswith("lang_url"))]
            new_fm = kept + lang_block(locale, page, index_extra)
            new_text = "---\n" + "\n".join(new_fm) + "\n---\n" + body
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_text)
            fixed += 1
    print("fixed front matter on %d files" % fixed)


if __name__ == "__main__":
    import sys
    if "--fix-fm" in sys.argv:
        fix_front_matter()
    else:
        augment_existing()
        scaffold()
