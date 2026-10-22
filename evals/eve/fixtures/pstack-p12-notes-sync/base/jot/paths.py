import os

HOME = os.environ.get("JOT_HOME", os.path.expanduser("~/.jot"))


def notes_dir():
    return os.path.join(HOME, "notes")


def remote_dir():
    return os.path.join(HOME, "remote")


def note_path(directory, name):
    return os.path.join(directory, f"{name}.md")
