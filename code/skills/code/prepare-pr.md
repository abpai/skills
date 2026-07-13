# Prepare PR

Finish working-tree changes for a pull request: scope the full PR diff (committed
and uncommitted), run finish-lane QA and cleanup, apply quality gates, validate,
draft reviewer-facing PR text, commit the intended scope, seal, then push/update
the PR — gated so remote review only happens on green.

This is the single self-contained PR-prep workflow. The deterministic core is
`scripts/finish-lane.ts`; everything else (findings, fixes, QA narrative, PR
text, commit discipline) is judgment this module owns.

## Effort contract

Parse `--effort low|medium|high` anywhere in the arguments. Default to
`medium`; reject any other value with one concise correction. Effort changes
review depth, not the terminal state: every level commits the intended scope,
seals, pushes, and creates or updates the PR.

| Effort | Required depth |
| --- | --- |
| `low` | Deterministic preflight, focused diff review, applicable risk-required gates, targeted source-grounded QA, validation, PR text, commit, seal, push. |
| `medium` | Everything in low, plus suggested quick-pass lenses and one independent full-scope review for behavior-affecting changes. |
| `high` | Everything in medium, plus a scoped `simplify.md` pass over the PR, deep passes for applicable lenses, broader live QA, and a second independent perspective when the first review leaves meaningful uncertainty. |

Risk is a floor. Auth, billing, migrations, destructive operations, public APIs,
new runtime surfaces, and other high-blast-radius changes still receive the gates
their evidence demands at `low`. Effort may add ambition; it may not waive a
safety or correctness obligation.

## Two bright-line rules (read before any phase)

**BRIGHT LINE 1 — Gate before push.** Effort-selected and risk-required quality
gates, source-grounded QA, and any required independent review run and the branch is **sealed** _before_ `git push`,
`gh pr create`, or `gh pr edit --body`. Push/PR-create is the terminal,
gated-on-green action — never an early "share it then polish" step. Pushing first
turns every finding into a post-hoc follow-up commit a reviewer already saw. An
always-on plugin hook (`gate-before-push.sh`) enforces this while prepare-pr is
**armed**: it blocks push/PR-create/PR-body-edit unless a fresh seal sentinel
exists for the current branch. **This enforcing hook exists only under Claude
Code** — Codex has no hook system, so there the arm/seal/disarm steps still run
but nothing auto-blocks the push. Under Codex, gate-before-push is a discipline
you self-enforce, with `--seal`'s refuse-on-red (Phase 5) as the deterministic
green check before you push.

**BRIGHT LINE 2 — Source-grounded verification.** Write the expected behavior
into the verification log _before_ each action, grounded in source, docs, route,
command, or contract. A pass written after the fact is a probe, not proof.
"Working tree clean" does **not** mean "nothing to finish" — PR scope is
`<base>...HEAD` unioned with uncommitted + staged + untracked. A green suite
whose fixtures encode the code's own assumption proves nothing: at a parse/trust
boundary, confirm fixtures match a sanitized real sample, not an invented shape;
for any value crossing a boundary (HTTP header, env var, API field, cache key),
find the consumer and confirm it accepts that shape.

**Ambition check.** Do not force every gate on every diff. Trivial docs-only or
metadata-only changes skip inapplicable gates with a one-line rationale. You may
override a script recommendation with a concrete reason or add a gate the
changed surface demands. Record the selected effort and any risk-driven
escalation above it.

**Autonomous finish contract.** `prepare-pr` is allowed and expected to stage
the intended scope, create coherent commits, push the branch, and create or
update the PR without stopping for routine approval. Ask the user only when the
commit scope is ambiguous, includes unrelated/user-owned work, contains
secret-looking or generated files that cannot be safely excluded, requires a
destructive operation, or changes public/production state outside git. The
default terminal state is a remote branch ready for human review, not a local
plan waiting for permission.

`.workflow/` is throwaway, per-repo, gitignored. The scope file and seal sentinel
live there and never travel into a commit.

## Phase 1 — Scope & Arm

