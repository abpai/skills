# Pi Protocol — Simulated Conversation

A walkthrough of the full plan -> execute -> review loop using a realistic
scenario: adding rate limiting to an Express API.

**Scenario:** A single client is hammering the API and degrading service for
everyone else. The user wants it fixed.

---

## Timeline

```
USER INPUT #1
─────────────
  /pi:plan Add rate limiting to our API. We're getting hammered by
  a single client and it's degrading service for everyone else.
```

### Under the hood

Coordinator reads state root, finds no prior state — fresh run. Writes
`state.json` with `phase: "plan"`, `current_step: "posture"`. Spawns
**planner** (foreground).

### Claude -> User

> Before I plan this out — which posture fits?
> - **expand** — explore the full design space (token buckets, distributed
>   rate limiting, per-endpoint policies, etc.)
> - **selective** — ship something real without over-engineering
> - **reduce** — smallest credible fix
>
> My read: you have a specific pain point (one bad client), so "selective"
> seems right. Confirm?

---

```
USER INPUT #2
─────────────
  Yeah, selective. We don't need anything fancy — just stop one
  client from ruining it for everyone.
```

### Under the hood

`SendMessage` -> planner with answer. Planner runs **clarify** step: reads
existing routes, middleware stack, identifies Express app structure.
`state.json`: step -> `"clarify"`.

### Claude -> User

> Got it — selective posture. A few questions:
> 1. Rate limit by IP, API key, or both? (I see you have x-api-key headers
>    in your auth middleware)
> 2. Should rate-limited requests get 429 with a Retry-After header, or
>    silently queue?
> 3. Any endpoints exempt? (health checks, webhooks?)

---

```
USER INPUT #3
─────────────
  1. API key — that's how we identify clients
  2. 429 with Retry-After
  3. Yeah, exempt /health and the Stripe webhook
```

### Under the hood

`SendMessage` -> planner with answers. Planner runs **lateral thinking**:

- Problem skeleton: "throttle a shared resource per-identity"
- Cross-domain raid: TCP congestion control (AIMD), circuit breakers,
  ecological carrying capacity
- Writes `research/lateral-thinking.md`

`state.json`: step -> `"lateral_thinking"`.

### Claude -> User

> Cross-domain patterns that might apply:
> 1. **TCP AIMD** — start generous, halve on violation, recover slowly.
>    Punishes bursts without permanent lockout.
> 2. **Circuit breaker** — after N violations, open the circuit entirely for
>    a cooldown window. Simple binary state.
> 3. **Ecological carrying capacity** — set a global request budget, divide
>    dynamically among active clients. Fair but complex.
>
> For selective posture, #2 (circuit breaker) feels right — simple,
> predictable, easy to explain to clients. #1 is interesting but adds state
> tracking complexity we don't need yet. Thoughts?

---

```
USER INPUT #4
─────────────
  Yeah, circuit breaker is fine. Keep it simple.
```

### Under the hood

`SendMessage` -> planner. Planner runs **distill**: compresses to 3
primitives. `state.json`: step -> `"distill"`.

### Claude -> User

> Distilled primitives:
> 1. **Identity resolver** — extract API key from request, map to client
>    identity
> 2. **Rate counter** — track request count per identity per window
>    (in-memory, Redis later if needed)
> 3. **Circuit gate** — middleware that checks count, returns 429 +
>    Retry-After when tripped, exempts allowlisted paths
>
> These three cover it. Sound right?

---

```
USER INPUT #5
─────────────
  Yep, that's it.
```

### Under the hood

Planner returns. Coordinator takes over for **Phase B — Research Fanout**.
`state.json`: step -> `"research_fanout"`.

Spawns **6 agents in parallel**:

| Primitive         | Agents                               |
|-------------------|--------------------------------------|
| identity resolver | claude-researcher, codex-researcher  |
| rate counter      | claude-researcher, codex-researcher  |
| circuit gate      | claude-researcher, codex-researcher  |

Each evaluates 3 layers: boring/proven, trending, first-principles. Results
written to `research/fanout/*.json`.

All 6 finish. Coordinator builds **consensus matrix**.
`state.json`: step -> `"verify_tech"`.

Claude and Codex agree on all 3 primitives — no tiebreaks needed. Writes
`research/consensus-matrix.md`.

