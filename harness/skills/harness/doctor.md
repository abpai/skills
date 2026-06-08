# Harness Doctor

Audit and improve an agent harness without turning the scanner into a prose judge. The external `harness-doctor` CLI owns deterministic checks; this skill owns triage, semantic review, and remediation planning.

Use this workflow when the user asks to run Harness Doctor, score repo docs, find stale or missing agent guidance, audit progressive disclosure, review `AGENTS.md`, inspect `docs/todos`, or decide what docs should be kept, moved, or deleted.

## Core split

- `harness:docs` authors the documentation structure.
- `harness:doctor` audits the structure and turns findings into next actions.
- `harness-doctor` CLI checks deterministic facts only: files, links, line budgets, banned paths, complete domain docs, glossary count, and todo-spec sections.
- Semantic judgment stays in this skill: duplicated guidance, rule altitude, glossary usefulness, invariant quality, and whether a todo is strategically worth keeping.

Do not add scanner scripts to product repos. A product repo may keep stable docs plus optional `harness-doctor.config.ts` (the `harness-doctor` CLI's config file); scanner output stays temporary.

## Fast Path

From the repo root:

```bash
npx harness-doctor@latest --json --verbose --diff
```

If diff mode is unavailable or the user asks for a full audit:

```bash
npx harness-doctor@latest --json --verbose
```

If the CLI is not available, the network is blocked, or the repo intentionally cannot run `npx`, use the manual checks below and say the scanner was unavailable.

## Read The Report

Parse JSON when available. Each diagnostic has `filePath`, `plugin`, `rule`, `severity`, `message`, `help`, `line`, `column`, and `category`.

Group findings for the handoff:

- Critical: missing entry point, missing `docs/`, stale local links, deleted referenced paths, or misleading routes that will send agents to the wrong code.
- High: giant `AGENTS.md`, missing `docs/INDEX.md`, missing architecture map, missing glossary, duplicate glossaries, incomplete domain docs, missing todo index, or banned long-lived paths.
- Medium: oversized docs, todo specs with missing sections, weak scan structure, or follow-up semantic review items.

Output recommendation-first:

```text
Harness Doctor Score: <score or unknown>

Recommendation
<one short paragraph>

Critical
- <finding + file path + fix>

High
- <finding + file path + fix>

Medium
- <finding + file path + fix>

Immediate
1. <first concrete fix>

Near-term
1. <next structural improvement>

Later
1. <semantic or adoption improvement>
```

## Manual Checks

Run these when the scanner is unavailable or after it finishes:

```bash
wc -l AGENTS.md 2>/dev/null || true
rg --files -g 'AGENTS.md' -g 'CLAUDE.md' -g 'docs/**' -g '.agent/**' -g '.cursor/**' -g 'feature-registry.json' | sort
rg -n "\\[[^]]+\\]\\([^)]+\\)" AGENTS.md CLAUDE.md docs 2>/dev/null || true
rg --files docs/domains 2>/dev/null | sort
rg --files docs/todos 2>/dev/null | sort
```

Then inspect:

- `AGENTS.md` is a map, not a manual.
- `docs/INDEX.md`, `docs/ARCHITECTURE.md`, and one canonical glossary exist.
- `docs/todos/INDEX.md` exists when the repo opted into the Harness docs contract or has todo specs.
- Every `docs/domains/*` folder has `INDEX.md`, `code-map.md`, `invariants.md`, and `test-map.md`.
- Local markdown links and referenced repo paths resolve.
- Banned default paths are absent: `.agent/`, `scripts/agent/`, `.cursor/rules/`, `docs/product-specs/`, `docs/exec-plans/`, `docs/references/vendor-docs/`, `feature-registry.json`. (`docs/adr/` is not banned: flag it only if newly created by default, but keep an existing maintained ADR convention.)
- Todo specs have status, scope, start points, invariants, validation, and close condition.

## Keep / Move / Delete Audit

For each docs or agent-guidance item, recommend one verdict:

- Keep: answers where the code is, who owns behavior, what must not break, how to validate, or defines a useful project term.
- Move: belongs in a smaller doc, domain doc, glossary, design docs, `docs/todos`, code, tests, or issue/PR context.
- Delete: duplicates source truth, records completed task scaffolding, mirrors vendor docs without freshness policy, or preserves stale historical plans.

Do not promote domain-specific rules to root. Do not bury broad repo rules inside a domain doc.

## AGENTS Line Gate

Each durable `AGENTS.md` line should pass this test:

- Universal: applies to all agents entering the repo or subtree.
- Operational: changes what the agent should do.
- Durable: likely to remain true after this PR.
- Enforceable: if it can be linted, tested, or scripted, prefer that over prose.
- Best location: cannot live in a narrower docs file without losing usefulness.

Use nested `AGENTS.md` only when a subtree has different commands, invariants, validation, or ownership that would bloat the root map.

## Feedback Compounding

Treat repeated failures as harness gaps:

- If agents keep asking where code lives, add or repair a code map.
- If agents keep breaking the same invariant, add a test or move the invariant near validation.
- If agents keep using confusing words, add a glossary term or aliases to avoid.
- If agents keep leaving TODOs in PR notes, add a `docs/todos` spec shape.

Repo-local source of truth wins. Prefer code, tests, runtime behavior, and current repo docs over Slack, memory, or stale external docs unless the user explicitly provides a current source.

## Proof

Proof beats assertion. End every audit with what was actually checked:

- Scanner command and result, or why it was unavailable.
- Manual commands run.
- Files inspected.
- Any link/path failures verified.
- Product-facing proof for UI/API docs when relevant: route loads, endpoint responds, screenshot/trace exists, or validation command ran.

Do not claim commands in docs still run unless you ran them or explicitly mark them unverified.