Run the slim deterministic preflight (writes `changed-files.txt`, prints one
stdout summary):

```bash
# inside the skills checkout itself
bun code/skills/code/scripts/finish-lane.ts --fix --arm
# installed via project-local skills (e.g. Codex's .agents/skills)
bun .agents/skills/code/scripts/finish-lane.ts --fix --arm
# loaded as a Claude Code plugin
bun "${CLAUDE_PLUGIN_ROOT}/skills/code/scripts/finish-lane.ts" --fix --arm
```

Pick the path that exists — `${CLAUDE_PLUGIN_ROOT}` is set only under the Claude
Code plugin runtime, so under Codex or a bare checkout use one of the first two.
Remember which path resolved; Phase 5 reuses it for `--seal`/`--disarm`. Pass `--base <ref>` when the auto-detected base is
wrong (PR onto a non-default branch). The script scopes to the union of
`<base>...HEAD` + uncommitted + staged + untracked and auto-detects `<base>`, so
a committed-but-unpushed branch with a clean working tree has real work to do —
never skip on "clean." Do not hand-roll this from a `git diff <base>...HEAD`
loop; the script owns base detection, scope union, mechanical scans, and the
suggested-lens list.

The single `FINISH_LANE` stdout block reports: base + branch + scope counts,
the `changed-files.txt` path, fix-command and validation/test results
(ok/fail/skip), mechanical-scan counts (slop, placeholder), structured UBS
status/severity/actionable-source summary, and a flat suggested-lens list. Read
it as the shared state for the rest of the workflow.

**Arm the gate.** The `--arm` flag writes the arm marker
`${CLAUDE_PLUGIN_DATA}/prepare-pr/armed/<repo-id>.armed` (the script computes
`<repo-id>` exactly as the hook does, so do not hand-build the path). The
always-on hook now blocks push/PR-create/PR-body-edit for this repo until the
branch is sealed (Phase 5); it is disarmed only in Phase 5 after a successful
push. The look-for `ARMED <path>` line in the summary confirms it. **If you
abandon the lane after arming** (user cancels, task changes), run `--disarm`
before stopping — the marker is per-repo and persistent, so a stale arm keeps
blocking pushes in future sessions until something disarms it. (Under Codex
or a bare checkout there is no `CLAUDE_PLUGIN_DATA` and no enforcing hook, so
`--arm` is a no-op and the gate stays inert — expected. Seal still works as your
green check; you self-enforce gate-before-push there.)

**Enumerate untracked files.** Flag anything large, data-shaped, or
secret-looking (dumps, exports, `.env`, tokens) as commit-excluded by default.

## Phase 2 — Stabilize & gate-select

From the script's flat suggested-lens list and `changed-files.txt`, decide gates
(anti-railroad): accept the suggestion, override with a concrete reason, or add a
gate the defaults missed. For each selected gate, load **only** that
`review-patterns/<lens>.md` (progressive disclosure — never read all lenses up
front), run its quick pass, escalate to the deep pass only when diff risk
justifies it, and record evidence or a skip rationale in context.

- At `low`, load only lenses required by concrete risk. A focused diff review is
  still mandatory.
- At `medium`, run the quick pass for applicable suggested lenses; use a deep
  pass only when the quick evidence escalates.
- At `high`, load `simplify.md` and explicitly invoke **scoped execution** over
  the changed-file set from `<base>...HEAD` plus uncommitted scope (not the
  repository-root proposal mode), applying worthwhile behavior-preserving fixes
  before QA. Run deep passes for every applicable lens whose stop rules allow it.

**New-surface check.** If the diff adds a surface the project did not have before
— first web UI, public CLI, API route, database migration, auth/billing
boundary, or background job — add a local gate and capture evidence for it.

**Semantic-shortcut check.** During the mandatory focused diff review, at every
effort level, inspect added or changed code at trust, parsing, security, and
externally-supplied-or-persisted data boundaries for semantic shortcuts —
fallback chains, regex-based classification, bespoke protocol/auth/security
implementations, and boundary type assertions. When one is present, load
`review-patterns/semantic-shortcuts.md` and run it.

