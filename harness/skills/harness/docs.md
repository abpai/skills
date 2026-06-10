# Docs Harness

Make a repository ergonomic for agent-driven development. Verification loops are the product; docs are the routing layer that gets agents to them. Build the smallest system that lets an agent answer six questions quickly:

1. What is this part of the repo, and why does it exist?
2. Where is the code?
3. What owns this behavior?
4. What must not be broken?
5. How do I validate the change?
6. How do I prove it works end-to-end?

Everything else should be enforcement (tests, lints, CI gates, validation scripts), grounding context (below), code, PR/issue context, durable todo specs under `docs/todos`, or temporary task scaffolding. Long prose scaffolding is the canonical anti-pattern: bloated agent files measurably degrade instruction adherence, and Codex silently truncates combined `AGENTS.md` content past 32 KiB (`project_doc_max_bytes` default).

## Use when

Use this workflow when the user asks to prepare a repo for agent-driven execution, slim `AGENTS.md`, create or restructure repo docs, define what a good SPEC.md looks like for the project, convert prose guidance into enforcement, improve agent navigation, build domain maps, or prepare a repo for Harness Doctor scanning.

Do not use this workflow for per-task intake (interviewing a human to produce a SPEC.md happens outside the repo, in the intake workflow), eval registries, long-lived execution plans, committed agent scratchpads, or vendor-doc mirrors.

## Operating model

The repo serves a pipeline where humans specify intent, acceptance criteria, risk, taste, and priority, and agents own implementation, testing, e2e verification, docs maintenance, and cleanup. The repo's side of that contract:

- Specs arrive from outside; `docs/SPEC_CONTRACT.md` defines what they must contain so this repo can verify them.
- Every change type has a runnable validation path. Without a pass/fail check, the human becomes the verification loop.
- Escalation boundaries are explicit: agents stop and surface (rather than guess) on irreversible actions, scope changes, and decisions the spec reserves for humans. Everything else they execute end-to-end.
- Repeated agent failures are harness gaps. Repair the harness, do not append warnings.

State this model in a few `AGENTS.md` lines that route to `docs/SPEC_CONTRACT.md` and the validation docs. Do not write an essay about it.

## Enforcement hierarchy

When a rule must hold, put it on the highest surface that fits:

1. **Failing test** — the rule is checked on every validation run.
2. **Lint rule** — the rule is checked on every commit/CI run.
3. **CI gate** — the rule blocks merge.
4. **Validation script / clearer runtime error** — the rule fails loudly at the moment it is broken.
5. **Docs routing** — a code map or invariant line that sends the agent to the right place.
6. **Prose rule** — last resort, kept lean.

Keep enforcement runtime-agnostic: tests, lints, CI, and scripts run no matter which agent harness executes the work. Claude Code hooks are an optional extra layer for repos also developed interactively with Claude — never the only enforcement. Prose remains valid (instruction-following keeps improving) but it is the only surface with measured negative returns when it bloats, so every prose rule must survive the line gate below.

When the same failure recurs, repair the smallest durable surface by walking the same hierarchy top-down:

- Agents keep breaking the same invariant → add a test that fails when it breaks.
- Agents keep running the wrong command → fix the script name or add a lint/CI check, then correct `docs/engineering/commands.md`.
- Agents keep editing the wrong file → fix the code map line.
- Agents keep misusing a term → add a glossary entry with aliases to avoid.
- Agents keep deferring the same work → write one `docs/todos` spec.
- Only if nothing mechanical fits → one prose line, placed by the line gate.

## Rules versus grounding

Durable prose splits into two kinds, judged by different gates:

- **Rules** change what the agent should do. They climb the enforcement hierarchy first; the survivors pass the AGENTS line gate.
- **Grounding** tells the agent what a part of the repo is and how to read it: what a subtree implements, why it exists (the feature flag, AB test, or product intent behind it), what it looks like to the user, the data-model topology, and a key-files table (file → role). Grounding cannot become a test or lint — its value is orientation — so it is judged by the grounding gate instead. Every grounding line must pass all three tests:

