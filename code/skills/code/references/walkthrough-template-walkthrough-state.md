# Walkthrough state template

Written to `docs/walkthrough-state.md` after each advance. Enables a fresh Claude to pick up where the last one left off after auto-compaction or session end.

Minimal — no transcript. Just enough to skip pre-seed and resume at the right stop.

## Structure

```markdown
# Walkthrough state

> Last updated: {ISO date}
> Session: {optional — session name or ID}
> Scope: {one sentence on what's being walked — e.g. "dispatch lifecycle in apps/dispatch"}

## Segmentation

The agreed stops:

1. **{Stop 1 name}** — {one-line scope} — ✅ complete
2. **{Stop 2 name}** — {one-line scope} — ✅ complete
3. **{Stop 3 name}** — {one-line scope} — 🟡 in progress
4. **{Stop 4 name}** — {one-line scope} — ⏸ not started

## Current stop: {N. Stop name}

**Grounded in:** {file paths read so far for this stop}
**Open probes:** {what the user asked that hasn't been fully answered}
**Last end-of-turn comprehension bullets:**
- {bullet 1}
- {bullet 2}

## Open reframes (surfaced, not yet explored)

- **{Reframe 1 title}** — {one-line description} — surfaced in stop {N}, user said "defer"
- **{Reframe 2 title}** — {one-line description} — surfaced in stop {N}, awaiting decision

## Artifacts produced

- `docs/todos/{file1}.md` — {what's in it}
- `docs/todos/{file2}.md` — {what's in it}

## Known-in-flight work (mid-refactor flags from pre-seed)

- {area} — {branch or PR reference}, mark stops involving this as "aspirational vs. actual"

## Resume instructions

To resume:
1. Read this file.
2. Read the artifacts listed above (context for current mental model).
3. Skip pre-seed. Start at the **Current stop** and emit the end-of-turn block.
4. Do NOT re-segment unless the user asks — the split above is already agreed.
```

## Rules

- **Update after every advance**, not just at session end. The point is crash-safety mid-session too.
- **No transcript.** If you find yourself copying Claude's prose, you're doing it wrong.
- **Artifacts listed must match what's actually on disk.** If a capture was proposed but never written, don't list it.
- **Resume ≠ cold start.** A resuming Claude should NOT pre-seed. Pre-seed is expensive; skip it when this file exists.
- **Stale-state handling:** if this file is >7 days old, a resuming Claude should check `git log` for intervening changes and flag anything that invalidates the current mental model before continuing.
