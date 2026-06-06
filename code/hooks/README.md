# code plugin hooks

## gate-before-push (PreToolUse / Bash)

`gate-before-push.sh` is an **always-registered but inert-by-default** push gate
that enforces BRIGHT LINE 1 of `/code:prepare-pr`: quality gates +
source-grounded QA + independent review must run, and the branch must be
**sealed**, _before_ `git push`, `gh pr create`, or `gh pr edit ... --body`.

### Arm / Seal / Disarm lifecycle

1. **Arm** — `/code:prepare-pr` Phase 1 writes the arm marker
   `${CLAUDE_PLUGIN_DATA}/prepare-pr/armed/<repo-id>.armed`
   (`<repo-id>` = `sha256(git toplevel abs path)[:16]`). The gate is active for
   that repo **only** while this marker exists. With no marker the hook is a
   complete NO-OP.

2. **Seal** — `/code:prepare-pr` Phase 4 runs `finish-lane.ts --seal` _after_
   gates/QA/review pass. It writes the per-branch sentinel
   `.workflow/finish-lane/seal/<branch-slug>.sealed` stamped with the current
   HEAD sha + `scope_hash`. The seal is **fresh** only while
   `head == git rev-parse HEAD` **and** `scope_hash == freshly recomputed scope
   hash`. Any new commit, staged change, unstaged edit, or new untracked file
   flips `scope_hash` and re-blocks push.

3. **Disarm** — `/code:prepare-pr` Phase 5 deletes the arm marker after a
   successful push / PR-create. The gate goes inert again.

### What it gates (only while armed)

Blocks (unless a fresh seal exists for the current branch): `git push`,
`gh pr create`, `gh pr edit ... --body|--body-file`. It never blocks
`git commit`, `git add`, validation, status, or any non-terminal command.

### Safety

Always-registered global hook, so every failure path falls through to **allow**
(no `jq`, not a git repo, missing markers, unparseable input). It only ever
emits a deny for the narrow armed + gated-action + unsealed case, via the JSON
`permissionDecision: "deny"` contract (exit 0).

### Sentinel / marker paths

- Arm marker: `${CLAUDE_PLUGIN_DATA}/prepare-pr/armed/<repo-id>.armed`
  (plugin-owned, per-machine, never enters git).
- Seal sentinel: `<repo>/.workflow/finish-lane/seal/<branch-slug>.sealed`
  (`.workflow/` is gitignored / ephemeral, so the seal never travels into a
  commit).