1. **Current-state-true** — describes the code as it is now and stays true after this PR.
2. **Not derivable in minutes** — an agent reading the obvious files would not quickly reconstruct it: off-repo context (flags, AB tests, product intent), cross-layer data flow, what the result looks like on screen.
3. **Anchored** — names concrete files, types, or identifiers, so staleness is detectable and the prose doubles as a route map.

The canonical grounding vehicle is a nested `AGENTS.md` in the subtree it describes — tell the agent what it is working on, why it matters, and where to look, then get out of the way. A grounding file may be longer than the root router: depth belongs at the leaf, the root stays a tiny map, and the budget that binds is the combined byte chain, not symmetry with root.

Stale grounding is worse than none — it is a misleading route. Whoever changes the data model or key files updates the grounding file in the same PR. And grounding never smuggles rules: a "do this / never that" line inside a grounding file climbs the enforcement hierarchy like any other rule.

## Target structure

Default core — create this unless the repo has a stronger equivalent:

```text
repo/
├── AGENTS.md                     # universal router, tiny
├── CLAUDE.md                     # one-line shim: @AGENTS.md (Claude Code reads only CLAUDE.md)
└── docs/
    ├── INDEX.md                  # table of contents
    ├── SPEC_CONTRACT.md          # what a good SPEC.md looks like for this repo
    ├── ARCHITECTURE.md           # current structure map, compact
    └── engineering/
        ├── commands.md           # canonical commands, validated by running them
        └── testing.md            # change type → required validation → proof
```

Earned surfaces — create only on demonstrated need, never as default scaffolding. Demonstrated need means two or more independent observations in transcripts, PR review comments, CI history, or issue/todo history; a single observation is an anecdote that stays in the PR/issue.

| Surface | Earned when |
| --- | --- |
| `docs/GLOSSARY.md` | A term is repeatedly misused or repeatedly takes too many words. Keep an existing `UBIQUITOUS_LANGUAGE.md` or `docs/reference/glossary.md` convention; never create a duplicate. |
| `docs/todos/` (+ `INDEX.md`) | Real deferred work exists with a code route, invariant, validation, and close condition. |
| `docs/domains/<domain>/` | A domain repeatedly misroutes agents and a nested `AGENTS.md` (below) is not enough. Shape: `INDEX.md`, `code-map.md`, `invariants.md`, `test-map.md`. |
| Nested `AGENTS.md` | A subtree has materially different commands, invariants, validation, or ownership — or needs grounding: a coherent feature whose intent or topology is not readable from the code (see decision test below). Often the better vehicle than a `docs/domains/` entry. Grounding is the one need that may be met when the feature ships, without waiting for the two-observation bar. |
| `docs/design/` | The repo does agentic UI work and needs migration rules (`migration-patterns.md` first — legacy pattern → new pattern tables). |
| `docs/engineering/observability.md`, `migrations.md`, `conventions.md` | Runtime debugging routes, frequent/high-risk migrations, or current conventions not enforceable in code. |
| `docs/domains/<domain>/runbook.md` | Operational debugging flows are real and used. |

Do not add these as long-lived repo defaults: `.agent/`, `scripts/agent/`, `.cursor/rules/`, `docs/product-specs/`, `docs/exec-plans/`, `docs/references/vendor-docs/`, `feature-registry.json`. Do not create ADRs (`docs/adr/`) by default, but preserve an existing maintained ADR convention and link it from `docs/INDEX.md`.

`STRUCTURE.md` is not an equivalent default. Use an existing one as migration input: move durable structure information into `docs/ARCHITECTURE.md`, route to it from `docs/INDEX.md`, then delete it (or leave it only if the repo explicitly disables the `docs-structure/no-structure-md` rule).

Temporary task files (`TODO.md`, `TASK_PLAN.md`, migration notes) live on the task branch only. Delete before merge, or condense real deferred work into `docs/todos/<todo-slug>.md`.

## Process

### 1. Inventory guidance and validation surfaces

Read both the prose and the machinery before editing:

