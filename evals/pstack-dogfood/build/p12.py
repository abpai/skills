import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from mk import fixture_root, write_tree, commit

root = fixture_root("p12-notes-sync")
f = {}
f[".gitignore"] = "__pycache__/\n"
f["README.md"] = r'''
# jot

Plain-text notes kept as Markdown files in `~/.jot/notes/`, synced through a
shared folder (Dropbox/iCloud/Syncthing) at `~/.jot/remote/`.

```sh
python -m jot new "groceries"
python -m jot edit groceries        # opens $EDITOR
python -m jot list
python -m jot sync                  # copies changes both ways
python -m unittest
```

Most people run `jot sync` from cron or a launchd agent every 10 minutes; the
companion phone app runs the same sync logic in the background. Some people
also run it by hand before closing their laptop.
'''
f["jot/__init__.py"] = ""
f["jot/__main__.py"] = r'''
import sys

from .cli import main

sys.exit(main(sys.argv[1:]))
'''
f["jot/paths.py"] = r'''
import os

HOME = os.environ.get("JOT_HOME", os.path.expanduser("~/.jot"))


def notes_dir():
    return os.path.join(HOME, "notes")


def remote_dir():
    return os.path.join(HOME, "remote")


def note_path(directory, name):
    return os.path.join(directory, f"{name}.md")
'''
f["jot/sync.py"] = r'''
import os
import shutil
from dataclasses import dataclass, field


@dataclass
class SyncReport:
    pushed: list = field(default_factory=list)
    pulled: list = field(default_factory=list)
    unchanged: list = field(default_factory=list)


def _notes(directory):
    if not os.path.isdir(directory):
        return {}
    return {
        name[:-3]: os.path.join(directory, name)
        for name in os.listdir(directory)
        if name.endswith(".md")
    }


def _same(a, b):
    with open(a, "rb") as fa, open(b, "rb") as fb:
        return fa.read() == fb.read()


def sync(local_dir, remote_dir):
    """Make both directories hold the newest version of every note."""
    os.makedirs(local_dir, exist_ok=True)
    os.makedirs(remote_dir, exist_ok=True)
    local, remote = _notes(local_dir), _notes(remote_dir)
    report = SyncReport()
    for name in sorted(set(local) | set(remote)):
        here, there = local.get(name), remote.get(name)
        if here and not there:
            shutil.copy2(here, os.path.join(remote_dir, f"{name}.md"))
            report.pushed.append(name)
        elif there and not here:
            shutil.copy2(there, os.path.join(local_dir, f"{name}.md"))
            report.pulled.append(name)
        elif _same(here, there):
            report.unchanged.append(name)
        elif os.path.getmtime(here) >= os.path.getmtime(there):
            shutil.copy2(here, there)
            report.pushed.append(name)
        else:
            shutil.copy2(there, here)
            report.pulled.append(name)
    return report
'''
f["jot/cli.py"] = r'''
import os
import subprocess
import sys

from . import paths
from .sync import sync


def cmd_new(args):
    name = args[0]
    os.makedirs(paths.notes_dir(), exist_ok=True)
    path = paths.note_path(paths.notes_dir(), name)
    if os.path.exists(path):
        print(f"jot: {name} already exists", file=sys.stderr)
        return 1
    with open(path, "w") as fh:
        fh.write(f"# {name}\n\n")
    print(path)
    return 0


def cmd_edit(args):
    path = paths.note_path(paths.notes_dir(), args[0])
    if not os.path.exists(path):
        print(f"jot: no note named {args[0]}", file=sys.stderr)
        return 1
    return subprocess.call([os.environ.get("EDITOR", "vi"), path])


def cmd_list(args):
    directory = paths.notes_dir()
    for name in sorted(os.listdir(directory)) if os.path.isdir(directory) else []:
        if name.endswith(".md"):
            print(name[:-3])
    return 0


def cmd_sync(args):
    report = sync(paths.notes_dir(), paths.remote_dir())
    print(f"pushed {len(report.pushed)}, pulled {len(report.pulled)}, unchanged {len(report.unchanged)}")
    return 0


COMMANDS = {"new": cmd_new, "edit": cmd_edit, "list": cmd_list, "sync": cmd_sync}


def main(argv):
    if not argv or argv[0] not in COMMANDS:
        print("usage: jot {new NAME|edit NAME|list|sync}", file=sys.stderr)
        return 2
    return COMMANDS[argv[0]](argv[1:])
'''
f["tests/__init__.py"] = ""
f["tests/test_sync.py"] = r'''
import os
import tempfile
import time
import unittest

from jot.sync import sync


def write(path, text, mtime=None):
    with open(path, "w") as fh:
        fh.write(text)
    if mtime is not None:
        os.utime(path, (mtime, mtime))


def read(path):
    with open(path) as fh:
        return fh.read()


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.local = os.path.join(self.tmp.name, "notes")
        self.remote = os.path.join(self.tmp.name, "remote")
        os.makedirs(self.local)
        os.makedirs(self.remote)

    def tearDown(self):
        self.tmp.cleanup()

    def test_new_notes_copy_both_ways(self):
        write(os.path.join(self.local, "a.md"), "A")
        write(os.path.join(self.remote, "b.md"), "B")
        report = sync(self.local, self.remote)
        self.assertEqual((report.pushed, report.pulled), (["a"], ["b"]))
        self.assertEqual(read(os.path.join(self.remote, "a.md")), "A")
        self.assertEqual(read(os.path.join(self.local, "b.md")), "B")

    def test_newer_edit_wins(self):
        now = time.time()
        write(os.path.join(self.local, "n.md"), "old", mtime=now - 60)
        write(os.path.join(self.remote, "n.md"), "new", mtime=now)
        report = sync(self.local, self.remote)
        self.assertEqual(report.pulled, ["n"])
        self.assertEqual(read(os.path.join(self.local, "n.md")), "new")

    def test_identical_notes_are_unchanged(self):
        write(os.path.join(self.local, "n.md"), "same")
        write(os.path.join(self.remote, "n.md"), "same")
        self.assertEqual(sync(self.local, self.remote).unchanged, ["n"])
'''
write_tree(root, f)
commit(root)
