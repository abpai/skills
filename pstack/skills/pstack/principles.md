# Principles

Select a principle when it changes the approach, prevents a concrete mistake,
or supplies a step or check the work relies on. Keep the list short so the
principles that matter stand out; leave out any that would only restate the
work. Open each selected file: a row gives only the trigger, not the guidance.

| When | Principle |
| --- | --- |
| Adding a helper, layer, or abstraction, or the diff grows beyond the request | [Laziness protocol](principles/principle-laziness-protocol.md) |
| A new requirement no longer fits the existing design cleanly | [Redesign from first principles](principles/principle-redesign-from-first-principles.md) |
| Two or more fixes that rest on one assumption have failed the same check | [Attack the premise](principles/principle-attack-the-premise.md) |
| Adding or changing validation, parsing, or error handling where input enters from users, files, configuration, the network, or external services | [Boundary discipline](principles/principle-boundary-discipline.md) |
| A change repeats across many files or sites, or needs a rerunnable check | [Script bulk operations](principles/principle-script-bulk-operations.md) |
| The same correction or instruction keeps recurring | [Encode lessons in structure](principles/principle-encode-lessons-in-structure.md) |
| A still-open decision would set a new UI interaction, architecture, or product behavior, and nothing in the codebase, request, or evidence settles it | [Exhaust the design space](principles/principle-exhaust-the-design-space.md) |
| A product, UX, or feature-scope tradeoff must be made | [Prioritize usability](principles/principle-prioritize-usability.md) |
| A planned rewrite or migration runs in phases, and intermediate states tempt compatibility code | [Outcome-oriented execution](principles/principle-outcome-oriented-execution.md) |
| Trusting, reporting, or acting on a measured number: a speedup, regression, throughput, latency, or eval result | [Explain the number](principles/principle-explain-the-number.md) |
| Dead code, redundant checks, or unneeded layers sit where an addition or refactor will land | [Subtract before you add](principles/principle-subtract-before-you-add.md) |
| Code is hard to follow because of extra layers, changing values, or copies kept in sync by hand | [Minimize reader load](principles/principle-minimize-reader-load.md) |
| State is spread across flags or many branches, one shape assumption repeats across files, or core types and data structures are being chosen | [Model the domain](principles/principle-model-the-domain.md) |
| Investigating a defect or proposing a workaround | [Fix root causes](principles/principle-fix-root-causes.md) |
| Deciding how to show a task works, or verifying it before declaring completion | [Prove it works](principles/principle-prove-it-works.md) |
| Work splits into dependent stages, such as a sweep, migration, or stacked commits, that each need a check before the next | [Sequence verifiable units](principles/principle-sequence-verifiable-units.md) |
| Commands or processing steps may crash, restart, or retry partway | [Make operations idempotent](principles/principle-make-operations-idempotent.md) |
| A new internal API replaces an old one that still has callers | [Migrate callers, then delete legacy APIs](principles/principle-migrate-callers-then-delete-legacy-apis.md) |
| Concurrent workers may change the same file, branch, key, or state object | [Separate before serializing shared state](principles/principle-separate-before-serializing-shared-state.md) |
| Writing, changing, or keeping tests | [Test behavior, not implementation](principles/principle-test-behavior-not-implementation.md) |
| Designing types or function signatures in a statically typed language | [Type system discipline](principles/principle-type-system-discipline.md) |
