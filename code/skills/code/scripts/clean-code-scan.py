#!/usr/bin/env python3
"""Static clean-code lead scanner for mixed TypeScript/JavaScript repositories.

This scanner is intentionally conservative: it produces leads for
`/code:simplify`, not final findings. Principles are derived from
labs42io/clean-code-typescript (MIT licensed), upstream commit
05a25e8fb8f4cdca4e6cfbddd60323c6ddc5aa54.
"""

from __future__ import annotations

import argparse
import ast
import fnmatch
import json
import os
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable


DEFAULT_EXCLUDES = {
    ".git",
    ".hg",
    ".next",
    ".nuxt",
    ".svn",
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
    ".cjs",
    ".js",
    ".jsx",
    ".mjs",
    ".py",
    ".ts",
    ".tsx",
}

JS_TS_EXTENSIONS = {".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"}
SCANNER_PATH = Path(__file__).resolve()

COMMENT_START_RE = re.compile(r"^\s*(?://|#|\*|/\*)\s?(.*)$")
COMMENTED_CODE_RE = re.compile(
    r"^\s*(?:"
    r"(?:export\s+)?(?:async\s+)?function\b|"
    r"(?:const|let|var)\s+\w+\s*=|"
    r"(?:if|for|while|switch)\s*\(|"
    r"(?:return|throw|await)\b.*;|"
    r"\w+\([^)]*\)\s*;?$|"
    r"\w+(?:\.\w+)+\s*=|"
    r"</?[A-Z_a-z][^>]*>"
    r")"
)
JOURNAL_COMMENT_RE = re.compile(
    r"\b(?:19|20)\d\d[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])\b"
)
POSITIONAL_MARKER_RE = re.compile(r"(?:/{5,}|#{5,}|={5,}|-{5,}|\*{5,})")
TODO_RE = re.compile(r"\bTODO\b", re.IGNORECASE)

FUNCTION_RE = re.compile(
    r"\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)?\s*\(([^)]*)\)|"
    r"\b(?:public|private|protected|static|async)\s+"
    r"([A-Za-z_$][\w$]*)\s*\(([^)]*)\)|"
    r"\b([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*[:\w<>,\s\[\]|&.?]*\s*\{|"
    r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*"
    r"(?:async\s*)?\(?([^)=]*)\)?\s*=>"
)
CLASS_RE = re.compile(r"\bclass\s+([A-Za-z_$][\w$]*)\b")
METHOD_RE = re.compile(
    r"^\s*(?:public|private|protected|static|async|get|set)?\s*"
    r"[A-Za-z_$][\w$]*\s*\([^)]*\)\s*[:\w<>,\s\[\]|&.?]*\{"
)
NEGATIVE_CONDITION_RE = re.compile(r"\b(?:if|while)\s*\([^)]*!\s*[A-Za-z_(]")
TYPE_CHECK_RE = re.compile(r"\b(?:typeof\s+\w+|instanceof|\.constructor\s*[=!]==)")
SHORT_CIRCUIT_DEFAULT_RE = re.compile(
    r"\b(?:const|let|var)?\s*[A-Za-z_$][\w$.\[\]]+\s*=\s*"
    r"[A-Za-z_$][\w$.\[\]]+\s*\|\|"
)
NON_ERROR_THROW_RE = re.compile(
    r"\bthrow\s+(?:['\"`]|{|\[)|"
    r"\b(?:Promise\.)?reject\s*\(\s*(?:['\"`]|{|\[)"
)
IGNORED_REJECTION_RE = re.compile(
    r"\.catch\s*\(\s*(?:\(\s*[^)]*\s*\)|[A-Za-z_$][\w$]*|function\s*\([^)]*\))\s*=>?\s*\{\s*\}\s*\)"
)
INLINE_CATCH_RE = re.compile(r"\bcatch\s*\(\s*[A-Za-z_$][\w$]*\s*\)\s*\{(.*?)\}")
GLOBAL_PROTOTYPE_MUTATION_RE = re.compile(
    r"\b(?:Array|Object|String|Number|Boolean|Date|Promise|Map|Set)\.prototype\."
    r"[A-Za-z_$][\w$]*\s*="
)
CONTROL_FLOW_NAMES = {"catch", "for", "if", "switch", "while", "with"}


