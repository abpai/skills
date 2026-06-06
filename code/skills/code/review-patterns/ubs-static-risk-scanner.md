# UBS Static Risk Scanner

Run `ubs` on the changed files, then triage every finding into real bug, justified false positive, or tool blocker — UBS catches what compiles but crashes, and it cries wolf often, so triage is the whole job.

## When this gate applies

- Changed code-like files in the diff: implementation, scripts, CLI/API, parsing, trust boundaries, async, resource lifecycle, error handling.
- Diff is AI-generated/AI-edited (this gate runs in an AI PR pipeline scanning AI-written code).
- `ubs` is on PATH (`command -v ubs`); if absent, fall back to manual review against the 14 categories below.

## Gotchas

1. **`--only=js` EXCLUDES TypeScript.** `js != ts`. For TS use `--only=ts,tsx`. A wrong `--only` silently scans nothing and reports a clean-looking exit 0. (`ubs --only=ts,tsx frontend/`, `ubs --only=go,rust src/`.)

2. **`--format=json` is summary-only; use `--format=jsonl` for per-finding detail.** Parsing `json` for individual findings gives you nothing. `--format=sarif` for GitHub/IDE. `--profile=loose` skips minor nits. `.ubsignore` (e.g. `test-fixtures/`, `generated/`) kills fixture/generated FP storms.

3. **Exit `2` is a TOOL FAILURE, never clean.** Run `ubs doctor --fix` — usually a missing AST/scanner engine, and JS/TS semantic analysis silently degrades without it. Never treat exit 2 as a pass. (`0` clean, `1` triage, `2` doctor.)

4. **14-category taxonomy; the category NUMBER is the flag** (`--skip=N`, `--category=N`):
   - **Block commit (1-5):** null safety · security · async/await · resource/memory leak · type coercion.
   - **Block merge (6-10):** division-by-zero · resource lifecycle · error swallowing · unhandled promise · array mutation.
   - **Discuss only (11-14):** debug code · TODO/FIXME/HACK/XXX · `any` · deep nesting (>4). Drop noise with `--skip=11,12`; focused scan with `--category=2` (or `--category=security`).
   The number gives you both the noise lever and the built-in severity ordering.

5. **The four signature AI-code bugs** (expect these before scanning AI diffs): `obj.a.b` no null check (cat **1**) · `fetch(url)` missing await (cat **3**) · `open(file)` never closed (cat **4**) · `catch(e){}` swallowed (cat **8**). Pre-empt them; then `ubs <file> --fail-on-warning`.

6. **Severity x Confidence triage matrix** (not flat reachability):
   - High-sev / High-conf -> fix immediately, **never suppress**.
   - High-sev / Low-conf -> investigate first, then fix or justify.
   - Low-sev / High-conf -> fix if easy, defer if complex.
   - Low-sev / Low-conf -> document and defer to future cleanup.

7. **FP decision tree — three FP exits, one real-bug exit:**
   - Code path never executes -> **FP (dead code)** — remove it.
   - Guard clause / `?.` / `??` exists upstream -> **FP (`ubs:ignore`)**.
   - Validated elsewhere (caller / API / schema, cross-file) -> **FP (cross-file)**.
   - Else -> **REAL BUG**, fix at root cause (not the symptom).

