"""Audit fixtures or run dirs: commit count, dirty files, diff fingerprint, and leaky words.

usage: python3 build/audit.py <dir>...   (a fixture/run dir, or a dir of them such as build_fixtures.py's out-dir)
"""
import os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from mk import diff_fingerprint

LEAK = re.compile(r"\b(bug|buggy|defect|seed(ed)?|flaw(ed)?|broken|hint|expected answer|TODO|FIXME|race|lost update|idempot|collision|collide)\b", re.I)


def repos(paths):
    for path in paths:
        if os.path.isdir(os.path.join(path, ".git")):
            yield path
        else:
            for name in sorted(os.listdir(path)):
                if os.path.isdir(os.path.join(path, name, ".git")):
                    yield os.path.join(path, name)


for root in repos(sys.argv[1:] or sys.exit(__doc__)):
    name = os.path.basename(root)
    count = subprocess.run(["git", "rev-list", "--count", "HEAD"], cwd=root, capture_output=True, text=True).stdout.strip()
    msg = subprocess.run(["git", "log", "--format=%s"], cwd=root, capture_output=True, text=True).stdout.strip()
    dirty = subprocess.run(["git", "status", "--short"], cwd=root, capture_output=True, text=True).stdout.split("\n")
    dirty = [d for d in dirty if d]
    print(f"{name}: commits={count} msg={msg!r} dirty={len(dirty)} fp={diff_fingerprint(root) if dirty else '-'}")
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d not in (".git", "__pycache__", "node_modules", ".agents")]
        for fn in fns:
            p = os.path.join(dp, fn)
            try:
                for i, line in enumerate(open(p), 1):
                    if LEAK.search(line) or LEAK.search(fn):
                        print(f"   LEAK? {os.path.relpath(p, os.path.dirname(root))}:{i}: {line.strip()[:100]}")
            except UnicodeDecodeError:
                pass