@dataclass
class Lead:
    file: str
    line: int
    severity: str
    category: str
    principle: str
    current_pattern: str
    why_it_matters: str
    suggested_next_step: str
    evidence: list[str] = field(default_factory=lambda: ["static_scan"])
    finding_id: str = ""


def excluded_by_glob(path: Path, root: Path, patterns: list[str]) -> bool:
    candidate = path.name if root.is_file() else path.relative_to(root).as_posix()
    return any(fnmatch.fnmatch(candidate, pattern) for pattern in patterns)


def iter_source_files(root: Path, excludes: set[str], exclude_globs: list[str]) -> Iterable[Path]:
    if root.is_file():
        if (
            root.suffix in TEXT_EXTENSIONS
            and root.resolve() != SCANNER_PATH
            and not excluded_by_glob(root, root, exclude_globs)
        ):
            yield root
        return

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [name for name in dirnames if name not in excludes]
        for filename in filenames:
            path = Path(dirpath) / filename
            if (
                path.suffix in TEXT_EXTENSIONS
                and path.resolve() != SCANNER_PATH
                and not excluded_by_glob(path, root, exclude_globs)
            ):
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


def split_params(params: str) -> list[str]:
    result: list[str] = []
    current: list[str] = []
    depth = 0
    quote: str | None = None
    for char in params:
        if quote:
            current.append(char)
            if char == quote:
                quote = None
            continue
        if char in {"'", '"', "`"}:
            quote = char
            current.append(char)
            continue
        if char in "([{<":
            depth += 1
        elif char in ")]}>":
            depth = max(0, depth - 1)
        if char == "," and depth == 0:
            part = "".join(current).strip()
            if part:
                result.append(part)
            current = []
        else:
            current.append(char)
    part = "".join(current).strip()
    if part:
        result.append(part)
    return [param for param in result if param not in {"", "..."}]


def boolean_params(params: list[str]) -> list[str]:
    bools: list[str] = []
    for param in params:
        cleaned = param.split("=", 1)[0].strip()
        if re.search(r":\s*boolean\b", cleaned) or re.search(r"\bbool\b", cleaned):
            bools.append(cleaned)
    return bools


def function_signature(match: re.Match[str]) -> tuple[str, str]:
    groups = match.groups()
    for name_index, params_index in ((0, 1), (2, 3), (4, 5), (6, 7)):
        if groups[params_index] is not None:
            return groups[name_index] or "<anonymous>", groups[params_index]
    return "<anonymous>", ""


def add_comment_leads(path: Path, root: Path, index: int, stripped: str, leads: list[Lead]) -> bool:
    match = COMMENT_START_RE.match(stripped)
    if not match:
        return False
    body = match.group(1).strip()
    if not body:
        return True

    if COMMENTED_CODE_RE.search(body):
        leads.append(
            Lead(
                file=relative(path, root),
                line=index,
                severity="medium",
                category="commented_out_code",
                principle="Do not leave commented-out code in the codebase.",
                current_pattern="Comment appears to contain disabled code.",
                why_it_matters="Disabled code hides dead paths from tests, formatters, and reviewers.",
                suggested_next_step="Delete it or restore it with tests and ownership.",
            )
        )
    if JOURNAL_COMMENT_RE.search(body):
        leads.append(
            Lead(
                file=relative(path, root),
                line=index,
                severity="info",
                category="journal_comment",
                principle="Do not have journal comments.",
                current_pattern="Comment contains a date-like changelog entry.",
                why_it_matters="Version history belongs in git; dated code comments usually drift.",
                suggested_next_step="Keep only current behavior rationale in the code.",
            )
        )
    if POSITIONAL_MARKER_RE.search(body):
        leads.append(
            Lead(
                file=relative(path, root),
                line=index,
                severity="info",
                category="positional_marker_comment",
                principle="Avoid positional markers.",
                current_pattern="Comment uses a long visual separator.",
                why_it_matters="Banners add noise and make structure depend on decoration.",
                suggested_next_step="Prefer module/function names and normal sectioning.",
            )
        )
    if TODO_RE.search(body) and (":" not in body or len(body) < 16):
        leads.append(
            Lead(
                file=relative(path, root),
                line=index,
                severity="info",
                category="bare_todo",
                principle="TODO comments should carry the next action.",
                current_pattern="TODO comment is terse or lacks a colon-delimited action.",
                why_it_matters="Vague TODOs become permanent noise.",
                suggested_next_step="Rewrite with an owner/action or track it outside code.",
            )
        )
    return True


