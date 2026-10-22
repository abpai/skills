"""Run every pstack dogfood scenario once on Codex, in parallel, and summarize.

usage: python3 run_codex_round.py <round-dir> [--fixtures DIR] [--worktree DIR]
                                  [--model MODEL] [--scenarios FILE] [--only ID ...]

  --fixtures   pristine fixtures from build_fixtures.py (default: build fresh
               into <round-dir>/.fixtures)
  --worktree   repo whose pstack/skills/pstack is under test (default: this repo)
  --model      default gpt-6.1-sol
  --scenarios  default scenarios.json next to this script

Each run gets a fresh copy of <fixtures>/<fixture> and a real (not symlinked)
copy of the skill under .agents/skills/pstack. Writes, per run:
<id>-codex/ (end state), .prompt.txt, .jsonl, .stderr, .exit, .final.md,
.commands.txt; then summary.json and codex.done in the round dir.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODE_FILE = re.compile(r"pstack/(plan|verify|auto)\.md\b")

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("round", type=Path)
ap.add_argument("--fixtures", type=Path)
ap.add_argument("--worktree", type=Path, default=HERE.parents[1])
ap.add_argument("--model", default="gpt-6.1-sol")
ap.add_argument("--scenarios", type=Path, default=HERE / "scenarios.json")
ap.add_argument("--only", nargs="+", metavar="ID", help="run only these scenario ids")
opts = ap.parse_args()

ROUND = opts.round.resolve()
WT = opts.worktree.resolve()
MODEL = opts.model
SCENARIOS = json.loads(opts.scenarios.read_text())
if opts.only:
    SCENARIOS = [s for s in SCENARIOS if s["id"] in opts.only]
    missing = set(opts.only) - {s["id"] for s in SCENARIOS}
    if missing:
        sys.exit(f"unknown scenario ids: {sorted(missing)}")
FIXTURES = (opts.fixtures or ROUND / ".fixtures").resolve()


def run(s):
    sid = s["id"]
    d = ROUND / f"{sid}-codex"
    if d.exists():
        return sid, "exists"
    shutil.copytree(FIXTURES / s["fixture"], d, symlinks=True)
    shutil.copytree(WT / "pstack" / "skills" / "pstack", d / ".agents" / "skills" / "pstack")
    (d / ".git" / "info").mkdir(parents=True, exist_ok=True)
    with open(d / ".git" / "info" / "exclude", "a") as f:
        f.write("\n.agents/\n")
    args = re.sub(r"^pstack\s*", "", s["invocation"])
    prompt = f"$pstack {args}".rstrip() + "\n\n" + s["user_context"]
    Path(f"{d}.prompt.txt").write_text(prompt)
    with open(f"{d}.jsonl", "w") as out, open(f"{d}.stderr", "w") as err:
        try:
            p = subprocess.run(
                ["codex", "exec", "--json", "-m", MODEL, "-c", 'service_tier="fast"',
                 "-C", str(d), "--sandbox", "workspace-write", prompt],
                stdin=subprocess.DEVNULL, stdout=out, stderr=err, timeout=1800,
            )
            code = p.returncode
        except subprocess.TimeoutExpired:
            code = "timeout"
    Path(f"{d}.exit").write_text(f"{code}\n")
    return sid, code


def summarize(s):
    sid = s["id"]
    d = ROUND / f"{sid}-codex"
    msgs, cmds = [], []
    for line in Path(f"{d}.jsonl").read_text().splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        it = e.get("item") or {}
        if e.get("type") != "item.completed":
            continue
        if it.get("type") == "agent_message":
            msgs.append(it.get("text", ""))
        elif it.get("type") == "command_execution":
            cmds.append(it.get("command", ""))
    Path(f"{d}.final.md").write_text(msgs[-1] if msgs else "")
    Path(f"{d}.commands.txt").write_text("\n---\n".join(cmds))
    read = sorted({m.group(1) for c in cmds for m in MODE_FILE.finditer(c)})
    expected = None if sid.startswith("r13") else s["mode"]
    return {
        "id": sid,
        "mode": expected,
        "exit": Path(f"{d}.exit").read_text().strip(),
        "mode_files_read": read,
        "read_own_mode_file": (expected in read) if expected else (not read),
        "commands": len(cmds),
        "final_chars": len(msgs[-1]) if msgs else 0,
    }


ROUND.mkdir(parents=True, exist_ok=True)
if not FIXTURES.exists():
    subprocess.run([sys.executable, "-B", str(HERE / "build_fixtures.py"), str(FIXTURES)], check=True)
with ThreadPoolExecutor(max_workers=len(SCENARIOS)) as pool:
    for sid, code in pool.map(run, SCENARIOS):
        print(sid, code, flush=True)
summary = [summarize(s) for s in SCENARIOS]
(ROUND / "summary.json").write_text(json.dumps(summary, indent=1))
(ROUND / "codex.done").write_text("done\n")
print(json.dumps(summary, indent=1))
