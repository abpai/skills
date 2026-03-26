#!/bin/bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

python3 - "$ROOT_DIR" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path

root = Path(sys.argv[1])

def rel(path: Path) -> str:
    return path.relative_to(root).as_posix()

def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}

def files(*patterns: str) -> list[str]:
    results: list[str] = []
    for pattern in patterns:
        results.extend(rel(p) for p in sorted(root.glob(pattern)) if p.is_file())
    return results

def unique(seq: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in seq:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out

def detect_languages() -> list[str]:
    langs: list[str] = []
    suffix_map = {
        ".ts": "TypeScript",
        ".tsx": "TypeScript",
        ".js": "JavaScript",
        ".jsx": "JavaScript",
        ".py": "Python",
        ".go": "Go",
        ".rs": "Rust",
        ".md": "Markdown",
        ".sh": "Shell",
    }
    for suffix, label in suffix_map.items():
        if any(root.rglob(f"*{suffix}")):
            langs.append(label)
    if (root / "package.json").exists():
        pkg = read_json(root / "package.json")
        deps = {}
        for key in ("dependencies", "devDependencies", "peerDependencies"):
            value = pkg.get(key)
            if isinstance(value, dict):
                deps.update(value)
        if any(name in deps for name in ("typescript", "ts-node", "tsx")):
            langs.append("TypeScript")
        if any(name in deps for name in ("react", "react-dom", "next")):
            langs.append("JavaScript/TypeScript frontend")
    return unique(langs)

def detect_test_runner() -> str:
    package_json = root / "package.json"
    if package_json.exists():
        pkg = read_json(package_json)
        scripts = pkg.get("scripts") if isinstance(pkg, dict) else {}
        if isinstance(scripts, dict):
            text = " ".join(str(v) for v in scripts.values())
            if "vitest" in text:
                return "vitest"
            if "jest" in text:
                return "jest"
            if "bun test" in text:
                return "bun test"
            if "mocha" in text:
                return "mocha"
            if "pytest" in text:
                return "pytest"
        deps = {}
        for key in ("dependencies", "devDependencies"):
            value = pkg.get(key)
            if isinstance(value, dict):
                deps.update(value)
        if "vitest" in deps:
            return "vitest"
        if "jest" in deps:
            return "jest"
    if any((root / name).exists() for name in ("pytest.ini", "tox.ini")):
        return "pytest"
    if (root / "go.mod").exists():
        return "go test"
    if (root / "Cargo.toml").exists():
        return "cargo test"
    return "not obvious from manifests"

def detect_ci() -> list[str]:
    return unique(files(
        ".github/workflows/*",
        ".gitlab-ci.yml",
        ".circleci/config.yml",
        "azure-pipelines.yml",
    ))

def detect_claude_config() -> list[str]:
    paths = []
    for rel_path in (".claude", ".agents"):
        path = root / rel_path
        if path.exists():
            for child in sorted(path.rglob("*")):
                if child.is_file():
                    paths.append(rel(child))
    return unique(paths)

def detect_frontend() -> str:
    package_json = root / "package.json"
    if package_json.exists():
        pkg = read_json(package_json)
        deps = {}
        for key in ("dependencies", "devDependencies", "peerDependencies"):
            value = pkg.get(key)
            if isinstance(value, dict):
                deps.update(value)
        if "next" in deps:
            return "yes, Next.js"
        if "react" in deps:
            return "yes, React"
        if "vue" in deps:
            return "yes, Vue"
        if "svelte" in deps:
            return "yes, Svelte"
    if any(root.rglob("*.tsx")) or any(root.rglob("*.jsx")):
        return "yes, frontend code is present"
    return "no obvious frontend"

languages = detect_languages()
test_runner = detect_test_runner()
ci = detect_ci()
claude = detect_claude_config()

print(f"Project scan: {root}")
print(f"Languages: {', '.join(languages) if languages else 'none obvious'}")
print(f"Test runner: {test_runner}")
print(f"CI: {', '.join(ci) if ci else 'none obvious'}")
print(f"Existing Claude config: {', '.join(claude[:10]) if claude else 'none'}")
print(f"Frontend: {detect_frontend()}")
PY
