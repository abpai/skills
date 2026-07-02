# Implementation candidate support — improvement plan

Goal: make `codex-exec` a first-class **implementation candidate** worker for
orchestrated dual-candidate loops (e.g. Fable orchestrates, Codex + Opus each
implement independently, parent compares diffs and synthesizes).

Today the skill is optimized for review and read-only analysis. Implementation
works via raw `codex exec --sandbox workspace-write`, but the parent agent must
reinvent prompt contracts, artifact capture, and comparison hygiene every time.

## Gap analysis

| Need | Today | Gap |
| --- | --- | --- |
| Write sandbox by default for implementation | `read-only` default | Parent must remember `workspace-write` |
| Structured candidate report | Ad hoc prose in `final.md` | No stable schema or required fields |
| Proof over summaries | Parent reads git diff manually | No run-dir diff/status artifacts |
| Isolated candidate workspace | Documented in orchestration prompt only | No skill guidance for disposable branches/worktrees |
| Dual-candidate independence | Not mentioned | Parent must enforce isolation |
| Comparison handoff | Parent-owned | No checklist for orchestrator synthesis |

## Phased delivery

### Phase 1 — This PR (v1.6.0)

Ship the minimum contract an orchestrator can rely on:

1. **`generate` wrapper mode** in `codex-run.sh`
   - Defaults: `workspace-write`, `reasoning=high`
   - Uses the bundled candidate report schema unless callers pass a custom one
   - Composes an implementation prompt wrapper (assumptions OK, no clarifying questions)
   - Captures baseline/post-run artifacts: `workspace-baseline.txt`,
     `workspace-status.txt`, `workspace.diff`, `workspace-diff.stat`,
     `changed-files.txt`
2. **`generate.md` workflow module** — parallel to Composer's generate path
3. **`candidate-report.schema.json`** — default structured final output
4. **SKILL.md + README** — routing, dual-candidate orchestration notes, artifact list

### Phase 2 — Worktree helper (v1.7.0, shipped)

`scripts/codex-workspace.sh` is live:

- `prepare --name candidate-a [--base REF]` → branch + optional worktree from a
  frozen base SHA; writes the path to `--run-dir-file`
- `finalize --name candidate-a [--run-dir DIR]` → bundles `candidate.diff`
  (vs the frozen base, untracked included), `candidate-diff.stat`,
  `changed-files.txt`, and Codex's `report.md` for parent comparison
- `cleanup --name candidate-a [--force] [--keep-branch]` → removes the disposable
  worktree, branch, bundle, and state when the parent rejects a candidate

Candidates are tracked by `--name` in a per-repo state file, so orchestration
prompts never pass raw git paths around. The helper never calls Codex or commits.
Documented in `generate.md` ("Workspace helper").

### Phase 3 — Dual-candidate orchestration kit (future)

Optional reference prompt + checklist for parent agents:

- Same task brief to Codex (`generate`) and Opus (Task subagent)
- Independence rule enforcement
- Comparison rubric template (correctness, simplicity, architecture fit, tests)
- Synthesis steps (pick best ideas, do not blindly merge either candidate)

Could live in `references/dual-candidate-orchestration.md` once Phase 1 is stable
in production.

### Phase 4 — Hardening (future)

- Integration test fixture for `generate` dry-run + artifact capture
- `--validation-cmd` hook to run a gate after Codex edits and store `validation.log`
- `--base-ref` for diff capture against milestone branch instead of working tree only
- Marketplace/docs index update for the new mode in quick reference

## Success criteria

An orchestrator using only `codex-exec` should be able to:

1. Preflight Codex CLI and target workspace
2. Launch an isolated implementation candidate with one documented command
3. Monitor the run and collect diff + report artifacts without custom shell
4. Compare Codex candidate against a peer candidate using actual diffs, not summaries
5. Hand synthesis, validation, commit, and PR ownership back to the parent agent

## Non-goals

- Replacing the parent orchestrator (Fable/Opus) for synthesis, commit, or PR merge
- Managing Opus subagent lifecycle — that stays in the parent harness
- Auto-merging dual candidates — parent always owns integration
