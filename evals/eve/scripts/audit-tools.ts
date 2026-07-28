/**
 * Keep `evals/support/tools.ts` honest about what Eve actually advertises.
 *
 * The predicates there reject unknown tool names so a typo fails loudly instead
 * of passing vacuously. That only works while `KNOWN_TOOLS` matches reality. If
 * Eve renames `write_file`, every `noWrites()` in the suite silently stops
 * guarding anything — the same failure the list was written to prevent, one
 * layer up.
 *
 * So read the newest run under `.eve/evals/` and compare the tools the model
 * actually called against the list. Reports both directions: a called tool
 * missing from `KNOWN_TOOLS` (the dangerous one), and a listed tool never seen
 * (informational — plenty of tools go uncalled in any given run).
 *
 * Usage: `bun run tools:audit [<run-dir>]`
 */
import { readdirSync, readFileSync, existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { KNOWN_TOOLS } from "../evals/support/tools"

const here = dirname(fileURLToPath(import.meta.url))
const eveRoot = resolve(here, "..")

function newestRunDir(): string {
  const root = join(eveRoot, ".eve", "evals")
  if (!existsSync(root)) throw new Error(`no eval runs found at ${root} — run an eval first`)
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  const newest = dirs.at(-1)
  if (newest === undefined) throw new Error(`no eval runs found under ${root}`)
  return join(root, newest)
}

/** Every *.events.ndjson under a run directory. */
function eventFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...eventFiles(full))
    else if (entry.name.endsWith(".events.ndjson")) out.push(full)
  }
  return out
}

function calledTools(runDir: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const file of eventFiles(runDir)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.includes('"tool-call"')) continue
      let event: { data?: { actions?: { toolName?: string; kind?: string }[] } }
      try {
        event = JSON.parse(line)
      } catch {
        continue
      }
      for (const action of event.data?.actions ?? []) {
        if (action.kind !== "tool-call" || action.toolName === undefined) continue
        counts.set(action.toolName, (counts.get(action.toolName) ?? 0) + 1)
      }
    }
  }
  return counts
}

const runDir = process.argv[2] ?? newestRunDir()
const called = calledTools(runDir)
const known = new Set<string>(KNOWN_TOOLS)

const missing = [...called.keys()].filter((t) => !known.has(t)).sort()
const unseen = [...known].filter((t) => !called.has(t)).sort()

console.log(`run: ${runDir}`)
console.log(`tools called: ${[...called.entries()].map(([t, n]) => `${t}(${n})`).join(", ") || "none"}`)
if (unseen.length > 0) console.log(`listed but not called this run: ${unseen.join(", ")}`)

if (missing.length > 0) {
  console.error(
    `\nFAIL: called but absent from KNOWN_TOOLS: ${missing.join(", ")}\n` +
      `Add them to evals/support/tools.ts, and to WRITE_TOOLS if they can modify the workspace.`,
  )
  process.exit(1)
}
if (called.size === 0) {
  console.error(`\nFAIL: no tool calls found in ${runDir} — the run is empty or its shape changed.`)
  process.exit(1)
}
console.log("\nOK: every called tool is declared.")
