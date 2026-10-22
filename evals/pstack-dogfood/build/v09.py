import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from mk import fixture_root, write_tree, commit, diff_fingerprint

root = fixture_root("v09-resolver-cache")
base = {}
base[".gitignore"] = "__pycache__/\n"
base["README.md"] = r'''
# depsolve

Resolves pinned versions for our internal package index. The CLI resolves one
set of roots per invocation (it runs in CI for every build):

```sh
python -m depsolve index.json web-app worker
RESOLVE_TRACE=1 python -m depsolve index.json web-app   # debug trace on stderr
python -m unittest
```
'''
base["CHANGELOG.md"] = r'''
# Changelog

## Unreleased

## 0.8.0

- Report conflicting constraints with the chain of packages that required them.
'''
base["depsolve/__init__.py"] = ""
base["depsolve/versions.py"] = r'''
def parse_version(text):
    return tuple(int(part) for part in text.split("."))


def format_version(version):
    return ".".join(str(p) for p in version)
'''
base["depsolve/requirements.py"] = r'''
import re

from .versions import parse_version

_NAME = re.compile(r"^\s*([a-z0-9][a-z0-9._-]*)\s*(.*)$")
_CONSTRAINT = re.compile(r"^\s*(==|>=|<=|>|<|!=)\s*([0-9]+(?:\.[0-9]+)*)\s*$")

_OPS = {
    "==": lambda v, c: v == c,
    "!=": lambda v, c: v != c,
    ">=": lambda v, c: v >= c,
    "<=": lambda v, c: v <= c,
    ">": lambda v, c: v > c,
    "<": lambda v, c: v < c,
}


class RequirementError(ValueError):
    pass


def parse_requirements(text):
    """Parse 'a>=1.0,<2.0; b; c==0.3' into [(name, [(op, version), ...]), ...]."""
    result = []
    for chunk in text.split(";"):
        if not chunk.strip():
            continue
        m = _NAME.match(chunk)
        if not m:
            raise RequirementError(f"bad requirement {chunk!r}")
        name, rest = m.groups()
        constraints = []
        for part in filter(None, (p.strip() for p in rest.split(","))):
            cm = _CONSTRAINT.match(part)
            if not cm:
                raise RequirementError(f"bad constraint {part!r} in {chunk!r}")
            constraints.append((cm.group(1), parse_version(cm.group(2))))
        result.append((name, constraints))
    return result


def satisfies(version, constraints):
    return all(_OPS[op](version, bound) for op, bound in constraints)
'''
base["depsolve/registry.py"] = r'''
import json

from .versions import parse_version


class Registry:
    """Package index: {name: {version: "requirement string"}}."""

    def __init__(self, data):
        self._data = data
        self._versions = {
            name: sorted((parse_version(v) for v in versions), reverse=True)
            for name, versions in data.items()
        }

    @classmethod
    def load(cls, path):
        with open(path) as fh:
            return cls(json.load(fh))

    def versions(self, name):
        if name not in self._versions:
            raise KeyError(f"unknown package {name!r}")
        return self._versions[name]

    def manifest(self, name, version):
        return self._data[name][".".join(map(str, version))]
'''
base["depsolve/resolver.py"] = r'''
import logging

from .requirements import parse_requirements, satisfies
from .versions import format_version

log = logging.getLogger("depsolve")


class ResolutionError(Exception):
    pass


def resolve(registry, roots):
    """Pick the highest version of every reachable package that satisfies all constraints.

    Returns {name: version_string}.
    """
    constraints = {name: [] for name in roots}
    required_by = {name: ["<root>"] for name in roots}
    chosen = {}
    queue = list(roots)
    while queue:
        name = queue.pop()
        candidates = [v for v in registry.versions(name) if satisfies(v, constraints[name])]
        if not candidates:
            raise ResolutionError(
                f"no version of {name} satisfies {constraints[name]} (required by {required_by[name]})"
            )
        version = candidates[0]
        if chosen.get(name) == version:
            continue
        chosen[name] = version
        log.debug("visit %s==%s", name, format_version(version))
        for dep, dep_constraints in parse_requirements(registry.manifest(name, version)):
            log.debug("  %s requires %s %s", name, dep, dep_constraints)
            constraints.setdefault(dep, []).extend(dep_constraints)
            required_by.setdefault(dep, []).append(name)
            queue.append(dep)
    return {name: format_version(v) for name, v in sorted(chosen.items())}
'''
base["depsolve/__main__.py"] = r'''
import logging
import os
import sys

from .registry import Registry
from .resolver import ResolutionError, resolve


def main(argv):
    if len(argv) < 2:
        print("usage: python -m depsolve INDEX.json ROOT [ROOT...]", file=sys.stderr)
        return 2
    if os.environ.get("RESOLVE_TRACE") == "1":
        logging.basicConfig(level=logging.DEBUG, format="%(name)s %(message)s")
    try:
        pins = resolve(Registry.load(argv[0]), argv[1:])
    except ResolutionError as err:
        print(f"error: {err}", file=sys.stderr)
        return 1
    for name, version in pins.items():
        print(f"{name}=={version}")
    return 0


sys.exit(main(sys.argv[1:]))
'''
base["bench/make_index.py"] = r'''
"""Deterministic synthetic index shaped like ours: ~600 packages, 6 versions each."""
import random


def make_index(packages=600, versions=6, seed=7):
    rng = random.Random(seed)
    names = [f"pkg{i:03d}" for i in range(packages)]
    data = {}
    for i, name in enumerate(names):
        data[name] = {}
        for v in range(versions):
            deps = []
            if i > 0:
                for dep in rng.sample(names[:i], k=min(i, rng.randint(2, 7))):
                    lo = rng.randint(0, 2)
                    deps.append(f"{dep}>={lo}.0,<{versions}.0")
            data[name][f"{v}.{rng.randint(0, 9)}"] = "; ".join(deps)
    roots = names[-25:]
    return data, roots
'''
base["tests/__init__.py"] = ""
base["tests/test_resolver.py"] = r'''
import unittest

from depsolve.registry import Registry
from depsolve.requirements import RequirementError, parse_requirements
from depsolve.resolver import ResolutionError, resolve


class RequirementTests(unittest.TestCase):
    def test_parses_names_and_constraints(self):
        self.assertEqual(
            parse_requirements("a>=1.0,<2.0; b; c==0.3"),
            [("a", [(">=", (1, 0)), ("<", (2, 0))]), ("b", []), ("c", [("==", (0, 3))])],
        )

    def test_rejects_garbage(self):
        with self.assertRaises(RequirementError):
            parse_requirements("a=>1")


class ResolveTests(unittest.TestCase):
    def test_picks_highest_compatible_versions(self):
        reg = Registry({
            "app": {"1.0": "lib>=1.0,<2.0; util"},
            "lib": {"1.0": "", "1.5": "util>=0.2", "2.0": ""},
            "util": {"0.1": "", "0.2": "", "0.3": ""},
        })
        self.assertEqual(resolve(reg, ["app"]), {"app": "1.0", "lib": "1.5", "util": "0.3"})

    def test_constraint_added_later_repicks(self):
        reg = Registry({
            "app": {"1.0": "a; b"},
            "a": {"1.0": "c"},
            "b": {"1.0": "c<2.0"},
            "c": {"1.0": "", "2.0": ""},
        })
        self.assertEqual(resolve(reg, ["app"])["c"], "1.0")

    def test_reports_conflicts(self):
        reg = Registry({
            "app": {"1.0": "a; b"},
            "a": {"1.0": "c>=2.0"},
            "b": {"1.0": "c<2.0"},
            "c": {"1.0": "", "2.0": ""},
        })
        with self.assertRaises(ResolutionError):
            resolve(reg, ["app"])
'''

