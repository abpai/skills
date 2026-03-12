---
description: Generate a visual HTML review — diff review, plan review, or project recap depending on the input
---
Load the visual-explainer skill, then generate a comprehensive visual review as a self-contained HTML page.

Follow the visual-explainer skill workflow. Read the reference template, CSS patterns, and mermaid theming references before generating. Pick a font pairing from the libraries.md rotation. Vary the tint color.

This is a report-style page, so the output must include at least two distinct visual forms:
- one structural visual near the top of the page
- one evidence visual near the top half of the page

Do not ship a prose-dominant review.

**Input detection** — determine the review type from `$1`:
- **Git ref** (branch name, commit hash, `HEAD`, PR number like `#42`, or range like `abc..def`): treat as **diff review**
- **File path** (ends in `.md`, `.txt`, or contains `/`): treat as **plan review** — compare the plan against the codebase
- **Time window** (`2w`, `30d`, `3m`): treat as **project recap**
- **No argument**: default to **project recap** with `2w` window

---

## Shared Instructions

**Verification checkpoint** — before generating HTML, produce a structured fact sheet of every claim you will present. Every quantitative figure, every name, every behavior description — cite the source. Verify each against the code. Mark unverifiable claims as uncertain.

**Visual hierarchy**: Early sections dominate the viewport (hero depth, larger type). Later reference sections are flat/recessed, compact, collapsible.

**Visual minimum**: A valid review must contain a structural diagram/timeline/architecture view and a KPI/table/comparison-style evidence visual. If the content does not naturally yield a diagram, use a timeline plus comparison panels rather than falling back to prose.

**Prose quality** — prose in generated pages must avoid AI writing patterns. Be specific: cite file:line, name actual functions, use concrete numbers. Don't inflate significance — describe what it does. Forbidden vocabulary in generated HTML: delve, crucial, pivotal, landscape (abstract), tapestry, testament, intricate, interplay, leverage, utilize, facilitate, showcase, underscore, foster, Additionally.

**Optional illustrations** — if `surf` CLI is available (`which surf`), consider generating a hero banner. Embed as base64.

Include responsive section navigation. Write to `~/.agent/diagrams/` and open in browser.

Ultrathink.

---

## Diff Review

**Scope detection** — determine what to diff:
- Branch name (e.g. `main`, `develop`): working tree vs that branch
- Commit hash: that specific commit's diff (`git show <hash>`)
- `HEAD`: uncommitted changes only (`git diff` and `git diff --staged`)
- PR number (e.g. `#42`): `gh pr diff 42`
- Range (e.g. `abc123..def456`): diff between two commits
- No argument: default to `main`

**Data gathering:**
- `git diff --stat <ref>` and `git diff --name-status <ref>` for file-level overview
- Line counts: compare key files between `<ref>` and working tree
- New public API surface: grep for exported symbols, public functions, classes, interfaces
- Read all changed files in full — include surrounding code paths needed to validate behavior
- Check whether `CHANGELOG.md` and `README.md` need updates
- Reconstruct decision rationale from conversation history, progress docs, commit messages

**Diagram structure:**
1. **Executive summary** — lead with the *intuition*: why do these changes exist? What was the core insight? Then factual scope. *Hero depth: larger type, accent-tinted background.*
2. **KPI dashboard** — lines added/removed, files changed, new modules, test counts, housekeeping indicators
3. **Module architecture** — Mermaid dependency graph with zoom controls. This is the required structural visual anchor unless a flow diagram is even more central.
4. **Major feature comparisons** — side-by-side before/after panels. Apply `min-width: 0` and `overflow-wrap: break-word`.
5. **Flow diagrams** — Mermaid for new lifecycle/pipeline/interaction patterns. Include this whenever the change introduces or alters a runtime path, hook chain, request path, or build pipeline.
6. **File map** — tree with color-coded new/modified/deleted indicators. Collapsible for large pages.
7. **Test coverage** — before/after test file counts
8. **Code review** — Good/Bad/Ugly/Questions with green/red/amber/blue left-border cards
9. **Decision log** — cards with decision, rationale, alternatives, confidence (high=green, medium=blue, low=amber border)
10. **Re-entry context** — key invariants, non-obvious coupling, gotchas, follow-up work. Collapsible.

---

## Plan Review

**Inputs:** Plan file path (`$1`), optional codebase path (`$2`, defaults to cwd).

