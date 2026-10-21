# Principles

Read only the principles relevant to the task. Select one when it changes an
approach or prevents a concrete mistake; do not pad the plan with a checklist.

| When | Principle |
| --- | --- |
| Adding a helper, layer, or abstraction, or scope grows beyond the request | [Laziness protocol](principles/principle-laziness-protocol.md) |
| A new requirement no longer fits the existing design cleanly | [Redesign from first principles](principles/principle-redesign-from-first-principles.md) |
| Repeated fixes share an assumption and keep failing | [Attack the premise](principles/principle-attack-the-premise.md) |
| Input arrives from users, files, external services, or framework code | [Boundary discipline](principles/principle-boundary-discipline.md) |
| Bulk updates or repeatable verification need tooling | [Script bulk operations](principles/principle-script-bulk-operations.md) |
| The same correction or instruction keeps recurring | [Encode lessons in structure](principles/principle-encode-lessons-in-structure.md) |
| A novel UI interaction or architectural decision has no useful precedent in the codebase | [Exhaust the design space](principles/principle-exhaust-the-design-space.md) |
| Choosing product behavior, features, or usability tradeoffs | [Prioritize usability](principles/principle-prioritize-usability.md) |
| A planned rewrite or migration has explicit verification checkpoints | [Outcome-oriented execution](principles/principle-outcome-oriented-execution.md) |
| Reporting or acting on performance measurements or agent/model evaluation results | [Explain the number](principles/principle-explain-the-number.md) |
| Existing complexity makes a change harder | [Subtract before you add](principles/principle-subtract-before-you-add.md) |
| Code is hard to follow because of extra layers or changing values | [Minimize reader load](principles/principle-minimize-reader-load.md) |
| Changing data, many conditions, or repeated rules make the design hard to follow | [Model the domain](principles/principle-model-the-domain.md) |
| Investigating a defect or proposing a workaround | [Fix root causes](principles/principle-fix-root-causes.md) |
| Verifying a task before declaring completion | [Prove it works](principles/principle-prove-it-works.md) |
| Work has multiple dependent steps | [Sequence verifiable units](principles/principle-sequence-verifiable-units.md) |
| Commands or processing steps may restart or retry | [Make operations idempotent](principles/principle-make-operations-idempotent.md) |
| Replacing an internal API during a simplification or refactor | [Migrate callers, then delete legacy APIs](principles/principle-migrate-callers-then-delete-legacy-apis.md) |
| Concurrent workers may change the same file, branch, key, or state object | [Separate before serializing shared state](principles/principle-separate-before-serializing-shared-state.md) |
| Writing, changing, or keeping tests | [Test behavior, not implementation](principles/principle-test-behavior-not-implementation.md) |
| Designing types or function signatures in a statically typed language | [Type system discipline](principles/principle-type-system-discipline.md) |