class BlockTracker:
    def __init__(self, start_line: int, name: str, kind: str, opening_depth: int) -> None:
        self.start_line = start_line
        self.name = name
        self.kind = kind
        self.opening_depth = opening_depth
        self.method_count = 0


def update_depth(line: str, depth: int) -> int:
    in_quote: str | None = None
    escaped = False
    for char in line:
        if in_quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == in_quote:
                in_quote = None
            continue
        if char in {"'", '"', "`"}:
            in_quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth = max(0, depth - 1)
    return depth


def scan_js_ts(path: Path, root: Path, text: str) -> list[Lead]:
    leads: list[Lead] = []
    lines = text.splitlines()
    depth = 0
    blocks: list[BlockTracker] = []
    catch_blocks: list[dict[str, object]] = []

    for index, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped:
            depth = update_depth(line, depth)
            continue

        is_comment = add_comment_leads(path, root, index, stripped, leads)

        class_match = None if is_comment else CLASS_RE.search(stripped)
        if class_match:
            blocks.append(BlockTracker(index, class_match.group(1), "class", depth))

        function_match = None if is_comment else FUNCTION_RE.search(stripped)
        if function_match:
            name, params_text = function_signature(function_match)
            if name in CONTROL_FLOW_NAMES:
                function_match = None

        if function_match:
            params = split_params(params_text)
            if len(params) > 2:
                leads.append(
                    Lead(
                        file=relative(path, root),
                        line=index,
                        severity="medium",
                        category="too_many_parameters",
                        principle="Function arguments should be two or fewer ideally.",
                        current_pattern=f"`{name}` has {len(params)} parameters.",
                        why_it_matters="Long parameter lists make call sites harder to read and refactor.",
                        suggested_next_step="Inspect whether a named options object or deeper module interface would clarify the call.",
                    )
                )
            bools = boolean_params(params)
            for param in bools:
                leads.append(
                    Lead(
                        file=relative(path, root),
                        line=index,
                        severity="medium",
                        category="boolean_flag_parameter",
                        principle="Do not use flags as function parameters.",
                        current_pattern=f"`{name}` accepts boolean parameter `{param}`.",
                        why_it_matters="Boolean flags often mean one function is carrying multiple behaviors.",
                        suggested_next_step="Check call sites; consider split functions or an explicit options object when behavior differs.",
                    )
                )
            blocks.append(BlockTracker(index, name, "function", depth))

        if blocks and blocks[-1].kind == "class" and METHOD_RE.match(stripped):
            blocks[-1].method_count += 1

        if not is_comment and TYPE_CHECK_RE.search(stripped):
            leads.append(
                Lead(
                    file=relative(path, root),
                    line=index,
                    severity="medium",
                    category="type_check_conditional",
                    principle="Avoid type checking when polymorphism or discriminated unions fit better.",
                    current_pattern="Line contains `typeof`, `instanceof`, or constructor type checking.",
                    why_it_matters="Repeated type checks can scatter behavior selection across callers.",
                    suggested_next_step="Inspect whether the branch is isolated, duplicated, or better represented by a type-safe variant.",
                )
            )

        if not is_comment and NEGATIVE_CONDITION_RE.search(stripped):
            leads.append(
                Lead(
                    file=relative(path, root),
                    line=index,
                    severity="info",
                    category="negative_conditional",
                    principle="Avoid negative conditionals when a positive name is clearer.",
                    current_pattern="Conditional uses direct negation.",
                    why_it_matters="Negated branches can make reader state harder to track.",
                    suggested_next_step="Inspect whether a positive predicate or early return improves the flow.",
                )
            )

        if not is_comment and SHORT_CIRCUIT_DEFAULT_RE.search(stripped):
            leads.append(
                Lead(
                    file=relative(path, root),
                    line=index,
                    severity="medium",
                    category="short_circuit_default",
                    principle="Use default arguments or nullish coalescing instead of broad short-circuit defaults.",
                    current_pattern="Assignment defaults with `||`.",
                    why_it_matters="Valid falsy values such as 0, false, and empty strings can be overwritten.",
                    suggested_next_step="Check expected falsy inputs; consider `??` or a default parameter.",
                )
            )

        if not is_comment and NON_ERROR_THROW_RE.search(stripped):
            leads.append(
                Lead(
                    file=relative(path, root),
                    line=index,
                    severity="high",
                    category="non_error_throw",
                    principle="Always use Error for throwing or rejecting.",
                    current_pattern="Throws or rejects a string/plain object/array.",
                    why_it_matters="Non-Error failures lose stack and type information.",
                    suggested_next_step="Throw an Error subclass or structured error object wrapped by Error semantics.",
                )
            )

        if not is_comment and IGNORED_REJECTION_RE.search(stripped):
            leads.append(
                Lead(
                    file=relative(path, root),
                    line=index,
                    severity="high",
                    category="ignored_rejection",
                    principle="Do not ignore rejected promises.",
                    current_pattern="Promise rejection handler is empty.",
                    why_it_matters="Swallowed async failures hide correctness and operational issues.",
                    suggested_next_step="Handle, log with context, rethrow, or document why the failure is intentionally ignored.",
                )
            )

        if not is_comment and GLOBAL_PROTOTYPE_MUTATION_RE.search(stripped):
            leads.append(
                Lead(
                    file=relative(path, root),
                    line=index,
                    severity="high",
                    category="global_prototype_mutation",
                    principle="Do not write to global functions or built-in prototypes.",
                    current_pattern="Line mutates a built-in prototype.",
                    why_it_matters="Global prototype changes leak behavior into unrelated code and dependencies.",
                    suggested_next_step="Use a local helper or wrapper instead.",
                )
            )

        inline_catch_match = None if is_comment else INLINE_CATCH_RE.search(stripped)
        if inline_catch_match:
            inline_body = inline_catch_match.group(1).strip()
            if (
                not inline_body
                or inline_body.startswith("//")
                or (inline_body.startswith("/*") and inline_body.endswith("*/"))
            ):
                leads.append(
                    Lead(
                        file=relative(path, root),
                        line=index,
                        severity="high",
                        category="ignored_catch",
                        principle="Do not ignore caught errors.",
                        current_pattern="Catch block appears to swallow the caught error.",
                        why_it_matters="Swallowed failures make production behavior and tests misleading.",
                        suggested_next_step="Handle with context, rethrow, or document the intentional suppression.",
                    )
                )

        catch_match = (
            None
            if is_comment or inline_catch_match
            else re.search(r"\bcatch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)", stripped)
        )
        if catch_match:
            catch_blocks.append(
                {
                    "line": index,
                    "depth": depth,
                    "body_tokens": 0,
                }
            )

        for catch in catch_blocks:
            if not is_comment and int(catch["line"]) != index and stripped not in {"{", "}"}:
                catch["body_tokens"] = int(catch["body_tokens"]) + 1

        new_depth = update_depth(line, depth)

        remaining_blocks: list[BlockTracker] = []
        for block in blocks:
            if new_depth <= block.opening_depth and index > block.start_line:
                length = index - block.start_line + 1
                if block.kind == "function" and length > 80:
                    leads.append(
                        Lead(
                            file=relative(path, root),
                            line=block.start_line,
                            severity="medium",
                            category="oversized_function",
                            principle="Functions should do one thing.",
                            current_pattern=f"`{block.name}` spans about {length} lines.",
                            why_it_matters="Long functions often mix abstraction levels or responsibilities.",
                            suggested_next_step="Inspect whether the function can be split by behavior, policy, or data transformation.",
                        )
                    )
                if block.kind == "class" and (length > 220 or block.method_count > 15):
                    leads.append(
                        Lead(
                            file=relative(path, root),
                            line=block.start_line,
                            severity="medium",
                            category="oversized_class",
                            principle="Classes should be small and cohesive.",
                            current_pattern=f"`{block.name}` spans about {length} lines with {block.method_count} methods.",
                            why_it_matters="Large classes often mix responsibilities and make changes less local.",
                            suggested_next_step="Inspect cohesion and caller-facing responsibilities before proposing extraction.",
                        )
                    )
            else:
                remaining_blocks.append(block)
        blocks = remaining_blocks

        remaining_catches: list[dict[str, object]] = []
        for catch in catch_blocks:
            if new_depth <= int(catch["depth"]) and index > int(catch["line"]):
                if int(catch["body_tokens"]) == 0:
                    leads.append(
                        Lead(
                            file=relative(path, root),
                            line=int(catch["line"]),
                            severity="high",
                            category="ignored_catch",
                            principle="Do not ignore caught errors.",
                            current_pattern="Catch block appears to swallow the caught error.",
                            why_it_matters="Swallowed failures make production behavior and tests misleading.",
                            suggested_next_step="Handle with context, rethrow, or document the intentional suppression.",
                        )
                    )
            else:
                remaining_catches.append(catch)
        catch_blocks = remaining_catches

        depth = new_depth

    return leads


