"""Download and aggregate Statements of Reasons (SoR) from the EU DSA
Transparency Database for a given reporting period.

Primary path — public, no token required:
  pip install dsa-tdb pandas pyarrow \
      --index-url https://code.europa.eu/api/v4/projects/943/packages/pypi/simple
  python fetch-sor-aggs.py --period H2-2025 --use-dsatdb

  dsa-tdb download-aggs pulls pre-made monthly aggregated parquet files from a
  public bucket (the same data feeding the EUDSATDB Dashboard). No Research API
  token needed. H2 2025 = 6 monthly files, typically a few MB total.

Fallback path — requires Research API token:
  DSA_API_TOKEN=<token> python fetch-sor-aggs.py --period H2-2025
  Request access: CNECT-DSA-HELPDESK@ec.europa.eu

Output: data/sor-aggs-{period}.json
  {
    "period": "H2-2025",
    "date_range": ["2025-07-01", "2025-12-31"],
    "generated": "2026-06-18",
    "totals": {
      "YouTube": {
        "STATEMENT_CATEGORY_ILLEGAL_OR_HARMFUL_SPEECH": {
          "SOURCE_ARTICLE_16": 1234,
          "SOURCE_TRUSTED_FLAGGER": 56,
          "SOURCE_VOLUNTARY_ILLEGAL": 789,
          "SOURCE_VOLUNTARY_TOS": 321
        }
      }
    }
  }
"""
import argparse
import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

try:
    import httpx
except ImportError:
    print("pip install httpx", file=sys.stderr)
    sys.exit(1)

HERE = Path(__file__).parent.parent
DATA = HERE / "data"

EUDSATDB_BASE = "https://transparency.dsa.ec.europa.eu/api/v1"
# Fields to aggregate over — gives us counts per (platform × category × source × ground).
AGG_FIELDS = "platform_name__category__source_type__decision_ground"

PERIODS = {
    "H2-2025": ("2025-07-01", "2025-12-31"),
    "H1-2025": ("2025-01-01", "2025-06-30"),
    "H2-2024": ("2024-07-01", "2024-12-31"),
    "H1-2024": ("2024-01-01", "2024-06-30"),
}

# Canonical source_type values in the SoR schema.
# These map to the DSA transparency report tables we want to compare.
# SOURCE_ARTICLE_16: notice submitted under Art. 16 → t4.notices
# SOURCE_TRUSTED_FLAGGER: trusted-flagger notice → t4.tf_notices
# SOURCE_VOLUNTARY + ILLEGAL: own-initiative illegal content → t5.measures
# SOURCE_VOLUNTARY + TOS:  own-initiative ToS violations → t6.measures
SOURCE_NOTICE = "SOURCE_ARTICLE_16"
SOURCE_TF = "SOURCE_TRUSTED_FLAGGER"
SOURCE_VOLUNTARY = "SOURCE_VOLUNTARY"
GROUND_ILLEGAL = "DECISION_GROUND_ILLEGAL_CONTENT"
GROUND_TOS = "DECISION_GROUND_INCOMPATIBLE_CONTENT"


def _date_range(start: str, end: str):
    cur = date.fromisoformat(start)
    end_d = date.fromisoformat(end)
    while cur <= end_d:
        yield cur.isoformat()
        cur += timedelta(days=1)


def fetch_via_api(token: str, start: str, end: str) -> dict:
    """Use the Research API aggregates endpoint (one call per day)."""
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    totals: dict = {}

    all_dates = list(_date_range(start, end))
    print(f"Fetching aggregates for {len(all_dates)} days via Research API...", file=sys.stderr)

    with httpx.Client(timeout=60) as client:
        for i, d in enumerate(all_dates):
            if i % 30 == 0:
                print(f"  {i}/{len(all_dates)}: {d}", file=sys.stderr)
            url = f"{EUDSATDB_BASE}/research/aggregates/{d}/{AGG_FIELDS}"
            for attempt in range(3):
                try:
                    resp = client.get(url, headers=headers)
                    if resp.status_code == 429:
                        retry_after = int(resp.headers.get("Retry-After", 5))
                        time.sleep(retry_after)
                        continue
                    resp.raise_for_status()
                    _accumulate(totals, resp.json())
                    break
                except httpx.HTTPError:
                    if attempt == 2:
                        raise
                    time.sleep(2 ** attempt)

    return totals


def _accumulate(totals: dict, api_resp: list) -> None:
    """Merge one day's aggregate rows into the running totals dict.

    Expected row shape: {platform_name, category, source_type, decision_ground, total}
    """
    for row in api_resp:
        platform = row.get("platform_name", "")
        category = row.get("category", "")
        source = row.get("source_type", "")
        ground = row.get("decision_ground", "")
        try:
            count = int(float(row.get("total", 0) or 0))
        except (ValueError, TypeError):
            count = 0

        if not (platform and category and count):
            continue

        # Collapse source × ground into the four comparison buckets.
        if source == SOURCE_NOTICE:
            bucket = "SOURCE_ARTICLE_16"
        elif source == SOURCE_TF:
            bucket = "SOURCE_TRUSTED_FLAGGER"
        elif source == SOURCE_VOLUNTARY and ground == GROUND_ILLEGAL:
            bucket = "SOURCE_VOLUNTARY_ILLEGAL"
        elif source == SOURCE_VOLUNTARY and ground == GROUND_TOS:
            bucket = "SOURCE_VOLUNTARY_TOS"
        else:
            bucket = "OTHER"

        totals.setdefault(platform, {}).setdefault(category, {})
        totals[platform][category][bucket] = (
            totals[platform][category].get(bucket, 0) + count
        )


