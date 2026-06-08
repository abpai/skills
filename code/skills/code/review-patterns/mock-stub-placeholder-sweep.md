# Mock Stub Placeholder Sweep

Catch fake or unwired behavior that makes a PR read as complete while the code path under review still does nothing real.

## When this gate applies

- Diff adds/changes implementation, tests, fixtures, scripts, or generated-looking code (not docs/lockfiles only).
- New or changed API routes, background jobs, scoring/metric code, caching/storage paths, or SSH/network/processing helpers.
- Multi-agent or long-lived-branch diffs where stubs accumulate silently.
- The same concept appears in two files (a consumer + a producer) — a divergent-path risk.

_Auto-suggest fires on test files and on service/job production paths (api/server/workers/routes/jobs). The branch-age and cross-file-divergence cues above are not path-detectable — add this gate manually when they apply._

## Gotchas

1. **Grep locates suspects; it does not prove them.** A keyword match is a lead, not a finding. Read the code and trace the caller before flagging anything. Findings cite caller/consumer impact, not bare matches.

2. **The subtlest fake is a DIVERGENT code path, not a labeled stub.** A function can return a fake while a *different* path already does the real work, so the stub silently wins. Real case (midas-edge): `batch-enrichment.ts` returned `redFlagsDetected: 0` while the consuming API route `transcript-sentiment/route.ts` actually counted them. Hunt it by grepping the shared **concept name** across files — `rg -n 'redFlags|red_flags'` — and if two files implement one concept differently, one is probably the stub.

3. **Caller tracing is the discriminator: output vs signature.** If callers depend on real *output*, it's a stub. If callers only need the *type signature* (trait impl, protocol method, abstract base), it may be intentional — a false positive, skip it. This single rule resolves most ambiguous hits.

4. **`sleep()` is fake work** when it stands in for SSH/network/processing (rch: `run_preflight()` used `sleep()` to fake SSH instead of running it). But you MUST filter out legitimate timing: `| grep -vi 'test|spec|bench|retry|backoff|rate.limit|throttle'`. Without that filter every retry loop reads as a stub.

5. **Hardcoded scores/metrics are stubs too — no English keyword fires.** `rarityScore = 3` (should be computed from history), always-zero DAU/MRR counters that never increment. Scan `score\s*[:=]\s*[0-9]|rarity.*[:=]\s*[0-9]|count.*[:=]\s*0|dau.*[:=]\s*0`. Anything that should be *computed from data* but isn't.

6. **Trivial success has no English keyword either.** Per-language tells grep misses: Rust `Ok(vec![])` / `Ok(Default::default())` / `Ok(String::new())` / `Ok(HashMap::new())`; Python bare `...` ellipsis body (protocol stub); Go `return nil, nil` (error swallowing); TS/JS `return undefined` / `throw new Error('not implemented')`; Java `throw new UnsupportedOperationException`. Empty error arms count: `Err(_) => {}`, `except: pass`, `.unwrap_or_default()`, empty `catch {}`.

7. **501 / "Not Implemented" routes and disabled I/O are stubs hiding as config.** midas-edge `promo/validate/route.ts` returned 501 with no callers. Caching/storage no-ops: `cacheToR2 return false`, `checkCache return null`, `warm: false`, `enable: false // todo`.

8. **Tests can themselves be stubs.** A test file with < 5 real assertions proves nothing. Rank by assertion count: `rg -c 'assert|expect|should' tests/ | sort -t: -k2 -n`. Real case (mcp-agent-mail): an E2E audit found `null_fields` and `unicode` test files were stubs (only 5-7 assertions). Caveat: this MISSES files with many but shallow assertions.

