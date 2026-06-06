# Prepare PR

Finish working-tree changes for a pull request: scope the full PR diff (committed
and uncommitted), run finish-lane QA and cleanup, apply quality gates, validate,
draft reviewer-facing PR text, seal, then build optional commits — gated so push
and PR creation only happen on green.

This is the single self-contained PR-prep workflow. The deterministic core is
`scripts/finish-lane.ts`; everything else (findings, fixes, QA narrative, PR
text, commit discipline) is judgment this module owns.

## Two bright-line rules (read before any phase)

**BRIGHT LINE 1 — Gate before push.** Quality gates, source-grounded QA, and
independent review run and the branch is **sealed** _before_ `git push`,
`gh pr create`, or `gh pr edit --body`. Push/PR-create is the terminal,
gated-on-green action — never an early "share it then polish" step. Pushing first
turns every finding into a post-hoc follow-up commit a reviewer already saw. An
always-on plugin hook (`gate-before-push.sh`) enforces this while prepare-pr is
**armed**: it blocks push/PR-create/PR-body-edit unless a fresh seal sentinel
exists for the current branch.

**BRIGHT LINE 2 — Source-grounded verification.** Write the expected behavior
into the verification log _before_ each action, grounded in source, docs, route,
command, or contract. A pass written after the fact is a probe, not proof.
"Working tree clean" does **not** mean "nothing to finish" — PR scope is
`<base>...HEAD` unioned with uncommitted + staged + untracked. A green suite
whose fixtures encode the code's own assumption proves nothing: at a parse/trust
boundary, confirm fixtures match a sanitized real sample, not an invented shape;
for any value crossing a boundary (HTTP header, env var, API field, cache key),
find the consumer and confirm it accepts that shape.

**Light ambition check.** Do not force every gate on every diff. Trivial
docs-only or metadata-only changes skip the heavy lane with a one-line rationale.
You may override any script recommendation with a concrete reason, or add a
one-off local gate for a new surface. The goal is explicit applicability and
visible skip rationale, not ceremony.

`.workflow/` is throwaway, per-repo, gitignored. The scope file and seal sentinel
live there and never travel into a commit.

## Phase 1 — Scope & Arm

Run the slim deterministic preflight (writes `changed-files.txt`, prints one
stdout summary):

```bash
# inside the skills checkout itself
bun code/skills/code/scripts/finish-lane.ts --fix --arm
# installed via project-local skills
bun .agents/skills/code/scripts/finish-lane.ts --fix --arm
# loaded as a Claude Code plugin
bun "${CLAUDE_PLUGIN_ROOT}/skills/code/scripts/finish-lane.ts" --fix --arm
```

Pick the path that exists. Pass `--base <ref>` when the auto-detected base is
wrong (PR onto a non-default branch). The script scopes to the union of
`<base>...HEAD` + uncommitted + staged + untracked and auto-detects `<base>`, so
a committed-but-unpushed branch with a clean working tree has real work to do —
never skip on "clean." Do not hand-roll this from a `git diff <base>...HEAD`
loop; the script owns base detection, scope union, mechanical scans, and the
suggested-lens list.

The single `FINISH_LANE` stdout block reports: base + branch + scope counts,
the `changed-files.txt` path, fix-command and validation/test results
(ok/fail/skip), mechanical-scan counts (slop, placeholder, `ubs`), and a flat
suggested-lens list. Read it as the shared state for the rest of the workflow.

**Arm the gate.** The `--arm` flag writes the arm marker
`${CLAUDE_PLUGIN_DATA}/prepare-pr/armed/<repo-id>.armed` (the script computes
`<repo-id>` exactly as the hook does, so do not hand-build the path). The
always-on hook now blocks push/PR-create/PR-body-edit for this repo until the
branch is sealed (Phase 4); it is disarmed only in Phase 5 after a successful
push. The look-for `ARMED <path>` line in the summary confirms it. (Outside the
installed plugin runtime there is no `CLAUDE_PLUGIN_DATA`; arming is a no-op and
the gate stays inert — expected in a bare checkout.)

**Enumerate untracked files.** Flag anything large, data-shaped, or
secret-looking (dumps, exports, `.env`, tokens) as commit-excluded by default.

## Phase 2 — Stabilize & gate-select

