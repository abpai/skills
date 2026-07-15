#!/usr/bin/env python3
"""Bounded, secret-free Claude CLI authentication preflight."""

from __future__ import annotations

import argparse
import errno
import json
import os
import pty
import re
import select
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path


EXIT_CODES = {
    "authenticated": 0,
    "credential_store_unavailable": 69,
    "indeterminate": 70,
    "not_logged_in": 78,
    "timed_out": 124,
    "cli_missing": 127,
}

CREDENTIAL_STORE_PATTERNS = (
    "credential store",
    "credentials unavailable",
    "could not access credentials",
    "failed to access credentials",
    "keychain",
    "errsec",
    "interaction not allowed",
    "security framework",
)
NOT_LOGGED_IN_PATTERNS = (
    "not logged in",
    "logged out",
    "unauthenticated",
    "please log in",
)
VERSION_PATTERN = re.compile(r"\b\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?\b")
MAX_CAPTURE_BYTES = 64 * 1024


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--claude-bin", default="claude")
    parser.add_argument("--timeout", type=int, default=8)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def atomic_write_json(path: Path, data: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.tmp.{os.getpid()}")
    temporary.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    os.chmod(temporary, 0o600)
    temporary.replace(path)


def safe_version(raw: bytes) -> str:
    match = VERSION_PATTERN.search(raw.decode("utf-8", errors="replace"))
    return match.group(0) if match else "unknown"


def run_version_bounded(
    executable: str, workspace: str, timeout: float
) -> tuple[int | None, bytes, bool]:
    process = subprocess.Popen(
        [executable, "--version"],
        cwd=workspace,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    try:
        output, _ = process.communicate(timeout=timeout)
        return process.returncode, output[:MAX_CAPTURE_BYTES], False
    except subprocess.TimeoutExpired:
        terminate_popen_group(process)
        return None, b"", True


def terminate_popen_group(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=0.5)
        return
    except subprocess.TimeoutExpired:
        pass
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    try:
        process.wait(timeout=0.5)
    except subprocess.TimeoutExpired:
        pass


def terminate_group(pid: int) -> None:
    try:
        os.killpg(pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    deadline = time.monotonic() + 0.5
    while time.monotonic() < deadline:
        waited, _ = os.waitpid(pid, os.WNOHANG)
        if waited == pid:
            return
        time.sleep(0.05)
    try:
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    try:
        os.waitpid(pid, 0)
    except ChildProcessError:
        pass


def run_auth_with_pty(
    executable: str, workspace: str, timeout: float
) -> tuple[int | None, bytes, bool]:
    pid, master_fd = pty.fork()
    if pid == 0:
        try:
            os.chdir(workspace)
            os.execve(
                executable,
                [executable, "auth", "status", "--text"],
                os.environ.copy(),
            )
        except BaseException:
            os._exit(126)

    captured = bytearray()
    deadline = time.monotonic() + timeout
    timed_out = False
    wait_status: int | None = None

    def append_chunk(chunk: bytes) -> None:
        if chunk and len(captured) < MAX_CAPTURE_BYTES:
            captured.extend(chunk[: MAX_CAPTURE_BYTES - len(captured)])

    def drain_after_exit() -> None:
        os.set_blocking(master_fd, False)
        while True:
            try:
                chunk = os.read(master_fd, 4096)
                if not chunk:
                    return
                append_chunk(chunk)
            except BlockingIOError:
                return
            except OSError as exc:
                if exc.errno == errno.EIO:
                    return
                raise

    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                timed_out = True
                terminate_group(pid)
                break
            readable, _, _ = select.select([master_fd], [], [], min(remaining, 0.1))
            if readable:
                try:
                    chunk = os.read(master_fd, 4096)
                except OSError as exc:
                    if exc.errno == errno.EIO:
                        chunk = b""
                    else:
                        raise
                append_chunk(chunk)
                waited, status = os.waitpid(pid, os.WNOHANG)
                if waited == pid:
                    wait_status = status
                    drain_after_exit()
                    break
            else:
                waited, status = os.waitpid(pid, os.WNOHANG)
                if waited == pid:
                    wait_status = status
                    drain_after_exit()
                    break
        if timed_out:
            return None, bytes(captured), True
        if wait_status is None:
            _, wait_status = os.waitpid(pid, 0)
        return os.waitstatus_to_exitcode(wait_status), bytes(captured), False
    finally:
        os.close(master_fd)


def classify_auth(exit_code: int | None, raw: bytes, timed_out: bool) -> tuple[str, str]:
    if timed_out:
        return "timed_out", "auth_probe_deadline"
    normalized = raw.decode("utf-8", errors="replace").lower()
    if any(pattern in normalized for pattern in CREDENTIAL_STORE_PATTERNS):
        return "credential_store_unavailable", "credential_store_access_failed"
    if any(pattern in normalized for pattern in NOT_LOGGED_IN_PATTERNS):
        return "not_logged_in", "auth_command_reported_logged_out"
    if exit_code == 0:
        return "authenticated", "auth_command_succeeded"
    return "indeterminate", "auth_command_failed_without_safe_classification"


def main() -> int:
    args = parse_args()
    started = time.monotonic()
    result: dict[str, object] = {
        "status": "indeterminate",
        "authenticated": False,
        "reason": "preflight_not_completed",
        "terminal_envelope": "pty",
        "auth_exit_code": None,
        "cli_version": "unknown",
        "cli_path": "",
        "duration_ms": 0,
    }

    if args.timeout < 1:
        result["reason"] = "invalid_timeout"
        atomic_write_json(Path(args.output), result)
        return EXIT_CODES["indeterminate"]

    executable = shutil.which(args.claude_bin)
    if executable is None:
        result.update(status="cli_missing", reason="claude_executable_not_found")
        result["duration_ms"] = int((time.monotonic() - started) * 1000)
        atomic_write_json(Path(args.output), result)
        return EXIT_CODES["cli_missing"]
    executable = str(Path(executable).resolve())
    result["cli_path"] = executable

    deadline = started + args.timeout
    try:
        version_timeout = max(0.1, min(2.0, deadline - time.monotonic()))
        version_exit, version_output, version_timed_out = run_version_bounded(
            executable, args.workspace, version_timeout
        )
    except OSError:
        result.update(status="indeterminate", reason="version_probe_failed")
    else:
        if version_timed_out:
            result.update(status="timed_out", reason="version_probe_deadline")
        elif version_exit != 0:
            result.update(status="indeterminate", reason="version_command_failed")
        else:
            result["cli_version"] = safe_version(version_output)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                result.update(status="timed_out", reason="preflight_deadline")
            else:
                try:
                    auth_exit, auth_output, timed_out = run_auth_with_pty(
                        executable, args.workspace, remaining
                    )
                except OSError:
                    result.update(
                        status="credential_store_unavailable",
                        reason="pty_auth_envelope_unavailable",
                    )
                else:
                    status, reason = classify_auth(auth_exit, auth_output, timed_out)
                    result.update(
                        status=status,
                        authenticated=status == "authenticated",
                        reason=reason,
                        auth_exit_code=auth_exit,
                    )

    result["duration_ms"] = int((time.monotonic() - started) * 1000)
    atomic_write_json(Path(args.output), result)
    status = str(result["status"])
    print(
        "[claude-preflight] "
        f"status={status} reason={result['reason']} terminal=pty "
        f"duration_ms={result['duration_ms']}"
    )
    return EXIT_CODES.get(status, EXIT_CODES["indeterminate"])


if __name__ == "__main__":
    sys.exit(main())
