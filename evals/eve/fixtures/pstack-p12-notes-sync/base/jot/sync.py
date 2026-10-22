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
