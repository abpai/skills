# Clean Code

Workflow module for `/engineering:clean-code`.

Principles are derived from `labs42io/clean-code-typescript`, MIT licensed
(`Copyright (c) 2019 Labs42 <hello@labs42.io>`), cloned for this package review
from `https://github.com/labs42io/clean-code-typescript` at commit
`05a25e8fb8f4cdca4e6cfbddd60323c6ddc5aa54`. No upstream examples are vendored.

Use this workflow when the user asks for a clean-code review, TypeScript code
quality audit, readable/refactorable-code pass, or wants principles from
`clean-code-typescript` converted into enforceable checks plus agent judgment.

## Scope

Apply the clean-code review outside TypeScript when the target language has
matching evidence: naming, function shape, side effects, errors, tests,
comments, duplication, and cohesion are language-agnostic. Scanner coverage is
adapter-based: JS/TS has the broadest deterministic coverage; Python gets a
smaller AST/comment subset. Other languages are not scanned until an adapter is
added; mark scanner coverage `unreviewed` and continue with agent-owned review.

## Core split

- The bundled scanner owns deterministic/static lead generation. It detects
  patterns a repo-agnostic tool can see without pretending to prove design
  quality: too many parameters, boolean flag parameters, commented-out code,
  journal comments, positional marker comments, bare TODOs, non-Error
  throws/rejections, empty catches/rejections, type-check conditionals,
  negative conditionals, defaulting with `||`, prototype mutation, and
  oversized functions/classes.
- The scanner emits **leads**, not verdicts. A lead becomes a finding only after
  an agent reads surrounding code and confirms the current pattern hurts
  readability, reuse, refactorability, testing, or error handling.
- Semantic judgment stays in this module: naming quality, domain vocabulary,
  duplicate-code intent, abstraction level, side effects, conditionals,
  object/class boundaries, SOLID tradeoffs, test intent, async flow, import
  organization, and whether a formatter/linter already owns a concern.

Do not add scanner scripts to product repos. The scanner is bundled with this
plugin; scanner output is temporary evidence for the report.

## Fast path

From this plugin checkout when dogfooding the skills repo:

```bash
python3 engineering/skills/engineering/scripts/clean_code_scan.py . --format markdown
python3 engineering/skills/engineering/scripts/clean_code_scan.py . --format json
```

For any other target repo, locate this `clean-code.md` module beside the
umbrella `engineering` `SKILL.md` and run the bundled script with the target
repo as an argument:

```bash
python3 <that-directory>/scripts/clean_code_scan.py <repo> --format markdown
```

If Python is unavailable, skip deterministic scanning and say so. Continue with
the agent-owned review dimensions, but mark scanner facts `unreviewed`.

## Process

1. Establish scope: repository root, target files/area, language/runtime,
   framework, existing formatter/linter/test commands, and any review concern.
   Done when the report can state exactly which files/areas and enforcement
   tools were considered.
2. Run the scanner unless the scope is prose-only or no repo path exists.
   Done when the report includes the command/result, or says scanner coverage
   was `unreviewed` with the reason.
3. Inspect each high-signal lead before promoting it. Read the enclosing
   function/class/module and any nearby tests. Do not report scanner noise.
   Done when every promoted finding cites surrounding code evidence and every
   skipped high-signal lead has a reason.
4. Check the agent-owned dimensions below. Prefer evidence over principle
   recitation: cite exact files/lines and explain the maintenance risk.
   Done when each reviewed dimension has a verdict, evidence, or a clear
   `not reviewed` note.
5. Separate deterministic scanner leads from semantic findings in the report.
   Done when the output has distinct `scanner_owned`, `promoted_findings`, and
   `review_prompts` channels for substantial reviews.
6. If the user wants fixes, implement only selected findings unless they expand
   the scope.

## Evidence channels

Emit three channels in substantial reviews:

- `scanner_owned`: deterministic/static leads from `clean_code_scan.py`.
- `promoted_findings`: scanner leads or semantic concerns that were confirmed by
  code inspection and deserve action.
