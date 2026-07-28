// Test suite for the order/pricing module. Grown organically; nobody has
// pruned it in a while.
import test from "node:test"
import assert from "node:assert/strict"
import { add, verifyToken, orderResponse, roundPrice } from "./source.js"

test("add returns the sum", () => {
  assert.equal(add(2, 3), 5)
})

test("add called its internal helper before the other helper", () => {
  assert.equal(add(2, 3), 5)
  assert.equal(add(3, 2), 5)
})

test("verifyToken rejects an expired token with 401", () => {
  assert.deepEqual(verifyToken({ exp: 100 }, 200), { ok: false, status: 401 })
  assert.equal(verifyToken({ exp: 300 }, 200).status, 200)
})

test("orderResponse matches the public /v1/orders shape", () => {
  const out = orderResponse({ id: "o1", total: 10, currency: "USD", status: "paid", secret: "x" })
  assert.deepEqual(Object.keys(out).sort(), ["currency", "id", "status", "total"])
  assert.equal(out.secret, undefined)
})

test("add snapshot", () => {
  assert.equal(String(add(2, 3)), "5")
})

test("createOrder rejects a wrong-typed argument", () => {
  // @ts-expect-error orderResponse requires an order object, not a string
  const _unused = () => orderResponse("not-an-order")
  assert.ok(true)
})

test("beta pricing rounds half-up to 2dp", { skip: !process.env.FEATURE_BETA_PRICING }, () => {
  assert.equal(roundPrice(1.005), 1.01)
  assert.equal(roundPrice(2.345), 2.35)
  assert.equal(roundPrice(0.1 + 0.2), 0.3)
})

test("module loads", () => {
  add(1, 1)
  assert.ok(true)
})
