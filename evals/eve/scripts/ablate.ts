/**
 * Ablation harness — mutation-testing for skill directives.
 *
 * For each manifest entry:
 *   - heading ablation → `prepare-skills --ablate <id>`, run `guardedBy` evals
 *   - retirement check → `prepare-skills --omit <skillId>`, run `retirement` evals
 *
 * Classifications:
 *   KILLED     — an eval failed. The cut text is load-bearing and now guarded.
 *   SURVIVED   — every eval passed AND the eval needs the skill to pass. The
 *                cut text really is a no-op for this contract: a cut candidate.
 *   UNGUARDED  — every eval passed, but they also pass with the skill entirely
 *                omitted. The eval measures the base model, not the skill, so
 *                it can say nothing about this text. Not a cut candidate —
 *                write a discriminating eval first.
 *   FLAKY      — with `--runs N`, the same ablated build both killed and
 *                survived. Neither label is a verdict; raise N or treat the
 *                entry as unmeasured.
 *   ERROR      — the run produced no judgement: an eval errored, or the guarded
 *                evals were not green BEFORE the cut. Infrastructure noise, not
 *                evidence. Fix and re-run.
 *
 * Every entry establishes a green baseline on the unmutated pack first. An eval
 * that is already red — a drifted contract, a flaky judge — would otherwise
 * report KILLED for every ablation aimed at it, crediting the cut text with a
 * failure it had nothing to do with.
 *
 * READ THIS BEFORE TRUSTING A SINGLE SWEEP. Live grading is non-deterministic,
 * and not marginally so: two consecutive identical sweeps on 2026-07-27
 * disagreed on 5 of 12 entries. One run is close to a coin flip for roughly half
 * the manifest. Use `--runs 3` (or more) before acting on any result, and treat
 * FLAKY as "no signal yet" rather than a weak KILLED.
 *
 * Ablation is also not the last word on a trim. The stronger check is to re-run
 * the guarding evals AFTER the edit and see them pass — that tests the text you
 * actually shipped, not a synthetic deletion of it.
 *
 * Always restore baseline in `finally` so a crashed run never leaves
 * `agent/skills/` mutated.
 *
 * Usage: `bun run ablate [--runs N] [<id>…]` (needs a model key for live grades).
 */
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { ABLATIONS, type Ablation } from "../ablations/manifest"

const here = dirname(fileURLToPath(import.meta.url))
const eveRoot = resolve(here, "..")

type EvalAssertion = {
  name: string
  passed?: boolean
  severity?: string
}

type EvalVerdict = {
  id: string
  verdict: string
  assertions?: EvalAssertion[]
}

type EvalRunSummary = {
  passed: number
  failed: number
  skipped?: number
  errored?: number
  /** Eve 0.26 `--json` emits `results[]` (not `evals[]`). */
  results: EvalVerdict[]
}

type Classification = "SURVIVED" | "KILLED" | "UNGUARDED" | "FLAKY" | "ERROR"

