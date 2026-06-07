# UBS Static Risk Scanner

Use the finish-lane UBS artifacts first, then triage the actionable source findings into real bug, justified false positive, or tool blocker. UBS catches what compiles but crashes, and it cries wolf often, so structured source-only triage is the whole job.

## When this gate applies

- Changed code-like files in the diff: implementation, scripts, CLI/API, parsing, trust boundaries, async, resource lifecycle, error handling.
- Diff is AI-generated/AI-edited (this gate runs in an AI PR pipeline scanning AI-written code).
- `ubs` is on PATH (`command -v ubs`); if absent, finish-lane records `status: skipped` and you fall back to manual review against the risk categories below.

## Gotchas

1. **Finish-lane is the source of truth for PR prep.** Read `.workflow/finish-lane/ubs-summary.md` before running ad hoc commands. The helper scans supported changed source files only, skips tests/fixtures/generated/unsupported files, and writes raw scanner artifacts under `.workflow/finish-lane/`.

2. **Do not narrate raw output counts.** `ubs` can emit one JSONL record per check, including zero-count `good`/`info` records. Treat `exit 1, N output lines` as implementation noise. Use finish-lane's severity totals and actionable source findings instead.

3. **Finish-lane runs deterministic artifacts.** The helper invokes `ubs --ci --beads-jsonl=<path> --report-json=<path> <source files>`, captures stdout/stderr separately, and caps raw fallback logs. Do not add unsupported/no-op flags such as `--profile=loose` or `--skip=11,12`.

4. **Exit `2` or timeout is a TOOL FAILURE, never clean.** Run `ubs doctor --fix` if available — usually a missing AST/scanner engine, and JS/TS semantic analysis can silently degrade without it. Never treat exit 2 or `status: timeout` as a pass. (`0` clean, `1` advisory findings, `2` doctor/tool failure.)

5. **Category numbers are advisory metadata, not the primary filter.** The finish-lane helper filters after parsing so tests, fixtures, generated files, and known noise categories stay out of the primary action prompt while raw artifacts remain available:
   - **Block commit (1-5):** null safety · security · async/await · resource/memory leak · type coercion.
   - **Block merge (6-10):** division-by-zero · resource lifecycle · error swallowing · unhandled promise · array mutation.
   - **Discuss only (11-14):** debug code · TODO/FIXME/HACK/XXX · `any` · deep nesting (>4).

6. **The four signature AI-code bugs** (expect these before scanning AI diffs): `obj.a.b` no null check (cat **1**) · `fetch(url)` missing await (cat **3**) · `open(file)` never closed (cat **4**) · `catch(e){}` swallowed (cat **8**). Pre-empt them; then rescan with the same finish-lane/ad hoc command.

7. **Severity x Confidence triage matrix** (not flat reachability):
   - High-sev / High-conf -> fix immediately, **never suppress**.
   - High-sev / Low-conf -> investigate first, then fix or justify.
   - Low-sev / High-conf -> fix if easy, defer if complex.
   - Low-sev / Low-conf -> document and defer to future cleanup.

8. **FP decision tree — three FP exits, one real-bug exit:**
   - Code path never executes -> **FP (dead code)** — remove it.
   - Guard clause / `?.` / `??` exists upstream -> **FP (`ubs:ignore`)**.
   - Validated elsewhere (caller / API / schema, cross-file) -> **FP (cross-file)**.
   - Else -> **REAL BUG**, fix at root cause (not the symptom).

