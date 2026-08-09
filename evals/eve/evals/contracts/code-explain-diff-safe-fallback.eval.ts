import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"

// This eval grades the useful result, not routing ceremony. The subject gets
// two exact before/after snapshots and must produce a correct execution-path
// explanation without installing a parser. A reply that only says it loaded
// the code skill, selected a fallback, or followed the requested format does
// not pass. It must explain the two concrete behavior changes in call order
// and support them with historical source pointers.
export default defineEval({
  description:
    "explain-diff correctly traces Bun TypeScript and Python changes through safe source fallbacks.",
  tags: ["live", "code", "contract"],
  async test(t) {
    const turn = await t.send(
      prompt(
        "Run `code explain-diff` on the two exact comparisons below. There is no",
        "repository checkout and calldiff is not installed. Use only the supplied",
        "snapshots. Do not download tools or probe the workspace.",
        "",
        "Comparison A is a Bun TypeScript service from object `1111111` to",
        "object `2222222`.",
        "",
        "`services/checkout.ts@1111111`:",
        "```ts",
        "export async function checkout(input: OrderInput) {",
        "  const saved = await saveOrder(input)",
        "  return saved.id",
        "}",
        "```",
        "",
        "`services/checkout.ts@2222222`:",
        "```ts",
        "export async function checkout(input: OrderInput) {",
        "  const order = normalizeOrder(input)",
        "  await validateInventory(order)",
        "  const saved = await saveOrder(order)",
        "  await publishOrderCreated(saved.id)",
        "  return saved.id",
        "}",
        "```",
        "",
        "Comparison B is a Python worker from object `3333333` to object",
        "`4444444`.",
        "",
        "`workers/sync_user.py@3333333`:",
        "```python",
        "def sync_user(user):",
        "    payload = serialize_user(user)",
        "    return send(payload)",
        "```",
        "",
        "`workers/sync_user.py@4444444`:",
        "```python",
        "def sync_user(user):",
        "    serialized = serialize_user(user)",
        "    payload = redact_secrets(serialized)",
        "    response = send(payload)",
        "    audit_sync(user.id, response.status)",
        "    return response",
        "```",
        "",
        "Explain the changed execution behavior for both comparisons. Cite the",
        "supplied historical objects and state evidence limits honestly.",
      ),
    )

    // The delivered explanation must preserve the new execution order. A list
    // of changed symbol names is not enough.
    t.check(
      t.reply,
      satisfies((reply: unknown) => {
        if (typeof reply !== "string") return false
        return (
          /normalizeOrder[\s\S]{0,700}validateInventory[\s\S]{0,700}saveOrder[\s\S]{0,700}publishOrderCreated/i.test(
            reply,
          ) &&
          /serialize_user[\s\S]{0,700}redact_secrets[\s\S]{0,700}send[\s\S]{0,700}audit_sync/i.test(
            reply,
          )
        )
      }, "reply traces each new call path in execution order"),
    )

    // Historical evidence is part of the behavior contract. Current-tree line
    // numbers or bare filenames cannot prove either side of these comparisons.
    t.check(
      t.reply,
      satisfies((reply: unknown) => {
        if (typeof reply !== "string") return false
        return (
          /checkout\.ts@1111111:[1-4]/.test(reply) &&
          /checkout\.ts@2222222:[1-7]/.test(reply) &&
          /sync_user\.py@3333333:[1-3]/.test(reply) &&
          /sync_user\.py@4444444:[1-7]/.test(reply)
        )
      }, "reply cites both historical objects for both comparisons"),
    )

    // The fallback must stay dependency-free. Workspace edits and runtime
    // package installation would turn a read-only explanation into a mutation.
    t.check(
      turn.toolCalls,
      satisfies((calls: unknown) => {
        if (!Array.isArray(calls)) return false
        return !calls.some((call) => {
          const item = call as { name?: string; input?: { command?: unknown } }
          if (item.name === "write_file") return true
          if (item.name !== "bash") return false
          const command = String(item.input?.command ?? "")
          return [
            /\b(?:npx|bunx|pipx)\b/i,
            /\b(?:npm|pnpm|yarn|bun)\s+(?:i|install|add)\b/i,
            /\b(?:pip|uv\s+pip)\s+install\b/i,
            /\bpython3?\s+-m\s+pip\b/i,
          ].some((pattern) => pattern.test(command))
        })
      }, "no workspace write or runtime tool installation"),
    )

    // The judge grades semantic accuracy. These are evidence signals, not
    // brittle phrase requirements, and remain soft under the suite policy.
    t.judge.autoevals
      .closedQA(
        prompt(
          "Does the answer correctly explain both behavior changes? For the Bun",
          "TypeScript path, the new version normalizes the input, validates inventory",
          "before saving, and publishes an event after saving. For the Python path,",
          "the new version redacts serialized data before the send boundary and audits",
          "the response after send. Answer NO if either order or effect is wrong, or",
          "if the response only lists changed functions without explaining behavior.",
        ),
      )
    t.judge.autoevals
      .closedQA(
        prompt(
          "Does the answer distinguish direct source evidence from runtime proof? It",
          "must not claim that calldiff, Bun, Python, tests, or the application ran.",
          "It should identify supplied-source inspection as the basis and note that",
          "runtime values, failures, and side effects were not executed. Answer NO if",
          "it presents inferred runtime behavior as observed fact.",
        ),
      )
  },
})
