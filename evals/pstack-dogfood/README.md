# pstack dogfood harness

Thirteen scenarios that run `pstack plan`, `verify` and `auto` against small
fixture repos, on Claude subagents and on Codex, with fixed grading criteria
for each. Use it to dogfood any pstack change the same way earlier rounds did.
Results are summarized in `docs/pstack-dogfood.md`.

**Executing agents must never read this directory.** `grading/` holds the
expected answers and the a06 hidden tests, `scenarios.json` names the target
principles, and the builders show where each fault is. Only the person running
the round and the reviewers read it. Keep fixtures and run copies outside the
repo, and do not tell an executing agent where this directory is.

## Layout

- `scenarios.json`: one entry per scenario with `id`, `mode`, `invocation`,
  `user_context`, `fixture` (directory name in the build output), `grading`
  (path relative to this directory), target and irrelevant principles, and
  the handoff case it covers. `r13-unsupported-review` reuses the v05 fixture.
- `build_fixtures.py`: builds all 12 fixtures. `build/<id>.py` builds one,
  and `build/mk.py` holds the helpers they share.
- `build/audit.py`: prints the commit count, dirty files, diff fingerprint
  and any words that would hint at the answer, for a fixture or a run copy.
- `grading/README.md`: the rules every scenario shares. `grading/<id>.md`:
  criteria for one scenario. `grading/a06-job-durations/`: hidden acceptance
  tests, `run-hidden.sh`, and the reference solution that proves they pass.
- `run_codex_round.py`: the Codex runner.

Needs `python3`, `git`, `bun` (TypeScript fixtures), `jq` (p08) and, for
Codex rounds, the `codex` CLI. v07's `make test` needs a private Postgres
image on purpose: the check cannot run (handoff case g).

## Build fixtures

```sh
python3 evals/pstack-dogfood/build_fixtures.py <out-dir>   # default: a fresh temp dir
```

Each fixture is a git repo with one commit (`main`, "Initial import", author
Dev). The verify fixtures (v03, v04, v05, v07, v09) also carry the uncommitted
change under review, and the build prints each one's fingerprint. It must
equal the fingerprint in `grading/<id>.md`. When a grading file says
`fixtures/<id>`, read it as `<out-dir>/<id>`. Treat `<out-dir>` as pristine:
copy from it, never run in it.

## Run a round

Snapshot the skill first (`git rev-parse --short HEAD`) and give each round
its own directory outside the repo. Every run gets a fresh copy of its
fixture.

**Claude subagents.** For each scenario, start one fresh subagent:

1. `cp -R <out-dir>/<fixture> <round>/<id>-claude`
2. Give it the scenario's `invocation` and `user_context`, the run copy as its
   working directory, and the path of this repo's `pstack/skills/pstack/SKILL.md`.
   Tell it to read SKILL.md and follow it, reading mode and principle files
   from that skill directory, and to stay out of the repo's `evals/`, `docs/`
   and other runs.
3. Have it write its final answer to `<round>/<id>-claude.final.md` and a
   process log to `<round>/<id>-claude.process.md`: the files it read, the
   commands it ran with their results, and anything else it changed.

Give it nothing from `grading/` or `scenarios.json` beyond those two fields.

**Codex.**

```sh
python3 evals/pstack-dogfood/run_codex_round.py <round-dir> \
  [--fixtures <out-dir>] [--model gpt-6.1-sol] [--worktree <repo>] [--only <id> ...]
```

All scenarios run in parallel. Each run copies its fixture to
`<round>/<id>-codex`, copies `pstack/skills/pstack` from the worktree into
`.agents/skills/pstack` as a real directory (Codex ignored symlinked skill
dirs), and adds `.agents/` to `.git/info/exclude`. It then runs
`codex exec --json -m <model> -c 'service_tier="fast"' --sandbox workspace-write`
with the prompt `$pstack <mode> <task>` plus the user context, with stdin from
`/dev/null` and a 30-minute timeout. Each run writes `<id>-codex/` (end state)
plus `.prompt.txt`, `.jsonl`, `.stderr`, `.exit`, `.final.md` (last agent
message) and `.commands.txt`. The round also gets `summary.json` (exit code,
mode files read, command count) and `codex.done`. Without `--fixtures` it
builds fresh fixtures into `<round>/.fixtures`. The worktree defaults to this
repo.

## Review

Give each run its own fresh reviewer subagent, never the one that executed it.
The reviewer reads `grading/README.md` and `grading/<id>.md`, the run's
`.final.md`, its `.process.md` (Claude) or `.jsonl` and `.commands.txt`
(Codex), and the run copy. Read-only checks can run on the run copy; anything
that runs the code (tests, builds, probes) goes in a separate copy.

- Verify runs: `python3 evals/pstack-dogfood/build/audit.py <run-copy>`. The
  fingerprint must still match the grading file.
- Plan runs: `git status --short` in the run copy is empty. Ignored caches
  are fine, and Codex runs exclude `.agents/`.
- a06: `evals/pstack-dogfood/grading/a06-job-durations/run-hidden.sh <run-copy>`
  (it copies the run copy before adding the hidden tests).

It writes `<round>/<run>.review.json`, for example:

```json
{
  "scenario": "p01-tenant-reports",
  "host": "claude",
  "snapshot": "09fa61c8",
  "pass": true,
  "skill_loaded": true,
  "mode_file_read": true,
  "principles_selected": ["attack-the-premise", "fix-root-causes"],
  "criteria": [{ "id": 1, "criterion": "...", "result": "PASS", "evidence": "..." }],
  "frictions": ["observation | evidence | suspected skill cause"],
  "summary": "..."
}
```

`grading/README.md` says a plan that lists more than five principles is a
FAIL. That rule predates pstack 0.4.4, which removed the numeric principle
cap. The criteria are left as written, but reviewers now treat the count as a
heuristic: more than five is a prompt to look for padding, not an automatic
FAIL. Two or more padding principles is still a FAIL.

## Record results

`docs/pstack-dogfood.md` stays short: add a row to its rounds table, replace
the latest-round section, and update the current state. Put the full round
(skill snapshot, hosts and model, one row per run with result, skill loaded,
mode file read, principles, evidence and suspected cause, then what improved
and what still fails) in the pull request that carries the change. Round
outputs stay outside the repo, so quote the evidence there.
