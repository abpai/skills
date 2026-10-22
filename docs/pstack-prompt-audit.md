# pstack prompt audit (0.4.2)

Audit of every Markdown file in `pstack/skills/pstack/`, one file at a time,
against the `/claude-api prompt-audit` guide. It ran after the approved plan
and verify edits and the trigger rewrites were applied, so it reviews that text.

## Assumptions

- **Scope:** `pstack/skills/pstack/**`. That is `SKILL.md`, `plan.md`,
  `verify.md`, `auto.md`, `principles.md`, `benchmark-checklist.md`, the 21
  `principles/*.md` files, and `agents/openai.yaml`. The plugin manifests carry
  no prompt text beyond their descriptions.
- **Target models:** Claude Opus 5.5, the model running this audit and the one
  Claude Code reads the skill with. Also Codex `gpt-6.1-sol`, which the user
  named as the production Codex model. The Claude guidance is the yardstick.
  Lines added only to steer `gpt-6-luna` are flagged for a re-test on
  `gpt-6.1-sol`.
- **Provenance:** checked with `git log -S` and the upstream checkout
  (`backnotprop/pstack` at `e44668c`).

## Summary

Most of the surface is clean. It has no pressure language, no thinking
scaffolds, no grader vocabulary and no stale paths. Three findings matter:

1. **The mode-file routing sentence is a fix written for one model**
   (`SKILL.md:18-20`). It was added in 0.4.1 because `gpt-6-luna` skipped mode
   files, and it skipped `verify.md` in two runs even after the change.
   Re-test it on `gpt-6.1-sol`. If sol reads the mode files, take the shorter
   wording.
2. **Prove it works checks a probe only when the probe fails**
   (`principle-prove-it-works.md:9-10`). That scoping let a probe that could
   not tell right from wrong pass as evidence (Codex v03, round 5).
3. **Two asides carried over from upstream do not fit a general coding skill**
   (`principle-boundary-discipline.md:15-16`,
   `principle-subtract-before-you-add.md:11`).

Counts: Group 1 (dated prompt text) 4, Group 2 (brittle skill files) 0
remaining, Group 3 (tool descriptions) not applicable, Group 4 (request
config) not applicable.

## Findings

| Location | Evidence | Pattern | Why it no longer fits | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| `SKILL.md:18-20` | "before any other step, read the mode's module file below in full and follow it ... do not infer them" | 1d model-version workaround | Added in `8c395a22` for `gpt-6-luna`. Current models follow a plain instruction, and the luna runs still skipped files with the stronger wording, so the extra force did not do its job. Keep the context, that steps and format live only in the mode file. | Medium | rewrite (see diff); apply only if the `gpt-6.1-sol` rerun reads every mode file |
| `principles/principle-prove-it-works.md:9-10` | "If verification fails, confirm that the check measures the intended thing" | Keep-list 11, re-baselining (add) | Checking a probe only on failure lets a passing or confirming probe through unchecked. In Codex v03 (round 5), a probe that excluded no rows was reported as evidence. | Medium | rewrite (see diff) |
| `principles/principle-boundary-discipline.md:15-16` | "Parse data, build prompts, and calculate scores using that pattern." | 1c padding (kitchen-sink aside) | Upstream's "prompt construction" example from its own domain. The bullet before it already says to keep business functions pure, and current models apply asides where they don't fit. | Medium | rewrite (merge into the previous bullet) |
| `principles/principle-subtract-before-you-add.md:11` | "Remove redundant prompt instructions and excessive templates." | 1c padding (kitchen-sink aside) | A prompt-file aside from upstream ("Simplify prompts") in a principle about code. It pulls prompt edits into unrelated tasks. | Medium | remove |
| `principles/principle-outcome-oriented-execution.md:6,12` | `## Core rule` / `## Guardrails` over five bullets | 1c heavy formatting for behavioral guidance | Two headings over five bullets split one rule into sections. A flat list reads as one rule. | Medium | rewrite (drop headings) |
| `principles.md:4` | "Keep at most five" | 1b/1f numeric ceiling | Reviewed and kept. It guards against a failure seen on the current model: Claude subagent plans listed 6-8 principles at 0.4.1 (keep-list 5). It limits selection, not output length. Re-test it in the rerun. | Low | flag (keep) |
| `verify.md:17-20` | "Run every check that can run here ... Call a check unverified only after attempting it" | 1d model-version workaround | Added in `8c395a22` for `gpt-6-luna` (v07, v09). It also sets the bar for what "unverified" means to whoever reads the report, which is context. | Low | flag (keep; re-test on sol) |
| `principles/principle-minimize-reader-load.md:7` | "Prefer explicit code over clever shortcuts." | 1c generic virtue | Current models already do this, but it costs one line and harms nothing. | Low | flag |
| `principles/principle-script-bulk-operations.md` | four `##` headings | 1c heavy formatting | Reviewed and kept. Removing the headings turns the file into a ten-bullet wall, and the grouping helps. | Low | flag (keep) |

Reviewed and clean: `plan.md`, `auto.md`, `benchmark-checklist.md`,
`agents/openai.yaml`, and the other 15 principle files.
- The numbered steps in `plan.md` stay, because their order is the point: the
  rough draft comes before principle selection.
- The report sections in `verify.md` stay because they pin a format that
  Garage's Evaluator reads (keep-list 7).