Moves to **Phase C — Task Proposal**. `state.json`: step ->
`"propose_tasks"`. Spawns fresh **planner** with primitives + consensus
matrix.

### Claude -> User

> Research complete — Claude and Codex agree on all three:
> - Identity: pull from `req.headers["x-api-key"]`, fall back to IP
> - Counter: express-rate-limit with MemoryStore (swap to rate-limit-redis
>   later)
> - Gate: custom middleware wrapping express-rate-limit, path allowlist via
>   config
>
> No tiebreaks. Proposed tasks:
>
> **T01** — Identity resolver middleware
> Extract API key from header, fall back to IP. Unit test with mock requests.
> Depends on: nothing | Risk: low
>
> **T02** — Rate counter + circuit gate middleware
> Wire up express-rate-limit keyed by identity. 429 + Retry-After. Exempt
> /health and /webhooks/stripe. Integration test.
> Depends on: T01 | Risk: medium
>
> **T03** — Config and documentation
> Externalize limits to env vars (RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX).
> Update API docs with 429 behavior.
> Depends on: T02 | Risk: low
>
> Approve these tasks?

---

```
USER INPUT #6
─────────────
  Looks good. Go.
```

### Under the hood

**Phase D — Codex Review**. `state.json`: step -> `"codex_review"`.

Spawns **codex-reviewer** pass 1: reviews brief + tasks. Must-address:
"add test for missing API key edge case". Incorporates into T01. Saves
`reviews/codex-plan-pass-1.json`.

Spawns **codex-reviewer** pass 2: clean pass (`changed: false`). Early exit,
skip pass 3. Saves `reviews/codex-plan-pass-2.json`.

**Phase E — Finalize**. `state.json`: step -> `"finalize"`.

Coordinator presents the full plan summary and waits for human approval
before writing any artifacts.

### Claude -> User

> Plan ready for review:
>
> **Brief:** Per-API-key rate limiting with circuit-breaker pattern for an
> Express API. Selective posture — solve the immediate problem without
> over-engineering.
>
> **Consensus matrix:** Claude and Codex agree on express-rate-limit with
> MemoryStore, keyed by x-api-key with IP fallback. No disagreements.
>
> **Codex review:** 2 passes. One must-address item incorporated (missing
> API key edge case test in T01). Pass 2 clean.
>
> **Noted risks:** MemoryStore won't survive restarts or scale horizontally.
> Acceptable for selective posture — documented as a future upgrade path.
>
> **Task slices:** T01 (identity resolver) -> T02 (rate counter + gate) ->
> T03 (config + docs). 3 tasks, linear dependency chain.
>
> Approve? On approval I'll write brief.md, rubric.json, and task files.

---

```
USER INPUT #7
─────────────
  Approved.
```

### Under the hood

User approved. Writes: `brief.md`, `rubric.json` (with `execution_policy`),
`tasks/T01.json`, `tasks/T02.json`, `tasks/T03.json`.
`state.json`: `phase` -> `"execute"`.

### Claude -> User

> Plan written. Run `/pi:execute` when ready.

---

```
USER INPUT #8
─────────────
  /pi:execute
```

### Under the hood

**Load & Resume.** Reads brief, rubric, tasks, state. T01: `not_started` ->
`in_progress`. `state.json`: step -> `"build"`.

#### T01 — Identity resolver

1. Writes `contracts/T01.md`. Spawns **evaluator** to pressure-test
   contract -> approved.
2. Spawns **generator** with brief, contract, consensus matrix.
   Creates `src/middleware/identity.ts`, `test/identity.test.ts`.
   `build_pass: 1`.
3. Spawns **codex-reviewer** scoped to 2 changed files.
   Saves `reviews/codex-build-1.json`.
4. Spawns **evaluator**: tests pass, functionality 8, code_quality 8.
   All criteria pass. Saves `evaluations/build-pass-1.json`.
5. T01: `in_progress` -> **complete**.

#### T02 — Rate counter + circuit gate

1. T02: `not_started` -> `in_progress`. Writes `contracts/T02.md`.
   Spawns **evaluator** to pressure-test contract -> approved.
2. Spawns **generator**. Creates `src/middleware/rateLimiter.ts`,
   `test/rateLimiter.test.ts`. `build_pass: 2`.
