/**
 * Tool-call predicates, with a guard against the bug that motivated this file.
 *
 * Two evals asserted `no call named "Edit" or "Write"`. Eve never advertises
 * those names — its write tool is `write_file` — so both predicates were
 * vacuously true and could not fail for any model behavior. They read like
 * restraint gates and proved nothing. The tool names came from Claude Code's
 * vocabulary, not this harness's.
 *
 * The fix is not just correcting the strings. Any predicate that asks about a
 * tool name is one typo away from silently passing forever, so every helper
 * here resolves names through `KNOWN_TOOLS` and throws on an unrecognized one.
 * A wrong name now fails the eval loudly instead of passing quietly.
 *
 * Keep `KNOWN_TOOLS` in sync with what the harness agent is actually offered.
 * `bun run tools:audit` reads the newest run under `.eve/evals/` and reports
 * any tool the model called that is missing from this list.
 */
import { satisfies } from "eve/evals/expect"

/** Every tool Eve advertises to the harness agent. */
export const KNOWN_TOOLS = [
  "bash",
  "glob",
  "grep",
  "load_skill",
  "read_file",
  "todo",
  "web_search",
  "write_file",
] as const

export type KnownTool = (typeof KNOWN_TOOLS)[number]

/** Tools that can modify the workspace. */
export const WRITE_TOOLS: readonly KnownTool[] = ["write_file"]

function assertKnown(names: readonly string[]): void {
  const unknown = names.filter((n) => !(KNOWN_TOOLS as readonly string[]).includes(n))
  if (unknown.length > 0) {
    throw new Error(
      `unknown tool name(s) in assertion: ${unknown.join(", ")}. ` +
        `Eve advertises: ${KNOWN_TOOLS.join(", ")}. A name outside that set can ` +
        `never match, so the assertion would pass vacuously.`,
    )
  }
}

type Call = {
  readonly name?: string
  readonly status?: string
  readonly input?: { readonly command?: string }
  readonly output?: unknown
}

function asCalls(value: unknown): readonly Call[] | null {
  return Array.isArray(value) ? (value as Call[]) : null
}

/** No call to any of the named tools. Throws if a name is not a real tool. */
export function notCalled(...names: readonly KnownTool[]) {
  assertKnown(names)
  return satisfies((value: unknown) => {
    const calls = asCalls(value)
    if (calls === null) return false
    return !calls.some((c) => c.name !== undefined && names.includes(c.name as KnownTool))
  }, `no call to ${names.join(" or ")}`)
}

/** No workspace-modifying tool call. */
export function noWrites() {
  return notCalled(...WRITE_TOOLS)
}

/**
 * No tool call ended in `failed`.
 *
 * `t.noFailedActions()` covers the same ground but only `smoke` asserted it,
 * which is how three evals hit `load_skill` path errors and still passed.
 */
export function noFailedCalls() {
  return satisfies((value: unknown) => {
    const calls = asCalls(value)
    if (calls === null) return false
    return !calls.some((c) => c.status === "failed")
  }, "no tool call ended in failed status")
}

/**
 * Every `load_skill` call resolved.
 *
 * This is the narrow replacement for blanket `t.noFailedActions()`, which
 * graded the sandbox instead of the skill: subjects probe (glob a path named
 * in the prompt, read a file that may not exist) and the sandbox itself
 * throws IO errors — CI runs 30513851355 (`rg: /proc/…: Permission denied`)
 * and 30514088913 (`rg: /mnt/data: No such file or directory`) each failed a
 * different eval on such noise. A failed probe is normal agent behavior. A
 * failed `load_skill` is the one failure the gate existed to catch: the
 * subject asked for a skill and did not get it, so every downstream gate is
 * grading an unskilled turn (three evals silently tolerated exactly that
 * before the blanket gate landed).
 */
export function noFailedSkillLoads() {
  return satisfies((value: unknown) => {
    const calls = asCalls(value)
    if (calls === null) return false
    return !calls.some((c) => c.name === "load_skill" && c.status === "failed")
  }, "every load_skill call resolved")
}

/**
 * No `bash` call exited non-zero.
 *
 * Distinct from `noFailedCalls`: a shell command that exits 1 is a *completed*
 * tool call carrying a failure in its output. `safety/codex-session-injection`
 * passes today with an `exitCode: 1` inside it, so status alone misses this.
 *
 * Some skills legitimately run commands that fail — a RED step in TDD, a
 * deliberately absent session file. Pass `allow` with substrings of the
 * commands whose failure is expected.
 */
export function noFailedShell(allow: readonly string[] = []) {
  const label =
    allow.length > 0
      ? `no unexpected non-zero bash exit (allowed: ${allow.join(", ")})`
      : "no non-zero bash exit"
  return satisfies((value: unknown) => {
    const calls = asCalls(value)
    if (calls === null) return false
    return !calls.some((c) => {
      if (c.name !== "bash") return false
      const out = c.output as { exitCode?: number } | undefined
      if (out?.exitCode === undefined || out.exitCode === 0) return false
      const command = c.input?.command ?? ""
      return !allow.some((a) => command.includes(a))
    })
  }, label)
}
