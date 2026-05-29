#!/usr/bin/env python3
"""Heuristic complexity lead scanner for mixed-language repositories.

This is intentionally a lead generator, not proof. It flags code worth
inspecting for the engineering/complexity-report skill.

Inspired by Kappaemme-git/codex-complexity-optimizer, MIT licensed, commit
6a1f9674d706a06d462296e53a40f668299e8893.
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable


DEFAULT_EXCLUDES = {
    ".git",
    ".hg",
    ".svn",
    ".next",
    ".nuxt",
    ".turbo",
    ".venv",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "target",
    "vendor",
    "venv",
}

TEXT_EXTENSIONS = {
    ".c",
    ".cc",
    ".cjs",
    ".cpp",
    ".cs",
    ".go",
    ".h",
    ".hpp",
    ".java",
    ".js",
    ".jsx",
    ".mjs",
    ".php",
    ".py",
    ".rb",
    ".swift",
    ".ts",
    ".tsx",
}

LOOP_RE = re.compile(
    r"\b(for|while)\b|"
    r"\.(forEach|map|filter|reduce|some|every|find|findIndex)\s*\("
)
SEARCH_RE = re.compile(
    r"\.(includes|indexOf|find|findIndex|contains)\s*\(|"
    r"\b(in_array|contains)\s*\("
)
SORT_RE = re.compile(r"\.(sort)\s*\(|\b(sorted|sort)\s*\(")
IO_RE = re.compile(
    r"\b(fetch|request|query|execute|select|where|findMany|findOne|findUnique)\s*\(|"
    r"\baxios\.",
    re.IGNORECASE,
)
COMPONENT_RE = re.compile(
    r"\b(function\s+[A-Z][A-Za-z0-9_]*|"
    r"const\s+[A-Z][A-Za-z0-9_]*\s*=|"
    r"export\s+default\s+function\s+[A-Z])"
)


@dataclass
class Lead:
    file: str
    line: int
    severity: str
    category: str
    current_pattern: str
    why_it_matters: str
    suggested_next_step: str
    evidence: list[str] = field(default_factory=lambda: ["static_scan"])
    finding_id: str = ""


def iter_source_files(root: Path, excludes: set[str]) -> Iterable[Path]:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [name for name in dirnames if name not in excludes]
        for filename in filenames:
            path = Path(dirpath) / filename
            if path.suffix in TEXT_EXTENSIONS:
                yield path


def read_text(path: Path) -> str | None:
    for encoding in ("utf-8", "latin-1"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
        except OSError:
            return None
    return None


def relative(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def call_name(func: ast.AST) -> str:
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return ""


class PythonComplexityVisitor(ast.NodeVisitor):
    def __init__(self, path: Path, root: Path) -> None:
        self.path = path
        self.root = root
        self.loop_depth = 0
        self.leads: list[Lead] = []

    def add(
        self,
        node: ast.AST,
        severity: str,
        category: str,
        current_pattern: str,
        why_it_matters: str,
        suggested_next_step: str,
    ) -> None:
        self.leads.append(
            Lead(
                file=relative(self.path, self.root),
                line=getattr(node, "lineno", 1),
                severity=severity,
                category=category,
                current_pattern=current_pattern,
                why_it_matters=why_it_matters,
                suggested_next_step=suggested_next_step,
            )
        )

    def visit_For(self, node: ast.For) -> None:
        self.visit_loop(node)

    def visit_While(self, node: ast.While) -> None:
        self.visit_loop(node)

    def visit_ListComp(self, node: ast.ListComp) -> None:
        self.visit_comprehension_expr(node)

    def visit_SetComp(self, node: ast.SetComp) -> None:
        self.visit_comprehension_expr(node)

    def visit_DictComp(self, node: ast.DictComp) -> None:
        self.visit_comprehension_expr(node)

    def visit_GeneratorExp(self, node: ast.GeneratorExp) -> None:
        self.visit_comprehension_expr(node)

    def visit_loop(self, node: ast.AST) -> None:
        if self.loop_depth:
            self.add(
                node,
                "high",
                "nested_lookup",
                "Loop nested inside another loop.",
                "This can become O(n*m) or worse on large inputs.",
                "Inspect whether a precomputed index, grouping, two-pointer pass, or batch operation preserves behavior.",
            )
        self.loop_depth += 1
        self.generic_visit(node)
        self.loop_depth -= 1

    def visit_comprehension_expr(self, node: ast.AST) -> None:
        if self.loop_depth:
            self.add(
                node,
                "medium",
                "nested_lookup",
                "Comprehension inside iterative code.",
                "It may repeatedly scan or rebuild derived data.",
                "Check whether the derived data can be computed once with stable semantics.",
            )
        self.loop_depth += 1
        self.generic_visit(node)
        self.loop_depth -= 1

    def visit_Compare(self, node: ast.Compare) -> None:
        if self.loop_depth and any(isinstance(op, (ast.In, ast.NotIn)) for op in node.ops):
            self.add(
                node,
                "medium",
                "membership_in_loop",
                "Membership check inside a loop.",
                "If the right side is list-like, this can become O(n*m).",
                "Confirm equality semantics, then consider a set or dict built once outside the loop.",
            )
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        name = call_name(node.func)
        lowered = name.lower()
        if self.loop_depth and name in {"sorted", "sort"}:
            self.add(
                node,
                "high",
                "sort_in_loop",
                "Sort call inside iterative code.",
                "Repeated sorting can dominate runtime.",
                "Verify whether one sort, a heap, or binary insertion preserves intermediate ordering semantics.",
            )
        if self.loop_depth and lowered in {
            "fetch",
            "request",
            "query",
            "execute",
            "find",
            "find_one",
            "find_many",
            "select",
            "where",
        }:
            self.add(
                node,
                "high",
                "n_plus_one_query",
                "Potential I/O, API, or database call inside a loop.",
                "Per-item round trips can dominate latency and load.",
                "Inspect query logs and consider batching while preserving auth, filters, ordering, and errors.",
            )
        self.generic_visit(node)


def scan_python(path: Path, root: Path, text: str) -> list[Lead]:
    try:
        tree = ast.parse(text)
    except SyntaxError as exc:
        return [
            Lead(
                file=relative(path, root),
                line=exc.lineno or 1,
                severity="info",
                category="unknown_static_lead",
                current_pattern="Python parse failed.",
                why_it_matters="The scanner could not inspect this file semantically.",
                suggested_next_step="Inspect manually if this file is on a performance-sensitive path.",
            )
        ] + scan_text(path, root, text)

    visitor = PythonComplexityVisitor(path, root)
    visitor.visit(tree)
    return visitor.leads


def likely_component_lines(lines: list[str]) -> set[int]:
    active_until = 0
    result: set[int] = set()
    for index, line in enumerate(lines, start=1):
        if COMPONENT_RE.search(line):
            active_until = index + 120
        if index <= active_until:
            result.add(index)
    return result


def scan_text(path: Path, root: Path, text: str) -> list[Lead]:
    leads: list[Lead] = []
    lines = text.splitlines()
    active_loop_until: list[int] = []
    component_lines = (
        likely_component_lines(lines)
        if path.suffix in {".js", ".jsx", ".mjs", ".ts", ".tsx"}
        else set()
    )

    for index, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith(("//", "#", "*")):
            continue

        active_loop_until = [until for until in active_loop_until if until >= index]
        loop_match = LOOP_RE.search(stripped)
        if loop_match:
            if active_loop_until:
                leads.append(
                    Lead(
                        file=relative(path, root),
                        line=index,
                        severity="high",
                        category="nested_lookup",
                        current_pattern="Loop or collection callback inside iterative code.",
                        why_it_matters="This may repeatedly scan, transform, or allocate on large inputs.",
                        suggested_next_step="Inspect for indexing, grouping, batching, or a single-pass algorithm.",
                    )
                )
            active_loop_until.append(index + 80)

        if active_loop_until and SEARCH_RE.search(stripped):
            leads.append(
                Lead(
                    file=relative(path, root),
                    line=index,
                    severity="medium",
                    category="membership_in_loop",
                    current_pattern="Search or membership check inside iterative code.",
                    why_it_matters="Repeated linear membership checks can become O(n*m).",
                    suggested_next_step="Confirm equality semantics, then consider Set, Map, dict, or precomputed grouping.",
                )
            )

        if active_loop_until and SORT_RE.search(stripped):
            leads.append(
                Lead(
                    file=relative(path, root),
                    line=index,
                    severity="high",
                    category="sort_in_loop",
                    current_pattern="Sort call inside iterative code.",
                    why_it_matters="Repeated sorting often dominates runtime.",
                    suggested_next_step="Check whether sorting once, using a heap, or changing the algorithm preserves behavior.",
                )
            )

        if active_loop_until and IO_RE.search(stripped):
            leads.append(
                Lead(
                    file=relative(path, root),
                    line=index,
                    severity="high",
                    category="n_plus_one_query",
                    current_pattern="Potential I/O, query, or API call inside iterative code.",
                    why_it_matters="Per-item round trips can dominate latency and load.",
                    suggested_next_step="Inspect logs and consider batching or preloading with auth and ordering preserved.",
                )
            )

        if index in component_lines and any(
            token in stripped for token in (".filter(", ".map(", ".sort(", ".reduce(")
        ):
            leads.append(
                Lead(
                    file=relative(path, root),
                    line=index,
                    severity="medium",
                    category="render_derived_work",
                    current_pattern="Collection transform in a likely UI component render path.",
                    why_it_matters="Large collections or frequent renders can make derived work user-visible.",
                    suggested_next_step="Check render frequency and data size before considering selectors, memoization, or virtualization.",
                )
            )

    return leads


def dedupe(leads: list[Lead]) -> list[Lead]:
    seen: set[tuple[str, int, str]] = set()
    result: list[Lead] = []
    for lead in leads:
        key = (lead.file, lead.line, lead.category)
        if key not in seen:
            seen.add(key)
            result.append(lead)
    return result


def sort_key(lead: Lead) -> tuple[int, str, int, str]:
    severity_rank = {"high": 0, "medium": 1, "info": 2}
    return (severity_rank.get(lead.severity, 3), lead.file, lead.line, lead.category)


def assign_ids(leads: list[Lead]) -> list[Lead]:
    for index, lead in enumerate(leads, start=1):
        lead.finding_id = f"lead-{index:03d}"
    return leads


def render_markdown(leads: list[Lead]) -> str:
    if not leads:
        return "No obvious complexity leads found by heuristic scanning.\n"

    lines = [
        "# Complexity Scan Leads",
        "",
        "These are static leads, not proof. Inspect hot-path relevance before ranking.",
        "",
    ]
    for lead in leads:
        lines.extend(
            [
                f"## {lead.finding_id}: {lead.severity.upper()} {lead.category}",
                f"- Location: `{lead.file}:{lead.line}`",
                f"- Current pattern: {lead.current_pattern}",
                f"- Why it matters: {lead.why_it_matters}",
                f"- Suggested next step: {lead.suggested_next_step}",
                "",
            ]
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Scan a repository for static complexity and performance leads."
    )
    parser.add_argument("root", nargs="?", default=".", help="Repository or directory to scan.")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown")
    parser.add_argument("--exclude", action="append", default=[], help="Additional directory name to exclude.")
    parser.add_argument("--max-findings", type=int, default=80)
    args = parser.parse_args()

    root = Path(args.root).resolve()
    excludes = DEFAULT_EXCLUDES | set(args.exclude)
    leads: list[Lead] = []

    for path in iter_source_files(root, excludes):
        text = read_text(path)
        if text is None:
            continue
        if path.suffix == ".py":
            leads.extend(scan_python(path, root, text))
        else:
            leads.extend(scan_text(path, root, text))

    leads = assign_ids(sorted(dedupe(leads), key=sort_key)[: args.max_findings])
    if args.format == "json":
        print(json.dumps([asdict(lead) for lead in leads], indent=2))
    else:
        print(render_markdown(leads))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