The finish lane scans added lines for these shapes and reports
`semantic-shortcut hits: N`, suggesting the lens when `N > 0`. A hit is a lead,
not a verdict. **Zero hits is weak evidence**, not a clean bill: the scan is tuned
to under-trigger on the lens's false positives, so your own read of the diff
overrides it in both directions. A contract divergence the lens surfaces is an
unresolved correctness finding — do not seal until it is fixed, explicitly
accepted for this PR, or removed from it.

## Phase 3 — Source-grounded QA & verification

Write named tests grounded in source/docs/route/contract **before** acting.
Record the expected behavior before each action, then mark it `passed`, `failed`,
or `untested`. For each check name: surface (UI route / CLI command / API
endpoint / worker path / migration / docs), inputs (URL, command, fixture,
token, payload, browser state), expected result (exact output, status, header,
persisted state, absence of regression), tooling, and evidence.

Prefer real user-path testing for UI. Browser JS, direct DB writes, request
mocking, or forced client state are useful diagnostics but are lower-level probes
— label them as such, never present them as user-path proof.

If a live QA path is blocked, isolate the smallest diagnostic that distinguishes
client/server/network/auth/fixture/sandbox failure, then report: what was
attempted, where it blocked, whether that blocker is a code defect, the closest
proof you ran instead, and the exact residual manual QA for the human. Do not
invent a code fix for an environment limitation.

Run validation (lint / test / typecheck / build) via the commands the script
reported. State any skips and why. Keep the parse/trust-boundary and
cross-boundary-consumer checks here — they catch what a green suite hides.

At `low`, keep QA targeted to the changed behavior and its most important
failure path. At `medium`, cover the representative user path plus relevant
boundaries. At `high`, broaden to alternate paths and live integrations that are
safe and practical. Never execute destructive, costly, or production-facing QA
without the authority required for that action.

## Phase 4 — Independent review & PR text

At `medium` and `high`, for correctness-sensitive or behavior-affecting diffs,
run an **independent**
review of the current diff — a reviewer with no memory of why you wrote the code,
because self-review reliably misses regressions your own fix just introduced. Use
the path that fits the harness:

The review must cover the **full PR scope** (`<base>...HEAD` plus uncommitted) —
by Phase 4 the work is often already committed on a clean tree, so a review of
only uncommitted changes sees an empty diff and passes vacuously.

- **Under Claude Code:** spawn a fresh no-context sub-agent (the Task tool) under
  a read-only sandbox to read the full scope diff, or run `codex review` against
  the detected base (e.g. `codex review --base <base>`) if the Codex CLI is
  installed — not `codex review --uncommitted`, which misses committed scope.
- **Under Codex:** run the review in a *separate* read-only `codex exec` session
  over the full scope diff — a fresh context, not your active one. Do **not**
  recursively `codex review` your own running session.

At `low`, skip independent review unless the change's risk requires it; record
the reason. At `high`, add a second independent perspective only when the first
review leaves meaningful structural, correctness, or boundary uncertainty.

Fold findings into `Review Findings` and triage them — do **not** auto-apply.

Draft or rewrite PR text from the actual diff + evidence: what now happens that
did not before, why it matters, how it works (only as much as a reviewer needs),
exact validation commands + live QA evidence, and residual manual QA or known
risk. Draft and compare the text against the current diff here, but **apply it to
a live PR with `gh pr edit --body-file` only in Phase 5, after the seal** — under
Claude Code the gate blocks PR-body edits until the branch is sealed; under Codex
that ordering is self-enforced. (Optional: a self-contained
HTML explainer for complex diffs — opt-in, not mandatory.)

## Phase 5 — Commit, seal, push & disarm

Build atomic commits that revert independently. For each: type
(`feat`/`fix`/`refactor`/`test`/`docs`/`chore`) + summary, exact files to stage,
why the grouping is coherent, and the final message (imperative mood, subject
<= 50 chars, body only when it explains _why_, wrapped near 72 chars).

