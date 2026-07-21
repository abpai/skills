/**
 * Ablation harness — mutation-testing for skill directives.
 *
 * For each manifest entry:
 *   - heading ablation → `prepare-skills --ablate <id>`, run `guardedBy` evals
 *   - retirement check → `prepare-skills --omit <skillId>`, run `retirement` evals
 * Classify SURVIVED (all pass) vs KILLED (any fail). Always restore baseline in
 * `finally` so a crashed run never leaves `agent/skills/` mutated.
 *
 * Usage: `bun run ablate` (requires OPENAI_API_KEY for live grades).
 */
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { ABLATIONS, type Ablation } from "../ablations/manifest"

const here = dirname(fileURLToPath(import.meta.url))
const eveRoot = resolve(here, "..")

type EvalVerdict = {
  id: string
  verdict: string
}

type EvalRunSummary = {
  passed: number
  failed: number
  skipped?: number
  errored?: number
  /** Eve 0.26 `--json` emits `results[]` (not `evals[]`). */
  results: EvalVerdict[]
}

type Row = {
  id: string
  mode: "ablate" | "omit"
  classification: "SURVIVED" | "KILLED" | "ERROR"
  detail: string
  hypothesis: string
}

function run(cmd: string[], opts: { env?: NodeJS.ProcessEnv } = {}): {
  status: number | null
  stdout: string
  stderr: string
} {
  const result = spawnSync(cmd[0], cmd.slice(1), {
    cwd: eveRoot,
    encoding: "utf8",
    env: { ...process.env, ...opts.env },
    maxBuffer: 20 * 1024 * 1024,
  })
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

function prepare(args: string[]): void {
  const r = run(["bun", "scripts/prepare-skills.ts", ...args])
  if (r.stdout.trim()) process.stdout.write(r.stdout)
  if (r.stderr.trim()) process.stderr.write(r.stderr)
  if (r.status !== 0) {
    throw new Error(`prepare-skills failed (exit ${r.status}): ${r.stderr || r.stdout}`)
  }
}

function restoreBaseline(): void {
  console.log("\nablate: restoring baseline materialization…")
  prepare([])
}

/** Pull the pretty-printed summary object out of eve's mixed stdout (logs + JSON). */
function extractJsonObject(stdout: string): unknown {
  const marked = stdout.search(/\n\{\n/)
  const start = marked >= 0 ? marked + 1 : stdout.indexOf("{")
  if (start < 0) {
    throw new Error(`eve eval --json produced no JSON object\nstdout:\n${stdout.slice(0, 500)}`)
  }
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < stdout.length; i++) {
    const ch = stdout[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === "\\") escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return JSON.parse(stdout.slice(start, i + 1))
    }
  }
  throw new Error("eve eval --json: unclosed JSON object in stdout")
}

/** Run named evals via `eve eval <id…> --json`; return parsed summary. */
function runEvals(ids: readonly string[]): EvalRunSummary {
  const r = run(["bunx", "eve", "eval", ...ids, "--json"])
  const summary = extractJsonObject(r.stdout) as EvalRunSummary
  if (!Array.isArray(summary.results)) {
    throw new Error(`eve eval --json: missing results[] in summary`)
  }
  return summary
}

function classify(summary: EvalRunSummary): "SURVIVED" | "KILLED" {
  const anyFail = summary.results.some(
    (e) => e.verdict === "failed" || e.verdict === "errored",
  )
  if (anyFail || summary.failed > 0 || (summary.errored ?? 0) > 0) return "KILLED"
  return "SURVIVED"
}

function formatEvalLine(summary: EvalRunSummary): string {
  return summary.results.map((e) => `${e.id}:${e.verdict}`).join(", ")
}

function runEntry(entry: Ablation): Row {
  if (entry.retirement && entry.retirement.length > 0 && !entry.span) {
    console.log(`\n══ omit ${entry.skillId}  (${entry.id}) ══`)
    prepare(["--omit", entry.skillId])
    const summary = runEvals(entry.retirement)
    const classification = classify(summary)
    return {
      id: entry.id,
      mode: "omit",
      classification,
      detail: formatEvalLine(summary),
      hypothesis: entry.hypothesis,
    }
  }

  if (entry.span && entry.guardedBy && entry.guardedBy.length > 0) {
    if ("lines" in entry.span) {
      throw new Error(`${entry.id}: line-span ablations are not implemented`)
    }
    console.log(`\n══ ablate ${entry.id}  (## ${entry.span.heading}) ══`)
    prepare(["--ablate", entry.id])
    const summary = runEvals(entry.guardedBy)
    const classification = classify(summary)
    return {
      id: entry.id,
      mode: "ablate",
      classification,
      detail: formatEvalLine(summary),
      hypothesis: entry.hypothesis,
    }
  }

  throw new Error(
    `${entry.id}: need span+guardedBy (ablate) or retirement-only (omit); got neither`,
  )
}

function printTable(rows: Row[]): void {
  console.log("\n╔════════════════════════════════════════════════════════════════════════════╗")
  console.log("║ Ablation report                                                            ║")
  console.log("╠══════════════════════════════╤════════╤═══════════╤════════════════════════╣")
  console.log("║ id                           │ mode   │ result    │ evals                  ║")
  console.log("╟──────────────────────────────┼────────┼───────────┼────────────────────────╢")
  for (const row of rows) {
    const id = row.id.padEnd(28).slice(0, 28)
    const mode = row.mode.padEnd(6)
    const result = row.classification.padEnd(9)
    const detail = row.detail.length > 22 ? row.detail.slice(0, 21) + "…" : row.detail.padEnd(22)
    console.log(`║ ${id} │ ${mode} │ ${result} │ ${detail} ║`)
  }
  console.log("╚══════════════════════════════╧════════╧═══════════╧════════════════════════╝")
  for (const row of rows) {
    console.log(`\n${row.id} → ${row.classification} (${row.mode})`)
    console.log(`  evals: ${row.detail}`)
    console.log(`  hypothesis: ${row.hypothesis}`)
  }
}

function main(): void {
  if (!process.env.OPENAI_API_KEY) {
    console.error("ablate: OPENAI_API_KEY is required (live grades). Load .env.local first.")
    process.exit(2)
  }

  const rows: Row[] = []
  try {
    for (const entry of ABLATIONS) {
      try {
        rows.push(runEntry(entry))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`ablate: entry ${entry.id} errored: ${message}`)
        rows.push({
          id: entry.id,
          mode: entry.retirement && !entry.span ? "omit" : "ablate",
          classification: "ERROR",
          detail: message.slice(0, 80),
          hypothesis: entry.hypothesis,
        })
      }
    }
  } finally {
    try {
      restoreBaseline()
    } catch (err) {
      console.error(
        "ablate: FAILED to restore baseline — agent/skills/ may be mutated:",
        err instanceof Error ? err.message : err,
      )
      process.exitCode = 2
    }
  }

  printTable(rows)

  const errors = rows.filter((r) => r.classification === "ERROR")
  if (errors.length > 0) {
    process.exitCode = 1
  }
}

main()
