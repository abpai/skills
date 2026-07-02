#!/usr/bin/env python3
"""Assert JSON schemas satisfy OpenAI Structured Outputs strict mode.

Strict mode requires that every object node's ``required`` array list *every*
key present in its ``properties``. Optional fields must be expressed with a
nullable type (e.g. ``"type": ["string", "null"]``) and still appear in
``required`` -- omitting a key from ``required`` is rejected by the API with
``invalid_json_schema`` about ~5s into a run.

These schemas are passed to ``codex exec --output-schema``; the dry-run test
path never calls the API, so a violation cannot be caught by ``bash -n`` or a
dry run. This linter closes that gap. Exit 0 when all files comply, 1 otherwise.
"""

import json
import sys


def find_violations(node, path, out):
    """Recurse through a schema node collecting strict-mode violations."""
    if isinstance(node, dict):
        if isinstance(node.get("properties"), dict):
            prop_keys = set(node["properties"].keys())
            required = node.get("required")
            if not isinstance(required, list):
                out.append(f"{path}: object has properties but no `required` array")
            else:
                missing = prop_keys - set(required)
                if missing:
                    keys = ", ".join(sorted(missing))
                    out.append(
                        f"{path}: `required` is missing property key(s): {keys} "
                        "(strict mode requires every property in `required`; "
                        "use a nullable type for optional fields)"
                    )
        for key, value in node.items():
            find_violations(value, f"{path}/{key}", out)
    elif isinstance(node, list):
        for i, value in enumerate(node):
            find_violations(value, f"{path}[{i}]", out)


def main(argv):
    failed = False
    for schema_path in argv:
        try:
            with open(schema_path, encoding="utf-8") as fh:
                schema = json.load(fh)
        except (OSError, json.JSONDecodeError) as err:
            print(f"[FAIL] {schema_path}: cannot read/parse schema: {err}")
            failed = True
            continue
        violations = []
        find_violations(schema, schema_path, violations)
        if violations:
            failed = True
            for violation in violations:
                print(f"[FAIL] {violation}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