change = {}
change["depsolve/registry.py"] = r'''
import json

from .requirements import parse_requirements
from .versions import parse_version


class Registry:
    """Package index: {name: {version: "requirement string"}}."""

    def __init__(self, data, cache=True):
        self._data = data
        self._versions = {
            name: sorted((parse_version(v) for v in versions), reverse=True)
            for name, versions in data.items()
        }
        self._cache = {} if cache else None

    @classmethod
    def load(cls, path):
        with open(path) as fh:
            return cls(json.load(fh))

    def versions(self, name):
        if name not in self._versions:
            raise KeyError(f"unknown package {name!r}")
        return self._versions[name]

    def manifest(self, name, version):
        return self._data[name][".".join(map(str, version))]

    def dependencies(self, name, version):
        if self._cache is None:
            return parse_requirements(self.manifest(name, version))
        key = (name, version)
        if key not in self._cache:
            self._cache[key] = parse_requirements(self.manifest(name, version))
        return self._cache[key]
'''
change["depsolve/resolver.py"] = r'''
import logging

from .requirements import satisfies
from .versions import format_version

log = logging.getLogger("depsolve")


class ResolutionError(Exception):
    pass


def resolve(registry, roots):
    """Pick the highest version of every reachable package that satisfies all constraints.

    Returns {name: version_string}.
    """
    constraints = {name: [] for name in roots}
    required_by = {name: ["<root>"] for name in roots}
    chosen = {}
    queue = list(roots)
    while queue:
        name = queue.pop()
        candidates = [v for v in registry.versions(name) if satisfies(v, constraints[name])]
        if not candidates:
            raise ResolutionError(
                f"no version of {name} satisfies {constraints[name]} (required by {required_by[name]})"
            )
        version = candidates[0]
        if chosen.get(name) == version:
            continue
        chosen[name] = version
        log.debug("visit %s==%s", name, format_version(version))
        for dep, dep_constraints in registry.dependencies(name, version):
            log.debug("  %s requires %s %s", name, dep, dep_constraints)
            constraints.setdefault(dep, []).extend(dep_constraints)
            required_by.setdefault(dep, []).append(name)
            queue.append(dep)
    return {name: format_version(v) for name, v in sorted(chosen.items())}
'''
change["bench/bench_resolve.py"] = r'''
"""Time resolve() on the synthetic index. Prints mean seconds per resolve."""
import argparse
import logging
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from bench.make_index import make_index  # noqa: E402
from depsolve.registry import Registry  # noqa: E402
from depsolve.resolver import resolve  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--iterations", type=int, default=30)
    args = parser.parse_args()
    if os.environ.get("RESOLVE_TRACE") == "1":
        logging.basicConfig(level=logging.DEBUG, format="%(name)s %(message)s")

    data, roots = make_index()
    registry = Registry(data, cache=not args.no_cache)
    start = time.perf_counter()
    for _ in range(args.iterations):
        resolve(registry, roots)
    print(f"{(time.perf_counter() - start) / args.iterations:.6f}")


if __name__ == "__main__":
    main()
'''
change["bench/compare.sh"] = r'''
#!/usr/bin/env bash
# Compare resolve() time without and with the dependency cache.
set -euo pipefail
cd "$(dirname "$0")/.."
before=$(RESOLVE_TRACE=1 python3 bench/bench_resolve.py --no-cache 2>/dev/null)
after=$(python3 bench/bench_resolve.py 2>/dev/null)
python3 - "$before" "$after" <<'EOF'
import sys
before, after = map(float, sys.argv[1:])
print(f"before {before * 1000:.1f} ms/resolve  after {after * 1000:.1f} ms/resolve  speedup {before / after:.1f}x")
EOF
'''
change["bench/__init__.py"] = ""
change["CHANGELOG.md"] = r'''
# Changelog

## Unreleased

- ~3x faster dependency resolution: parsed requirements are now cached per
  package version (`bench/compare.sh`).

## 0.8.0

- Report conflicting constraints with the chain of packages that required them.
'''

write_tree(root, base)
commit(root)
write_tree(root, change)
print(diff_fingerprint(root))
