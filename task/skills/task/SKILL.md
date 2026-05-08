---
name: task
description: Convert a rough ask into a hands-off task brief an agent can execute end-to-end. Defines done, scope, and stop conditions so you can fire it and walk away.
when_to_use: User wants to delegate work to an agent and step out of the loop. Trigger phrases include "kick this off", "run with this", "I'll come back later", "fire and forget", "make this autonomous", "write a brief for", "hand this off", "task for the agent", or any long-running coding/research/refactor task where the user shouldn't be the bottleneck. Not for sharpening a one-shot prompt (use improve-prompt) or for live planning conversation (use pi:plan).
argument-hint: "[task, ticket, goal, or empty to use conversation context]"
metadata:
  author: Andy Pai
  version: "0.1.0"
  tags: "agents autonomy delegation briefs leverage"
---

# Task

Turn a rough ask into a **hands-off brief** — a self-contained contract an agent can execute end-to-end without pulling you back into the loop.

This is different from `improve-prompt`. That skill optimizes a prompt as text. This skill optimizes a task as a unit of autonomous work: the verifier, the scope, the stop conditions, the failure clause. The output isn't sharper words; it's an artifact you can fire and walk away from.

The animating principle: **the human is the bottleneck.** Every implicit decision, every "ask me if unclear", every approval gate is a place the agent will stop and wait for you. A good brief preempts those.

## How to run this skill

### 1. Read what you have

`$ARGUMENTS` (or recent conversation) contains the rough task. Classify:

Score the draft on the five clarity dimensions in step 2 (V/S/C/X/O).

- **All dimensions ≥1 and V ≥2** — skip to step 3.
- **Anything below threshold** — go to step 2.
- **Genuinely not autonomy-tractable** (pure taste, open design, ambiguous goal where V cannot reach ≥1) — say so. Recommend `improve-prompt` for a sharper one-shot, `pi:plan` for an interactive plan, or downgrade to candidates mode (see references/verification.md §5).

### 2. Interview — Socratic, ambiguity-gated

Score the draft on five clarity dimensions. **0** = absent, **1** = mentioned but vague, **2** = concrete and load-bearing.

| Dim | Question it answers | Concrete looks like |
|---|---|---|
| **V** Verifier | How does the agent know it's done? | Named runnable cmd whose exit-zero defines done; named tests; output schema |
| **S** Scope | What can it touch and what's the blast radius? | Explicit in/out file list; local vs. shared vs. prod called out |
| **C** Context | What must be loaded first? | Paths with line ranges; stable IDs (not email/name); doc links |
| **X** Stop conditions | When does it halt instead of looping or asking? | Retry budget; destructive-action allow/deny; out-of-scope exit |
| **O** Output | What does it leave behind? | SITREP fields specified; report path named |

**Loop, one question per round:**

1. Score V/S/C/X/O.
2. Pick the **lowest** dimension. Ties: V > S > C > X > O.
3. Ask **exactly one** question via the available user-question mechanism, targeted at that dimension. Not a batch. In Claude Code, use `AskUserQuestion`; in Codex, ask one concise question in chat.
4. Re-score after the answer.
5. Repeat.