- `review_prompts`: agent-only questions from the taxonomy that were checked
  but cannot be proven by the scanner.

## Deterministic rule family

Scanner categories:

- `too_many_parameters` - functions/methods with more than two parameters.
- `boolean_flag_parameter` - boolean parameters that likely select behavior.
- `oversized_function` - long functions worth splitting or deepening.
- `oversized_class` - large classes with many lines or methods.
- `type_check_conditional` - `typeof`/`instanceof` branching that may hide
  polymorphism or discriminated-union opportunities.
- `negative_conditional` - negated conditions that may hurt readability.
- `short_circuit_default` - `x = x || fallback` style defaulting that can
  mishandle valid falsy values.
- `non_error_throw` - throwing or rejecting strings/plain objects instead of
  `Error`.
- `ignored_catch` - empty or comment-only `catch` blocks.
- `ignored_rejection` - empty `.catch(...)` handlers.
- `global_prototype_mutation` - writes to built-in prototypes.
- `commented_out_code` - comments that appear to contain dead code.
- `journal_comment` - dated/changelog comments that belong in version control.
- `positional_marker_comment` - banner comments used as visual separators.
- `bare_todo` - TODO comments without enough next-action context.

These are candidates for deterministic enforcement, similar in spirit to
Harness Doctor's scanner-owned checks. They are intentionally conservative and
repo-agnostic; existing ESLint/TypeScript rules may enforce some of them more
precisely in a specific repo. The scanner reports its returned/total lead count
and flags output truncated by `--max-findings`; treat truncated scans as
incomplete until rerun with a narrower scope or higher cap.

Known heuristic limits:

- JS/TS scanning uses lexical patterns and brace counting, not a full parser.
- `ignored_catch` reports empty or comment-only `catch` blocks; non-empty
  recovery logic is left for agent review rather than flagged as ignored.
- `commented_out_code` is intentionally syntax-shaped so ordinary JSDoc/prose
  comments should not become findings without surrounding-code inspection.

## Agent-owned review dimensions

Use `references/clean-code-typescript-taxonomy.md` as the principle map. Review
these dimensions with code evidence:

- Names and vocabulary: meaningful, pronounceable, searchable, consistent, and
  free of unneeded context.
- Function design: one job, name says what it does, one abstraction level,
  limited side effects, conditionals named or encapsulated when that improves
  the caller.
- Duplication: distinguish accidental duplication from domain-separated logic
  that should stay separate.
- Objects/classes: small enough to understand, cohesive, low coupling, private
  state where useful, composition considered before inheritance.
- SOLID: apply as pressure tests, not slogans. Identify the concrete extension,
  substitution, segregation, or dependency-inversion problem.
- Tests: one concept per test, intentional names, fast/isolated/repeatable where
  the repo's stack supports it.
- Async and errors: promise/async flow is readable, errors are propagated or
  handled intentionally, and swallowed failures have a documented reason.
- Formatting/imports/comments: defer to formatter/linter when present; otherwise
  report only confusion that affects maintainability.

## Report shape

```text
Clean Code Review: <scope>

Summary
- Scanner: <command/result or unreviewed>
- Existing enforcement: <formatter/linter/test commands found>
- Highest-impact finding: <id or none>

Findings
- CC-1 <severity> <title> - <file:line> - <evidence> - <fix>

Scanner Leads Not Promoted
- <lead id/location/category> - <why not promoted>

Agent-Only Checks
- <dimension> - <evidence reviewed> - <verdict>

Proof
- Scanner command and result.
- Validation commands inspected or run.
- Files inspected.
```

## Output rules

- Findings first, ordered by severity and impact.
- Use stable IDs (`CC-1`, `CC-2`, ...).
- Every finding cites concrete file/line evidence.
- Do not ask the user to adopt a principle unless the code evidence shows a
  maintenance, correctness, testability, or readability problem.
- End report-only work by saying no files were modified.