type Row = {
  id: string
  mode: "ablate" | "omit"
  classification: Classification
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

/** Read one balanced `{…}` starting at `start`; null if it never closes. */
function readBalancedObject(text: string, start: number): string | null {
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
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
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/**
 * Pull the summary object out of eve's mixed stdout (logs + JSON).
 *
 * Eve interleaves human-readable logs with the `--json` summary, and those logs
 * can themselves contain `{`. Anchoring on the FIRST candidate locked onto a
 * log fragment and died with "unclosed JSON object" mid-sweep (2026-07-27), so
 * scan candidates newest-first and accept the first that both parses and
 * carries `results[]` — the summary is emitted last.
 */
function extractJsonObject(stdout: string): unknown {
  const starts: number[] = []
  for (let i = 0; i < stdout.length; i++) {
    if (stdout[i] === "{" && (i === 0 || stdout[i - 1] === "\n")) starts.push(i)
  }
  if (stdout.indexOf("{") >= 0 && starts.length === 0) starts.push(stdout.indexOf("{"))

  for (let i = starts.length - 1; i >= 0; i--) {
    const slice = readBalancedObject(stdout, starts[i])
    if (!slice) continue
    try {
      const parsed = JSON.parse(slice)
      if (parsed && typeof parsed === "object" && Array.isArray((parsed as EvalRunSummary).results)) {
        return parsed
      }
    } catch {
      // Not the summary — keep scanning older candidates.
    }
  }
  throw new Error(
    `eve eval --json: no summary object with results[] in stdout\nstdout tail:\n${stdout.slice(-800)}`,
  )
}

/**
 * Run named evals via `eve eval <id…> --json`; return parsed summary.
 *
 * Invokes the `eve` binary directly, never `bun run eval`. The package
 * scripts re-run prepare-skills first so a hand-run eval can't grade a stale
 * copy of a skill — but here the tree has been deliberately mutated by the
 * caller (a heading cut, or a whole skill omitted), and re-preparing would
 * restore it and silently grade the unmutated pack. Every entry would come
 * back SURVIVED.
 */
function runEvals(ids: readonly string[]): EvalRunSummary {
  const r = run(["bunx", "eve", "eval", ...ids, "--json"])
  const summary = extractJsonObject(r.stdout) as EvalRunSummary
  if (!Array.isArray(summary.results)) {
    throw new Error(`eve eval --json: missing results[] in summary`)
  }
  return summary
}

/**
 * An eval that ERRORED is not evidence of anything.
 *
 * This used to fold `errored` into KILLED alongside `failed`, on the reasoning
 * that both are "not passing." They are not the same claim. KILLED means the
 * model read the mutated skill and behaved differently — the directive is
 * load-bearing. ERRORED means the eval never produced a judgement: a container
 * that would not start, a provider timeout, a fixture that failed to seed.
 *
 * Conflating them biases in the worst direction. Broken infrastructure reads as
 * proof that the cut text matters, so the directive gets kept and nobody looks
 * again. Report it as ERROR and let the run be re-driven.
 */
function classify(summary: EvalRunSummary): "SURVIVED" | "KILLED" | "ERROR" {
  if (summary.results.some((e) => e.verdict === "errored") || (summary.errored ?? 0) > 0) {
    return "ERROR"
  }
  if (summary.results.some((e) => e.verdict === "failed") || summary.failed > 0) return "KILLED"
  return "SURVIVED"
}

/**
 * Guarded evals must be green BEFORE the cut, in this same run.
 *
 * Without this, an eval that is red for an unrelated reason — a flaky judge, a
 * contract that drifted, a model change — reports KILLED for every ablation
 * pointed at it. The cut text gets credit for a failure it had nothing to do
 * with, and the louder the suite's background failure rate, the more
 * "load-bearing" everything looks.
 */
function baselineIsGreen(ids: readonly string[]): { green: boolean; detail: string } {
  prepare([])
  const summary = runEvals(ids)
  const verdict = classify(summary)
  return { green: verdict === "SURVIVED", detail: formatEvalLine(summary) }
}

/**
 * Negative control for a SURVIVED result.
 *
 * SURVIVED is ambiguous: the cut directive may be a genuine no-op, OR the eval
 * may never have depended on the skill in the first place. Those look identical
 * in the table, and only one of them means "safe to delete."
 *
 * So before reporting SURVIVED, re-run the same evals with the whole skill
 * omitted. `loadedSkill(...)` gates fail mechanically when the skill is absent,
 * so they are excluded — every OTHER gate passing means the base model already
 * produced the graded behavior unaided, and this eval cannot testify about the
 * skill's text at all.
 *
 * Measured 2026-07-27: `contracts/code-simplify-proposal-no-edits` scored 4/5
 * with `code` fully omitted — only the `loadedSkill` gate failed. Without this
 * control its SURVIVED reads as "delete the Scope contract section."
 */
function controlPassesWithoutSkill(ids: readonly string[], skillId: string): boolean {
  prepare(["--omit", skillId])
  const summary = runEvals(ids)
  return summary.results.every((r) => {
    const assertions = r.assertions ?? []
    // No assertion detail means we cannot prove non-discrimination; don't claim it.
    if (assertions.length === 0) return false
    return assertions.every((a) => a.passed === true || /^loadedSkill\(/.test(a.name))
  })
}

function formatEvalLine(summary: EvalRunSummary): string {
  return summary.results.map((e) => `${e.id}:${e.verdict}`).join(", ")
}

function runEntry(entry: Ablation, runs: number): Row {
  if (entry.retirement && entry.retirement.length > 0 && !entry.span) {
    console.log(`\n══ omit ${entry.skillId}  (${entry.id}) ══`)
    // Same baseline rule as the ablate path: a retirement eval that is already
    // red with the skill PRESENT cannot testify about removing it.
    console.log(`   baseline: ${entry.retirement.join(", ")} with ${entry.skillId} present…`)
    const baseline = baselineIsGreen(entry.retirement)
    if (!baseline.green) {
      return {
        id: entry.id,
        mode: "omit",
        classification: "ERROR",
        detail: `baseline not green with the skill present — ${baseline.detail}`,
        hypothesis: entry.hypothesis,
      }
    }
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
    console.log(
      `\n══ ablate ${entry.id}  (${entry.span.file ?? "SKILL.md"} ## ${entry.span.heading})` +
        `${runs > 1 ? `  ×${runs}` : ""} ══`,
    )
    // Establish the green baseline first, so a KILLED below can only mean the
    // cut changed something.
    console.log(`   baseline: ${entry.guardedBy.join(", ")} on the unmutated pack…`)
    const baseline = baselineIsGreen(entry.guardedBy)
    if (!baseline.green) {
      return {
        id: entry.id,
        mode: "ablate",
        classification: "ERROR",
        detail: `baseline not green before the cut — ${baseline.detail}`,
        hypothesis: entry.hypothesis,
      }
    }

    prepare(["--ablate", entry.id])

    // Repeat the same ablated build. Live grading is non-deterministic, and the
    // scale of that is not a footnote: two consecutive identical sweeps on
    // 2026-07-27 disagreed on 5 of 12 entries. A single run is a coin flip for
    // roughly half the manifest, so a lone KILLED or SURVIVED is not a verdict.
    const votes: ("SURVIVED" | "KILLED" | "ERROR")[] = []
    let lastSummary: EvalRunSummary | undefined
    for (let i = 0; i < runs; i++) {
      lastSummary = runEvals(entry.guardedBy)
      votes.push(classify(lastSummary))
      if (runs > 1) console.log(`   run ${i + 1}/${runs}: ${votes[i]}`)
    }

    const errored = votes.filter((v) => v === "ERROR").length
    if (errored > 0) {
      return {
        id: entry.id,
        mode: "ablate",
        classification: "ERROR",
        detail: `${errored}/${runs} run(s) errored — no verdict`,
        hypothesis: entry.hypothesis,
      }
    }

    const killed = votes.filter((v) => v === "KILLED").length
    const survived = votes.filter((v) => v === "SURVIVED").length
    let classification: Classification =
      killed > 0 && survived > 0 ? "FLAKY" : killed > 0 ? "KILLED" : "SURVIVED"
    let detail =
      runs > 1
        ? `KILLED ${killed}/${runs}, SURVIVED ${survived}/${runs}`
        : formatEvalLine(lastSummary!)

    // A SURVIVED is only meaningful if the eval could ever have failed for
    // want of this skill. Prove that before reporting it as a cut candidate.
    // FLAKY needs no control: it already killed at least once, so the eval
    // demonstrably reacts to the skill.
    if (classification === "SURVIVED") {
      console.log(`   control: re-running ${entry.guardedBy.join(", ")} with ${entry.skillId} omitted…`)
      if (controlPassesWithoutSkill(entry.guardedBy, entry.skillId)) {
        classification = "UNGUARDED"
        detail = `${detail} (passes without ${entry.skillId})`
      }
    }

    return {
      id: entry.id,
      mode: "ablate",
      classification,
      detail,
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

  // Optional id filter: `bun run ablate <id> [<id>...]`. A full sweep is one
  // live model session per guarded eval, so re-running a single entry after
  // editing its eval should not cost the whole manifest.
  const argv = process.argv.slice(2)

  // `--runs N` repeats each ablated build N times and reports the vote split.
  // Default 1 keeps a sweep cheap; raise it before acting on any single result.
  let runs = 1
  const runsFlag = argv.findIndex((a) => a === "--runs")
  if (runsFlag >= 0) {
    const raw = argv[runsFlag + 1]
    runs = Number(raw)
    if (!Number.isInteger(runs) || runs < 1) {
      console.error(`ablate: --runs expects a positive integer, got "${raw}"`)
      process.exit(2)
    }
    argv.splice(runsFlag, 2)
  }

  const only = argv.filter((a) => !a.startsWith("-"))
  const unknown = only.filter((id) => !ABLATIONS.some((a) => a.id === id))
  if (unknown.length > 0) {
    console.error(
      `ablate: unknown ablation id(s): ${unknown.join(", ")}\n` +
        `known: ${ABLATIONS.map((a) => a.id).join(", ")}`,
    )
    process.exit(2)
  }
  const selected = only.length > 0 ? ABLATIONS.filter((a) => only.includes(a.id)) : ABLATIONS

  const rows: Row[] = []
  try {
    for (const entry of selected) {
      try {
        rows.push(runEntry(entry, runs))
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
