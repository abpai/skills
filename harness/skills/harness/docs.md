# Docs Harness

Build or renovate a repository documentation system so agents can answer four questions quickly:

1. Where is the code?
2. What owns this behavior?
3. What must not be broken?
4. How do I validate the change?

Everything else should be code, tests, PR context, issue context, durable todo specs under `docs/todos`, glossary entries for useful shared terms, temporary task scaffolding, or external harness-tooling output. The target is progressive disclosure: a tiny universal entry point, compact indexes, defined terms, todo specs for real deferred work, and domain docs that route agents to code and validation without becoming a manual.

## Use when

Use this workflow when the user asks to slim `AGENTS.md`, create or restructure repo docs, improve agent guidance, make a codebase easier to navigate, define ambiguous project terms, build domain maps, add design-system migration guidance, create durable follow-up specs under `docs/todos`, or prepare a repo for Harness Doctor-style scanning.

Do not use this to create eval registries, long-lived execution plans, committed agent scratchpads, or vendor-doc mirrors.

## Target structure

Create this structure unless the repo already has a stronger equivalent:

```text
repo/
├── AGENTS.md
├── CLAUDE.md
└── docs/
    ├── INDEX.md
    ├── ARCHITECTURE.md
    ├── GLOSSARY.md
    ├── todos/
    │   ├── INDEX.md
    │   └── <todo-slug>.md
    ├── engineering/
    │   ├── commands.md
    │   ├── testing.md
    │   ├── observability.md
    │   ├── migrations.md
    │   └── conventions.md
    ├── design/
    │   ├── INDEX.md
    │   ├── components.md
    │   ├── page-patterns.md
    │   ├── migration-patterns.md
    │   ├── tokens.md
    │   ├── accessibility.md
    │   └── anti-patterns.md
    └── domains/
        └── <domain>/
            ├── INDEX.md
            ├── code-map.md
            ├── invariants.md
            └── test-map.md
```

Optional files:

- `CLAUDE.md` - Claude-specific shim; often just points to `AGENTS.md`.
- `docs/engineering/migrations.md` - only when migrations are frequent or high-risk.
- `docs/engineering/conventions.md` - only for current conventions not enforceable in code.
- `docs/domains/<domain>/runbook.md` - only where operational debugging flows are useful.
- `docs/todos/<todo-slug>.md` - durable follow-up specs for real work intentionally left out of the current PR.
- `UBIQUITOUS_LANGUAGE.md` or `docs/reference/glossary.md` - keep an existing convention if the repo already has one, but link it from `docs/INDEX.md` and do not create a duplicate glossary.

Do not add these as long-lived repo defaults:

```text
.agent/
scripts/agent/
.cursor/rules/
docs/product-specs/
docs/exec-plans/
docs/references/vendor-docs/
feature-registry.json
```

Do not create ADRs (`docs/adr/`) by default, but preserve an existing, maintained ADR convention if it is the repo's source of truth for architecture history — link it from `docs/INDEX.md` rather than duplicating it.

Temporary task files such as `TODO.md`, `TASK_PLAN.md`, and migration notes belong on the task branch only. Delete them before merge, or condense real deferred work into `docs/todos/<todo-slug>.md` with code routes, invariants, validation, and a close condition.

## File roles

| File | Purpose | Keep? |
| --- | --- | --- |
| `AGENTS.md` | Universal agent router | Yes |
| `CLAUDE.md` | Claude-specific shim | Optional |
| `docs/INDEX.md` | Human/agent table of contents | Yes |
| `docs/ARCHITECTURE.md` | Current architecture map | Yes, compact |
| `docs/GLOSSARY.md` | Canonical defined terms and aliases to avoid | Yes, when terms exist |
| `docs/todos/INDEX.md` | Durable queue of follow-up specs | Yes |
| `docs/todos/<todo-slug>.md` | One deferred task/spec agents can pick up later | Yes, when real |
| `docs/engineering/commands.md` | Canonical commands | Yes |
| `docs/engineering/testing.md` | Validation paths | Yes |
| `docs/engineering/observability.md` | Runtime debugging paths | Yes |
| `docs/engineering/conventions.md` | Current conventions not enforceable elsewhere | Maybe |
| `docs/design/*` | Design-system migration and UI guidance | Yes |
| `docs/domains/*/code-map.md` | Where to start for each domain | Yes |
| `docs/domains/*/invariants.md` | Current rules and constraints | Yes |
| `docs/domains/*/test-map.md` | Area-specific validation | Yes |
| `docs/domains/*/runbook.md` | Operational/debugging flow | Only where useful |

