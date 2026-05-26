from pathlib import Path
import csv
import json
from typing import Any, Dict


def parse_csv_value(key: str, value: str) -> Any:
    if value is None:
        return None
    v = value.strip()
    if v == "":
        return None
    low = v.lower()
    if low == "true":
        return True
    if low == "false":
        return False
    # split comma-separated lists (e.g. "Global, International")
    if "," in v:
        parts = [p.strip() for p in v.split(",") if p.strip()]
        if len(parts) > 1:
            return parts
    # known numeric fields
    if key in ("objectID",):
        try:
            return int(v)
        except Exception:
            return v
    if key in ("reviews_count",):
        try:
            return int(v)
        except Exception:
            return v
    if key in ("stars_count",):
        try:
            return float(v)
        except Exception:
            return v
    # fallback: try int, then float
    try:
        iv = int(v)
        return iv
    except Exception:
        pass
    try:
        fv = float(v)
        return fv
    except Exception:
        pass
    return v


def load_restaurants_info(csv_path: Path) -> Dict[str, Dict]:
    data = {}
    if not csv_path.exists():
        return data
    with csv_path.open(newline="", encoding="utf-8") as fh:
        # CSV uses semicolon delimiter in this dataset
        reader = csv.DictReader(fh, delimiter=";")
        for row in reader:
            if "objectID" not in row:
                continue
            objid_raw = row.get("objectID")
            if objid_raw is None:
                continue
            objid = str(parse_csv_value("objectID", objid_raw))
            parsed = {}
            for k, v in row.items():
                parsed[k] = parse_csv_value(k, v)
            data[objid] = parsed
    return data


def load_restaurants_list(json_path: Path) -> Dict[str, Dict]:
    data = {}
    if not json_path.exists():
        return data
    with json_path.open(encoding="utf-8") as fh:
        obj = json.load(fh)
        # Accept either an array of objects or a dict mapping
        if isinstance(obj, dict):
            # try to detect nested mapping by objectID
            for k, v in obj.items():
                # if v has objectID field prefer that
                if isinstance(v, dict) and "objectID" in v:
                    data[str(v["objectID"]) ] = v
                else:
                    data[str(k)] = v
        elif isinstance(obj, list):
            for item in obj:
                if not isinstance(item, dict):
                    continue
                oid = item.get("objectID")
                if oid is None:
                    # try common alternatives
                    oid = item.get("id")
                if oid is None:
                    # skip records without id
                    continue
                data[str(oid)] = item
    return data


def merge_records(info: Dict[str, Dict], lst: Dict[str, Dict]) -> list:
    merged = []
    all_keys = set(info.keys()) | set(lst.keys())
    for key in sorted(all_keys, key=lambda x: int(x) if x.isdigit() else x):
        base = {}
        if key in info:
            base.update(info[key])
        if key in lst:
            # overlay JSON list values (prefer fields from JSON file when overlap)
            base.update(lst[key])
        # ensure objectID exists and is numeric when possible
        if "objectID" not in base or base.get("objectID") is None:
            try:
                base["objectID"] = int(key)
            except Exception:
                base["objectID"] = key
        merged.append(base)
    return merged


def main():
    root = Path(__file__).resolve().parent.parent
    csv_path = root / "dataset" / "restaurants_info.csv"
    json_path = root / "dataset" / "restaurants_list.json"
    out_path = root / "scripts" / "merged_data.json"

    info = load_restaurants_info(csv_path)
    lst = load_restaurants_list(json_path)

    merged = merge_records(info, lst)

    # Write output
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(merged, fh, ensure_ascii=False, indent=2)

    print(f"Merged {len(merged)} records to {out_path}")


if __name__ == "__main__":
    main()
