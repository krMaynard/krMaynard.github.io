---
name: run-krmaynard-site
description: Build, serve, and screenshot the krmaynard.github.io Jekyll site — especially blog posts. Use when asked to run/serve/build the site, preview or screenshot a blog post (any language), verify a new post renders, check light/dark themes, or author a new post with its ja/zh/ko translations. Drives the real built site via jekyll + WeasyPrint (this container has no browser).
---

# Run krmaynard.github.io

Personal Jekyll site (static, GitHub-Pages-built). The thing you almost always
want is to **preview a blog post** — see it rendered with the real layout, nav,
and `styles.css`, in light and dark, across `en/ja/zh/ko`.

There is **no browser in this container** (no Chromium; apt is locked down), so
there is nothing for `chromium-cli` to drive. The driver instead does
`jekyll build` → serves `_site/` over HTTP → renders the page to PNG with
WeasyPrint. It drives the **real built output** (Liquid + layouts processed),
not the raw source files.

> Paths below are relative to the repo root (`krMaynard.github.io/`).
> The driver is `.claude/skills/run-krmaynard-site/driver.py`.

## Prerequisites

```bash
gem install jekyll --no-document                         # Jekyll 4.4.1 here
python3 -m pip install weasyprint pypdfium2 pillow requests
```

Gem-installed `jekyll` is not on `PATH` by default — the driver adds it
internally, but for any direct `jekyll` call:

```bash
export PATH="$PATH:$(ruby -e 'puts Gem.bindir')"
```

## Run (agent path) — preview/screenshot a post

This is the path to use. Screenshots land in `/tmp/site-preview/` as
`<slug>.<lang>.<theme>.png`.

```bash
# one post, English, light + dark
python3 .claude/skills/run-krmaynard-site/driver.py chinese-language-trip-maps

# all four locales, light only (verify translations render)
python3 .claude/skills/run-krmaynard-site/driver.py chinese-language-trip-maps --langs en,zh,ja,ko --themes light

# list available post slugs
python3 .claude/skills/run-krmaynard-site/driver.py --list

# any non-post page
python3 .claude/skills/run-krmaynard-site/driver.py --path /index.html --themes light
```

Then **look at the PNG** (Read it). A correct render shows the site nav,
the `WRITING` eyebrow, title, tag pills, and body. Blank/untemplated output
means it rendered source instead of built HTML — see Gotchas.

Flags: `--langs en,zh,ja,ko` · `--themes light,dark` · `--out DIR` · `--path /x.html` · `--list`.

## Author a new post (what `CLAUDE.md` requires)

A post is **eight files**, all in one commit, or the site breaks:

1. `blog/<slug>.html` (en) + `ja/blog/<slug>.html`, `zh/blog/<slug>.html`, `ko/blog/<slug>.html`.
   - Front matter: `layout: main`, `title`, `description`, `date`, `lang`, and the
     cross-links — en uses `lang_url` (→ja), `lang_url_zh`, `lang_url_ko`; each
     translation points `lang_url` back to en plus the other two.
   - Body: `<article class="post">` → `<a class="post-back">← Blog</a>` →
     `<header class="post-header">` (`<p class="section-label">`, `<h1>`, `<time>`,
     `<div class="tags">`) → `<div class="post-body">` (`<p>`/`<h2>`) → JSON-LD block.
     Copy an existing post (e.g. `blog/fable-5-security-review.html`) as the template.
2. A listing card at the **top** of `blog.html` **and** `ja/blog.html`,
   `zh/blog.html`, `ko/blog.html` (match the existing `news-entry` markup).

Then preview all four with the driver above before committing.

## Run (human path)

```bash
export PATH="$PATH:$(ruby -e 'puts Gem.bindir')"
jekyll serve --port 4123 --no-watch          # http://127.0.0.1:4123/
```

Serves the real site, but headless there's nothing to view it with — use the
driver to get an actual image. Ctrl-C to stop.

## Test

```bash
npm test            # node tests/vlop-dashboard.test.js — unrelated to posts
```

CI (`.github/workflows/ci.yml`) only runs Node checks; it never builds Jekyll.
The live site is built by GitHub Pages on push to `master`.

## Gotchas

- **No browser, by design.** No Chromium/Chrome; apt can't install one here.
  `chromium-cli` is absent. WeasyPrint is the renderer — the driver builds
  to PDF then rasterizes with pypdfium2 (this WeasyPrint has no `write_png`).
- **Theme is JS-only.** The layout sets `data-theme` from a `<script>`
  (localStorage / `prefers-color-scheme`). WeasyPrint runs no JS, so the driver
  **injects `data-theme`** itself — that's how `--themes light,dark` works.
- **Raw post files are Liquid templates.** `blog/<slug>.html` has front matter,
  `{{ }}`, and a JSON-LD `{{ page.title | jsonify }}`. Rendering the source shows
  gibberish — you must `jekyll build` first (the driver does).
- **Absolute asset paths.** Built pages link `/styles.css`. A `file://` base
  can't resolve that, so the driver serves `_site/` over HTTP and renders the
  URL. (Don't "simplify" it to render the file directly.)
- **No Gemfile.** GitHub Pages builds Jekyll remotely; locally you install it
  yourself. `gem`-installed `jekyll` lives in `$(ruby -e 'puts Gem.bindir')`.
- **`ja/zh/ko` are mandatory** (`CLAUDE.md`): a post without all three
  translations + the four listing updates 404s the language switcher.
- **Merging a post auto-posts to LinkedIn.** `.github/workflows/linkedin-post.yml`
  fires on push to `master` touching `blog.html`. Heads-up before merging a PR.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `jekyll: command not found` | `export PATH="$PATH:$(ruby -e 'puts Gem.bindir')"` |
| `OptionParser::NeedlessArgument: --skip-initial-build...` | flag doesn't exist; use `jekyll serve --port N --no-watch` |
| `'HTML' object has no attribute 'write_png'` | expected — driver renders PDF→PNG via pypdfium2, not `write_png` |
| Screenshot is blank / shows `{{ ... }}` | you rendered source, not built HTML — run via the driver (it `jekyll build`s first) |
| `ModuleNotFoundError: weasyprint` | run the pip line in Prerequisites |