class PythonCleanCodeVisitor(ast.NodeVisitor):
    def __init__(self, path: Path, root: Path) -> None:
        self.path = path
        self.root = root
        self.leads: list[Lead] = []

    def add(
        self,
        node: ast.AST,
        severity: str,
        category: str,
        principle: str,
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
                principle=principle,
                current_pattern=current_pattern,
                why_it_matters=why_it_matters,
                suggested_next_step=suggested_next_step,
            )
        )

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self.visit_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self.visit_function(node)

    def visit_function(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        arg_count = len(node.args.args) + len(node.args.kwonlyargs)
        if node.args.vararg:
            arg_count += 1
        if node.args.kwarg:
            arg_count += 1
        if arg_count > 2:
            self.add(
                node,
                "medium",
                "too_many_parameters",
                "Function arguments should be two or fewer ideally.",
                f"`{node.name}` has {arg_count} parameters.",
                "Long parameter lists make call sites harder to read and refactor.",
                "Inspect whether a named options object or deeper module interface would clarify the call.",
            )
        end_line = getattr(node, "end_lineno", node.lineno)
        if end_line - node.lineno + 1 > 80:
            self.add(
                node,
                "medium",
                "oversized_function",
                "Functions should do one thing.",
                f"`{node.name}` spans about {end_line - node.lineno + 1} lines.",
                "Long functions often mix abstraction levels or responsibilities.",
                "Inspect whether the function can be split by behavior, policy, or data transformation.",
            )
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        end_line = getattr(node, "end_lineno", node.lineno)
        method_count = sum(isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)) for item in node.body)
        if end_line - node.lineno + 1 > 220 or method_count > 15:
            self.add(
                node,
                "medium",
                "oversized_class",
                "Classes should be small and cohesive.",
                f"`{node.name}` spans about {end_line - node.lineno + 1} lines with {method_count} methods.",
                "Large classes often mix responsibilities and make changes less local.",
                "Inspect cohesion and caller-facing responsibilities before proposing extraction.",
            )
        self.generic_visit(node)

    def visit_Raise(self, node: ast.Raise) -> None:
        if isinstance(node.exc, (ast.Constant, ast.Dict, ast.List, ast.Tuple)):
            self.add(
                node,
                "high",
                "non_error_throw",
                "Always use Error-like exceptions for throwing.",
                "Raise statement uses a literal/container.",
                "Non-exception failures lose stack/type semantics.",
                "Raise an Exception subclass with useful context.",
            )
        self.generic_visit(node)

    def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
        if not node.body or all(isinstance(stmt, ast.Pass) for stmt in node.body):
            self.add(
                node,
                "high",
                "ignored_catch",
                "Do not ignore caught errors.",
                "Except block is empty or only passes.",
                "Swallowed failures make production behavior and tests misleading.",
                "Handle with context, rethrow, or document intentional suppression.",
            )
        self.generic_visit(node)


