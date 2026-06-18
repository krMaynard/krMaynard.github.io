"""Compare EUDSATDB SoR aggregates against platform-published DSA transparency reports.

Produces data/sor-comparison-{period}.json, consumed by the website comparison page
and optionally loaded into the research-api database.

Usage:
    python compare-reports.py --period H2-2025
    python compare-reports.py --sor data/sor-aggs-H2-2025.json --vlop data/vlop-dsa.json

Comparison scope (tables that map to SoR fields):
  t4.notices       ↔ SoR count with source_type=SOURCE_ARTICLE_16
  t4.tf_notices    ↔ SoR count with source_type=SOURCE_TRUSTED_FLAGGER
  t5.measures      ↔ SoR count with SOURCE_VOLUNTARY_ILLEGAL (own-init illegal)
  t6.measures      ↔ SoR count with SOURCE_VOLUNTARY_TOS (own-init ToS)

Tables with no SoR equivalent (not compared):
  t3 (member-state orders), t7 (appeals), t8 (automation),
  t9 (human resources), t10 (AMAR), t11 (qualitative)

A delta is flagged when:
  |reported - sor_derived| / max(reported, sor_derived, 1) > DELTA_THRESHOLD
"""
import argparse
import json
from pathlib import Path

HERE = Path(__file__).parent.parent
DATA = HERE / "data"

DELTA_THRESHOLD = 0.20  # 20 % discrepancy triggers a flag

PERIODS = {
    "H2-2025": ("2025-07-01", "2025-12-31"),
    "H1-2025": ("2025-01-01", "2025-06-30"),
    "H2-2024": ("2024-07-01", "2024-12-31"),
    "H1-2024": ("2024-01-01", "2024-06-30"),
}


def _delta_pct(reported: int | None, sor: int) -> float | None:
    if reported is None:
        return None
    denom = max(reported, sor, 1)
    return round(abs(reported - sor) / denom, 4)


def _flag(delta: float | None) -> str:
    if delta is None:
        return "no_data"
    if delta <= 0.05:
        return "ok"
    if delta <= 0.20:
        return "amber"
    return "red"


def compare(sor_data: dict, vlop: dict, platform_map: dict) -> list:
    """Return a list of per-service discrepancy records."""
    totals = sor_data["totals"]

    # Invert platform map: service_name → list of possible EUDSATDB platform_name values.
    svc_to_platform: dict[str, list[str]] = {}
    for eur_name, svc_name in platform_map.items():
        if not eur_name.startswith("_"):
            svc_to_platform.setdefault(svc_name, []).append(eur_name)

    services = vlop["services"]
    categories = vlop["categories"]
    cat_labels = vlop.get("category_labels", {})
    scopes = vlop.get("scopes", [])
    TOTAL_SCOPE_ID = scopes.index("Total number") if "Total number" in scopes else None

    # Build lookup: (service_id, category_id) → t4 row
    t4_lookup: dict[tuple, dict] = {}
    for row in vlop.get("t4", []):
        svc_id, cat_id = row[0], row[1]
        t4_lookup[(svc_id, cat_id)] = {
            "notices": row[2], "tf_notices": row[3],
        }

    # Build lookup: (service_id, category_id) → t5/t6 row
    t5_lookup: dict[tuple, dict] = {}
    for row in vlop.get("t5", []):
        t5_lookup[(row[0], row[1])] = {"measures": row[2]}

    t6_lookup: dict[tuple, dict] = {}
    for row in vlop.get("t6", []):
        t6_lookup[(row[0], row[1])] = {"measures": row[2]}

    results = []
    for svc_id, svc_name in enumerate(services):
        platform_names = svc_to_platform.get(svc_name, [])
        if not platform_names:
            continue

        # Merge SoR counts across all EUDSATDB names that map to this service.
        sor_by_cat: dict[str, dict[str, int]] = {}
        for pname in platform_names:
            for cat, buckets in totals.get(pname, {}).items():
                for bucket, n in buckets.items():
                    sor_by_cat.setdefault(cat, {})
                    sor_by_cat[cat][bucket] = sor_by_cat[cat].get(bucket, 0) + n

        for cat_id, cat_code in enumerate(categories):
            cat_sor = sor_by_cat.get(cat_code, {})

            t4 = t4_lookup.get((svc_id, cat_id), {})
            t5 = t5_lookup.get((svc_id, cat_id), {})
            t6 = t6_lookup.get((svc_id, cat_id), {})

            rep_notices = t4.get("notices")
            rep_tf = t4.get("tf_notices")
            rep_own_illegal = t5.get("measures")
            rep_own_tos = t6.get("measures")

            sor_notices = cat_sor.get("SOURCE_ARTICLE_16", 0)
            sor_tf = cat_sor.get("SOURCE_TRUSTED_FLAGGER", 0)
            sor_own_illegal = cat_sor.get("SOURCE_VOLUNTARY_ILLEGAL", 0)
            sor_own_tos = cat_sor.get("SOURCE_VOLUNTARY_TOS", 0)

            # Skip rows where both sides are zero / None.
            has_data = any([
                rep_notices, rep_tf, rep_own_illegal, rep_own_tos,
                sor_notices, sor_tf, sor_own_illegal, sor_own_tos,
            ])
            if not has_data:
                continue

            d_notices = _delta_pct(rep_notices, sor_notices)
            d_tf = _delta_pct(rep_tf, sor_tf)
            d_own_illegal = _delta_pct(rep_own_illegal, sor_own_illegal)
            d_own_tos = _delta_pct(rep_own_tos, sor_own_tos)

            results.append({
                "service_name": svc_name,
                "category_code": cat_code,
                "category_label": cat_labels.get(cat_code, cat_code),
                # Platform-published (t4/t5/t6)
                "rep_notices": rep_notices,
                "rep_tf_notices": rep_tf,
                "rep_own_illegal": rep_own_illegal,
                "rep_own_tos": rep_own_tos,
                # SoR-derived
                "sor_notices": sor_notices,
                "sor_tf_notices": sor_tf,
                "sor_own_illegal": sor_own_illegal,
                "sor_own_tos": sor_own_tos,
                # Deltas (fraction of max(reported, sor))
                "delta_notices": d_notices,
                "delta_tf_notices": d_tf,
                "delta_own_illegal": d_own_illegal,
                "delta_own_tos": d_own_tos,
                # Signal flags: ok / amber / red / no_data
                "flag_notices": _flag(d_notices),
                "flag_tf_notices": _flag(d_tf),
                "flag_own_illegal": _flag(d_own_illegal),
                "flag_own_tos": _flag(d_own_tos),
                "worst_flag": max(
                    [_flag(d_notices), _flag(d_tf), _flag(d_own_illegal), _flag(d_own_tos)],
                    key=lambda x: {"ok": 0, "no_data": 0, "amber": 1, "red": 2}[x],
                ),
            })

    results.sort(key=lambda r: (
        {"red": 0, "amber": 1, "no_data": 2, "ok": 3}[r["worst_flag"]],
        r["service_name"],
        r["category_code"],
    ))
    return results