def fetch_via_dsatdb(start: str, end: str, tmp_dir: str) -> dict:
    """Download pre-made monthly aggregated parquet files via dsa-tdb-cli.

    Uses the public bucket download (no token required). Tries --advanced first
    to get the full field breakdown (platform × category × source_type ×
    decision_ground). Falls back to the basic aggregation if --advanced is not
    recognised by the installed version.
    """
    import subprocess
    import glob

    try:
        import pandas as pd
    except ImportError:
        print("pip install pandas pyarrow", file=sys.stderr)
        sys.exit(1)

    os.makedirs(tmp_dir, exist_ok=True)

    # Try advanced aggregation first (includes source_type + decision_ground).
    # If the flag is not supported, fall back to the default (basic).
    for extra_flags in [["--advanced"], []]:
        cmd = ["dsa-tdb-cli", "download-aggs", "-o", tmp_dir, "-i", start, "-f", end] + extra_flags
        print(f"Running: {' '.join(cmd)}", file=sys.stderr)
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            break
        # If --advanced caused an error, retry without it.
        if extra_flags and ("unrecognized" in result.stderr.lower()
                            or "invalid" in result.stderr.lower()
                            or "error" in result.stderr.lower()):
            print("  --advanced flag not supported; retrying without it", file=sys.stderr)
            continue
        # Other failure — surface the error.
        print(result.stderr, file=sys.stderr)
        result.check_returncode()

    # Required columns for our comparison. The count column may be named
    # "total", "count", or "sor_count" depending on dsa-tdb version.
    COUNT_ALIASES = ("total", "count", "sor_count", "n")
    REQUIRED = {"platform_name", "category", "source_type", "decision_ground"}

    totals: dict = {}
    files = sorted(glob.glob(f"{tmp_dir}/**/*.parquet", recursive=True)
                   + glob.glob(f"{tmp_dir}/**/*.csv", recursive=True))
    if not files:
        print(f"  No parquet/CSV files found under {tmp_dir}", file=sys.stderr)
        return totals

    for path in files:
        df = pd.read_parquet(path) if path.endswith(".parquet") else pd.read_csv(path)
        cols = set(df.columns)
        print(f"  {path}: columns = {sorted(cols)}", file=sys.stderr)

        if not REQUIRED.issubset(cols):
            print(f"  Skipping — missing {REQUIRED - cols}", file=sys.stderr)
            continue

        # Find the count column.
        count_col = next((c for c in COUNT_ALIASES if c in cols), None)
        if count_col is None:
            print(f"  Skipping — no count column found (tried {COUNT_ALIASES})", file=sys.stderr)
            continue
        if count_col != "total":
            df = df.rename(columns={count_col: "total"})

        for _, row in df.iterrows():
            _accumulate(totals, [row.to_dict()])

    return totals


def main():
    parser = argparse.ArgumentParser(description="Fetch SoR aggregates from EUDSATDB")
    parser.add_argument("--period", default="H2-2025",
                        help=f"Reporting period label. Known: {', '.join(PERIODS)}")
    parser.add_argument("--start", help="Override start date (YYYY-MM-DD)")
    parser.add_argument("--end", help="Override end date (YYYY-MM-DD)")
    parser.add_argument("--use-dsatdb", action="store_true",
                        help="Use dsa-tdb-cli download-aggs instead of Research API")
    parser.add_argument("--tmp-dir", default="/tmp/dsa-aggs",
                        help="Temp directory for dsa-tdb downloads")
    parser.add_argument("--out", help="Override output path (default: data/sor-aggs-{period}.json)")
    args = parser.parse_args()

    if args.period in PERIODS:
        start, end = PERIODS[args.period]
    elif args.start and args.end:
        start, end = args.start, args.end
    else:
        parser.error(f"--period must be one of {list(PERIODS)} or provide --start/--end")

    if args.start:
        start = args.start
    if args.end:
        end = args.end

    if args.use_dsatdb:
        totals = fetch_via_dsatdb(start, end, args.tmp_dir)
    else:
        token = os.environ.get("DSA_API_TOKEN")
        if not token:
            print(
                "Set DSA_API_TOKEN or use --use-dsatdb. "
                "Request access: CNECT-DSA-HELPDESK@ec.europa.eu",
                file=sys.stderr,
            )
            sys.exit(1)
        totals = fetch_via_api(token, start, end)

    out_path = args.out or str(DATA / f"sor-aggs-{args.period}.json")
    result = {
        "period": args.period,
        "date_range": [start, end],
        "generated": date.today().isoformat(),
        "totals": totals,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"Wrote {out_path}: {sum(len(v) for v in totals.values())} (platform × category) pairs")


if __name__ == "__main__":
    main()
