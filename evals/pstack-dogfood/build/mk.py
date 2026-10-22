"""Tiny fixture writer: fixture_root(name); write_tree(root, {relpath: text}); commit(root); diff_fingerprint(root).

Every builder is a script: `python3 build/<id>.py [out-dir]` writes <out-dir>/<fixture>
(default out-dir: a fresh temp dir). build_fixtures.py runs all of them.
"""
import hashlib
import os
import subprocess
import sys
import tempfile
import textwrap

# Drop GIT_DIR and friends so a builder run from a git hook cannot write into the caller's repo.
_LOCAL = subprocess.run(["git", "rev-parse", "--local-env-vars"], capture_output=True, text=True).stdout.split()
GIT_ENV = {k: v for k, v in os.environ.items() if k not in _LOCAL}


def fixture_root(name):
    """Return a new, empty <out-dir>/<name>; out-dir is argv[1] or a fresh temp dir."""
    out = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix="pstack-fixtures-")
    root = os.path.join(os.path.abspath(out), name)
    if os.path.exists(root):
        sys.exit(f"{root} already exists; build into a fresh directory")
    os.makedirs(root)
    print(f"building {root}", file=sys.stderr)
    return root


def write_tree(root, files):
    for rel, text in files.items():
        path = os.path.join(root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        body = textwrap.dedent(text).lstrip("\n")
        with open(path, "w") as fh:
            fh.write(body)
        if rel.startswith("bin/") or rel.endswith(".sh"):
            os.chmod(path, 0o755)


def git(root, *args):
    return subprocess.run(["git", *args], cwd=root, env=GIT_ENV, check=True, capture_output=True, text=True).stdout


def commit(root):
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.name", "Dev")
    git(root, "config", "user.email", "dev@example.com")
    git(root, "add", "-A")
    git(root, "-c", "commit.gpgsign=false", "commit", "-q", "--no-verify", "-m", "Initial import")


def diff_fingerprint(root):
    """sha256 of `git diff` + sorted untracked file contents, to detect edits by a verifier."""
    h = hashlib.sha256(git(root, "diff").encode())
    untracked = sorted(git(root, "ls-files", "--others", "--exclude-standard").split())
    for rel in untracked:
        h.update(rel.encode())
        with open(os.path.join(root, rel), "rb") as fh:
            h.update(fh.read())
    return h.hexdigest()
