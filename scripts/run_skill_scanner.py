#!/usr/bin/env python3
"""Run cisco-ai-skill-scanner with repo-local defaults for pre-commit."""

from __future__ import annotations

import argparse
import importlib.util
import os
import shlex
import subprocess
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover - optional dependency in local runs
    load_dotenv = None


def _strtobool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _load_env() -> None:
    if load_dotenv is None:
        return
    root = Path(__file__).resolve().parents[1]
    env_file = root / ".env"
    if env_file.exists():
        load_dotenv(env_file, override=False)


def _build_scan_args(args: argparse.Namespace) -> list[str]:
    scan_args: list[str] = [
        "scan-all",
        args.path,
        "--format",
        args.format,
    ]

    if args.recursive:
        scan_args.append("--recursive")
    if args.use_behavioral:
        scan_args.append("--use-behavioral")
    if args.use_llm:
        scan_args.append("--use-llm")
    if args.fail_on_findings:
        scan_args.append("--fail-on-findings")
    if args.output_file:
        scan_args.extend(["--output-file", args.output_file])

    return scan_args


def _run_skill_scanner(scan_args: list[str]) -> int:
    candidates = [["skill-scanner", *scan_args]]
    if importlib.util.find_spec("skill_scanner") and importlib.util.find_spec(
        "skill_scanner.cli"
    ):
        candidates.append([sys.executable, "-m", "skill_scanner.cli", *scan_args])

    for candidate in candidates:
        try:
            return subprocess.run(candidate, check=False).returncode
        except FileNotFoundError:
            continue

    print(
        "skill-scanner not found. Install cisco-ai-skill-scanner.",
        file=sys.stderr,
    )
    return 127


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", default=".", help="Path to scan (default: current repo)")
    parser.add_argument(
        "--format",
        default=os.getenv("SKILL_SCANNER_FORMAT", "summary"),
        choices=["json", "summary", "rich"],
        help="Output format",
    )
    parser.add_argument(
        "--output-file",
        default=os.getenv("SKILL_SCANNER_OUTPUT_FILE"),
        help="Optional file to write scan output",
    )
    parser.add_argument(
        "--recursive",
        default=_strtobool(os.getenv("SKILL_SCANNER_RECURSIVE"), True),
        action=argparse.BooleanOptionalAction,
        help="Scan directories recursively",
    )
    parser.add_argument(
        "--use-behavioral",
        default=_strtobool(os.getenv("SKILL_SCANNER_USE_BEHAVIORAL"), True),
        action=argparse.BooleanOptionalAction,
        help="Enable behavioral analysis",
    )
    parser.add_argument(
        "--use-llm",
        default=_strtobool(os.getenv("SKILL_SCANNER_USE_LLM"), False),
        action=argparse.BooleanOptionalAction,
        help="Enable LLM analysis",
    )
    parser.add_argument(
        "--fail-on-findings",
        default=_strtobool(os.getenv("SKILL_SCANNER_FAIL_ON_FINDINGS"), True),
        action=argparse.BooleanOptionalAction,
        help="Return non-zero when findings exist",
    )
    return parser.parse_args()


def main() -> int:
    _load_env()
    args = parse_args()
    scan_args = _build_scan_args(args)

    print(f"Running: {' '.join(shlex.quote(x) for x in ['skill-scanner', *scan_args])}")
    return _run_skill_scanner(scan_args)


if __name__ == "__main__":
    raise SystemExit(main())