## Process

### 1. Inventory current guidance

Read local agent entry points and docs before editing:

```bash
pwd
rg --files -g 'AGENTS.md' -g 'CLAUDE.md' -g 'README.md' -g 'docs/**' -g '.cursor/**' -g '.agent/**' -g 'feature-registry.json'
rg -n "Slack|Google Doc|Figma|Linear|Notion|TODO|decision|architecture|domain|owner|source of truth|tribal|agent|cursor|plan|eval" AGENTS.md CLAUDE.md README.md docs .cursor .agent 2>/dev/null || true
```

If external knowledge is referenced but unavailable, preserve the pointer and mark it as missing. Do not invent product truth.

### 2. Decide the docs map

Name the target files and what each one will own. Keep every long-lived doc tied to at least one of the four core questions.

Ask of each proposed file:

- Does this help agents find code?
- Does this name ownership or domain scope?
- Does this state a real invariant?
- Does this identify validation?
- Does this name a concept that was non-obvious or repeatedly awkward to describe?

If the answer is no, keep the information in code, tests, PR context, issue context, or temporary task scaffolding. If the answer is yes but the work is intentionally outside the current PR, write the smallest durable spec under `docs/todos`.

### 3. Rewrite `AGENTS.md` as a router

Keep it tiny. It should point outward instead of teaching the whole repo.

Use this shape:

