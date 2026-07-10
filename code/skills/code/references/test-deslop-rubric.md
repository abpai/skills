# Deslop rubric — full catalog

Read this when judging individual tests or explaining a call. Each entry has the
tell, why it's low value (or why it's protected), and a concrete example.

## KILL

### Tautological / mock-only
Asserts that a mock returned what the mock was configured to return. Exercises the
test's own setup, not the code.

```ts
// the store is faked to return X, then we assert it returned X
fakeStore.get.mockResolvedValue(row)
expect(await service.load(id)).toEqual(row) // proves the mock, not service.load
```
Keep it only if `service.load` does real transformation/validation between the mock
and the assertion.

### Implementation-detail
Breaks on a refactor that doesn't change behavior: asserts call order, private
internals, exact log strings, or that a specific internal method was invoked.

```ts
expect(logger.calls).toEqual([['debug', 'quiet'], ['info', 'tick']]) // log shape
expect(Object.getPrototypeOf(store).listAgents).toBeUndefined()       // prototype shape
```
The behavior these stand in for is usually covered by an observable assertion
elsewhere. Prefer asserting the outcome, not the mechanism.

### Redundant / duplicate
N near-identical cases hitting one branch, or coverage a higher-level test already
guarantees.
- **Within a file:** five cases that differ only by a value but exercise the same
  `if`. Keep one representative (or a `test.each` table); delete the rest.
- **Cross-file:** a re-export shim's test that re-proves the canonical module's
  tests; an integration test that re-checks a pure function's unit cases. Delete the
  duplicate **only after confirming** the named sibling actually covers the same
  inputs and assertions — scope "redundant" to the same file unless you can prove it.

### Over-specified non-contract snapshot
Whole-blob `toEqual`/`toMatchSnapshot` where only one field is load-bearing, or a
snapshot of text that is *meant* to change (a prompt, a generated comment, a log
line). It fails on every benign edit and asserts nothing about behavior.

### Vacuous
`expect(true).toBe(true)`; a test with no assertion; a permanently empty
`.skip`/`it.todo`; a test that builds a literal and asserts the literal has its own
values (`JSON.stringify`/`parse` round-trips of a local constant).

### Trivial
A one-line getter, passthrough, or constant with no logic — `expect(THING).toBe(
THING_LITERAL)`, `entryFileName('x') === 'x.eval.ts'`.

## KEEP + SHARPEN (conservative)

Survivor edits, in rough order of safety:
- Rename `describe`/`it` to state the behavior plainly (drop names that reference a
  private method or oversell what the body checks).
- Remove dead setup, unused vars, redundant `beforeEach`/`afterEach`, and any import
  left unused after a deletion (so the file still compiles).
- Tighten an over-broad assertion **only** when it doesn't drop real coverage.

Hard line: never change the behavior under test, never weaken a meaningful
assertion, and never edit the code-under-test or shared helpers. If a helper goes
unused after a deletion, leave it and note it rather than churn shared setup.

## PROTECT — looks prunable, isn't

These trip the KILL tells but are load-bearing. Do not delete as "redundant" unless
the input *and* assertion are literally identical in the same file.

- **Security / authz / identity** — scope minting, credential/secret rejection,
  alg-confusion (`HS256`/`none`/`RS256`) cases, prototype-pollution → 404,
  path-traversal rejection, "secret never appears in output" guards. Near-identical
  cases with *different inputs* are distinct attack vectors, not duplicates.
- **Contract goldens** — a serializer's canonical bytes, a public API-response
  payload shape, CLI help/exit-code output, a wire schema's JSON. The exact output
  *is* the product contract; whole-blob equality is correct here.
- **No-drift / boundary gates** — a test that regenerates a schema or env-example and
  asserts no drift vs the committed file; an import/dependency-boundary guard. These
  are CI protection; deleting one removes a safety mechanism, not slop.
- **Compile-time type guards** — `const _x: A = {} as B` / `satisfies` proofs that
  two types stay structurally identical across a package boundary. The runtime body
  may look vacuous; the contract is the compile.
- **Env-gated skip shims** — `test.skip(name, () => {})` that surfaces a Postgres/
  infra suite's names when a URL is unset (real bodies run when it's set). Deliberate
  visibility, not an abandoned skip.

## The snapshot heuristic

Decide by what breaking the snapshot would *mean*:
- Prompt text, log output, generated comments → **change-detector → KILL**.
- Serializer output, wire format, public payload, CLI contract → **contract → KEEP**.

## When unsure

Keep it and flag it. An over-kept test costs a few lines; a wrongly-deleted guard
costs a regression. Note the borderline calls in your report so a human can make the
final cut.