The commit plan is an execution checklist, not an approval checkpoint. Proceed
without asking when the scope is unambiguous:

1. Stage only planned paths **by name** — never `git add -A` or `git add .`.
2. Create the commit; confirm with hash + summary. Repeat per commit.
3. Re-run any targeted validation that is invalidated by the committed changes.

Pause and ask before staging only if a planned path is ambiguous, unrelated to
the PR, user-owned local work, secret-like, or unsafe to decide automatically.
If excluded untracked files remain and the seal would treat them as in-scope,
resolve that explicitly (move, ignore, or ask) before sealing; do not push a PR
whose local scope cannot be represented by the committed branch.

**Seal** only after gates + QA + independent review pass and after all intended
commits have been created (reuse the finish-lane.ts path that resolved in
Phase 1 — `${CLAUDE_PLUGIN_ROOT}/...` under the Claude plugin, or
`.agents/skills/...` under Codex / project-local skills):

```bash
# Claude Code plugin runtime:
bun "${CLAUDE_PLUGIN_ROOT}/skills/code/scripts/finish-lane.ts" --seal
# Codex / project-local skills:
bun .agents/skills/code/scripts/finish-lane.ts --seal
# inside the skills checkout itself:
bun code/skills/code/scripts/finish-lane.ts --seal
```

This writes the per-branch sentinel
`.workflow/finish-lane/seal/<branch-slug>.sealed` stamped with the current HEAD
sha + scope hash + timestamp. Under Claude Code the hook treats it as fresh only
if HEAD and the scope hash still match — any new commit, staged change, unstaged
edit, or new untracked file invalidates the seal and re-blocks push; under Codex
the sentinel is your own freshness check, since no hook consumes it. `--seal` **refuses to
write the sentinel (exit 2) if any discovered validation command is failing**, so
the mechanical gate can never be sealed red — fix the failure and re-seal. (No
validation command discovered is not a failure; for a docs-only diff your skip
rationale is the gate.) `--seal` does **not** disarm.

Push / open or update the PR once the seal is fresh. Then **disarm immediately**
so the gate goes inert again (same finish-lane.ts path as above; under Codex this
is a harmless no-op — there was no armed hook to clear):

```bash
# Claude Code plugin runtime:
bun "${CLAUDE_PLUGIN_ROOT}/skills/code/scripts/finish-lane.ts" --disarm
# Codex / project-local skills:
bun .agents/skills/code/scripts/finish-lane.ts --disarm
# inside the skills checkout itself:
bun code/skills/code/scripts/finish-lane.ts --disarm
```

If any commit or file change happens after sealing, the seal is stale — re-seal
before push. If push or PR editing fails after a successful seal, report the
exact blocker and leave the branch locally review-ready.

## Output Format

1. `Review Findings` by severity (`Critical`, `Important`, `Suggestion`).
2. `Applied Fixes` (file-level summary).
3. `Quality Gates` (passes run, evidence, skip rationales).
4. `QA Plan` (surface, inputs, expected per check).
5. `Verification Timeline` (expected-before-action assertions, pass/fail/untested,
   evidence).
6. `QA Results` (what ran, evidence, blockers, residual human QA).
7. `Validation Results` (commands run and outcomes).
8. `Independent Review` (findings or skip rationale).
9. `Reusable Setup` (new deterministic setup scripts/skills to create, or "none").
10. `Commit Plan` (numbered commits with files + message).
11. `Execution Results` (commit hashes, push/PR URL, disarm status, blockers).

## Decision Rules

- Prefer correctness over style; project conventions over personal preference.
- Surface trade-offs when multiple valid approaches exist; escalate risky or
  architecture-affecting changes explicitly.
- Treat a failed check as evidence, not an automatic code defect: classify it as
  current-change bug, pre-existing issue, or environment blocker.
- When review or QA surfaces a bug outside this change's scope, propose it as a
  separate commit or stacked PR rather than bundling it in.