**Data gathering:**
- Read the plan file in full — extract problem statement, proposed changes, rejected alternatives, scope boundaries
- Read every file the plan references, plus files that import/depend on them
- Map the blast radius: importers, tests, configs, public API surface
- Cross-reference: does the file/function/type the plan references actually exist? Does the plan's description of current behavior match reality?

**Diagram structure:**
1. **Plan summary** — problem solved, core insight, scope. *Hero depth.*
2. **Impact dashboard** — files to modify/create/delete, estimated lines. Include completeness indicators as colored badges: test coverage (green if tests updated, red if not), doc updates (green if done, yellow if partial, red if missing), migration/rollback (green if addressed, grey if not applicable). Show as a KPI row.
3. **Current architecture** — Mermaid diagram of affected subsystem today. Zoom controls. This is required.
4. **Planned architecture** — Mermaid diagram after implementation. Same node names/layout as current. Highlight new/removed/changed elements. This is required unless the plan is table-only by nature.
5. **Change-by-change breakdown** — for each planned change, show a left/right/rationale/discrepancy card structure. Left panel: what the plan says happens. Right panel: what the code actually looks like today. Rationale row: why this change exists (extract from plan or flag "rationale missing" in amber). Discrepancy row: flag where the plan says *what* but not *why*, or where the plan's description of current behavior doesn't match the actual code. Use red left-border for discrepancies, green for confirmed-accurate descriptions.
6. **Dependency & ripple analysis** — callers, importers, downstream effects. Color-code coverage: green (covered by the plan), amber (likely affected but not mentioned in plan), red (definitely missed — imports/calls the changed code but plan doesn't address). Collapsible.
7. **Risk assessment** — edge cases, assumptions, ordering risks, rollback complexity. Include a **cognitive complexity** subsection: non-obvious coupling, action-at-distance, implicit ordering, memory-only contracts. Each gets a mitigation suggestion card.
8. **Plan review** — Good/Bad/Ugly/Questions analysis
9. **Understanding gaps dashboard** — closing summary. Show a rationale coverage bar (% of changes that have explicit rationale vs "rationale missing"). Roll up cognitive complexity flags into a count. List pre-implementation recommendations.

---

## Project Recap

**Time window** — determine the recency window from `$1`:
- Shorthand like `2w`, `30d`, `3m`: parse to git's `--since` format (`2w` → `"2 weeks ago"`, `30d` → `"30 days ago"`, `3m` → `"3 months ago"`)
- No argument: default to `2w` (2 weeks)

**Data gathering:**

1. **Project identity.** Read `README.md`, `CHANGELOG.md`, `package.json` / `Cargo.toml` / `pyproject.toml` / `go.mod` for name, description, version, dependencies. Read the top-level file structure.

2. **Recent activity.** `git log --oneline --since=<window>` for commit history. `git log --stat --since=<window>` for file-level change scope. `git shortlog -sn --since=<window>` for contributor activity. Identify which areas of the codebase were most active.

3. **Current state.** Check for uncommitted changes (`git status`). Check for stale branches (`git branch --no-merged`). Look for TODO/FIXME comments in recently changed files. Read progress docs if they exist.

4. **Decision context.** Read recent commit messages for rationale. If running in the same session as recent work, mine the conversation history. Read any plan docs, RFCs, or ADRs in the project directory.

5. **Architecture scan.** Read key source files to understand the module structure and dependencies. Focus on entry points, public API surface, and the files most frequently changed in the time window.

**Diagram structure:**
1. **Project identity** — current-state summary: what this project does, who uses it, what stage it's at. Include version, key dependencies, and the elevator pitch.
2. **Architecture snapshot** — Mermaid diagram of the system as it exists today. Focus on conceptual modules and relationships, not every file. Wrap in `.mermaid-wrap` with zoom controls. *This is the visual anchor — use hero depth.* Required.
3. **Recent activity** — human-readable narrative grouped by theme: feature work, bug fixes, refactors, infrastructure. Timeline visualization with significant changes called out.
4. **Decision log** — key design decisions from the time window. Each entry: what was decided, why, what was considered.
5. **State of things** — KPI card dashboard: working/broken/blocked/in-progress counts with color-coded trend indicators. Required as evidence visual.
6. **Mental model essentials** — key invariants, non-obvious coupling, gotchas, naming conventions.
7. **Cognitive debt hotspots** — amber-tinted cards with severity indicators. Areas where understanding is weakest: undocumented changes, untested complex modules, overlapping modifications. Each with a concrete suggestion.
8. **Next steps** — inferred from recent activity, open TODOs, project trajectory.

$@
