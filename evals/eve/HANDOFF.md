# Hand-off: Eve eval lane, prose-compliance → outcome

**PR:** [#127](https://github.com/abpai/skills/pull/127) · base `simplify/trim-eng` · MERGEABLE
**Scope of this hand-off:** the original 10 commits from `b045c9b` to `50ef58a`,
plus the reviewer fixes described below.

## Read this first

The open pruning defect is fixed at three levels: skill instructions, fixture
enforcement, and verifier isolation. Deterministic controls and two clean
subagent dogfood runs pass.

The external live-provider eval was not rerun during review. It sends
repo-derived prompts and fixtures to an external model provider, so it needs
explicit authorization. Do not report that lane as green until it runs.

## Why the work happened

The lane had 34 evals and 133 assertions, all green, protecting a 22-PR
simplification of every skill. Reading a *passing* run's event stream showed the
green was worth less than it looked:

- Two "restraint" gates asserted no tool call named `Edit` or `Write`. Eve never
  advertises those names — its write tool is `write_file`. **The predicates were
  vacuously true for every possible model behavior.**
- Only `smoke` asserted `noFailedActions`. Three evals called
  `load_skill("engineering/reduce")`, got `Expected skill id to be a non-empty
  safe path segment`, and **passed anyway**.
- Every sandbox `/workspace` was empty and every contract prompt was worded to
  prevent work — "don't touch anything yet", "just tell me". **Nothing a skill
  produced was ever run**, so no eval could fail when a skill's advice was wrong.

## What changed

### 1. Assertions that can fail

| before | after |
|---|---|
| `name === "Edit"` — never matches | `write_file`, via `evals/support/tools.ts` |
| a typo passes silently forever | `KNOWN_TOOLS` lookup **throws** on an unknown name |
| nothing keeps that list honest | `bun run tools:audit` fails if a called tool is undeclared |
| `noFailedActions` on 1 of 34 | on all of them |
| shell exit codes unchecked | `noFailedShell(allow)`, with per-eval allowances |

The two injection evals documented *why* they skipped `noFailedActions` — the
session parser exits non-zero on a fabricated UUID. That reasoning was wrong:
`noFailedActions` keys on tool-call **status**, and a bash call exiting 1 still
resolves `completed`. Both signals are now asserted separately.

### 2. `load_skill` module-path gap

Umbrella packs say *"load the sibling module `./<subcommand>.md`"*, which is
correct for hosts where "load" means reading the file. Fixed in
`agent/instructions.md`. **The packs are unchanged** — the harness was the odd
one out.

### 3. Ablation you can trust

- `classify()` folded `errored` into `KILLED`. Broken infrastructure read as
  proof the cut text mattered. `ERROR` is now its own classification.
- Every entry proves a **green baseline** on the unmutated pack first. Without
  it, an eval red for an unrelated reason reports KILLED for every ablation
  aimed at it.

### 4. Outcome evals

`evals/outcomes/`, tagged `outcome`. The model gets a fixture in the prompt,
returns real work, and that work is **executed against a suite it never saw**.

**Model-produced code never runs on the host.** The subject sandbox does not
receive the hidden suite. After the model replies, the eval driver mounts the
candidate and hidden suite read-only in a second restricted Docker container.
That container has no network, no host secrets, a read-only root, no Linux
capabilities, process and memory limits, and a non-root user.

This is isolation from accidental host access, not a security boundary for
hostile code. The candidate can inspect files mounted in its verifier container,
so the hidden suite is an outcome check, not an anti-cheating boundary.

### 5. Incidental fixes

- **`prepare-skills` rewrote everything every run.** Harmless by hand; not once
  every eval script runs it first, because Eve's dev server watches
  `agent/skills/` and rebuilt artifacts under in-flight turns. Now syncs by
  content.
- **That fix exposed a worse bug.** Removing files left their directories, so
  `--omit <skill>` left an empty husk and the skill was never absent. **Every
  retirement ablation had been measuring a still-present skill.**
- `EVE_DEV` defaults to 0 — sandbox chatter is opt-in (30 log lines → 0).
- `harness-d7-safety-cap`: 3 judges → 1, mechanical and deterministic, 9/9 live.

## Current state

| metric | value |
|---|---|
| eval files | 36 |
| live-tagged | 35 |
| outcome-tagged | 2 |
| judge (`closedQA`) calls | 20, down from 22 |
| fixtures | `normalize-config`, `prune-tests` |

**Green:** deterministic controls, typecheck, mock smoke, and two clean
subagent dogfood runs.
**Live-provider status:** not rerun after the reviewer fix.
**Red, pre-existing, not caused by this work:** `contracts/distill-default-format`
— proved with a control (removed my instructions change, still failed 3/3).

## Reviewer resolution

`outcomes/code-simplify-protects-guards` grades a real test-pruning pass by
**mutation score** — three faults planted in the module, each guarded by one
protected test. A suite that drops a guard goes green against its fault.

Review found that the verifier did not enforce its stated compile-time proof.
The fixture was JavaScript, and the `@ts-expect-error` line was never passed to
TypeScript. A comment marker was the only gate.

The fix:

- gives the fixture a checked JSDoc contract;
- runs `tsc --allowJs --checkJs --noEmit` in the restricted verifier container;
- keeps runtime, typecheck, mutation, and required-marker results separate;
- makes `simplify.md` map each protected test to its real enforcement lane;
- warns that a green default test run is not coverage proof for compile-time or
  environment-gated guards.

Deterministic controls prove that the full fixture passes and that deleting only
the directive leaves runtime green but makes typecheck fail. Two fresh subagent
dogfood runs reduced eight tests to five and kept the runtime boundary, missing
session case, secret/public shape, compile-time proof, and environment-gated
quota guard.

The exact live-provider outcome remains unverified after these changes.

## What a reviewer should check

1. **The verifier has two isolation layers.** The subject container cannot see
   the hidden suite. Model-produced code runs only in the second restricted
   container. Review the image pin and Docker limits in
   `evals/support/outcome.ts`.
2. **The compile-time guard is real.** Delete only `@ts-expect-error`; runtime
   stays green and `typecheckGreen` becomes false.
3. **`normalize-config` is UNGUARDED and labelled as such.** With `code` omitted
   entirely, all its outcome gates still pass — the base model tidies a small
   module correctly unaided. It proves the machinery, not the skill. Kept
   deliberately; do not cite it as evidence the rubric works.
4. **Fixture design rule.** `prune-tests` originally labelled each test
   `// N. PROTECTED —` / `// N. NOISE —`. With the answer key present, both the
   skill run and the omit control passed everything. **Fixtures must not
   narrate their own grading.**
5. **Every new fixture needs the four-candidate validation** before it is
   trusted — unchanged input, careless rewrite, correct rewrite, no code block.
   Two must fail. See the README table.
6. **The omit control is mandatory.** A green outcome eval means nothing until
   you have shown it fails without the skill.

## Dogfood ledger

| pass | observation | cause | result |
|---|---|---|---|
| first | behavior was correct, but Git evidence was unavailable | the temporary target was not a Git repository | fixture corrected |
| second | eight tests reduced to five; every runtime, typecheck, and gated lane passed | none | clean |
| third | same five-test result and proof; no material instruction friction | none | clean |

## Known operational issue

Eve accumulates `.eve/.workflow-data` without bound. At 568 MB / 89,718 files
**every eval timed out past 280s**, including prose evals that normally take
seconds. Both `.eve/.workflow-data` and `.eve/evals/` are untracked caches;
delete them when runs get slow. Documented in the README.

The current copies were moved to the session scratchpad rather than deleted, so
they are recoverable if anything is needed from them.

## Not done

- Steps 3 and 5 of the agreed plan: the remaining two `harness` judge → mechanical
  conversions (`onboard-verdict-gate`, `scanner-unavailable`), and the routing
  restructure.
- `contracts/distill-default-format` is still red and unexplained.
- The post-fix live-provider outcome eval has not run.

## Cost note

Do not assume the suite is cheaper. Outcome runs add tool turns, and merging
eval files does not remove model calls. Bun auto-loads `.env.local`. To force
the mock smoke path when that file contains provider keys, run:

```bash
OPENAI_API_KEY= ANTHROPIC_API_KEY= bun run eval:smoke
```
