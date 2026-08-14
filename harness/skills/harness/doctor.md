# Harness Doctor

Audit whether a repository gives an agent enough reliable context and proof to
change it safely. Report evidence, not a maturity score.

Use full scope for adoption and periodic audits. Use `doctor diff [base]` for
self-review of the current change.

## 1. Bind the candidate

Record:

- repository identity and requested base;
- `git rev-parse HEAD`;
- `git status --short --branch`;
- a diff hash when the tree is dirty.

Proof belongs to this candidate. If the candidate changes after a command ran,
mark that command's evidence stale and rerun it before claiming completion.

## 2. Run deterministic inspection

The external `harness-doctor` CLI is the implementation of structural checks.
Do not re-create its rules in prose or with an improvised checklist.

Prefer the repository-pinned binary:

```bash
./node_modules/.bin/harness-doctor --json --verbose
```

Use the project's equivalent pinned command when one is documented. If no
pinned binary exists, ask before running the network-backed fallback:

```bash
npx @andypai/harness-doctor@latest --json --verbose
```

For dead-code inspection, load `./references/scanner-setup.md`. Configure Knip
in the repository and rerun the scanner; do not maintain a second ignore list
inside Harness. Dead-code coverage is required when the repository declares it
in its canonical check or adoption policy. Otherwise run it as an additional
safe diagnostic and report its status without inventing a universal gate.

Scanner output is evidence, not the final judgment. Inspect the surrounding
code before promoting a lead to a finding. Record dismissed leads and why.
Process success or an `ok` field proves only that the scan completed; it does
not erase emitted errors or warnings. Interpret each diagnostic and the
repository's configured failure threshold separately.

For monorepos, honor the repository's declared workspace roots. Group repeated
root-document findings by their shared cause, and exclude generated, vendored,
cache, or state directories only through repository-owned scanner
configuration.

## Scanner unavailable

Add an `unknown` stating exactly which deterministic coverage did not run and
how to restore it. Do not infer a clean docs structure, dead-code state, or
proof-menu parse from manual inspection. Continue with semantic review and safe
commands, clearly separating them from missing scanner coverage.

## 3. Inspect the repository contract

Check only the surfaces the repository actually uses:

| Condition | Evidence |
| --- | --- |
| Behavior is understood | Ratified inventory joined to existing or captured proof, or an equivalent repo-owned map |
| Agents can navigate | Small agent entry point routes to current architecture, commands, testing, and project-specific gotchas |
| Proof is selectable | `docs/SPEC_CONTRACT.md` or equivalent maps change types to real commands and required artifacts |
| Fast and full loops exist | Canonical bootstrap, focused feedback, full validation, and any live/human proof are documented and runnable |
| Rules are enforced | Important invariants live in tests, lint, scripts, runtime checks, or CI rather than duplicated prose |
| Execution is reproducible | Tool versions, lockfiles, install behavior, and CI use the same intended dependency graph |
| Agent scope is safe | Secrets are brokered or mocked, writes are bounded, and production or irreversible actions require an explicit human gate |
| Parallel work is safe | Fresh worktrees do not collide through mutable fixtures, ports, databases, or shared state |

Absence is not always a defect. Record an `unknown` when evidence could not be
obtained. Record a `blocker` when the missing or unsafe condition prevents the
requested mode of work. An intentional human merge gate is a fact, not a
readiness defect.

## Safety blockers

Exposed secrets readable by the agent or ambient credentials that can mutate
production/shared data are always blockers for unattended execution, even when
every validation command passes.

## 4. Validate proof supply and demand

Parse the proof menu using `./INTERFACES.md`:

- Every command ID resolves to a repository-owned script, target, recipe, or
  CI job.
- Each important change type has sufficient automated or human-gated proof.
- Each spec acceptance criterion selects an available proof.
- Proof artifacts say what must be retained, not merely which command starts.

If behavior inventory and ledger files exist, require stable joined IDs,
terminal outcomes for ratified high-priority rows, real proof paths, and
candidate-bound run evidence. A production change with no affected behavior or
proof mapping is a gap.

## 5. Execute safely

Inspect a command and its immediate script body before running it.

Run without asking when the command is local, bounded, reversible, and does not
need secrets, paid APIs, deployment, migrations, or shared/production writes.
Ask before commands with those effects. Never silently replace an unavailable
service with a weaker proof.

Record the exact command, exit result, runtime, candidate, and artifact. Label
documented but unexecuted commands `unverified` with the reason.

Full scope runs the canonical safe validation lane. Diff scope runs every proof
selected by the changed paths plus the repository's required common checks.

## Diff scope

For `doctor diff [base]`:

1. Resolve the base and list changed files.
2. Map files to proof-menu change types and behavior inventory IDs.
3. Run or account for the selected proof commands.
4. Flag changed production behavior with no matching proof or explicit gap.
5. Check whether agent routes, commands, architecture, or baseline artifacts
   became stale.

## Output

Lead with one of:

- **Ready for the requested work** — no relevant blockers or unknowns remain.
- **Supervision required** — work may proceed, but named human gates or
  unresolved evidence remain.
- **Blocked** — a named condition makes the requested work unsafe or
  unprovable.

Then emit the `HarnessReadinessResult` from `./INTERFACES.md`, followed by a
short human report:

```text
Recommendation: <ready | supervision required | blocked> — <reason>
Candidate: <revision and working-tree state>
Observed facts: <evidence-backed list>
Unknowns: <missing evidence and next action>
Blockers: <unsafe/unmet condition and next action>
Proof run: <command, result, runtime, candidate, artifact>
Not run: <command and reason>
```

Doctor is complete when every statement is traceable to inspected files or an
executed command, every missing fact is explicit, and no evidence from an older
candidate is presented as current.
