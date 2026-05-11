# CLAUDE.md

## Japanese Localization

The site has a full Japanese translation under `/ja/`. Whenever content is added or changed in English, the corresponding Japanese file must be updated to match.

- English pages live at the root: `index.html`, `work.html`, `consulting.html`, etc.
- Japanese counterparts live under `/ja/`: `ja/index.html`, `ja/work.html`, `ja/consulting.html`, etc.
- The nav in `_layouts/main.html` has both an English and Japanese block (`{% if page.lang == 'ja' %}`). Update both when nav links change.
- `lang_url` in each page's front matter should point to the corresponding page in the other language.

When making any content change to an English page, always make the equivalent update to its Japanese counterpart in the same commit.