```md
# Agent guide

This repo treats code, tests, and runtime behavior as the source of truth. Docs exist to help agents find the right code and validation path quickly.

## Start here

1. Read `docs/INDEX.md`.
2. Read the relevant domain guide under `docs/domains/`.
3. For UI work, read `docs/design/INDEX.md`.
4. Identify the validation command before editing.
5. Prefer small, reversible diffs.

## Where to look

- Architecture: `docs/ARCHITECTURE.md`
- Glossary: `docs/GLOSSARY.md`
- Todos/specs: `docs/todos/INDEX.md`
- Commands: `docs/engineering/commands.md`
- Testing: `docs/engineering/testing.md`
- Observability: `docs/engineering/observability.md`
- Design system: `docs/design/INDEX.md`
- Domain maps: `docs/domains/*/INDEX.md`

## Rules

- Do not duplicate product truth in docs.
- Do not add generic rules to this file.
- Do not create long-lived task plans; use `docs/todos` only for real deferred specs.
- If a rule can be tested or linted, prefer enforcement over prose.
- If you struggle to find the right code, mention the missing route in your handoff.

## Done means

- Relevant validation passed or failure is explained.
- The changed code path is clear.
- User-visible behavior was checked where applicable.
- Durable knowledge was added only to the smallest relevant doc.
- Deferred work was recorded in `docs/todos` only if it is real and actionable.
```

If the repo has `CLAUDE.md`, make it a small shim unless Claude genuinely needs different instructions.

### 4. Create `docs/INDEX.md`

Use this shape:

```md
# Documentation index

## System

- `ARCHITECTURE.md` - current system shape and package boundaries.
- `GLOSSARY.md` - canonical defined terms and aliases to avoid.

If the repo already uses `UBIQUITOUS_LANGUAGE.md` or `docs/reference/glossary.md`, link to that file instead of creating a duplicate.

## Engineering

- `engineering/commands.md` - install/dev/test/lint/build commands.
- `engineering/testing.md` - validation matrix by area.
- `engineering/observability.md` - logs, traces, dashboards, debugging.
- `engineering/migrations.md` - migration process, if applicable.

## Todos

- `todos/INDEX.md` - durable follow-up specs intentionally left outside current PRs.

## Design

- `design/INDEX.md` - design-system map.
- `design/components.md` - canonical components.
- `design/page-patterns.md` - approved page/layout patterns.
- `design/migration-patterns.md` - legacy UI to new system rules.
- `design/anti-patterns.md` - things not to do.

## Domains

- `domains/pricing/`
- `domains/subscriptions/`
- `domains/auth/`
- `domains/markets-data/`
- `domains/portfolio/`
- `domains/articles/`
- `domains/seo/`
- `domains/notifications/`
```

Adjust the domain list to the actual repo.

### 5. Build the glossary

Use `docs/GLOSSARY.md` for canonical project vocabulary. Two reasons justify adding a term:

1. An agent or maintainer keeps using a term that is non-obvious to the reader.
2. The team keeps needing too many words to describe the same thing and should name it.

Do not add obvious programming terms, generic acronyms, or concepts that only appear once. A glossary entry should reduce ambiguity, prevent wrong synonyms, or make repeated communication shorter.

Use this shape:

```md
# Glossary

This is the canonical vocabulary file for this repo. Use these terms in code, public interfaces, tests, docs, prompts, issues, PRs, and commit messages. Add or adjust a term here before introducing new public language.

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| Chrome | The visible application frame around page content: headers, sidebars, footers, nav, and persistent controls. | browser only, wrapper, shell unless translating external terminology |
| Workstation | The right-side panel that contains operator buttons, widgets, and contextual controls. | right panel, sidebar, controls area |

## Relationships

- The Workstation is part of the app Chrome.
- Domain-specific terms may link to `docs/domains/<domain>/INDEX.md` when ownership matters.
```

Entry rules:

- Prefer the name already used in code when it is clear and correct.
- Include aliases to avoid so agents stop spreading synonyms.
- Add relationships when terms are easily confused.
- If a term belongs to exactly one domain, link that domain's docs.
- If a term should appear in public APIs, tests, CLI output, or UI copy, say so.

Existing glossary names are acceptable. If the repo already has `UBIQUITOUS_LANGUAGE.md` or `docs/reference/glossary.md`, keep it and route to it from `docs/INDEX.md`.

### 6. Build todo specs

Use `docs/todos` for durable follow-up work that an agent notices but should not handle in the current PR. This is the repo-local shelf for "likely next" work, not a scratchpad.

Create an index:

```md
# Todo specs

| Spec | Area | Status | Why now | Validation |
| --- | --- | --- | --- | --- |
| `pricing-entitlement-copy.md` | pricing/subscriptions | open | Pricing copy can drift from entitlement logic | entitlement consistency check |
```

Each todo spec should be one file:

```md
# Pricing entitlement copy

## Status

Open

## Why this exists

Pricing copy can drift from entitlement logic. This was noticed while changing the pricing page, but fixing it is outside the current PR.

## Scope

- Audit pricing page feature text against subscription entitlements.
- Update mismatches in the smallest owning module.

## Start here

| Task | Start here | Also inspect |
| --- | --- | --- |
| Compare plan copy to entitlement mapping | `apps/web/...` | `docs/domains/subscriptions/invariants.md` |

## Invariants

- Do not show plan features that are not backed by entitlement logic.

## Validation

| Change type | Required validation |
| --- | --- |
| Plan/feature text | entitlement consistency check |

## Close when

- The copy and entitlement mapping agree.
- Required validation has passed.
- This spec is deleted or moved to completed history only if the repo has one.
```

Keep todo specs small and actionable. If a note lacks a code route, invariant, validation path, or close condition, keep it in the PR/issue instead of committing it.

### 7. Build domain docs

Each domain folder should be boring and consistent:

```text
docs/domains/<domain>/
├── INDEX.md
├── code-map.md
├── invariants.md
└── test-map.md
```

`INDEX.md` should state ownership and nearest neighbors:

```md
# Pricing domain

## Owns

Pricing pages, plan display, discounts, checkout entry points, pricing experiments.

## Start here

- Code map: `code-map.md`
- Invariants: `invariants.md`
- Tests: `test-map.md`

## Closely related domains

- `subscriptions`
- `auth`
- `seo`
- `design`
```

`code-map.md` should route tasks to starting points:

```md
# Pricing code map

| Task | Start here | Also inspect |
| --- | --- | --- |
| Change pricing page layout | `apps/web/...` | `docs/design/page-patterns.md` |
| Change displayed plan features | `packages/...` | `docs/domains/subscriptions/invariants.md` |
| Change discount behavior | `services/...` | checkout tests |
| Change SEO metadata | `apps/web/...` | `docs/domains/seo/test-map.md` |
```

`invariants.md` should contain current constraints only:

```md
# Pricing invariants

- Do not show plan features that are not backed by entitlement logic.
- Do not infer subscription access from pricing display state.
- Pricing experiments must not change canonical checkout entitlement mapping.
- SEO-visible pricing copy must remain consistent with checkout copy.
```

`test-map.md` should bind change types to validation:

```md
# Pricing validation

| Change type | Required validation |
| --- | --- |
| Pricing UI | component tests + visual check |
| Checkout link behavior | e2e checkout smoke |
| Plan/feature text | entitlement consistency check |
| SEO metadata | metadata snapshot / route check |
```

### 8. Treat design as a top-level control surface

For agentic UI migrations, `docs/design/` is not an appendix. Build:

```text
docs/design/
├── INDEX.md
├── components.md
├── page-patterns.md
├── migration-patterns.md
├── tokens.md
├── accessibility.md
└── anti-patterns.md
```

Prioritize `docs/design/migration-patterns.md`, because agents need translation rules:

```md
# Design migration patterns

| Legacy pattern | New pattern | Notes |
| --- | --- | --- |
| Legacy quote card | `MarketQuoteCard` | Preserve live price refresh behavior |
| Inline CSS spacing | design tokens | Do not invent one-off spacing |
| Custom tab group | `Tabs` component | Use controlled mode for URL-driven tabs |
| Desktop-only table | responsive data table pattern | Must validate mobile layout |
```

### 9. Leave scanner work to `harness:doctor`

Harness Doctor is the React Doctor analogy for agent guidance. The scanner should live outside product repos and inspect stable repo docs plus agent guidance for deterministic gaps: missing files, stale links, incomplete domain docs, banned long-lived paths, and todo-spec shape.

During docs work, product repos should contain only stable docs and optional thin config such as `harness-doctor.config.ts` with `docsContract: true`. Do not embed scanner packages, agent utility scripts, generated reports, or task outputs in every product repo.

When the user asks to audit, score, run the scanner, triage findings, or apply the Keep / Move / Delete review, route to `doctor.md` instead of expanding this authoring workflow.

## Verification

Run focused checks after editing:

```bash
wc -l AGENTS.md
rg -n "TODO|TBD|ask .*person|tribal|Slack|Google Doc|Notion|Figma|exec-plans|feature-registry" AGENTS.md CLAUDE.md docs || true
rg -n "glossary|ubiquitous language|aliases to avoid|defined term" AGENTS.md CLAUDE.md docs UBIQUITOUS_LANGUAGE.md 2>/dev/null || true
rg -n "\\[[^]]+\\]\\([^)]+\\)" AGENTS.md CLAUDE.md docs || true
rg --files docs/domains 2>/dev/null | sort
rg --files docs/todos 2>/dev/null | sort
```

Then inspect links and file paths you added or changed. If the repo has a markdown link checker or Harness Doctor config, run it.

## Output shape

End with a short report:

- Files created or changed.
- What now lives in `AGENTS.md` versus `docs/`.
- Glossary terms added or still missing.
- Todo specs added or still missing.
- Domain docs added or still missing.
- Any stale, duplicated, or external knowledge still unresolved.
- Verification run, including the `AGENTS.md` line count.

## Anti-patterns

- One giant `AGENTS.md`.
- `docs/` without an index.
- Architecture docs that mix current structure with historical decision records.
- Domain rules copied into the root agent guide.
- Non-obvious project terms repeated without a glossary entry.
- A glossary full of generic terms that do not reduce project-specific ambiguity.
- Multiple canonical vocabulary files that drift from each other.
- Deferred work trapped in PR notes when it should be a durable `docs/todos` spec.
- Vague todo specs without start files, invariants, validation, or close conditions.
- Design migration guidance hidden under generic references.
- Long-lived task plans, product specs, feature registries, or vendor docs committed by default.
- Scanner output committed instead of kept as external tooling output.
