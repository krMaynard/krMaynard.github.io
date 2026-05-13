# CLAUDE.md

## Localization

The site has full translations in Japanese (`/ja/`) and Chinese (`/zh/`). Whenever content is added or changed in English, the corresponding Japanese and Chinese files must be updated to match.

- English pages live at the root: `index.html`, `work.html`, `consulting.html`, etc.
- Japanese counterparts live under `/ja/`: `ja/index.html`, `ja/work.html`, `ja/consulting.html`, etc.
- Chinese counterparts live under `/zh/`: `zh/index.html`, `zh/work.html`, `zh/consulting.html`, etc.
- The nav in `_layouts/main.html` has blocks for `en`, `ja`, and `zh` (`{% if page.lang == 'ja' %}` / `{% elsif page.lang == 'zh' %}`). Update all three when nav links change.
- Front matter on each page:
  - English pages: `lang: en`, `lang_url: /ja/...` (Japanese URL), `lang_url_zh: /zh/...` (Chinese URL)
  - Japanese pages: `lang: ja`, `lang_url: /...` (English URL), `lang_url_zh: /zh/...` (Chinese URL)
  - Chinese pages: `lang: zh`, `lang_url: /...` (English URL), `lang_url_ja: /ja/...` (Japanese URL)

When making any content change to an English page, always make the equivalent update to its Japanese and Chinese counterparts in the same commit.