```bash
pwd
rg --files --hidden -g 'AGENTS.md' -g 'CLAUDE.md' -g 'README.md' -g 'docs/**' -g '.cursor/**' -g '.agent/**' -g 'STRUCTURE.md' -g 'feature-registry.json' 2>/dev/null
rg --files --hidden -g '.github/workflows/*' -g 'Makefile' -g 'justfile' -g '*.lint*' -g 'lefthook*' -g '.husky/**' 2>/dev/null
rg --files -g '**/package.json' -g 'pyproject.toml' -g 'Cargo.toml' -g 'go.mod' -g 'Gemfile' --max-depth 3 2>/dev/null
cat package.json 2>/dev/null | python3 -c "import json,sys; print('\n'.join(json.load(sys.stdin).get('scripts',{}).keys()))" 2>/dev/null || true
rg -n "Slack|Google Doc|Figma|Linear|Notion|TODO|tribal|source of truth" AGENTS.md CLAUDE.md README.md docs 2>/dev/null || true
```

`--hidden` is required — without it ripgrep skips `.github/`, `.husky/`, `.cursor/`, and `.agent/` entirely. `rg --files` also respects `.gitignore`, so if the CI/lint listing comes back empty, check those paths directly before concluding they are absent.

The validation-surface inventory (scripts, CI jobs, lint configs, test layout, e2e harnesses) feeds the spec contract in step 4. In monorepos, read per-package manifests too — root `package.json` alone hides workspace scripts. If external knowledge is referenced but unavailable, preserve the pointer and mark it missing. Do not invent product truth.

### 2. Run the Keep / Move / Delete audit

Give every durable guidance item an explicit verdict with a reason and a destination:

- **Keep** — answers one of the six questions (rules judged by the line gate, grounding by the grounding gate) or defines a genuinely useful term, and already sits on the smallest correct surface.
- **Move** — belongs on a better surface. Preference order: test/lint/CI/script (enforcement beats prose — these moves are executed in step 3), then engineering docs, design docs, domain docs, glossary, `docs/todos`, code, tests, issue/PR context.
- **Delete** — stale, duplicative, completed-task residue, or a vendor mirror without freshness policy.

A Move destination may be a planned core file from the Target structure (created in later steps). A Move targeting an earned surface that does not yet exist is itself demonstrated-need evidence — record it in the verdict's reason; if it is a single observation, the item stays in PR/issue context instead.

Record verdicts as a table (`item | verdict | reason | destination`) with concrete file paths. Vague areas ("docs", "auth code") are banned when a concrete path exists.

### 3. Convert prose rules to enforcement

Execute the "move to enforcement" verdicts: for each prose rule, implement the highest surface on the enforcement hierarchy that fits — write the test, add the lint rule, add the CI gate, or create the validation script — then delete the prose. Validate every command you create or document by running it. A rule the agent already follows without the line gets the line deleted outright.

Enforcement changes encode behavioral assumptions. Derive each test or lint from an explicitly stated rule — never invent the expected behavior — and when the user's request was docs-scoped, present the conversion plan (rule → surface → proposed file/command) for approval before implementing it.

If the target surface does not exist (no test runner, no lint config, no CI), do not bootstrap project infrastructure inside this workflow: convert what fits existing surfaces, record the rest as `docs/todos` specs (a missing enforcement surface is demonstrated need), and surface the infra decision to the user. An unconverted rule keeps its prose line plus a todo route.

### 4. Author `docs/SPEC_CONTRACT.md`

This file defines what a good SPEC.md looks like for this repo, so per-task intake (which happens outside the repo) produces specs the repo can verify. It has two parts: a generic quality bar and a project-specific proof menu **derived from the validation surfaces inventoried in step 1** — never freeform.

```md
# Spec contract

Specs executed against this repo must meet this bar. A spec that promises a
proof not listed in the proof menu is invalid — extend the menu (and the
validation surface behind it) first.

## Quality bar

A spec is ready when it:

- Is self-contained: an agent with no prior context can execute it.
- Names a goal as a user-visible outcome, not an implementation.
- Lists acceptance criteria that each map to a proof in the menu below.
- Names the files/interfaces it expects to touch, when known.
- States what is out of scope.
- States risk and taste constraints the agent must not trade away.
- Ends with an end-to-end verification step drawn from the proof menu.

## Proof menu

| Change type | Validation command | Proof artifact |
| --- | --- | --- |
| <area> logic | `<command>` | passing run output |
| <area> UI | `<command>` + screenshot diff | screenshot pair |
| API surface | `<contract/e2e command>` | passing run + response trace |
| Cross-cutting | `<full check command>` | CI-green equivalent locally |

## Escalation boundaries

Agents stop and surface instead of guessing when:

- An acceptance criterion cannot be proven with the menu above.
- The change requires an irreversible action (deploy, migration apply, data deletion).
- The spec's scope and the code's reality conflict.
```