def scan_python(path: Path, root: Path, text: str) -> list[Lead]:
    leads = scan_text_comments(path, root, text)
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return leads
    visitor = PythonCleanCodeVisitor(path, root)
    visitor.visit(tree)
    leads.extend(visitor.leads)
    return leads


def scan_text_comments(path: Path, root: Path, text: str) -> list[Lead]:
    leads: list[Lead] = []
    for index, line in enumerate(text.splitlines(), start=1):
        add_comment_leads(path, root, index, line.strip(), leads)
    return leads


def scan_file(path: Path, root: Path, text: str) -> list[Lead]:
    if path.suffix == ".py":
        return scan_python(path, root, text)
    if path.suffix in JS_TS_EXTENSIONS:
        return scan_js_ts(path, root, text)
    return scan_text_comments(path, root, text)


def dedupe(leads: list[Lead]) -> list[Lead]:
    seen: set[tuple[str, int, str, str]] = set()
    result: list[Lead] = []
    for lead in leads:
        key = (lead.file, lead.line, lead.category, lead.current_pattern)
        if key not in seen:
            seen.add(key)
            result.append(lead)
    return result


def sort_key(lead: Lead) -> tuple[int, str, int, str]:
    severity_rank = {"high": 0, "medium": 1, "info": 2}
    return (severity_rank.get(lead.severity, 3), lead.file, lead.line, lead.category)


