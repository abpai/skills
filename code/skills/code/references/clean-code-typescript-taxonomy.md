# Clean Code TypeScript Taxonomy

Source: `labs42io/clean-code-typescript`
(`https://github.com/labs42io/clean-code-typescript`), MIT licensed
(`Copyright (c) 2019 Labs42 <hello@labs42.io>`). This derived taxonomy was
prepared from upstream commit
`05a25e8fb8f4cdca4e6cfbddd60323c6ddc5aa54`.
No upstream examples are vendored.

Use this as the review map for `/code simplify`. The original upstream
document is a principle catalog; this file classifies those principles by what a
repo-agnostic scanner can enforce and what needs agent judgment.

## Scanner-owned deterministic/static leads

These can be detected without understanding product semantics. They still need
inspection before they become findings.

| Principle area | Scanner category | Coverage | Detector idea |
| --- | --- | --- | --- |
| Function arguments (2 or fewer ideally) | `too_many_parameters` | JS/TS, Python | Count function/method parameters in supported signatures. |
| Do not use flags as function parameters | `boolean_flag_parameter` | JS/TS | Flag boolean-typed parameters in JS/TS signatures. |
| Do not use type checking | `type_check_conditional` | JS/TS | Flag `typeof`, `instanceof`, and constructor checks in conditionals. |
| Avoid negative conditionals | `negative_conditional` | JS/TS | Flag direct negation in `if`/ternary/while conditions. |
| Use default arguments instead of short circuiting | `short_circuit_default` | JS/TS | Flag assignment/defaulting with `||`, which can treat valid falsy values as absent. |
| Always use Error for throwing/rejecting | `non_error_throw` | JS/TS, Python | Flag non-`Error` throws/rejections and bare Python raises. |
| Do not ignore caught errors | `ignored_catch` | JS/TS, Python | Flag empty or comment-only catch/except bodies. |
| Do not ignore rejected promises | `ignored_rejection` | JS/TS | Flag empty `.catch(...)` handlers. |
| Do not write to global functions | `global_prototype_mutation` | JS/TS | Flag writes to built-in prototypes such as `Array.prototype.foo = ...`. |
| Prefer self explanatory code instead of comments | `commented_out_code` | JS/TS, Python | Flag comments that look like disabled statements. |
| Do not have journal comments | `journal_comment` | JS/TS, Python | Flag date-prefixed changelog comments. |
| Avoid positional markers | `positional_marker_comment` | JS/TS, Python | Flag long comment banners of `////`, `====`, `----`, etc. |
| TODO comments | `bare_todo` | JS/TS, Python | Flag TODO comments that lack a colon or enough action context. |
| Classes should be small | `oversized_class` | JS/TS, Python | Flag classes above line/method thresholds. |
| Functions should do one thing | `oversized_function` | JS/TS, Python | Flag functions above line thresholds as a lead, not proof. |

## Static leads that need stronger agent judgment

These are visible in code shape, but false positives are common.

| Principle area | Review approach |
| --- | --- |
| Use meaningful/pronounceable/searchable names | Inspect names in context; avoid reporting domain abbreviations that are standard in the repo. |
| Use the same vocabulary for the same type | Compare nearby API names and domain terms; route vocabulary conflicts to `defined-terms` when useful. |
| Do not add unneeded context | Check whether prefixes repeat the enclosing module/domain name without adding meaning. |
| Encapsulate conditionals | Promote only when naming the condition or moving policy reduces caller knowledge. |
| Avoid conditionals | Prefer discriminated unions, maps, or polymorphism only when current branching is growing or duplicated. |
| Remove dead code | Use tests/build/static tools when available; commented-out code is deterministic, unused exported behavior is not. |
| Prefer promises/async-await | Inspect async flow and error handling; do not rewrite working callback APIs owned by framework conventions. |
| Organize imports and aliases | Prefer existing formatter/linter/tsconfig evidence before suggesting style changes. |

## Agent-only principles

These require understanding intent, domain boundaries, or architectural tradeoffs.

- Explanatory variables versus over-fragmented code.
- One level of abstraction per function.
- Removing duplicate code without collapsing distinct domain concepts.
- Avoiding side effects while preserving necessary integration behavior.
- Favoring functional programming over imperative programming where it clarifies
  state and error flow.
- Getters/setters, privacy, immutability, `type` versus `interface`, method
  chaining, composition over inheritance, cohesion/coupling, and SOLID.
- TDD laws, F.I.R.S.T. tests, single concept per test, and test names revealing
  intention.
- Formatting and comments where the repo already has an agreed formatter or
  documentation style.
