# Test-Driven Development

Workflow module for `/engineering:tdd`.

Upstream inspiration: https://github.com/mattpocock/skills/tree/main/skills/engineering/tdd

## Philosophy

**Core principle**: Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't.

Good tests are integration-style, reading like a spec ("user can checkout with valid cart"), and survive refactors. Bad tests mock internal collaborators, test private methods, or verify through external means (e.g. querying a database directly instead of the interface) — the warning sign is a test that breaks on refactor with no behavior change.

See [tests](references/tdd-tests.md) for examples and [mocking](references/tdd-mocking.md) for mocking guidelines.

## Anti-Pattern: Horizontal Slices

**Do not write all tests first, then all implementation** ("horizontal slicing" — treating RED as "write all tests" and GREEN as "write all code"). It produces tests for _imagined_ behavior, not _actual_ behavior: insensitive to real regressions, and committed to test structure before the implementation is understood.

**Correct**: vertical slices. One test, then its implementation, then repeat — never all tests batched before any implementation. Each test responds to what the previous cycle taught you.

## Workflow

### 1. Planning

When exploring the codebase, use the project's domain glossary so that test names and interface vocabulary match the project's language, and respect ADRs in the area you're touching.

Before writing any code:

- [ ] Confirm with user what interface changes are needed
- [ ] Confirm with user which behaviors to test (prioritize)
- [ ] Identify opportunities for [deep modules](references/tdd-deep-modules.md) (small interface, deep implementation)
- [ ] Design interfaces for [testability](references/tdd-interface-design.md)
- [ ] List the behaviors to test (not implementation steps)
- [ ] Get user approval on the plan

**You can't test everything.** Confirm with the user which behaviors matter most; focus on critical paths and complex logic, not every edge case.

### 2. Vertical slice loop

For each behavior, in order:

```
RED:   Write one test for one behavior → fails
GREEN: Minimal code to pass → passes
```

The first cycle is a tracer bullet — it proves the path works end-to-end.
Rules for every cycle:

- One test at a time
- Only enough code to pass the current test
- Don't anticipate future tests
- Keep tests focused on observable behavior

### 3. Refactor

After all tests pass, look for [refactor candidates](references/tdd-refactoring.md):

- [ ] Extract duplication
- [ ] Deepen modules (move complexity behind simple interfaces)
- [ ] Apply SOLID principles where natural
- [ ] Consider what new code reveals about existing code
- [ ] Run tests after each refactor step

**Never refactor while RED.** Get to GREEN first.

## Checklist Per Cycle

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Code is minimal for this test
[ ] No speculative features added
```