def assign_ids(leads: list[Lead]) -> list[Lead]:
    for index, lead in enumerate(leads, start=1):
        lead.finding_id = f"cc-{index:03d}"
    return leads


def render_markdown(leads: list[Lead], total_leads: int, dropped_leads: int, max_findings: int) -> str:
    if not leads:
        return "No obvious clean-code leads found by heuristic scanning.\n"

    lines = [
        "# Clean Code Scan Leads",
        "",
        "These are static leads, not proof. Inspect surrounding code before reporting a finding.",
        f"Returned {len(leads)} of {total_leads} lead(s).",
        "",
    ]
    if dropped_leads:
        lines.extend(
            [
                (
                    f"Output truncated by --max-findings={max_findings}; "
                    f"{dropped_leads} lead(s) omitted."
                ),
                "Re-run with a higher limit or narrower path before treating the scan as complete.",
                "",
            ]
        )
    for lead in leads:
        lines.extend(
            [
                f"## {lead.finding_id}: {lead.severity.upper()} {lead.category}",
                f"- Location: `{lead.file}:{lead.line}`",
                f"- Principle: {lead.principle}",
                f"- Current pattern: {lead.current_pattern}",
                f"- Why it matters: {lead.why_it_matters}",
                f"- Suggested next step: {lead.suggested_next_step}",
                "",
            ]
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan a file or directory for clean-code static leads.")
    parser.add_argument("root", nargs="?", default=".", help="File or directory to scan.")
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown")
    parser.add_argument("--exclude", action="append", default=[], help="Additional directory name to exclude.")
    parser.add_argument(
        "--exclude-glob",
        action="append",
        default=[],
        help="Additional file glob to exclude, matched against paths relative to the scan root.",
    )
    parser.add_argument("--max-findings", type=int, default=120)
    args = parser.parse_args()
    if args.max_findings < 1:
        parser.error("--max-findings must be at least 1")

    root = Path(args.root).resolve()
    excludes = DEFAULT_EXCLUDES | set(args.exclude)
    leads: list[Lead] = []

    display_root = root.parent if root.is_file() else root
    for path in iter_source_files(root, excludes, args.exclude_glob):
        text = read_text(path)
        if text is not None:
            leads.extend(scan_file(path, display_root, text))

    all_leads = sorted(dedupe(leads), key=sort_key)
    dropped_leads = max(0, len(all_leads) - args.max_findings)
    leads = assign_ids(all_leads[: args.max_findings])
    if args.format == "json":
        print(
            json.dumps(
                {
                    "summary": {
                        "kind": "static_leads",
                        "disclaimer": (
                            "These are static leads, not proof. Inspect surrounding code before "
                            "reporting a finding."
                        ),
                        "total_leads": len(all_leads),
                        "returned_leads": len(leads),
                        "truncated": dropped_leads > 0,
                        "dropped_leads": dropped_leads,
                        "max_findings": args.max_findings,
                    },
                    "leads": [asdict(lead) for lead in leads],
                },
                indent=2,
            )
        )
    else:
        print(render_markdown(leads, len(all_leads), dropped_leads, args.max_findings))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
