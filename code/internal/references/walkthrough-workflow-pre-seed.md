# Pre-seed workflow

Before proposing any stops, ground yourself. A bad segmentation poisons every later stop.

## Checklist

Run these in parallel where possible:

- [ ] Read `WALKTHROUGH_NOTES.md` at repo root **first** if present — owner framing, treated as authoritative (see `code/internal/walkthrough.md` Step 0). Quote it later when stops turn on owner-stated framing.
- [ ] Read root `README.md` if present
- [ ] Read `CLAUDE.md` and any `.cursor/rules`, `AGENTS.md`, `.agents/*.md`
- [ ] Read `spec.md`, `ARCHITECTURE.md`, `DESIGN.md`, or equivalent if present
- [ ] Glob for entry points: `apps/*`, `bin/*`, `cmd/*`, `src/main.*`, `src/index.*`, `packages/*/src/index.*`
- [ ] Read `package.json` (or `Cargo.toml`, `pyproject.toml`, etc.) for workspace layout and scripts
- [ ] List the top-level directories and note which look like code vs. infrastructure vs. docs
- [ ] Check for `docs/todos/` — prior walkthroughs may have left state

## Flags to raise in the segmentation proposal

If any of these are true, surface them BEFORE proposing the split:

- **No authoritative doc** (no spec, no README, no CLAUDE.md) → branch to `references/walkthrough-workflow-no-spec.md`. First stop reconstructs the implicit spec.
- **Multiple apps / monorepo** → ask which subsystem to walk, or propose stops per-app.
- **No clear entry point** (library code, SDK) → segment by public API surface instead of lifecycle.
- **Active refactor signals** (recent commits with "refactor:", "wip:", multiple branches with divergent code in same area, TODOs concentrated in one dir) → ask "anything in-flight?" Mark stops as aspirational vs. actual.
- **Prior walkthrough state exists** at `docs/walkthrough-state.md` → read it, skip pre-seed, offer to resume.
- **Owner notes present** (`WALKTHROUGH_NOTES.md`) → call it out explicitly in the pre-seed notes block ("Owner framing in `WALKTHROUGH_NOTES.md` flags X, Y; segmentation weighted accordingly"). Don't restate the whole file — just signal that you read it and how it shaped the split.

## Ask the user explicitly before committing to a split

- "Anything in-flight I should know about before I segment?"
- "Is there a specific subsystem or lifecycle you want to walk, or should I pick?"

Only after these are answered do you propose the numbered stops.

## Citation requirement

Every proposed stop must cite at least one concrete file it covers. No stop titled "the core loop" without a file path. If you can't cite, you didn't pre-seed enough.

## Time budget

Pre-seed should take 1–3 tool calls worth of reading. If you're past 5 reads and still can't propose a split, stop and ask the user to point you at something. The workflow is NOT for reverse-engineering opaque code from scratch.
