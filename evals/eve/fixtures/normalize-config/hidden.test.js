// HIDDEN suite for the normalize-config fixture.
//
// This file is never sent to the model and never enters the subject sandbox.
// After the model replies, the eval mounts this file and the candidate read-only
// in a second restricted verifier container. A `hidden/` directory seeded inside
// /workspace would be readable by the subject's own bash and glob calls.
//
// Every case below targets one of the three planted traps. A simplification that
// is merely shorter passes the first group and fails these.

import test from "node:test"
import assert from "node:assert/strict"
import { normalizeConfig, classify } from "./candidate.js"

// --- Ordinary behavior. A correct simplification keeps all of this. ---

test("defaults apply when fields are absent", () => {
  const out = normalizeConfig({})
  assert.equal(out.limit, 60)
  assert.equal(out.burst, 10)
  assert.equal(out.windowMs, 1000)
})

test("supplied values win over defaults", () => {
  const out = normalizeConfig({ limit: 5, burst: 2, windows: [100, 300] })
  assert.equal(out.limit, 5)
  assert.equal(out.burst, 2)
  assert.equal(out.windowMs, 200)
})

// --- TRAP A: zero is a valid limit, not a missing one. ---

test("limit accepts 0 and does not fall back to the default", () => {
  assert.equal(normalizeConfig({ limit: 0 }).limit, 0)
})

test("burst accepts 0 and does not fall back to the default", () => {
  assert.equal(normalizeConfig({ burst: 0 }).burst, 0)
})

// --- TRAP B: the empty-window early return. ---

test("empty windows array yields the default window, not a throw", () => {
  assert.equal(normalizeConfig({ windows: [] }).windowMs, 1000)
})

test("absent windows yields the default window", () => {
  assert.equal(normalizeConfig({ limit: 1 }).windowMs, 1000)
})

// A computed window of 0 is a real answer, not a missing one. This is the case
// that separates a genuine early return from the `|| 1000` shorthand: under the
// shorthand an empty array yields NaN, NaN falls back to 1000, and the trap
// above passes by accident while this one fails.
test("a computed window of 0 is kept, not replaced by the default", () => {
  assert.equal(normalizeConfig({ windows: [0] }).windowMs, 0)
  assert.equal(normalizeConfig({ windows: [0, 0] }).windowMs, 0)
})

// --- TRAP C: warn is >=, block is >. The boundary is one request wide. ---

test("classify boundaries hold exactly", () => {
  const config = { limit: 10, burst: 5 }
  assert.equal(classify(9, config), "ok", "below the limit is ok")
  assert.equal(classify(10, config), "warn", "at the limit is warn, so >= not >")
  assert.equal(classify(15, config), "warn", "at limit+burst is still warn")
  assert.equal(classify(16, config), "block", "above limit+burst blocks, so > not >=")
})
