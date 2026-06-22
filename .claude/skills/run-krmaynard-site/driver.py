#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Preview driver for the krmaynard.github.io Jekyll site.

Builds the site with Jekyll, serves _site/ over HTTP, and screenshots one or
more pages to PNG (light + dark) with WeasyPrint -> pypdfium2. This drives the
REAL built output (Liquid + layouts processed), which is what a future agent
needs to verify a new/edited blog post actually renders.

Why not a headless browser? This container has no Chromium and apt is locked
down, so there's nothing for chromium-cli to drive. WeasyPrint renders the
served HTML + the site's real styles.css; the theme toggle is JS-only, so the
driver injects `data-theme` itself.

Usage:
  driver.py <slug> [--langs en,zh,ja,ko] [--themes light,dark] [--out DIR]
  driver.py --path /index.html --themes light          # any page, not just posts
  driver.py --list                                     # list blog post slugs

Examples (run from repo root):
  python3 .claude/skills/run-krmaynard-site/driver.py chinese-language-trip-maps
  python3 .claude/skills/run-krmaynard-site/driver.py fable-5-security-review --themes light --langs en
"""
import argparse, functools, http.server, io, os, re, socketserver, subprocess, sys, threading
from pathlib import Path

import requests
import weasyprint
import pypdfium2 as pdfium
from PIL import Image

REPO = Path(__file__).resolve().parents[3]          # …/.claude/skills/run-…/driver.py -> repo
SITE = REPO / "_site"
PAGE_W = 1000           # desktop viewport width for the single tall print page
PAGE_H = 7200

def jekyll_env():
    env = dict(os.environ)
    try:
        bindir = subprocess.check_output(["ruby", "-e", "puts Gem.bindir"], text=True).strip()
        env["PATH"] = bindir + os.pathsep + env.get("PATH", "")
    except Exception:
        pass
    return env

def build_site():
    print("• jekyll build …", flush=True)
    r = subprocess.run(["jekyll", "build"], cwd=REPO, env=jekyll_env(),
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit("jekyll build failed:\n" + r.stdout + r.stderr)
    if not SITE.exists():
        sys.exit("jekyll build produced no _site/")
    print("  built ->", SITE, flush=True)

def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler,
                                directory=str(SITE))
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]

def crop_bottom(img):
    px = img.load(); w, h = img.size; bg = px[4, 4]; last = h - 1
    for y in range(h - 1, -1, -1):
        for x in range(0, w, 7):
            p = px[x, y]
            if abs(p[0]-bg[0]) + abs(p[1]-bg[1]) + abs(p[2]-bg[2]) > 24:
                last = y; break
        else:
            continue
        break
    return img.crop((0, 0, w, min(h, last + 60)))

def render(port, path, theme, out_png):
    url = f"http://127.0.0.1:{port}{path}"
    html = requests.get(url, timeout=30).text
    # force the JS-only theme, and pin a single tall print page at desktop width
    html = re.sub(r"<html([^>]*)>",
                  lambda m: f'<html{m.group(1)} data-theme="{theme}">', html, count=1)
    html = html.replace("</head>",
                        f"<style>@page{{size:{PAGE_W}px {PAGE_H}px;margin:0}}</style></head>", 1)
    pdf = io.BytesIO()
    weasyprint.HTML(string=html, base_url=url).write_pdf(pdf)
    pdf.seek(0)
    img = pdfium.PdfDocument(pdf.read())[0].render(scale=1.5).to_pil().convert("RGB")
    crop_bottom(img).save(out_png)
    print("  ✓", out_png, flush=True)

def post_paths(slug, langs):
    out = []
    for lang in langs:
        out.append(("en" if lang == "en" else lang,
                    f"/blog/{slug}.html" if lang == "en" else f"/{lang}/blog/{slug}.html"))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?", help="blog post slug, e.g. chinese-language-trip-maps")
    ap.add_argument("--path", help="render an arbitrary site path instead, e.g. /index.html")
    ap.add_argument("--langs", default="en", help="comma list: en,zh,ja,ko (post mode)")
    ap.add_argument("--themes", default="light,dark", help="comma list: light,dark")
    ap.add_argument("--out", default="/tmp/site-preview", help="output dir")
    ap.add_argument("--list", action="store_true", help="list blog post slugs and exit")
    args = ap.parse_args()

    if args.list:
        for p in sorted((REPO / "blog").glob("*.html")):
            print(p.stem)
        return

    build_site()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    themes = [t.strip() for t in args.themes.split(",") if t.strip()]

    if args.path:
        targets = [("page", args.path)]
        stem = re.sub(r"\W+", "_", args.path.strip("/")) or "index"
    elif args.slug:
        targets = post_paths(args.slug, [l.strip() for l in args.langs.split(",")])
        stem = args.slug
    else:
        sys.exit("give a <slug>, or --path /foo.html, or --list")

    httpd, port = serve()
    try:
        for tag, path in targets:
            for theme in themes:
                render(port, path, theme, str(out / f"{stem}.{tag}.{theme}.png"))
    finally:
        httpd.shutdown()
    print(f"\nDone. {len(targets)*len(themes)} screenshot(s) in {out}")

if __name__ == "__main__":
    main()
