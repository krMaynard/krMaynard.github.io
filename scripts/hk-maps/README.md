# Hong Kong itinerary maps — offline generator

The Chinese-labelled maps in [`/hk-trip.html`](../../hk-trip.html) and the
[blog post](../../blog/hong-kong-itinerary-offline-maps.html) are rendered here,
with **no map-tile service** involved. The basemap is real coastline geometry
from [Natural Earth](https://www.naturalearthdata.com/) (10 m), clipped to Hong
Kong and drawn as SVG, then rasterised to PNG with a headless browser.

This was written by Claude Code inside a sandbox whose network egress allowlist
blocked every tile/map host (Google, OSM, Mapbox, Carto, …) but left GitHub, npm
and PyPI reachable — so the map data comes from a GitHub-hosted dataset and the
renderer is local.

## Files

| File | What it is |
|------|------------|
| `clip_hk.py` | Clips Natural Earth 10 m land to the HK bbox (`shapely`), simplifies, writes `hk_land.json`. |
| `hk_land.json` | The clipped HK coastline (≈18 KB). Committed so rendering needs no download. |
| `render.js` | Projects the coastline to Web Mercator, draws each map (pins, Chinese labels, scale bar, north arrow) as SVG, screenshots to PNG via Playwright Chromium. |

## Re-render the maps (uses committed data)

```bash
npm install playwright
npx playwright install chromium
node render.js            # writes out/*.png
```

## Rebuild the coastline from source (optional)

```bash
pip install shapely
mkdir -p data && cd data
curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson
curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_minor_islands.geojson
cd .. && python3 clip_hk.py   # regenerates hk_land.json
```

Point-of-interest coordinates and the per-map views live at the top of
`render.js`. CJK glyphs need a CJK font installed (e.g. Noto Sans CJK or
WenQuanYi Zen Hei on Linux).

Basemap data © Natural Earth (public domain).
