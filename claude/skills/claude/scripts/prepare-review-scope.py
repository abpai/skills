#!/usr/bin/env python3
"""Build a tracked-file-only Claude review workspace and redacted approval record."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path, PurePosixPath


DENIED_NAMES = {
    ".netrc",
    ".npmrc",
    ".pypirc",
    "credentials.json",
    "secrets.json",
    "id_rsa",
    "id_ed25519",
}
DENIED_SUFFIXES = {".key", ".pem", ".p12", ".pfx"}
SECRET_PATTERNS = (
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"\bBearer\s+[A-Za-z0-9._~+/=-]{16,}", re.IGNORECASE),
)
EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
ASSIGNMENT_PATTERN = re.compile(
    r"(?i)\b(token|password|passwd|api[_-]?key|client[_-]?secret)\s*[:=]\s*[^\s,;]+"
)


class ScopeError(RuntimeError):
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--scope-file", required=True)
    parser.add_argument("--approval-file", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--approval-output", required=True)
    parser.add_argument("--prompt-input", required=True)
    parser.add_argument("--prompt-output", required=True)
    return parser.parse_args()


def run_git(
    workspace: Path,
    *args: str,
    input_text: str | None = None,
    allowed_exit_codes: tuple[int, ...] = (0,),
) -> str:
    completed = subprocess.run(
        ["git", "-C", str(workspace), *args],
        input=input_text,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode not in allowed_exit_codes:
        raise ScopeError(f"git_{args[0].replace('-', '_')}_failed")
    return completed.stdout


def normalize_scope_entry(raw: str) -> str:
    value = raw.strip().replace("\\", "/").rstrip("/")
    if not value or value.startswith("/"):
        raise ScopeError("invalid_scope_path")
    path = PurePosixPath(value)
    if any(part in {"", ".", ".."} for part in path.parts):
        raise ScopeError("invalid_scope_path")
    if EMAIL_PATTERN.search(value) or ASSIGNMENT_PATTERN.search(value):
        raise ScopeError("sensitive_scope_path")
    return str(path)


def denied_path(relative: str) -> bool:
    path = PurePosixPath(relative)
    lowered = [part.lower() for part in path.parts]
    if any(part == ".env" or part.startswith(".env.") for part in lowered):
        return True
    if any(part in {".git", ".ssh"} for part in lowered):
        return True
    name = lowered[-1]
    return name in DENIED_NAMES or Path(name).suffix in DENIED_SUFFIXES


def sanitize_text(value: str) -> str:
    value = EMAIL_PATTERN.sub("[redacted-email]", value)
    value = ASSIGNMENT_PATTERN.sub(lambda match: f"{match.group(1)}=[redacted]", value)
    for pattern in SECRET_PATTERNS:
        value = pattern.sub("[redacted-secret]", value)
    return value[:2000]


def contains_known_secret(data: bytes) -> bool:
    text = data.decode("utf-8", errors="ignore")
    return any(pattern.search(text) for pattern in SECRET_PATTERNS)


def read_json(path: Path) -> dict[str, object]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ScopeError("invalid_approval_metadata") from exc
    if not isinstance(data, dict):
        raise ScopeError("invalid_approval_metadata")
    return data


def atomic_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.tmp.{os.getpid()}")
    temporary.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    os.chmod(temporary, 0o600)
    temporary.replace(path)


def main() -> int:
    args = parse_args()
    workspace = Path(args.workspace).resolve()
    output_dir = Path(args.output_dir)
    approval_output = Path(args.approval_output)
    prompt_input = Path(args.prompt_input)
    prompt_output = Path(args.prompt_output)

    try:
        run_git(workspace, "rev-parse", "--is-inside-work-tree")
        requested = [
            normalize_scope_entry(line)
            for line in Path(args.scope_file).read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        ]
        if not requested:
            raise ScopeError("empty_review_scope")

        approval = read_json(Path(args.approval_file))
        destination = approval.get("destination")
        purpose = approval.get("purpose")
        exclusions = approval.get("exclusions")
        approved_scope = approval.get("approved_scope")
        current_user_approved = approval.get("current_user_approved")
        if destination != "Claude Code/Anthropic" or current_user_approved is not True:
            raise ScopeError("sharing_approval_missing")
        if not isinstance(purpose, str) or not isinstance(exclusions, list) or not isinstance(approved_scope, list):
            raise ScopeError("invalid_approval_metadata")
        approved_normalized = [normalize_scope_entry(str(item)) for item in approved_scope]
        if sorted(set(requested)) != sorted(set(approved_normalized)):
            raise ScopeError("scope_does_not_match_approval")

        tracked = run_git(workspace, "ls-files", "--cached", "-z").split("\0")
        selected = sorted(
            path
            for path in tracked
            if any(path == entry or path.startswith(entry + "/") for entry in requested)
        )
        if not selected:
            raise ScopeError("approved_scope_has_no_tracked_files")

        ignored = set(
            filter(
                None,
                run_git(
                    workspace,
                    "check-ignore",
                    "--no-index",
                    "-z",
                    "--stdin",
                    input_text="\0".join(selected) + "\0",
                    allowed_exit_codes=(0, 1),
                ).split("\0"),
            )
        )
        rejected = [path for path in selected if path in ignored or denied_path(path)]
        if rejected:
            raise ScopeError("approved_scope_contains_excluded_files")

        if output_dir.exists():
            shutil.rmtree(output_dir)
        output_dir.mkdir(parents=True, mode=0o700)
        copied: list[str] = []
        for relative in selected:
            source = workspace / relative
            if source.is_symlink() or not source.is_file():
                raise ScopeError("approved_scope_contains_non_regular_file")
            data = source.read_bytes()
            if contains_known_secret(data):
                raise ScopeError("approved_scope_contains_known_secret")
            destination_path = output_dir / relative
            destination_path.parent.mkdir(parents=True, exist_ok=True)
            destination_path.write_bytes(data)
            os.chmod(destination_path, 0o600)
            copied.append(relative)

        evidence_dir = output_dir / ".review-evidence"
        evidence_dir.mkdir(mode=0o700)
        candidate_diff = run_git(workspace, "diff", "--no-ext-diff", "--binary", "HEAD", "--", *copied)
        if contains_known_secret(candidate_diff.encode("utf-8")):
            raise ScopeError("candidate_diff_contains_known_secret")
        (evidence_dir / "candidate.diff").write_text(candidate_diff, encoding="utf-8")
        os.chmod(evidence_dir / "candidate.diff", 0o600)
        atomic_json(
            evidence_dir / "scope-manifest.json",
            {"tracked_files": copied, "candidate_diff": ".review-evidence/candidate.diff"},
        )

        sanitized_approval = {
            "destination": destination,
            "approved_scope": requested,
            "purpose": sanitize_text(purpose),
            "exclusions": [sanitize_text(str(item)) for item in exclusions],
            "current_user_approved": True,
            "evidence_class": "repo-grounded-review",
        }
        atomic_json(approval_output, sanitized_approval)
        approval_copy = evidence_dir / "sharing-approval.json"
        atomic_json(approval_copy, sanitized_approval)

        prompt = prompt_input.read_text(encoding="utf-8")
        header = (
            "User-approved external data sharing:\n"
            "- Destination: Claude Code/Anthropic.\n"
            f"- Approved scope: {', '.join(requested)}.\n"
            f"- Purpose: {sanitized_approval['purpose']}.\n"
            f"- Exclusions: {', '.join(sanitized_approval['exclusions'])}.\n"
            "- Current-user approval present: yes.\n"
            "- Evidence class: repo-grounded review.\n"
            "Use read/search tools inside this sanitized workspace. Do not claim a workspace review without tool evidence.\n\n"
        )
        prompt_output.write_text(header + prompt, encoding="utf-8")
        os.chmod(prompt_output, 0o600)
    except (OSError, ScopeError) as exc:
        reason = str(exc) if isinstance(exc, ScopeError) else "scope_io_failed"
        print(f"[review-scope] status=failed reason={reason}", file=sys.stderr)
        return 65

    print(f"[review-scope] status=ready tracked_files={len(copied)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
