# Multi-Pass Bug Hunting

Hunt the correctness, security, regression, and missing-test defects a single
read-through leaves behind, then loop scan -> fix -> rescan until the branch
converges to clean.

## When this gate applies

- Changed code/API/CLI touching behavior, parsing, trust boundaries,
  persistence, concurrency, resource lifecycle, control flow, or error handling.
- Any **agent-generated diff** (its failure modes are signature; see Gotcha 3).
- Correctness-sensitive changes where a green test suite is not proof.
- Pre-release / security-audit hardening over an existing branch.

## Gotchas

1. **Fixes introduce bugs — so rescan after every fix, never stop at first
   green.** Pass 1 finds the obvious bugs; pass 2 finds the bugs the obvious
   ones *hid*; pass 3 catches what you *introduced* fixing the first two.
   Fixing A exposes B; fixing B introduces C. This causal chain — not "read it
   twice" — is why one careful pass is insufficient. A fix you wrote in pass N
   is a new bug source; re-scan its file and consumers before claiming done.

2. **The convergence loop with explicit stop criteria.**
   `AUDIT -> FIX -> RESCAN -> clean?` and iterate. Stop ONLY when ALL hold:
   - [ ] final scan exits 0 (`ubs . --fail-on-warning`, or the project scanner)
   - [ ] all tests pass
   - [ ] no new findings on a fresh re-read
   - [ ] no deferred items remaining
   Missing these turns "review more" into either stopping too early or never
   knowing when it's done.

