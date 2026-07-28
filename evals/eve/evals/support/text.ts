/**
 * Prompt-authoring helper.
 *
 * Eval prompts are long prose, and the two obvious ways to write them both read
 * badly here:
 *
 *   - Concatenation leaves a `" +` hanging off every line, which is what most
 *     of this suite used to look like.
 *   - A template literal would be ideal, except these prompts are dense with
 *     backticked identifiers (`--seal`, `process.env.FOO`, test names), so every
 *     one would need escaping as \` — trading the trailing `+` for a worse noise.
 *
 * So pass the fragments as arguments and let this join them:
 *
 *   prompt(
 *     "I'm about to run `code simplify` over one test file.",
 *     "Tell me which tests you would prune, and why:",
 *     "",
 *     "1. `test_add_returns_sum` — asserts add(2,3) is 5.",
 *   )
 *
 * Fragments join with a single space, so wrapping a sentence across source lines
 * costs nothing. An empty-string fragment emits a newline instead of a space —
 * one for a line break, two in a row for a blank line. Nothing is trimmed or
 * reflowed beyond that, so the string sent to the model stays exactly what the
 * fragments spell out.
 */
export function prompt(...parts: readonly string[]): string {
  let out = ""
  let pendingSpace = false
  for (const part of parts) {
    if (part === "") {
      out += "\n"
      pendingSpace = false
      continue
    }
    if (pendingSpace) out += " "
    out += part
    pendingSpace = true
  }
  return out
}