From the script's flat suggested-lens list and `changed-files.txt`, decide gates
(anti-railroad): accept the suggestion, override with a concrete reason, or add a
gate the defaults missed. For each selected gate, load **only** that
`review-patterns/<lens>.md` (progressive disclosure — never read all lenses up
front), run its quick pass, escalate to the deep pass only when diff risk
justifies it, and record evidence or a skip rationale in context.

**New-surface check.** If the diff adds a surface the project did not have before
— first web UI, public CLI, API route, database migration, auth/billing
boundary, or background job — add a local gate and capture evidence for it.

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

## Phase 4 — Independent review & PR text, then SEAL

For correctness-sensitive or behavior-affecting diffs, run an independent review:
`codex review --uncommitted`, or a fresh no-context sub-agent under a read-only
sandbox, reads the current diff. Self-review reliably misses regressions your own
fix just introduced. Fold findings into `Review Findings` and triage them — do
**not** auto-apply. Skip with a rationale only for trivial docs/metadata diffs.

Draft or rewrite PR text from the actual diff + evidence: what now happens that
did not before, why it matters, how it works (only as much as a reviewer needs),
exact validation commands + live QA evidence, and residual manual QA or known
risk. For a live PR, use `gh pr edit --body-file` only after comparing the draft
against the current diff. (Optional: a self-contained HTML explainer for complex
diffs — opt-in, not mandatory.)

**Seal** only after gates + QA + independent review pass:

```bash
bun "${CLAUDE_PLUGIN_ROOT}/skills/code/scripts/finish-lane.ts" --seal
```

This writes the per-branch sentinel
`.workflow/finish-lane/seal/<branch-slug>.sealed` stamped with the current HEAD
sha + scope hash + timestamp. The hook treats it as fresh only if HEAD and the
scope hash still match — any new commit, staged change, unstaged edit, or new
untracked file invalidates the seal and re-blocks push. `--seal` **refuses to
write the sentinel (exit 2) if any discovered validation command is failing**, so
the mechanical gate can never be sealed red — fix the failure and re-seal. (No
validation command discovered is not a failure; for a docs-only diff your skip
rationale is the gate.) `--seal` does **not** disarm; disarm is the explicit
Phase 5 step after push.

## Phase 5 — Commit plan, approval, push & disarm

Build atomic commits that revert independently. For each: type
(`feat`/`fix`/`refactor`/`test`/`docs`/`chore`) + summary, exact files to stage,
why the grouping is coherent, and the final message (imperative mood, subject
<= 50 chars, body only when it explains _why_, wrapped near 72 chars).

Present the full plan and **get approval before any `git add` / `git commit`**.
If the user asks for changes, revise and re-present. Then:

1. Stage only planned paths **by name** — never `git add -A` or `git add .`.
2. Create the commit; confirm with hash + summary. Repeat per commit.
3. Push / open the PR — now allowed because the seal is fresh.
4. **Disarm immediately** so the gate goes inert again:

   ```bash
   bun "${CLAUDE_PLUGIN_ROOT}/skills/code/scripts/finish-lane.ts" --disarm
   ```

If you commit after sealing, the seal is stale — re-seal (Phase 4) before push.

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
11. `Execution Results` after approval.

## Decision Rules

- Prefer correctness over style; project conventions over personal preference.
- Surface trade-offs when multiple valid approaches exist; escalate risky or
  architecture-affecting changes explicitly.
- Treat a failed check as evidence, not an automatic code defect: classify it as
  current-change bug, pre-existing issue, or environment blocker.
- When review or QA surfaces a bug outside this change's scope, propose it as a
  separate commit or stacked PR rather than bundling it in.

## Update Check

On first use in a session, silently check for a newer version:

1. Fetch `https://raw.githubusercontent.com/abpai/skills/main/versions.json`.
2. Compare the version for `code` against `code/skills/code/SKILL.md`
   `metadata.version`.
3. If the remote version is newer, pause before the main task and ask:
   > **code** update available (local {X.Y} → remote {A.B}).
   > Would you like me to update it for you first?
   > I can run `npx skills update code` for you.
4. If yes, run the update before continuing. If no, continue with the local
   version. If the fetch fails or web access is unavailable, skip silently.
