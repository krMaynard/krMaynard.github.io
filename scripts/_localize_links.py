#!/usr/bin/env python3
"""Normalize internal links in the fr/es/de/it pages to the locale prefix.

Rule: a root-relative link `/foo` is rewritten to `/<locale>/foo` **iff** the
localized target `<locale>/foo` actually exists on disk. Links whose localized
counterpart we did not create (the skipped literary essays, /homework/,
/murakami/, other-locale home links like /ja/, and all static assets) are left
pointing at the English/root version — a correct fallback, never a broken link.

Idempotent: links already under `/<locale>/` are skipped. External URLs,
mailto:, and pure anchors are never touched.
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEW = ["fr", "es", "de", "it"]

ATTR = re.compile(r'(href|src)="(/[^"]*)"')


def rewrite(loc, val):
    if val.startswith("//"):
        return val
    if val.startswith("/%s/" % loc) or val == "/%s" % loc:
        return val
    # split off query/fragment
    m = re.match(r'^([^?#]*)([?#].*)?$', val)
    base, suffix = m.group(1), m.group(2) or ""
    if base == "/":
        target = os.path.join(ROOT, loc, "index.html")
        newbase = "/%s/" % loc
    else:
        rel = base.lstrip("/")
        if base.endswith("/"):
            target = os.path.join(ROOT, loc, rel, "index.html")
        else:
            target = os.path.join(ROOT, loc, rel)
        newbase = "/%s%s" % (loc, base)
    if os.path.exists(target):
        return newbase + suffix
    return val


def main():
    changed = 0
    for loc in NEW:
        for dirpath, _dirs, files in os.walk(os.path.join(ROOT, loc)):
            for fn in files:
                if not fn.endswith(".html"):
                    continue
                path = os.path.join(dirpath, fn)
                text = open(path, encoding="utf-8").read()
                # only touch the body (after the front matter), never front matter
                parts = text.split("\n")
                end = parts.index("---", 1)
                head = "\n".join(parts[:end + 1])
                body = "\n".join(parts[end + 1:])
                new_body = ATTR.sub(
                    lambda mm: '%s="%s"' % (mm.group(1), rewrite(loc, mm.group(2))),
                    body,
                )
                if new_body != body:
                    open(path, "w", encoding="utf-8").write(head + "\n" + new_body)
                    changed += 1
    print("rewrote internal links in %d files" % changed)


if __name__ == "__main__":
    main()