Fill the proof menu with the repo's real commands. Every row must reference a command that exists and runs. Keep the menu compact — roughly ten rows, grouping related areas rather than enumerating every package. If the repo has no validation surfaces at all, do not invent commands: write the quality bar, mark the proof menu `provisional — validation not ready` with the gaps listed, and surface the infrastructure decision to the user; the operating model's runnable-validation-path rule is the target state this gap report works toward. Monorepos keep a single root `SPEC_CONTRACT.md`; the change-type column carries the package/workspace dimension (e.g. `<pkg> logic | pnpm --filter <pkg> test | …`). Route to this file from `AGENTS.md`.

### 5. Author the remaining core docs

- `docs/ARCHITECTURE.md` — the current structure map, compact: packages/services, boundaries, data flow. Current state only; history belongs in an existing maintained ADR convention, linked from `docs/INDEX.md`.
- `docs/engineering/commands.md` — canonical install/dev/test/lint/build commands. Run each command before documenting it.
- `docs/engineering/testing.md` — change type → required validation → proof, seeded from the spec-contract proof menu and extended with area-specific detail.

### 6. Rewrite `AGENTS.md` as a router

Keep it tiny: point outward, never teach the whole repo. Budgets (enforced by the `harness-doctor` scanner, which owns the numbers): the root entry point stays under 150 non-blank lines, and the combined size of all `AGENTS.md` files stays under 32 KiB or Codex silently drops the rest.

```md
# Agent guide

Code, tests, and runtime behavior are the source of truth. Docs route you to the right code and validation path.

## Operating model

- Specs come from intake against `docs/SPEC_CONTRACT.md`; you own implementation through end-to-end proof.
- Identify the validation command before editing. Escalate per the spec contract; otherwise execute end-to-end.

## Where to look

- Spec contract: `docs/SPEC_CONTRACT.md`
- Index: `docs/INDEX.md` · Architecture: `docs/ARCHITECTURE.md`
- Commands: `docs/engineering/commands.md` · Validation: `docs/engineering/testing.md`

## Rules

- If a rule can be tested, linted, or scripted, enforce it there — do not add it here.
- Do not duplicate product truth in docs.
- If you struggle to find the right code, say so in your handoff (that is a harness gap).

## Done means

- Required validation passed or the failure is explained.
- End-to-end proof produced per the spec.
- Durable knowledge landed on the smallest relevant surface; deferred work in `docs/todos` only if real and actionable.
```