3. Spawns **codex-reviewer**. Saves `reviews/codex-build-2.json`.
4. Spawns **evaluator**: 1 test failing, `code_quality: 6` (below threshold
   of 7). Issue: "Retry-After header is in seconds but window is configured
   in ms — unit mismatch". Saves `evaluations/build-pass-2.json`.
5. T02: `in_progress` -> **failed**.
   - `failure_reason`: "Retry-After unit mismatch, test assertion wrong"
   - `action_on_resume`: "fix Retry-After to use seconds, update test"

#### T02 — Repair pass 1

1. T02: `failed` -> `in_progress`. `repair_pass: 1`.
2. Spawns **generator** with only the failing evidence + repair guidance.
   Fixes ms->s conversion, fixes test assertion.
3. Spawns **codex-reviewer**. Saves `reviews/codex-build-3.json`.
4. Spawns **evaluator**: all tests pass, `code_quality: 8`.
   Saves `evaluations/build-pass-3.json`.
5. T02: `in_progress` -> **complete**. `repair_pass` reset to 0.

#### T03 — Config and documentation

1. T03: `not_started` -> `in_progress`. Writes `contracts/T03.md`.
   Spawns **evaluator** to pressure-test contract -> approved.
2. Spawns **generator**, **codex-reviewer**, **evaluator**. Passes first
   try.
3. T03: `in_progress` -> **complete**.

#### All tasks complete

`state.json`: `phase` -> `"review"`.

### Claude -> User

> Build complete.
> - T01 identity resolver — pass (1 pass)
> - T02 rate counter + gate — pass (1 build + 1 repair — fixed Retry-After
>   unit mismatch)
> - T03 config + docs — pass (1 pass)
>
> Run `/pi:review` for final QA.

---

```
USER INPUT #9
─────────────
  /pi:review
```

### Under the hood

**Load & Verify.** Reads state (`phase: "review"`), brief, rubric, all
tasks, all evaluations.

**Full Suite.** Runs `npm test` -> all pass. Runs per-task verification
arrays. Writes `evaluations/suite-results.json`.

**Final Codex Review.** Spawns **codex-reviewer** on full build. Saves
`reviews/codex-final.json`.

**Final Evaluator.** Spawns **evaluator** against whole build with all
context. Saves `evaluations/review.json`. All criteria pass.

Writes `LEARNINGS.md`. `state.json`: `phase` -> `"done"`.

### Claude -> User

> ```
> ┌──────────────────────────────────────────────┐
> │              FINAL SCORECARD                  │
> ├──────────────────┬───────────┬───────────────┤
> │ Criterion        │ Score     │ Threshold     │
> ├──────────────────┼───────────┼───────────────┤
> │ functionality    │ 9         │ 7 pass        │
> │ code_quality     │ 8         │ 7 pass        │
> │ product_depth    │ 7         │ 6 pass        │
> │ visual_design    │ n/a       │ —             │
> └──────────────────────────────────────────────┘
> ```
>
> **Per-task verification:** T01 pass (3/3 checks), T02 pass (4/4), T03
> pass (2/2)
>
> **Full-suite test results:** `npm test` — 14 passed, 0 failed, 0 skipped
>
> **Repair passes used:** 1 (T02 — Retry-After unit mismatch)
>
> **Codex impact:** Codex was consulted at all checkpoints. Changed the
> outcome in two places: (1) added missing-API-key edge case test to T01
> during plan review, (2) flagged the Retry-After unit mismatch in
> build pass 2 before the evaluator scored it.
>
> **Consensus deviations:** none
>
> **Known gaps:** none
>
> Build passes. Learnings written. Done.

---

## Observations

- **User types 9 times.** The protocol handles ~20+ agent spawns, file
  writes, and evaluation loops autonomously between inputs.
- **User decisions are the bottleneck by design.** Posture, clarifications,
  pattern selection, primitive approval, task approval, plan approval after
  Codex review. Everything else is automated.
- **The T02 repair loop is invisible.** User doesn't intervene; the
  evaluator caught a real bug (unit mismatch), the generator fixed it, and
  it re-evaluated cleanly within the same `/pi:execute` run.
- **Codex runs at every checkpoint** but the user never interacts with it
  directly — it's a background critic that feeds into the evaluator.
- **State is fully resumable.** If the session died after T02 failed, a cold
  resume would read `action_on_resume` and know exactly where to pick up.
