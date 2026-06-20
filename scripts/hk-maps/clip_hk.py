"""Clip Natural Earth 10m land to the Hong Kong region, simplify, and emit a
compact JSON of polygon rings in [lon, lat] for the offline map renderer."""
import json
from shapely.geometry import shape, box, mapping
from shapely.ops import unary_union

# Generous HK bbox: includes Lantau + airport (west ~113.92) and outlying isles.
BBOX = box(113.55, 22.10, 114.55, 22.62)

def load(path):
    with open(path) as f:
        gj = json.load(f)
    geoms = []
    for feat in gj["features"]:
        try:
            geoms.append(shape(feat["geometry"]))
        except Exception:
            pass
    return geoms

geoms = load("data/ne_10m_land.geojson") + load("data/ne_10m_minor_islands.geojson")

clipped = []
for g in geoms:
    if not g.is_valid:
        g = g.buffer(0)
    if g.intersects(BBOX):
        inter = g.intersection(BBOX)
        if inter.is_empty:
            continue
        # Keep only area geometries: a polygon that merely touches the bbox edge
        # can clip to a LineString/Point, which would turn the union into a
        # GeometryCollection and silently empty the output.
        if inter.geom_type in ("Polygon", "MultiPolygon"):
            clipped.append(inter)
        elif inter.geom_type == "GeometryCollection":
            clipped.extend(p for p in inter.geoms
                           if p.geom_type in ("Polygon", "MultiPolygon"))

merged = unary_union(clipped)

# Simplify a touch for smooth, light output (~50 m tolerance).
merged = merged.simplify(0.0006, preserve_topology=True)

def rings_of(geom):
    out = []
    if geom.geom_type == "Polygon":
        polys = [geom]
    elif geom.geom_type == "MultiPolygon":
        polys = list(geom.geoms)
    else:
        return out
    for p in polys:
        ext = [[round(x, 5), round(y, 5)] for x, y in p.exterior.coords]
        holes = [[[round(x, 5), round(y, 5)] for x, y in r.coords] for r in p.interiors]
        out.append({"exterior": ext, "holes": holes})
    return out

rings = rings_of(merged)
rings.sort(key=lambda r: -len(r["exterior"]))

with open("hk_land.json", "w") as f:
    json.dump(rings, f)

# Diagnostics: how many distinct land polygons sit in the core harbour box?
core = box(114.13, 22.27, 114.20, 22.31)
core_polys = [p for p in (merged.geoms if merged.geom_type == "MultiPolygon" else [merged])
              if p.intersects(core)]
print(f"total polygons in HK bbox: {len(rings)}")
print(f"polygons touching core-harbour box: {len(core_polys)}")
print(f"largest ring vertex counts: {[len(r['exterior']) for r in rings[:6]]}")
print(f"output bytes: {len(json.dumps(rings))}")