**Proceed to rewrite when:** every dimension is ≥1 **and** V is ≥2. (The verifier is load-bearing — it's the seam where autonomy actually lives.)

**Cap at round 5.** If still under threshold, hand back a partial brief that flags the unscored dimensions inline as `[NEEDS: …]` so the user can fill them before firing. Mark it `NOT READY TO FIRE` and do not include a runnable line.

**Refuse autonomy when:** V cannot reach ≥1 after probing — the task isn't autonomy-tractable. Recommend `improve-prompt` for a sharper one-shot, or downgrade to candidates mode (see references/verification.md §5).

> Pattern borrowed from oh-my-codex's `deep-interview` skill: one question per round on the weakest clarity dimension, re-score after each answer, gate on a structured ambiguity threshold rather than a fixed question count. We use Claude Code's `AskUserQuestion` instead of `omx question`; the contract is prompt-driven.

### 3. Rewrite into the brief skeleton

Use the skeleton below. Then return:

1. **The brief** (ready to paste, complete).
2. **Hands-off checklist** — 4 bullets the user can scan: verifier defined / scope bounded / context named / stop conditions set. Any unchecked box is where they'll get pulled back in.
3. **Runnable line** — a one-liner like `claude -p "$(cat brief.md)"` or `cat brief.md | pbcopy` so they can fire it without further editing. Omit this when the brief is `NOT READY TO FIRE`.
4. **Final clarity scorecard** — V/S/C/X/O scores so the user sees at a glance which dimensions are concrete and which (if any) shipped under threshold.

Lead with the brief. Keep commentary minimal.

---

## The brief skeleton

```md
# Task: <one-line outcome>

## Done when
- [ ] <observable end state>
- [ ] <observable end state>
- Verification: `<exact cmd that returns 0/green>`

## Context (load before acting)
- Files: `<path:line-range>`, `<path>`
- Prior decisions / docs: `<link or path>`
- Stable IDs to use: `<UUID, FK, etc — not email/name>`
- Conventions to match: `<style, framework, naming>`

## Scope
- In:  <bullet list>
- Out: <bullet list — "do not touch X, do not refactor Y">

## Acceptance checks (all must pass before declaring done)
1. `<lint/typecheck cmd>`
2. `<test cmd — name the specific tests added/changed>`
3. `<end-to-end smoke: curl, script, screenshot>`
4. Self-review the diff as a hostile reviewer; list what changed and why.

## Rules
- DON'T-FABRICATE: do not declare a check passed without running it. Paste real command output.
- STABLE-IDS: join/correlate on stable identifiers. Never on emails, names, timestamps, or display strings.
- NO-SILENT-WORKAROUNDS: do not delete, skip, mock-out, weaken, or `try/except` past a failing check. Fix the cause or stop.
- STOP-AND-SITREP: after 3 failed attempts at the same sub-problem, halt and write a SITREP. Do not loop.
- MAKE-ASSUMPTIONS-AND-LOG: do not stop to ask. Make the most reasonable assumption, log it under ASSUMPTIONS in the SITREP, proceed.

## Authorization (blast radius)
- Pre-authorized: edits under `<paths>`, running `<cmds>`, installing `<deps>`.
- Stop and ask first: schema migrations, secrets, prod network calls, `git push`, deletions outside `<paths>`, `--force`, `reset --hard`.

## Budget
- Soft cap: <N> tool calls or <N> minutes. At cap, stop and SITREP regardless of state.

## SITREP (always leave behind, success or otherwise)
Write `TASK_REPORT.md`:
- STATUS: DONE | BLOCKED | OUT_OF_SCOPE
- GOAL: <restated>
- CHANGED: <files touched, one-line each>
- VERIFIED: <each check: cmd → PASS/FAIL + key evidence line>
- ASSUMPTIONS: <decisions made without asking>
- UNRESOLVED: <failing check or boundary; empty if DONE>
- HYPOTHESIS: <root-cause guess if BLOCKED>
- NEXT: <one concrete next step a human can take cold>
```

## Load-bearing clauses (drop in as needed)

**Don't fabricate success:**
> Do not claim a check passed without running it. For each acceptance check, paste the literal command and the last 20 lines of its output into the SITREP. If you cannot run a check, mark it UNVERIFIED — never GREEN.

**Stable IDs only:**
> When joining, deduping, or correlating across systems or tables, use stable primary identifiers (UUIDs, foreign keys, immutable handles). Never key off emails, display names, timestamps, or other human-mutable fields, even if they appear unique in the sample data. If a stable ID is missing, stop and SITREP.

**No moving the goalposts:**
> Verification commands and their expected outcomes are fixed at the start of the task. You may not edit, skip, weaken, delete, `.skip`, `xfail`, `// @ts-ignore`, `# type: ignore`, `eslint-disable`, or `|| true` a check to make it pass. If a check is wrong, stop and report `BLOCKED` — do not silently rewrite it.

**Stop, don't loop:**
> If the same sub-problem fails 3 times, or you find yourself reverting the same change, halt. Write a SITREP with what you tried, the error each time, your current hypothesis, and the smallest next experiment. Do not loop, paper over with `try/except`, or weaken the test.

**No mocking the subject:**
> If a check is supposed to exercise component X, you may not mock, stub, or replace X to make the check green. Mocks are allowed only at boundaries that already have mocks before your edit.

**Out-of-scope exit:**
> If the fix requires changes outside the scope allowlist (schema migration, dependency bump, API contract change, secrets, infra), stop. Do not expand scope. Write SITREP with status `OUT_OF_SCOPE` describing the boundary and the minimum scope expansion that would unblock it.

## Two reference files

Load only when relevant:

- [references/loop-traps.md](references/loop-traps.md) — catalogue of patterns that secretly require the human in the loop, with the smell to detect in a draft and the rewrite. Use this while reviewing the user's draft.
- [references/verification.md](references/verification.md) — verification taxonomy by task shape, exit-criteria clauses, SITREP format, and what to do when verification is genuinely hard. Use this while filling in the **Done when** and **Acceptance checks** sections.

## Worked example

Input: *"add rate limiting to the menu endpoint"*

Output:

```md
# Task: Add rate limiting to GET /api/menu and prove it works

## Done when
- [ ] /api/menu returns 429 after 60 req/min from one IP
- [ ] Limit is configurable via RATE_LIMIT_MENU_PER_MIN env var
- Verification: `pnpm test api/menu.rate-limit && bash scripts/smoke-rate-limit.sh` is green.

## Context
- Files: `src/api/menu.ts`, `src/middleware/rateLimit.ts` (existing pattern), `.env.example`
- Conventions: middleware composition matches `src/api/auth.ts`; tests use Vitest + supertest.
- Stable ID for limiter key: `req.ip + route`. Do not key by user email or session token.

## Scope
- In: menu route + its tests + env docs.
- Out: other routes, the rate-limit store implementation (reuse existing Redis client).

## Acceptance checks
1. `pnpm typecheck && pnpm lint`
2. `pnpm test api/menu.rate-limit` — add this file, must go from absent to passing
3. `bash scripts/smoke-rate-limit.sh` — fires 70 reqs, expects 60×200 then 10×429
4. Self-review the diff: only `src/api/`, `src/middleware/`, `tests/`, `scripts/`, `.env.example` changed.

## Rules
[DON'T-FABRICATE, STABLE-IDS, NO-MOVING-GOALPOSTS, STOP-DON'T-LOOP, MAKE-ASSUMPTIONS-AND-LOG]

## Authorization
- Pre-authorized: edits under `src/api`, `src/middleware`, `tests/`, `scripts/`.
- Ask first: changing Redis config, touching auth middleware, adding new deps.

## Budget
- 30 tool calls or 20 min, then SITREP.

## SITREP
TASK_REPORT.md with STATUS, CHANGED, VERIFIED (paste output of all 3 checks), ASSUMPTIONS, UNRESOLVED, NEXT.
```

## Do not use this skill for

- **Sharpening a one-shot prompt** — use `improve-prompt` instead.
- **Interactive long-running planning with rubrics** — use `pi:plan`.
- **A small reversible edit you're staying in the loop for** — just go do it.
- **Genuinely unverifiable taste calls** — see references/verification.md §5 (downgrade to candidates mode).

## Why this works (brief)

Karpathy's framing: the lever now is **leverage** — few tokens in, huge work out. That requires the agent to self-verify (it can stop), self-bound (it doesn't sprawl), and self-report (you can audit when you come back). The brief skeleton encodes those three properties as fields. Fields you can't fill in are the seams where you'd otherwise get pulled back in.
