# Loop Traps

Patterns that secretly require a human in the loop. Scan the user's draft for these, apply the rewrite. The goal is one-shot autonomy: the goal is verifiable enough for an agent to execute without repeatedly asking the user to be the judge.

For each: **Trap** (what the pattern does), **Detect** (smell in the draft), **Rewrite** (clause or restructuring).

---

### 1. Implicit acceptance criteria
**Trap:** No runnable check means the agent can't tell when it's done, so you become the oracle.
**Detect:** "make it work", "fix the bug", "get the tests passing" with no command named.
**Rewrite:** Name the exact command whose exit-zero defines done (`pnpm test path/to/foo.test.ts && pnpm typecheck`). If no such command exists, write one first.

### 2. Approval gates mid-flow
**Trap:** "Plan, then wait for me" guarantees re-entry; the gate adds latency without adding signal.
**Detect:** "show me the plan before", "confirm with me", "stop after step 1".
**Rewrite:** Front-load the spec; agent executes end-to-end and reports once. If a real gate is needed, name the exact artifact and the exact condition for proceeding.

### 3. "Ask me if you have questions"
**Trap:** Invites re-entry on every ambiguity; the agent will find ambiguity.
**Detect:** "let me know if", "ask if unclear", "check with me first".
**Rewrite:** "Make the most reasonable assumption, log it under ASSUMPTIONS in the SITREP, and proceed. Do not stop to ask."

### 4. Heuristic joins on fragile keys
**Trap:** Agent correlates records by email/name/timestamp; looks fine, silently wrong (Karpathy's Stripe×Google example).
**Detect:** Two data sources mentioned with no join key specified; "match users", "find the corresponding", "link records".
**Rewrite:** Name the stable ID (`stripe_customer_id`, `user_uuid`). Add: "Do not match by email, name, or any human-readable field. If the stable ID is missing, stop and SITREP."

### 5. Unbounded scope
**Trap:** "Refactor everything that needs it" — the agent keeps going until it breaks something or you stop it.
**Detect:** "everything", "all the", "wherever", "as needed", "while you're at it".
**Rewrite:** Explicit in-list and out-list of files/modules. Hard budget: "Touch at most N files. If more are required, stop and SITREP."

### 6. Verification by vibes
**Trap:** "Make it look good" has no falsifier; agent declares victory on appearance.
**Detect:** "looks right", "feels good", "clean", "nice".
**Rewrite:** Pin to an objective signal: typecheck, unit test, e2e, screenshot diff against a reference, or numeric threshold (latency < X, bundle < Y).

### 7. Polished-wrong over correct-partial
**Trap:** Under pressure, agents weaken assertions, swallow errors, or fabricate success logs to "ship".
**Detect:** Aggressive deadline language; no failure clause.
**Rewrite:** "Prefer a correct partial result with a SITREP listing what's incomplete, over a complete result with weakened tests, caught-and-ignored errors, or skipped assertions. Do not modify tests to make them pass."

### 8. Mocked-out hard parts
**Trap:** Agent stubs the integration under test and declares done.
**Detect:** Integration work where mocks are easy to insert (auth, payments, external APIs).
**Rewrite:** "Do not mock [the system under test]. Mocks allowed only for: [explicit list]. The acceptance check must hit the real integration in [env]."

### 9. Open-ended retry loops
**Trap:** Agent burns the budget retrying a flaky thing, or thrashes between two failure modes.
**Detect:** Anything touching networks, CI, browsers, LLMs, or "until it passes".
**Rewrite:** "Bounded retries: max 3 attempts per failing check. After that, stop and SITREP with the last error and the diff so far. Do not loop on the same failure with cosmetic edits."

### 10. Destructive actions without authorization
**Trap:** Agent force-pushes, drops a table, deletes a branch, runs migrations on prod.
**Detect:** Tasks touching git history, databases, deployments, file deletion at scale.
**Rewrite:** Explicit allow-list of mutating commands. Default-deny for `--force`, `reset --hard`, `DROP`, `DELETE FROM` without `WHERE`, branch deletion, prod env vars. "If a destructive action seems needed and isn't allow-listed, stop and SITREP."

### 11. Hidden coupling / unstated invariants
**Trap:** Agent breaks a cross-cutting rule it had no way to know about.
**Detect:** Domain-specific work (auth, billing, permissions) without invariants pasted.
**Rewrite:** Paste the invariant verbatim into the brief: "Every X must Y. Verify by [grep/test]." If you can't articulate it, the goal is not ready.

### 12. Underspecified context
**Trap:** Agent has to discover which file, which function, which config — and guesses wrong.
**Detect:** Vague references ("the API", "that component", "the config").
**Rewrite:** Paths with line ranges, pasted snippets, doc URLs. "Edit `src/foo.ts:42-88`. Related: `bar.ts`. Spec: <link>."

### 13. "And while you're there..."
**Trap:** Polite phrasing smuggles a second goal in; doubles scope, doubles failure surface.
**Detect:** "also", "while you're at it", "might as well", "by the way".
**Rewrite:** Pull the secondary goal into a separate brief, or add: "Out of scope: [list]. Note any incidental cleanup in SITREP under DEFERRED; do not commit it."

### 14. Outputs nobody reads
**Trap:** Agent produces a 4000-word essay you'll skim once; the cost of reading it is back in your loop.
**Detect:** No output format specified.
**Rewrite:** Pin the format. Default: "5-bullet SITREP — what changed, what's verified, what's assumed, what's deferred, link to diff. No prose summary."

---

## Summary heuristic

Every brief must answer:

- **How does it know it's done?** A runnable check, not a vibe.
- **Where does it stop?** Bounded scope (files, retries, budget) and an explicit failure clause that ends in SITREP, not in asking you.
- **What is it forbidden to do?** Destructive ops, mocks of the system under test, heuristic joins, modifying tests to pass — name them by name.
