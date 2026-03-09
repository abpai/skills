---
description: Generate a visual HTML review — diff review or plan review depending on the input
---
Load the visual-explainer skill, then generate a comprehensive visual review as a self-contained HTML page.

Follow the visual-explainer skill workflow. Read the reference template, CSS patterns, and mermaid theming references before generating. Pick a font pairing from the libraries.md rotation. Vary the tint color.

**Input detection** — determine the review type from `$1`:
- **File path** (ends in `.md`, `.txt`, or contains `/`): treat as **plan review** — compare the plan against the codebase
- **Git ref** (branch name, commit hash, `HEAD`, PR number like `#42`, or range like `abc..def`): treat as **diff review**
- **No argument**: default to **diff review** against `main`

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
3. **Module architecture** — Mermaid dependency graph with zoom controls
4. **Major feature comparisons** — side-by-side before/after panels. Apply `min-width: 0` and `overflow-wrap: break-word`.
5. **Flow diagrams** — Mermaid for new lifecycle/pipeline/interaction patterns
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
3. **Current architecture** — Mermaid diagram of affected subsystem today. Zoom controls.
4. **Planned architecture** — Mermaid diagram after implementation. Same node names/layout as current. Highlight new/removed/changed elements.
5. **Change-by-change breakdown** — for each planned change, show a left/right/rationale/discrepancy card structure. Left panel: what the plan says happens. Right panel: what the code actually looks like today. Rationale row: why this change exists (extract from plan or flag "rationale missing" in amber). Discrepancy row: flag where the plan says *what* but not *why*, or where the plan's description of current behavior doesn't match the actual code. Use red left-border for discrepancies, green for confirmed-accurate descriptions.
6. **Dependency & ripple analysis** — callers, importers, downstream effects. Color-code coverage: green (covered by the plan), amber (likely affected but not mentioned in plan), red (definitely missed — imports/calls the changed code but plan doesn't address). Collapsible.
7. **Risk assessment** — edge cases, assumptions, ordering risks, rollback complexity. Include a **cognitive complexity** subsection as a distinct category from bug risk: non-obvious coupling (A changes behavior of B without explicit dependency), action-at-distance (config in file X changes runtime behavior in file Y), implicit ordering (steps that must happen in sequence but the plan doesn't specify order), memory-only contracts (invariants maintained by convention, not enforced by code). Each gets a mitigation suggestion card.
8. **Plan review** — Good/Bad/Ugly/Questions analysis
9. **Understanding gaps dashboard** — closing summary. Show a rationale coverage bar (% of changes that have explicit rationale vs "rationale missing"). Roll up cognitive complexity flags into a count. List explicit pre-implementation recommendations: things to verify, questions to answer, or spikes to run before starting.

---

## Shared Instructions

**Verification checkpoint** — before generating HTML, produce a structured fact sheet of every claim you will present. Every quantitative figure, every name, every behavior description — cite the source. Verify each against the code. Mark unverifiable claims as uncertain.

**Visual hierarchy**: Sections 1-3 dominate the viewport (hero depth, larger type). Sections 6+ are reference material (flat/recessed, compact, collapsible).

**Prose quality** — prose in generated pages must avoid AI writing patterns. Be specific: cite file:line, name actual functions, use concrete numbers. Don't inflate significance ("this critical change") — describe what it does. Executive summaries should lead with the concrete insight, not a throat-clearing flourish. Forbidden vocabulary in generated HTML: delve, crucial, pivotal, landscape (abstract), tapestry, testament, intricate, interplay, leverage, utilize, facilitate, showcase, underscore, foster, Additionally. Replace with plain equivalents.

**Optional illustrations** — if `surf` CLI is available (`which surf`), consider generating a hero banner. Embed as base64.

Include responsive section navigation. Write to `~/.agent/diagrams/` and open in browser.

Ultrathink.

$@