3. **Agent-written diffs have signature failure modes — look for each by
   name.** These are the highest-signal gotchas for agent code and push you to
   checks you would not do by default:
   - **Hallucinated APIs:** `response.getBody()` (it's `response.body`),
     `array.unique()` (no such method). Grep that the method exists on the type.
   - **Incomplete error paths:** happy path works, errors crash —
     `return res.data` with no check that `res` exists.
   - **Context confusion:** a function named `save` that actually deletes;
     `user` used where `profile` was meant.
   - **Oversimplified solutions:** split-on-comma that breaks when data contains
     commas; parse-as-int that breaks on huge numbers.
   For agent code, **cast a wide net — do NOT restrict to the latest commits.**
   Go deeper and diagnose underlying root causes via first-principles analysis
   before fixing. (This is the explicit exception to "don't chase pre-existing
   issues": for agent-code review the source widens scope on purpose.)

4. **One bug is usually a class — `similar code -> similar bugs`.** When you
   find a bug, grep/search the codebase for the same pattern instead of treating
   it as a one-off; one found bug becomes a class of found bugs. Check boundary
   values explicitly: `0, -1, empty, MAX_INT, unicode` — `str.length` is wrong
   for emoji, use `[...str].length`. Trace every `throw`, every `catch`, every
   `return null`.

5. **Triage every scanner finding before acting — each category has named false
   positives. The decision trees ARE the technique:**
   - *Null safety FP* when: value validated in caller / type system guarantees
     non-null / initialization always happens first.
   - *Missing await* is a real bug UNLESS fire-and-forget is intentional (return
     value unused and side-effect order doesn't matter).
   - *Resource leak FP* when RAII / `using` / `with` scope-cleanup is present.
   - *Security* is real ONLY when input is external AND unsanitized; internal or
     sanitized input is a FP. SQL/command/XSS injection with user input is
     always real.

6. **Per-finding prior + the one disambiguating check** (spend triage budget on
   the uncertain ones):

   | Finding | Usually real | Quick check |
   |---|---|---|
   | Missing await | 90% | fire-and-forget? |
   | SQL injection | 95% | parameterized? |
   | Error swallowed | 80% | intentional? |
   | Null deref | 70% | caller validates? |
   | Resource leak | 60% | RAII / scope? |
   | Division by zero | 40% | validated? |

7. **Which pass catches which class — don't trust pass-1 scanner output as
   comprehensive, and don't skip pass 3.** Races and integration bugs are MOST
   likely found in the LAST pass, which is what justifies it:

   | Class | Pass 1 | Pass 2 | Pass 3 |
   |---|---|---|---|
   | Null deref | 90% | 10% | — |
   | Logic error | 10% | 80% | 10% |
   | Edge case | 5% | 85% | 10% |
   | Race condition | 20% | 30% | **50%** |
   | Integration | 5% | 20% | **75%** |

8. **Fresh-eyes pass uses empirically-derived trigger phrases (CASS-discovered),
   not generic advice.** After fixing, step back and re-read each touched file as
   if new. The phrases that operationalize "fresh eyes" and actually shift the
   read deeper: *"with fresh eyes"*, *"careful methodical check"*, *"trace
   functionality through related files"*, *"Use ultrathink"* (enables deeper
   analysis). The original prompt: "randomly explore the code files... trace
   their functionality through related files. Do a super careful methodical
   check with fresh eyes." Ask each pass: did my fix add a bug? what edge case
   did I miss? does this same bug exist elsewhere in the file?

9. **Suppress with a reason, never silently.** Every suppressed finding carries
   an inline justification: `// ubs:ignore validated-by-caller`, block form
   `/* ubs:ignore-block security-reviewed-2024 */ ... /* ubs:ignore-block-end */`.
   **Security findings: never suppress without justification.** Suppression-with-
   reason is the discipline that keeps a green scan honest and preserves the
   audit trail.

10. **Scan NEW issues only.** `--comparison=baseline.json` (or
    `git diff main...HEAD`) so pre-existing scanner noise doesn't drown the
    defects *your* change introduced.

## Quick pass

Right-size effort to risk — do not force every pass on every diff:

| Situation | Passes |
|---|---|
| Quick pre-commit | 1 (`ubs --staged`) |
| Feature complete | 2-3 |
| Pre-release | 3-4 |
| Security audit | 4+, security-focused |
| Reviewing agent code | 2-3 min, fresh eyes critical |

Minimal loop for a normal PR:
1. Read the diff and the changed files.
2. Pass 1: scoped/baseline static scan; triage each finding (real / FP /
   missing-test / blocker / unrelated) with a reason; suppress FPs with
   justification.
3. Pass 2: fresh-eyes re-read of every touched file + its consumers; grep the
   repo for any bug you found; check boundary values.
4. Pass 3: run targeted tests; review the holistic diff for regressions,
   shared-state mutation (`config = defaultConfig` then mutate), and races.
5. Pass 4: final scan must exit 0 — loop back to step 2 if not.
6. Confirm all four convergence criteria, or name the residual untested risk.

## Deep pass

For correctness-sensitive or agent-authored diffs: run the full 4-pass loop to
convergence. Name the scanner levers per language — clippy `unwrap_used` /
`expect_used` (panics), eslint `no-floating-promises` / `no-misused-promises`
(awaits), ruff `B`+`S` (bugbear/bandit), staticcheck `SA*`, shellcheck. For
agent code, widen scope past the latest commits and root-cause from first
principles (Gotcha 3). Re-read every fix and its call sites; compare first-pass
assumptions against the final code line by line.

## Scripts

- [`scripts/multi-pass-runner.sh`](scripts/multi-pass-runner.sh) — runs the
  4-pass loop end to end (pass-1 scan, pass-2 file list to re-read, pass-3
  tests, pass-4 `--fail-on-warning` gate) with a convergence checklist.
  Auto-detects the project scanner/test runner; `ubs` and cargo/npm are
  examples, not requirements. `multi-pass-runner.sh --staged` for the 1-pass
  pre-commit check; `--base <ref>` to override base detection.
- [`scripts/triage-scan.sh`](scripts/triage-scan.sh) — turns a scanner jsonl
  dump into a triageable summary: counts by severity, errors only, unique
  affected files, plus the FP-check cheatsheet. `ubs . --format=jsonl |
  triage-scan.sh`.

## False positives

Reject a finding (with a one-line reason at the site) when:
- **Null:** caller validates / type guarantees non-null / init runs first.
- **Await:** fire-and-forget is intentional.
- **Leak:** RAII / `using` / `with` already scopes cleanup.
- **Security:** input is internal, or external-but-sanitized-before-use.
- **Dead code:** the flagged path never executes.

Suppression discipline: every suppression gets an inline justification tag;
security suppressions need an explicit reviewed reason. Never delete a finding
silently — the suppression IS the audit trail.

## Evidence to record

In your review notes and the PR text: files reviewed; each finding with impact,
file:line, category, and the disambiguating check used; the static-scan command +
exit status; fix-or-reject rationale per finding; pass-by-pass notes (what each
pass found / what was deferred to the next); the convergence checklist state, and
the validation command + result. Test/QA blockers carry the exact failing command
or why it cannot run. On skip (docs/prose-only,
or tiny type-/test-only change already covered by validation) record the one-line
rationale; with no diff the gate is blocked.

---
Provenance: ported and condensed from `jeffery-skills/multi-pass-bug-hunting`
(SKILL.md + references/PATTERNS.md, TRIAGE.md, TOOLS.md). Source scanner is `ubs`
(Ultimate Bug Scanner); substitute the project's actual scanner/test runner.
