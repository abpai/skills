# Harness Baseline

Build a behavior baseline for an existing production repo: inventory what it
appears to do, compare that to existing proof, have a human ratify the
high-value behavior map, then add characterization tests/snapshots for
confirmed behavior so later agents change code against a runnable safety net.

Use this workflow to baseline a legacy repo, capture existing functionality at
repo scale, prepare a production repo for agents, create a behavior inventory,
or characterize current behavior before autonomous work begins. `capture.md`
is the primitive for one named behavior; this module orchestrates many
captures.

## Stage routing

Parse the first remaining argument after `baseline` as an optional stage:

- `status` — report current baseline state and the next action.
- `scout` — run Gate 0 and the read-only scout, producing or refreshing the working surface map.
- `inventory` — produce `docs/BEHAVIOR_INVENTORY.md`; `--refresh` preserves stable IDs and human statuses where possible.
- `capture` — capture ratified rows into tests/snapshots and update `docs/BEHAVIOR_LEDGER.md`.
- no stage — auto-detect state from disk and resume at the next unfinished phase:
  1. No inventory → Gate 0, scout, inventory, then stop for human ratification.
  2. Inventory with no `confirmed`/`corrected` rows → print ratification instructions and stop.
  3. Confirmed/corrected P0/P1 rows lacking terminal ledger outcomes → run capture.
  4. Ledger complete for confirmed/corrected P0/P1 → run `status` and recommend `harness doctor`.

Chat memory is never a phase boundary — the durable contract is the files on disk.

## Durable artifacts

- `docs/BEHAVIOR_INVENTORY.md` — human-ratified behavior map (`./templates/BEHAVIOR_INVENTORY.md`).
- `docs/BEHAVIOR_LEDGER.md` — machine-maintained proof ledger (`./templates/BEHAVIOR_LEDGER.md`).

If a template is unavailable, recreate its strict table headers by hand and
report that it could not be read. Ephemeral scout notes, grep dumps, coverage
reports, and temporary plans stay outside the repo or in task-local scratch
space — only durable facts belong in the inventory and ledger.

## Gate 0: toolchain check

Before spending tokens on inventory, verify the repo can run its local tooling
well enough to support characterization:

1. Record `git rev-parse HEAD` and `git status --short --branch`.
2. Discover install/build/test commands from package scripts, Make/just
   targets, CI, README, and `docs/engineering/commands.md`.
3. Inspect command bodies one hop deep before running, per `doctor.md`'s
   execution policy; never run deploys, migrations, live-service, or
   paid/API-touching commands without explicit user approval.
4. Run the cheapest safe install/build/test commands needed to classify the
   repo.

Outcomes:

- `toolchain-ready-green` — commands run and pass; continue.
- `tests-runnable-red` — the runner works but existing tests are red; continue
  with caveats — capture must run targeted new tests against unchanged code,
  and `doctor` later reports the full lane red.
- `no-test-harness` — no runner or executable validation command exists; stop
  unless the user explicitly approves bootstrapping minimal test tooling.
- `toolchain-broken` — install/build/test cannot execute locally; stop with a
  repair list.
- `env-blocked` — missing local services, credentials, Docker, or similar;
  continue only for rows capturable hermetically, else record
  `gap: needs-human-env`.

Gate 0 is complete when the outcome, commands inspected/run, exit evidence, and
runtime are recorded and, if proceeding, summarized in short prose above the
inventory table (not a table — the scanner finds the behavior table by header,
and prose stays easier to review).

## Phase 1: scout

Run a read-only orientation pass. Inventory evidence, not opinions: package
scripts, Make/just targets, CI jobs, and existing validation commands; test
suites, e2e suites, snapshots, fixtures, mocks, coverage reports; routes,
controllers, public APIs, package exports, CLI commands; UI pages and core
user flows; jobs, queues, cron tasks, migrations, schemas, persisted shapes;
auth, permissions, billing, money movement, external integrations, webhooks;
README/docs claims that point to code.

Use concrete `file:line` evidence. The scout pass is complete when you can
draft behavior rows with entry points and proof/gap evidence — it is not a
docs overhaul and should not create broad architecture prose.

## Phase 2: inventory

Create or refresh `docs/BEHAVIOR_INVENTORY.md`. Rows use stable IDs (`B-001`,
`B-002`, ...). Required columns:

`ID | Area | Behavior | Entry points | Existing proof | Missing proof | Confidence | Risk | Status | Priority | Notes`

Rules:

- Behavior is user-visible or externally observable: "subscription downgrade
  preserves access until period end", not "calls helper X".
- Entry points include at least one concrete `file:line`.
- Existing proof names specific test files/cases or commands; if you cannot
  connect a test to the behavior, it belongs in Missing proof.
- Confidence: `high` (route/entry point, handler/core logic, and effect all
  located), `medium` (two of those signals, or strong naming/structure), `low`
  (mostly docs, comments, or weak naming).
- Risk follows blast radius: auth, permissions, billing, money, persistence,
  public API, migrations, jobs, and external integrations skew high.
- Default ratifiable cap is about 30 rows, ranked by risk × centrality. Leave
  the long tail `proposed` at `P2` rather than asking the human to ratify
  hundreds of rows; `deferred` is a human decision the agent never assigns.
- Pre-mark high-confidence, high-evidence rows `proposed`, not `confirmed` —
  the human owns confirmation.