9. **Structural stubs need AST, not keywords.** Single-keyword grep misses *unlabeled* short functions that do nothing substantive. Measure body length and rank shortest-first with ast-grep + jq; functions under ~3 lines in a non-trivial module deserve scrutiny. See [Scripts](#scripts).

10. **A slightly-better stub is still a stub.** Replacing a stub with a marginally less-fake stub is not real code — implement fully or defer **explicitly** as blocked. Oversimplifying a resolution loses functionality. After fixing, re-run the SAME scan targeting zero findings, and delete the TODO marker — a forgotten marker makes the next sweep re-flag stale work.

## Quick pass

1. Build scope from `.workflow/finish-lane/changed-files.txt` (fallback `git diff --name-only`).
2. Keyword + trivial-return + per-language-unimplemented scan over the diff:
   `rg -n 'TODO|FIXME|HACK|XXX|STUB|PLACEHOLDER|MOCK|DUMMY|FAKE|WORKAROUND|KLUDGE|REVISIT|WIP|INCOMPLETE|SKELETON|BOILERPLATE|todo!\(|unimplemented!\(|NotImplementedError|not implemented'`
   (the weak-signal markers — `WORKAROUND`/`KLUDGE`/`WIP`/`INCOMPLETE` — catch
   half-built code that never used a loud `TODO`).
3. For each real-looking suspect, trace its caller — **output-dependent or signature-only?** (Gotcha 3).
4. Check for a divergent path doing the real work elsewhere (grep the concept name, Gotcha 2).
5. Assign each suspect a 4-way disposition + blocker status (see [Deep pass](#deep-pass) taxonomy) and record it.

## Deep pass

Risk-gated escalation for large, generated, or correctness-sensitive diffs:

- **AST short-function rank** for unlabeled structural stubs — `scripts/short-function-rank.sh`.
- **Behavioral grep pack** (fake-work sleep + FP filter, hardcoded metrics, 501, no-op cache, swallowed errors) — `scripts/behavioral-stub-scan.sh`.
- **Stub-test counter** — `scripts/stub-test-counter.sh`.
- Inspect generated artifacts that feed runtime behavior; sample tests to confirm they exercise the real path, not a mock.
- **4-way disposition with a "Real Blocker?" column.** Sort every suspect into exactly one mutually-exclusive bucket:
  - **Just-needs-code** — no external dep, implement now.
  - **Blocked-on-infra** — needs DB schema, API keys, external service; document the blocker.
  - **Dead-code** — no callers, unreachable; deletion candidate.
  - **Intentional-stub** — abstract base / trait impl / protocol method; false positive, skip.

## Scripts

- [`scripts/short-function-rank.sh`](scripts/short-function-rank.sh) — rank functions shortest-body-first via ast-grep + jq. `short-function-rank.sh Rust src/ 3` emits only fns whose body spans < 3 lines.
- [`scripts/behavioral-stub-scan.sh`](scripts/behavioral-stub-scan.sh) — behavioral stub pack with the load-bearing sleep FP filter. `xargs scripts/behavioral-stub-scan.sh < .workflow/finish-lane/changed-files.txt`.
- [`scripts/stub-test-counter.sh`](scripts/stub-test-counter.sh) — flag test files with < 5 assertions. `stub-test-counter.sh tests/`.

## False positives

Named buckets that look like stubs but usually are not — do not flag without caller-output evidence:

- **Signature-only impls** — abstract base, trait impl, protocol/ABC method, `pass`/`...` bodies whose callers need only the type (Gotcha 3).
- **Legit short bodies** — accessors, getters, builder-pattern methods, `return true` inside a feature-flag check (vs a validation fn, which IS a stub).
- **Test fixtures / constants** — a hardcoded return in a fixture is data, not a stub.
- **Old resolved `// TODO`** left behind with no missing work.
- **Filtered timing** — retry/backoff/rate-limit/throttle/test sleeps (the grep filter already excludes them; if one slips through, it is not fake work).
- **Accepted boundary mocks** — test/service-boundary mocks are not automatically findings.
- **Suppression discipline:** do not chase repo-wide legacy placeholders for an ordinary small PR; scope to the diff.

## Evidence to record

In the finish-lane gate decision, record:

- Scan commands run (keyword, AST rank, behavioral pack, stub-test counter).
- Each suspect `file:line`.
- The caller/consumer `file:line` proving wired-or-fake — and whether the caller depends on **output** (stub) or only **signature** (maybe intentional).
- The 4-way disposition + blocker status per suspect (Just-needs-code / Blocked-on-infra / Dead-code / Intentional-stub).
- Reviewed false positives and why they are clean.
- For a skip: the one-line rationale (docs-only, lockfile, vendored/generated, abstract interface, fixture that does not hide the subject under test).
- Re-scan result after any fix — target zero remaining live stubs, stale markers deleted.

---
Provenance: distilled from `jeffery-skills/mock-code-finder` (SKILL.md + references/DETECTION-METHODS.md, AST-PATTERNS.md, RESOLUTION-STRATEGIES.md), scoped to a PR quality gate.