9. **Rationalization blacklist — these phrases mean the finding is REAL, not an FP:** "it works in practice" (luck isn't safety) · "always been this way" (tech debt) · "data is always valid" (data changes) · "users won't do that" (users do everything). **Golden rule:** if you must think hard about whether it's an FP, treat it as real and add the guard — a redundant check costs ~nothing, a missed bug costs a lot.

10. **Per-category legit suppression reason** (a suppression that doesn't match its category's one valid pattern is itself a red flag):
   - null (1) = validated by caller/API/schema · async (3) = intentional fire-and-forget (logging/analytics) · leak (4) = app-lifetime global singleton · coercion (5) = `== null` to catch both null and undefined · error-swallow (8) = cleanup that mustn't fail the main op.

11. **Suppression token is `ubs:ignore — reason`, with the right comment prefix or the scanner ignores it** and the finding stays open: `//` (JS/TS/Go/Rust/Java) · `#` (Python/Ruby/Shell) · `--` (SQL). Wrong prefix = silently unresolved.

12. **Never suppress just to make the scan pass.** Forbidden when: you're not sure it's safe · you don't understand the code · you only want exit 0. Suppress ONLY when ALL true: verified safe + UBS structurally can't see the guarantee (cross-file / runtime / API contract) + comment says WHY.

13. **Per-language known FPs UBS reliably cries wolf on:**
    - **JS/TS:** `?.`/`??` ARE the guard · `const [a,b] = await Promise.all([...])` destructure · `analytics.track()` fire-and-forget · `useState<T|null>(null)` then render needs a loading guard.
    - **Python:** `raise` re-raise is not swallowed · binary `open(...,'rb')` needs no `encoding=` · `eval('2+2')` literal vs input (prefer `literal_eval`) · context-manager wrappers.
    - **Go:** interface-nil vs concrete-nil · `defer` in loop (wrap in `func(){...}()`) · best-effort `_ = w.Flush()` · goroutine bounded by `main()`.
    - **Rust:** `unwrap()` in tests/CLI-`main` (panic-with-backtrace IS the UX) · safe `unsafe{}` FFI wrappers · `tokio::spawn` fire-and-forget cleanup.
    - **Java:** `@Autowired` / Spring-managed resources · wrap-and-rethrow as `RuntimeException` (not swallowed) · `AutoCloseable` returned to caller (caller closes).

## Quick pass

1. Read `.workflow/finish-lane/ubs-summary.md`.
2. If `status: skipped`, record the skip reason and do the manual risk review.
3. If `status: tool-failure` or `status: timeout`, inspect `.workflow/finish-lane/ubs-raw.log`, run `ubs doctor --fix` if available, then rescan.
4. If `status: advisory-findings`, triage only the listed actionable source findings first: run the FP decision tree (gotcha 8), then the severity x confidence matrix (gotcha 7).
5. Fix real bugs at root cause; add `ubs:ignore — <category-legit-reason>` (gotcha 10) with the correct comment prefix for genuine FPs.
6. Rerun finish-lane or the same structured UBS command and document the new summary status.

## Deep pass

- **Big/legacy diff drowning in findings:** baseline/regression mode — `ubs . --report-json=baseline.json` on base, then `ubs . --comparison=baseline.json` on the branch surfaces only NEW issues.
- **Trust boundary or confirmed real bug:** trace callers and tests around each finding, fix at root cause, then rerun the scanner plus the targeted behavior tests that exercise the fixed path.
- **Triage by priority on a flood:** parse the JSONL/report artifacts and inspect `critical` first, then `warning`, then security, then async.

## Scripts

None ported. The source skill's `validate.py` only checks the original multi-file skill's folder layout (frontmatter, line budgets, referenced docs), which this single-file lens does not use — no executable asset is worth porting.

## False positives

- **Three FP buckets** (the only legit exits): dead code · guard-clause/`?.`/`??` upstream · cross-file validation (caller/API/schema). See gotcha 13 for the per-language catalog of where UBS predictably mis-fires.
- **Rationalization blacklist** (gotcha 8): "works in practice" / "always been this way" / "data is always valid" / "users won't do that" all mean REAL.
- **Suppression discipline** (gotcha 12): never to make the scan pass; only verified-safe + UBS-structurally-blind + WHY-comment, written with the right per-language `ubs:ignore` prefix (gotcha 11) and matching the category's one legit reason (gotcha 10).

## Evidence to record

In the finish-lane gate notes: the UBS summary status, severity totals, actionable source finding list, each triage outcome (real / FP-reason / blocked), file:line for every fix and suppression, and the rerun summary status. For tool failures/timeouts, attach the raw fallback log path and `ubs doctor` output if run. For skips, record the reason (`ubs` absent, no supported source files, or generated/vendor/test-only scope).

## Skip when

Docs-only, generated/vendor/lockfile-only, or no-code diffs. If `ubs` is absent, record the `command -v ubs` failure and fall back to manual review against the 14 categories above.