8. **Rationalization blacklist — these phrases mean the finding is REAL, not an FP:** "it works in practice" (luck isn't safety) · "always been this way" (tech debt) · "data is always valid" (data changes) · "users won't do that" (users do everything). **Golden rule:** if you must think hard about whether it's an FP, treat it as real and add the guard — a redundant check costs ~nothing, a missed bug costs a lot.

9. **Per-category legit suppression reason** (a suppression that doesn't match its category's one valid pattern is itself a red flag):
   - null (1) = validated by caller/API/schema · async (3) = intentional fire-and-forget (logging/analytics) · leak (4) = app-lifetime global singleton · coercion (5) = `== null` to catch both null and undefined · error-swallow (8) = cleanup that mustn't fail the main op.

10. **Suppression token is `ubs:ignore — reason`, with the right comment prefix or the scanner ignores it** and the finding stays open: `//` (JS/TS/Go/Rust/Java) · `#` (Python/Ruby/Shell) · `--` (SQL). Wrong prefix = silently unresolved.

11. **Never suppress just to make the scan pass.** Forbidden when: you're not sure it's safe · you don't understand the code · you only want exit 0. Suppress ONLY when ALL true: verified safe + UBS structurally can't see the guarantee (cross-file / runtime / API contract) + comment says WHY.

12. **Per-language known FPs UBS reliably cries wolf on:**
    - **JS/TS:** `?.`/`??` ARE the guard · `const [a,b] = await Promise.all([...])` destructure · `analytics.track()` fire-and-forget · `useState<T|null>(null)` then render needs a loading guard.
    - **Python:** `raise` re-raise is not swallowed · binary `open(...,'rb')` needs no `encoding=` · `eval('2+2')` literal vs input (prefer `literal_eval`) · context-manager wrappers.
    - **Go:** interface-nil vs concrete-nil · `defer` in loop (wrap in `func(){...}()`) · best-effort `_ = w.Flush()` · goroutine bounded by `main()`.
    - **Rust:** `unwrap()` in tests/CLI-`main` (panic-with-backtrace IS the UX) · safe `unsafe{}` FFI wrappers · `tokio::spawn` fire-and-forget cleanup.
    - **Java:** `@Autowired` / Spring-managed resources · wrap-and-rethrow as `RuntimeException` (not swallowed) · `AutoCloseable` returned to caller (caller closes).

## Quick pass

1. List changed code-like files (changed-files.txt / staged / PR diff).
2. Run: `ubs --staged` (commit prep) or `ubs --diff` / `ubs <files>` (PR prep). TS-only tree -> `--only=ts,tsx`.
3. Read exit: `0` clean · `1` triage · `2` `ubs doctor --fix` then rescan.
4. Per finding: run the FP decision tree (gotcha 7), then the severity x confidence matrix (gotcha 6). Note its category number.
5. Fix real bugs at root cause; add `ubs:ignore — <category-legit-reason>` (gotcha 9) with the correct comment prefix for genuine FPs.
6. Rerun the same scan to exit 0, or document remaining justified suppressions.

## Deep pass

- **Big/legacy diff drowning in findings:** baseline/regression mode — `ubs . --report-json=baseline.json` on base, then `ubs . --comparison=baseline.json --fail-on-warning` on the branch surfaces only NEW issues.
- **Trust boundary or confirmed real bug:** trace callers and tests around each finding, fix at root cause, then rerun the scanner plus the targeted behavior tests that exercise the fixed path.
- **Triage by priority on a flood:** `ubs . --format=json | jq '.findings[] | select(.severity=="critical")'`, then security, then async.

## Scripts

None ported. The source skill's `validate.py` only checks the original multi-file skill's folder layout (frontmatter, line budgets, referenced docs), which this single-file lens does not use — no executable asset is worth porting.

## False positives

- **Three FP buckets** (the only legit exits): dead code · guard-clause/`?.`/`??` upstream · cross-file validation (caller/API/schema). See gotcha 12 for the per-language catalog of where UBS predictably mis-fires.
- **Rationalization blacklist** (gotcha 8): "works in practice" / "always been this way" / "data is always valid" / "users won't do that" all mean REAL.
- **Suppression discipline** (gotcha 11): never to make the scan pass; only verified-safe + UBS-structurally-blind + WHY-comment, written with the right per-language `ubs:ignore` prefix (gotcha 10) and matching the category's one legit reason (gotcha 9).

## Evidence to record

In the finish-lane gate notes: exact command, exit code, the finding list with **category numbers**, each triage outcome (real / FP-reason / blocked), file:line for every fix and suppression, and the rerun exit code. For exit 2, attach `ubs doctor` output. For skips, record the reason (docs-only, generated/vendor/lockfile-only, no-code, or `ubs` absent with the `command -v ubs` failure).

## Skip when

Docs-only, generated/vendor/lockfile-only, or no-code diffs. If `ubs` is absent, record the `command -v ubs` failure and fall back to manual review against the 14 categories above.