Refresh mode (`inventory --refresh`) preserves stable IDs and human decisions
where the entry point still matches, adds new IDs for new behavior, and marks
rows `stale` when their entry point is gone with no replacement found. Never
rewrite a human's `confirmed`/`corrected`/`skip`/`deferred` choice without
recording why in Notes.

Inventory is complete when the file parses, IDs are unique, statuses use the
allowed enum, each ratifiable row has evidence, and the workflow stops with a
short instruction telling the human to edit statuses/priorities.

## Phase 3: human ratification

The human edits `docs/BEHAVIOR_INVENTORY.md`: `confirmed` (capture the row),
`corrected` (row edited to match reality — capture it), `skip` (do not
capture), `deferred` (real, but outside this baseline pass), `stale` (no
longer current).

Use priorities `P0`/`P1`/`P2`. Default capture scope is confirmed/corrected
P0/P1; P2 rows wait unless the user asks for them. Do not ask the human to
approve every test — the ratified inventory plus final PR review are the
human gates.

## Phase 4: capture loop

For each confirmed/corrected P0/P1 row lacking a terminal ledger status,
invoke `capture.md` in row mode, after loading and following
`./references/characterization-rules.md`.

Inputs to row mode: behavior ID and row text, entry points, existing proof,
missing proof, confidence/risk/priority, and repo test conventions discovered
in Gate 0/scout.

Guardrails:

- Capture what the code does today, bugs included.
- Touch only tests, fixtures, snapshots, mocks, test configuration, and the
  inventory/ledger docs unless the user explicitly authorizes source repair.
- Use existing test style and the cheapest level that pins the observable
  behavior.
- Run each new proof against unchanged code, two or three times when
  practical; flaky proof is a `gap`, not a commit.
- One row failure does not abort the whole loop — record `failed` or `gap`
  and continue.
- Rows needing live credentials, production data, paid APIs, or irreversible
  actions become `gap: needs-human-env` unless the user explicitly provides a
  safe local harness.

Capture is complete when every in-scope row has a terminal ledger status:
`captured`, `bug-pinned`, `gap`, `failed`, or `stale`.

## Phase 5: ledger and handoff

Update `docs/BEHAVIOR_LEDGER.md`. Rows use the inventory ID. Required columns:

`ID | Status | Capture type | Test paths | Run command | Run evidence | Confidence | Remaining gap`

Ledger rules:

- `captured` rows name real test/snapshot paths and the command that passed.
- `bug-pinned` rows name proof plus the suspected bug note.
- `gap` rows explain the blocker (`needs-human-env`, `nondeterministic`,
  `no-stable-boundary`, `no-test-harness`).
- `failed` rows explain what was tried and why it was abandoned.
- Run evidence includes the current commit SHA (or working-tree snapshot) and
  the number of successful runs, e.g. `3/3 green at <sha>`.

After ledger update, run or recommend `harness doctor`.

Baseline is complete when confirmed/corrected P0/P1 rows have terminal ledger
outcomes, the new proof commands were run and recorded, the diff touches only
allowed surfaces, and `doctor` has checked the inventory/ledger structure when
the scanner supports it.

## `baseline status`

Report a compact state summary:

```text
Gate 0: <outcome>
Inventory: <total> rows; <confirmed> confirmed; <corrected> corrected; <pending> pending; <deferred> deferred; <high-risk> high-risk
Ledger: <captured> captured; <bug-pinned> bug-pinned; <gap> gaps; <failed> failed; <stale> stale
High-risk gaps: <n>
Last verified: <sha or unknown>
Next action: <edit inventory | run harness baseline capture | run harness doctor>
```

`pending` counts `proposed` rows awaiting human ratification. The counts
mirror the `BaselineReport` contract in `./INTERFACES.md`:

- Gate 0 comes from the prose summary above the inventory table; `unknown`
  when no summary exists.
- Last verified is the most recent SHA in the ledger's Run evidence column;
  `unknown` when none is recorded.
- High-risk gaps counts confirmed/corrected high-risk P0/P1 rows whose ledger
  status is `gap`, `failed`, or `stale`, or that have no ledger row — the
  D2/D4 scope in `doctor.md`; the doctor verdict cap is its P0 subset.

If artifacts are malformed, report the parse issue and point to the required
headers instead of continuing.

## Self-review and CI affordances

Baseline itself is an agent workflow, not a CI job — deterministic checks
belong in `harness-doctor`:

```bash
npx @andypai/harness-doctor@latest --json --verbose
```

No released scanner validates inventory or ledger integrity yet (the CLI
accepts unknown flags/config fields silently, so a clean exit proves nothing —
see `doctor.md`'s Fast path note). Until it ships, this module's own artifact
parse is the only source of baseline health.

For persistent local and CI enforcement, load `doctor.md` and follow its
**Pinned scanner and CI setup** — it owns package-manager detection, config
formats, the package script, and CI boundaries; do not duplicate the recipe
here.

For an agent's final self-review, route to `doctor.md` with diff scope
(`harness doctor diff`): map changed files to behavior IDs, list impacted
ledger rows, require the relevant ledger commands to run, and flag production
code changes with no affected behavior proof or explicit gap.

## Output

Lead with the next action. Then report:

- Gate 0 outcome and commands inspected/run.
- Inventory rows created/refreshed and how many need human ratification.
- Capture rows attempted and terminal ledger outcomes.
- Files created/changed.
- Commands run with pass/fail/runtime.
- Gaps that require human environment, product intent, or test infrastructure.
