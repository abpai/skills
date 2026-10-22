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
