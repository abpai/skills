/**
 * Skill-load reader controls, run without a model or Docker.
 *
 * eve 0.83 stopped reporting a skill load as a `load_skill` tool call; a load
 * is a `load-skill` action request paired with an `action.result`. Helpers that
 * kept looking at `toolCalls` passed vacuously, so the reader must be able to
 * see a completed load, a failed load, an unresolved load, and no load at all.
 */
import assert from "node:assert/strict"
import { skillLoadsOf } from "../evals/support/loaded"

const request = (callId: string, name: string) => ({
  type: "actions.requested",
  data: { actions: [{ kind: "load-skill", callId, name }] },
})
const result = (callId: string, status: string, kind = "load-skill-result") => ({
  type: "action.result",
  data: { status, result: { kind, callId } },
})
const toolCall = { type: "actions.requested", data: { actions: [{ kind: "tool-call", callId: "t1", toolName: "bash" }] } }

assert.deepEqual(skillLoadsOf([request("c1", "code"), result("c1", "completed")]), [
  { skill: "code", status: "completed" },
])
assert.deepEqual(skillLoadsOf([request("c1", "code"), result("c1", "failed")]), [
  { skill: "code", status: "failed" },
])
assert.deepEqual(skillLoadsOf([request("c1", "code")]), [{ skill: "code", status: "pending" }])
assert.deepEqual(skillLoadsOf([toolCall, result("t1", "completed", "tool-result")]), [])
assert.deepEqual(skillLoadsOf([]), [])
// Two loads pair with their own results, in either order.
assert.deepEqual(
  skillLoadsOf([request("a", "code"), request("b", "distill"), result("b", "failed"), result("a", "completed")]),
  [
    { skill: "code", status: "completed" },
    { skill: "distill", status: "failed" },
  ],
)
// Not an event list: the helpers must fail, not pass, so a stale call site is loud.
assert.equal(skillLoadsOf(undefined), null)
assert.deepEqual(skillLoadsOf([{ name: "load_skill", status: "completed" }]), [])

console.log("Skill-load reader controls passed.")
