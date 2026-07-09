# CLAUDE.md

## Localization

English is the source of truth (pages at the root). The core site + blog are
fully translated into **Japanese (`/ja/`), Chinese (`/zh/`), Korean (`/ko/`),
French (`/fr/`), Spanish (`/es/`), German (`/de/`), and Italian (`/it/`)**
(plus single-page Classical Chinese `/lzh/`, Cantonese `/yue/`, and Tibetan
`/bo/` landing variants). Whenever content is added or changed in English, the
corresponding files in every locale that has that page must be updated to match.

- English pages live at the root: `index.html`, `work.html`, `consulting.html`, etc.
- Each locale mirrors the tree under its prefix: `<locale>/index.html`,
  `<locale>/work.html`, `<locale>/blog/<slug>.html`, etc.
- The 6 long literary/academic essays (`bacchus`, `bccwj`, `chang`, `jasei`,
  `moyan`, `yang`) are localized as full translations in `/ja/` but as short
  stubs (translated intro + "read the full text in English" link) in `/ko/`, and
  are intentionally **not** present in `/fr` `/es` `/de` `/it` (their English
  pages only cross-link ja/zh/ko). Everything else in a locale is a full translation.
- The nav in `_layouts/main.html` has a `{% if page.lang == '…' %}` cascade with
  a block per locale (assign cascade, nav-links, language-switcher `<li>`, and the
  blog author/"continue reading" block). Update every locale block when nav
  links change.
- Front matter cross-links every locale to its counterparts. On a non-English
  page, `lang_url` holds the **English** URL; the other locales use
  `lang_url_ja` / `lang_url_zh` / `lang_url_ko` / `lang_url_fr` / `lang_url_es` /
  `lang_url_de` / `lang_url_it` (omitting the page's own locale). English pages
  set `lang_url: /ja/...` plus `lang_url_zh` / `lang_url_ko` / `lang_url_fr` /
  `lang_url_es` / `lang_url_de` / `lang_url_it`. The language switcher only shows
  a locale when the matching `lang_url_*` is present, so add all of them.
- Internal same-site links inside a localized page point at the locale-prefixed
  counterpart where one exists (e.g. `/fr/work.html`), falling back to the
  root/English URL for pages that aren't localized in that locale.
- `scripts/_localize_new_locales.py` (scaffold + front-matter assertion) and
  `scripts/_localize_links.py` (internal-link localization) are one-off helpers
  used to add a locale; pages are maintained by hand thereafter.

When making any content change to an English page, always make the equivalent
update to its counterparts in every locale that has that page, in the same commit.

## LLM API schemas

Before implementing or updating any LLM API call (Gemini, Claude, OpenAI, etc.), always confirm the current model ID strings and endpoint schema with a web search. Model IDs change frequently and previews are deprecated — never assume a model ID from memory.

## Pull request reviews

After opening a PR, always self-review the diff and post a comment noting any issues found and fixes applied. When Gemini code review comments arrive, always address them: apply the fix if the point is valid, or reply explaining why it isn't. Never leave a Gemini review comment unacknowledged.
