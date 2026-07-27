# Finish-lane arm/seal lifecycle

Mechanics behind `prepare-pr.md`'s Phase 1 arm and Phase 5 seal/disarm calls.
The workflow only needs the actionable summary in those phases; read this when
you need the underlying detail.

## Locating the script

Try these in order and use whichever path exists. Remember it — every later
`--seal`/`--disarm` call in the same run reuses that same path.

- In-checkout: `code/skills/code/scripts/finish-lane.ts`
- Project-local install (Codex `.agents/skills`, etc.):
  `.agents/skills/code/scripts/finish-lane.ts`
- Claude Code plugin runtime:
  `"${CLAUDE_PLUGIN_ROOT}/skills/code/scripts/finish-lane.ts"` —
  `CLAUDE_PLUGIN_ROOT` is set only under that runtime.

## Arm marker

`--arm` writes `${CLAUDE_PLUGIN_DATA}/prepare-pr/armed/<repo-id>.armed`. The
script computes `<repo-id>` exactly as `gate-before-push.sh` does — never
hand-build this path. The marker is per-repo and persists across sessions
until `--seal` (fresh) or `--disarm` clears it, so an abandoned armed lane
blocks pushes in a later, unrelated session. `CLAUDE_PLUGIN_DATA` is absent
under Codex or a bare checkout, so `--arm` there is a no-op and the gate stays
inert — expected; `--seal`'s refuse-on-red is your green check instead.

## Seal sentinel

`--seal` writes `.workflow/finish-lane/seal/<branch-slug>.sealed`, stamped
with the current HEAD sha + scope hash + timestamp. Under Claude Code the hook
treats it as fresh only if HEAD and the scope hash still match the sentinel —
any new commit, staged change, unstaged edit, or new untracked file
invalidates it and re-blocks push. Under Codex no hook consumes the sentinel;
it is your own freshness check. `--seal` refuses to write it (exit 2) if any
discovered validation command is failing, so the gate can never be sealed red.
`--seal` does not disarm.

## Disarm

`--disarm` clears the arm marker so the hook goes inert again. Under Codex
this is a harmless no-op since there was no armed hook to clear.
