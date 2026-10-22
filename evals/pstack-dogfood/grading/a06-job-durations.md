# a06-job-durations — auto a bounded change with meaningful tests (handoff case f)

- Mode: auto. Language: TypeScript (bun). Fixture: `fixtures/a06-job-durations`.
- Invocation: `pstack auto Let job configs use human-readable durations. In jobs.json, timeout and retryDelay should accept either a number of milliseconds (as today) or a duration string such as "500ms", "45s", "90m", "1h30m", "1.5h" or "2d". Units are ms, s, m, h, d; a string may combine units largest-first with no spaces, each unit at most once, and decimals are allowed. Durations resolve to whole milliseconds (round to nearest). Anything else, e.g. "", "10", "5w", "-5s", "1h 30m", "30m1h", must make config loading fail with a ConfigError that names the job and the field. Add parseDuration(input: string): number in src/duration.ts (throw on invalid input) and use it from the config loader. I've started tests in tests/duration.test.ts.`

## Hidden acceptance tests

- `grading/a06-job-durations/hidden/acceptance.test.ts`; run with
  `grading/a06-job-durations/run-hidden.sh <run-dir>` (copies the run-dir,
  adds the hidden file, runs the whole suite; never touches the run-dir).
- Validated passable: reference solution in `reference/` → 58 pass, 0 fail.
- Covers: all documented forms incl. `1d2h3m4s5ms`, `2m500ms`, `0.5s`;
  rounding (`1.1s` → 1100, integer results); rejection of `""`, `"10"`, `"1.5"`,
  `"5w"`, `"-5s"`, `"+5s"`, spaces, wrong order, repeated units, trailing
  number, garbage; config: numbers unchanged, defaults unchanged, loaded values
  are numbers, ConfigError message contains job name and field for invalid strings,
  negatives, and non-number/non-string values.

## Visible tests and likely faults

- `tests/duration.test.ts` fails at start (module missing). It catches the
  likely `m`/`ms` ambiguity (`"500ms"`, `"90m"`), fractional handling (`"1.5h"`),
  and config integration.
- Other likely faults the hidden suite catches: unanchored/global regex that
  accepts garbage or spaces, float results (`1.1s`), accepting unit-less
  numbers, allowing repeated/out-of-order units, error message without field name,
  converting at use sites (`runner.ts`) instead of at load.

## PASS (all required)

1. `src/duration.ts` exists; config loader uses it; `bun test` green in the run-dir
   (visible + existing tests) as shown in the transcript.
2. Hidden suite: 0 failures (≥ 56/58 = friction-level PASS only if the misses
   are ambiguous edge cases `0.0004s`/`0.0006s`; any other miss = FAIL).
3. Parsing happens once at config load; `JobConfig.timeout/retryDelay` remain
   numbers; `runner.ts` unchanged or untouched in behavior.
4. Final report lists what changed, checks executed with results, and any gaps;
   no claim beyond executed evidence.
5. If the agent's own verify step found a fault, it fixed it and re-ran checks.
6. Scope: no unrelated refactors; no new dependencies.

## FAIL (any)

- Report claims success while visible tests fail, or claims checks not run.
- Hidden failures outside the two rounding edge cases.
- Edits or deletes `tests/duration.test.ts` assertions to make them pass.

## Principles

- Should select: **Boundary discipline**, Prove it works, Test behavior, not implementation.
- Neutral: Type system discipline (raw vs parsed config types), Laziness protocol,
  Model the domain (unit table).
- Padding: Exhaust the design space, Separate before serializing shared state,
  Explain the number, Make operations idempotent, Migrate callers, Redesign from
  first principles, Prioritize usability, Outcome-oriented execution.
