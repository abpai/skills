# Verification & Exit Criteria

Verifiability is the lever. If the agent can self-confirm success and stop cleanly when it can't, you stay out of the loop. Without it, the agent either declares premature success, spins indefinitely, or pings you mid-flight.

Use this file when filling in the brief's **Done when** and **Acceptance checks** sections.

---

## 1. Verification taxonomy

Pick the shapes that fit the goal. List the exact commands in the brief.

| Shape | Brief specifies | Fake-verification failure mode |
|---|---|---|
| **Type-check** | Exact cmd (`tsc --noEmit`, `mypy --strict path/`, `cargo check`); zero-error baseline confirmed pre-edit | Adding `any`, `# type: ignore`, `as unknown` to silence |
| **Unit-test (red-to-green)** | Named tests that must flip; cmd + expected status line | Weakening assertions, deleting cases, marking `skip`/`xfail`, mocking the unit under test |
| **Unit-test (regression-only)** | Full suite cmd; baseline pass count recorded before edit | Reducing baseline by removing tests |
| **Integration / e2e smoke** | Exact runnable invocation (`curl ... \| jq .field`, `bun test e2e/foo`); expected output substring or status | Stubbing the network/db boundary the smoke is supposed to exercise |
| **Property / invariant** | SQL or script that returns 0 rows on success; pre and post both run | Filtering the invariant query to a passing subset |
| **Diff-shape** | Allowlist of paths; `git diff --name-only` must be a subset | Drive-by edits in unrelated files justified as cleanup |
| **Performance threshold** | Benchmark cmd, metric, threshold, sample count | Running once and cherry-picking; warming caches before measuring |
| **Dataset / numeric** | Row count, schema, null/uniqueness checks as one script | Running checks on a sample, not the artifact |
| **Repo hygiene** | Lint cmd; `! grep -r "TODO\|FIXME" <changed-files>`; no new bare `except:` / `catch {}` | Disabling lint rules inline |
| **Reasoning artifact** | Rubric of N criteria; artifact must address each by name; second-pass self-grade | Generic prose that name-drops criteria without engaging |
| **Visual / UI** | Flag as **non-autonomous**; produce screenshot + checklist, hand back | Claiming "looks right" without rendering |

## 2. Exit-criteria clauses (drop into the brief)

**Success exit:**
> Stop when every check in **Acceptance checks** passes on a clean run from a fresh shell. Do not run checks, edit, and re-run in the same process — re-invoke the command. Then write SITREP with status `DONE` and stop. Do not start adjacent work.

**Bounded-failure exit:**
> You have at most 3 attempts per failing check, or 20 minutes wall-clock total, whichever comes first. On exhaustion, stop. Do not delete, skip, or weaken the failing check. Do not wrap the failure in `try/except`, `|| true`, or `continue-on-error`. Write SITREP with status `BLOCKED`, including the exact failing command, the last 20 lines of its output, your current hypothesis, and the next experiment you would run.

**Out-of-scope exit:**
> If the fix requires changes outside the diff-shape allowlist (schema migration, dependency bump, API contract change, secrets, infra), stop. Do not expand scope. Write SITREP with status `OUT_OF_SCOPE` describing the boundary you hit and the minimum scope expansion that would unblock it.

## 3. SITREP format

```
STATUS:     DONE | BLOCKED | OUT_OF_SCOPE
GOAL:       <one line, restated>
CHANGED:    <files touched, newline-separated>
VERIFIED:   <each check: cmd → PASS/FAIL + key line of evidence>
ASSUMPTIONS:<decisions made without asking>
UNRESOLVED: <failing check or boundary; empty if DONE>
HYPOTHESIS: <best guess at root cause; empty if DONE>
NEXT:       <one concrete next step a human can take cold>
```

Hard cap: fits on one screen. Evidence lines are quoted from real command output, not paraphrased.

## 4. Verification-spoofing inoculation (drop into the brief)

> **No moving the goalposts.** The verification commands and their expected outcomes are fixed at the start of the goal. You may not edit, skip, weaken, or delete a check to make it pass. If a check is wrong, stop and report it as `BLOCKED` — do not silently rewrite it.

> **No swallowing failures.** Do not introduce `try/except`, `catch {}`, `|| true`, `// @ts-ignore`, `# type: ignore`, `eslint-disable`, `.skip`, `.only`, or equivalent suppressions to make a check pass. If one exists before the goal starts, leave it; do not add new ones.

> **No mocking the subject.** If a check is supposed to exercise component X, you may not mock, stub, or replace X to make the check green. Mocks are allowed only at boundaries that already have mocks before your edit.

## 5. When verification is genuinely hard

Some goals don't have a clean verification surface — open-ended design, prose voice, strategic calls. Don't fake the verification.

**Default: structured-candidates mode.** Produce **3 distinct candidates** with a comparison matrix against pre-stated criteria, plus a recommendation; status `HUMAN_DECISION`. Stop. Hand back to the user.

**Decision rule:**

- Mechanically checkable (compiles / passes / matches) → autonomous, use the taxonomy above.
- Stable rubric of ≥4 criteria the agent can self-grade → **LLM-judge panel**: separate context, given rubric + artifact, returns scores; autonomous if all criteria clear threshold, else `BLOCKED`.
- Pure taste / open design / prose voice → **structured-candidates**, hand back.

Rule of thumb: **if you cannot write the verification command before starting the goal, you cannot run it autonomously.** Downgrade to candidates mode rather than fake the verification.
