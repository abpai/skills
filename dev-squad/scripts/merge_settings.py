#!/usr/bin/env python3
import json
import sys
from pathlib import Path


def load_json(path: Path):
    if not path.exists():
        return {}
    with path.open() as fh:
        return json.load(fh)


def merge_values(existing, incoming):
    if isinstance(existing, dict) and isinstance(incoming, dict):
        merged = dict(existing)
        for key, value in incoming.items():
            if key in merged:
                merged[key] = merge_values(merged[key], value)
            else:
                merged[key] = value
        return merged

    if isinstance(existing, list) and isinstance(incoming, list):
        seen = {json.dumps(item, sort_keys=True) for item in existing}
        merged = list(existing)
        for item in incoming:
            fingerprint = json.dumps(item, sort_keys=True)
            if fingerprint not in seen:
                merged.append(item)
                seen.add(fingerprint)
        return merged

    return incoming


def main():
    if len(sys.argv) != 4:
        print(
            "usage: merge_settings.py EXISTING_JSON TEMPLATE_JSON OUTPUT_JSON",
            file=sys.stderr,
        )
        raise SystemExit(1)

    existing_path = Path(sys.argv[1])
    template_path = Path(sys.argv[2])
    output_path = Path(sys.argv[3])

    existing = load_json(existing_path)
    template = load_json(template_path)
    merged = merge_values(existing, template)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w") as fh:
        json.dump(merged, fh, indent=2, sort_keys=True)
        fh.write("\n")


if __name__ == "__main__":
    main()