- The `**Stop:**` line in Attack the premise is a deliberate single recap
  (keep-list 10).

## Already applied (not audit findings)

These edits were approved in conversation and are in the working tree. They
are listed here so the full change set can be reviewed in one place.

- `plan.md`:
  - Research first, then compare options for unprecedented open decisions
    (Exhaust).
  - Then a rough draft, then select principles against the task, findings and
    draft.
  - Then revise, and recheck to drop principles that changed nothing.
- `verify.md`: the plan is optional, and the request can come from a pull
  request's description or linked issue. The report says when the request is
  only the PR's own description.
- `principles.md`: "Keep at most five", and 13 trigger rows rewritten against
  the upstream descriptions. The opening line of each matching principle file
  was aligned with its row.

## Proposed diff

One finding per hunk. The Prove it works, Boundary discipline, Subtract
before you add, and Outcome-oriented execution hunks were applied in 0.4.2.
The `SKILL.md` routing hunk waits on the `gpt-6.1-sol` rerun: apply it only
if sol reads the mode file in every mode run.

```diff
diff --git a/pstack/skills/pstack/SKILL.md b/pstack/skills/pstack/SKILL.md
--- a/pstack/skills/pstack/SKILL.md
+++ b/pstack/skills/pstack/SKILL.md
@@ -15,9 +15,9 @@
 Take the first token of `$ARGUMENTS` as the mode, strip a leading `--`, and
 match it case-insensitively. If it is not exactly `plan`, `verify`, or `auto`,
 show `pstack plan|verify|auto [task]` and stop; do not map synonyms such as
-`review`. Otherwise, before any other step, read the mode's module file below
-in full and follow it. The steps and report format of each mode exist only in
-that file; do not infer them. Treat the remaining arguments as its input:
+`review`. Otherwise read the mode's module file below and follow it; the steps
+and report format of each mode exist only in that file. Treat the remaining
+arguments as its input:
 
 - `plan` → [plan.md](plan.md): the task to plan.
 - `verify` → [verify.md](verify.md): the original request and the
diff --git a/pstack/skills/pstack/principles/principle-boundary-discipline.md b/pstack/skills/pstack/principles/principle-boundary-discipline.md
--- a/pstack/skills/pstack/principles/principle-boundary-discipline.md
+++ b/pstack/skills/pstack/principles/principle-boundary-discipline.md
@@ -11,9 +11,8 @@
 - Use application concepts in public interfaces. Keep network, storage, and
   framework-specific types inside the code that connects to those systems.
 - Keep business functions pure: compute outputs from inputs without reading
-  or changing outside state.
-- Parse data, build prompts, and calculate scores using that pattern. Keep
-  input/output handling and framework code around those functions.
+  or changing outside state. Keep input/output handling and framework code
+  around those functions.
 - Handle invalid input and external-system failures explicitly. Pass other
   errors to the code responsible for handling them.
 
diff --git a/pstack/skills/pstack/principles/principle-outcome-oriented-execution.md b/pstack/skills/pstack/principles/principle-outcome-oriented-execution.md
--- a/pstack/skills/pstack/principles/principle-outcome-oriented-execution.md
+++ b/pstack/skills/pstack/principles/principle-outcome-oriented-execution.md
@@ -3,14 +3,9 @@
 For planned rewrites or migrations that run in phases, where intermediate
 states tempt compatibility code.
 
-## Core rule
-
 - Prioritize the intended, verified end state over keeping every intermediate
   step working. Avoid temporary compatibility code that becomes lasting debt.
 - Temporary breakage is acceptable when it is planned, scoped, and reversible.
-
-## Guardrails
-
 - Define the phases and where temporary breakage is acceptable before starting.
 - Check the affected areas throughout the work and verify correctness at each
   planned checkpoint.
diff --git a/pstack/skills/pstack/principles/principle-prove-it-works.md b/pstack/skills/pstack/principles/principle-prove-it-works.md
--- a/pstack/skills/pstack/principles/principle-prove-it-works.md
+++ b/pstack/skills/pstack/principles/principle-prove-it-works.md
@@ -6,8 +6,9 @@
 - Observe live state directly where it matters; agent self-reports,
   timestamps, summaries, and cached results are not proof of the behavior
   being checked.
-- If verification fails, confirm that the check measures the intended thing
-  before deciding what is wrong with the system.
+- Before relying on a check's result, pass or fail, confirm it can tell
+  correct behavior from incorrect, for example by expecting a different
+  result from inputs the change should affect.
 - Prefer deterministic checks: repeat the same comparison with the same inputs
   and expected result. Use
   [Script Bulk Operations](principle-script-bulk-operations.md) where helpful.
diff --git a/pstack/skills/pstack/principles/principle-subtract-before-you-add.md b/pstack/skills/pstack/principles/principle-subtract-before-you-add.md
--- a/pstack/skills/pstack/principles/principle-subtract-before-you-add.md
+++ b/pstack/skills/pstack/principles/principle-subtract-before-you-add.md
@@ -8,7 +8,6 @@
 - Design for current requirements and how the system is actually used.
 - Add input validation, parsing, and defensive checks for specific requirements
   or failure cases.
-- Remove redundant prompt instructions and excessive templates.
 - Delete references that add no new information rather than leaving empty stubs.
 
 Related principles:
```