Adapt sections to the repo (add earned-surface links only when those surfaces exist). Make `CLAUDE.md` a shim whose content is the single import line `@AGENTS.md` (Claude Code's import syntax — a prose "see AGENTS.md" does not reliably load the file). Claude Code reads only `CLAUDE.md`, other agents read `AGENTS.md`; the shim keeps one source of truth.

#### AGENTS line gate

Every durable **rule** line must pass all six tests; otherwise move or delete it per step 2. Grounding lines are judged by the grounding gate (Rules versus grounding, above) instead — do not delete grounding for failing the Operational test.

1. **Universal** — applies to all agents entering the repo or subtree.
2. **Operational** — changes what the agent should do.
3. **Durable** — likely true after this PR.
4. **Enforceable?** — if it can be tested, linted, or scripted, do that instead (step 3).
5. **Best location** — cannot live on a narrower surface without losing usefulness.
6. **Not already followed** — if the agent does it correctly without the line, delete the line.

#### Nested AGENTS decision test

A nested `AGENTS.md` (nearest-file precedence) is the standard vehicle for subtree-specific guidance — often better than a parallel `docs/domains/` entry — but each one is another prose surface. Two needs justify one:

- **Rules** — the subtree has materially different commands, invariants, validation, or ownership. Justification test: would putting this rule at root bloat the universal map or mislead agents working elsewhere? If yes, nest it; if no, move the detail to a narrower doc or delete it.
- **Grounding** — the subtree implements a coherent feature or subsystem whose intent or topology is not readable from the code (gated/AB-tested features, cross-layer data flow, a user-visible surface). Shape: what this implements → why it exists → what it looks like → data model → key files (file → role), every line passing the grounding gate. Create it when the feature ships — waiting for two misroutes here just taxes every future agent.

A nested file names the local boundary, points to local docs/tests, never restates generic repo rules, gets a sibling `CLAUDE.md` shim (`@AGENTS.md`) exactly like the root, and counts against the combined byte budget. A grounding file may exceed the root router's length; the binding limits are the gates and the byte chain, not symmetry with root. Note: tool compliance with nested files is uneven (documented Copilot bugs), so keep root routes to critical subtree rules.

### 7. Create `docs/INDEX.md`

A short table of contents listing only files that exist: spec contract, architecture, engineering docs, and any earned surfaces. Link existing conventions (ADRs, an existing glossary) instead of duplicating them.

### 8. Build earned surfaces only as needed

When the need from the Target structure table is demonstrated, use these shapes and keep them small:

- **Glossary** — table of `Term | Definition | Aliases to avoid`. Add a term only when it is repeatedly misused or repeatedly verbose to describe. No generic programming terms.
- **Todo specs** — `docs/todos/INDEX.md` table plus one file per spec containing: status, why this exists, scope, start-here table (task → file), invariants, validation table, close condition. A note lacking a code route, invariant, validation path, or close condition stays in the PR/issue.
- **Domain folder** — `INDEX.md` (owns / start here / related domains), `code-map.md` (task → start file → also inspect), `invariants.md` (current constraints only), `test-map.md` (change type → required validation). Consider whether a nested `AGENTS.md` covers the need with less surface first.
- **Design docs** — `migration-patterns.md` first (legacy pattern → new pattern → notes table); add `components.md`, `page-patterns.md`, `tokens.md`, `accessibility.md`, `anti-patterns.md` only as UI work demands.

### 9. Leave scanning to `harness:doctor`

Product repos contain stable docs, enforcement, and optionally a thin `harness-doctor.config.ts` (e.g. `docsContract: true`, rule disables). Never embed scanner packages, agent utility scripts, or generated reports. When the user asks to audit, score, run the scanner, or triage findings, route to `doctor.md`.

## Verification

Deterministic structure checks live in the external `harness-doctor` CLI — the single implementation this workflow never re-derives. Verify with it following the same invocation recipe as `doctor.md`'s Fast path, without `--diff` (verification here is a full scan). Prefer a repo-pinned install:

```bash
[ -x ./node_modules/.bin/harness-doctor ] && ./node_modules/.bin/harness-doctor --json --verbose
```

With no pinned binary, confirm with the user first, then run `npx @andypai/harness-doctor@latest --json --verbose`.

If the scanner is unavailable, say so in the report and recommend pinning `@andypai/harness-doctor` as a devDependency — do not hand-run structure checks.

Then run every command you documented or created — `docs/engineering/commands.md`, the spec-contract proof menu, new tests/lints/scripts. A documented command you did not run is marked unverified in your report.

## Output shape

Lead with a one-paragraph recommendation, then report:

- Files created, changed, deleted (concrete paths).
- Keep / Move / Delete table.
- Prose rules converted to enforcement (rule → surface), and rules deferred to `docs/todos` because the surface was missing.
- Spec-contract proof menu rows and which commands were run to validate them.
- What now lives in `AGENTS.md` versus `docs/`, and the scanner result.
- Earned surfaces created or intentionally skipped, with the need shown or absent.
- Stale, duplicated, or external knowledge still unresolved.

When the report includes remediation work, order it Immediate / Near-term / Later — severity describes impact, tiers describe execution order, the same semantics `doctor.md` uses.