def summarise(results: list) -> dict:
    from collections import Counter
    flags = Counter(r["worst_flag"] for r in results)
    by_service: dict[str, dict] = {}
    for r in results:
        svc = r["service_name"]
        by_service.setdefault(svc, {"red": 0, "amber": 0, "ok": 0, "no_data": 0})
        by_service[svc][r["worst_flag"]] += 1
    return {"flag_counts": dict(flags), "by_service": by_service}


def main():
    parser = argparse.ArgumentParser(description="Compare SoR aggregates with published reports")
    parser.add_argument("--period", default="H2-2025")
    parser.add_argument("--sor", help="Path to sor-aggs-*.json (default: data/sor-aggs-{period}.json)")
    parser.add_argument("--vlop", default=str(DATA / "vlop-dsa.json"))
    parser.add_argument("--map", default=str(DATA / "sor-platform-map.json"))
    parser.add_argument("--out", help="Output path (default: data/sor-comparison-{period}.json)")
    args = parser.parse_args()

    sor_path = args.sor or str(DATA / f"sor-aggs-{args.period}.json")
    out_path = args.out or str(DATA / f"sor-comparison-{args.period}.json")

    with open(sor_path, encoding="utf-8") as f:
        sor_data = json.load(f)
    with open(args.vlop, encoding="utf-8") as f:
        vlop = json.load(f)
    with open(args.map, encoding="utf-8") as f:
        platform_map = json.load(f)

    results = compare(sor_data, vlop, platform_map)
    summary = summarise(results)

    output = {
        "period": args.period,
        "date_range": sor_data.get("date_range", PERIODS.get(args.period, [])),
        "generated": sor_data.get("generated", ""),
        "summary": summary,
        "rows": results,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Wrote {out_path}: {len(results)} comparison rows")
    print(f"  flags: {summary['flag_counts']}")
    worst = [r for r in results if r["worst_flag"] == "red"][:5]
    if worst:
        print("  top red flags:")
        for r in worst:
            print(f"    {r['service_name']} / {r['category_code']}: "
                  f"rep_notices={r['rep_notices']} sor={r['sor_notices']}")


if __name__ == "__main__":
    main()
