/**
 * Outcome verification: judge what a skill PRODUCED, not what it said.
 *
 * The rest of this suite grades prose. It can tell you the model recited
 * `simplify`'s rubric; it cannot tell you a simplification it performed kept the
 * code correct. This module closes that gap for skills whose output is a
 * checkable artifact.
 *
 * ## Why verification runs on the host
 *
 * The obvious design seeds a fixture into the sandbox with a `hidden/` directory
 * of tests beside it. That is not hidden: the subject has `bash`, `glob`, and
 * `read_file` pointed at the same `/workspace`, so it can read the tests it is
 * being graded by and write code that satisfies them specifically.
 *
 * Eve also gives the eval driver no sandbox handle — `ctx.getSandbox()` exists
 * only inside authored runtime execution, not inside `test(t)`.
 *
 * Both problems have one answer: never put the verification in the sandbox. The
 * fixture source travels to the model inside the prompt, the model's output
 * comes back in the reply, and the hidden suite runs here on the host against
 * the extracted code. The subject cannot read, edit, or disable a test file it
 * never had access to.
 *
 * ## What a pass requires
 *
 * Green tests alone would reward deleting the hard parts, and a line-count drop
 * alone would reward deleting anything. `verifyCandidate` reports both, plus
 * whether the exports still exist, and the eval gates on the combination.
 */
import { execFileSync } from "node:child_process"
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Locate `fixtures/` without trusting this file's own path.
 *
 * Eve compiles eval modules into `node_modules/.cache` before running them, so
 * an `import.meta.url`-relative resolve lands inside the cache and every fixture
 * read fails with ENOENT. Walk up from the working directory instead, and fall
 * back to the module path for any caller that runs these helpers directly.
 */
function findFixtureRoot(): string {
  const starts = [process.cwd(), dirname(fileURLToPath(import.meta.url))]
  for (const start of starts) {
    let dir = start
    for (let depth = 0; depth < 8; depth++) {
      const candidate = join(dir, "fixtures")
      if (existsSync(join(candidate, "normalize-config", "input.js"))) return candidate
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  throw new Error(
    `could not locate evals/eve/fixtures from ${process.cwd()} — outcome evals need it on disk`,
  )
}

export const FIXTURE_ROOT: string = findFixtureRoot()

export type Fixture = {
  /** Directory name under `fixtures/`. */
  readonly name: string
  /** Symbols the simplified code must still export. */
  readonly exports: readonly string[]
}

/** The messy source a fixture hands to the model, verbatim. */
export function fixtureInput(fixture: Fixture): string {
  return readFileSync(join(FIXTURE_ROOT, fixture.name, "input.js"), "utf8")
}

/** Read any file from a fixture directory, for fixtures with several inputs. */
export function fixtureFile(name: string, file: string): string {
  return readFileSync(join(FIXTURE_ROOT, name, file), "utf8")
}

export type PruneVerification = {
  readonly extracted: boolean
  /** The pruned suite still passes against unmutated source. */
  readonly suiteGreen: boolean
  /** Mutants the pruned suite still catches. */
  readonly killed: readonly string[]
  /** Mutants that now go undetected — a guard was pruned away. */
  readonly survived: readonly string[]
  /** Noise tests the model was expected to remove but kept. */
  readonly noiseKept: readonly string[]
  /** Tests whose text must survive, checked by substring. */
  readonly missingMarkers: readonly string[]
  readonly tests: { readonly before: number; readonly after: number }
  readonly error?: string
}

function countTests(source: string): number {
  return [...source.matchAll(/^\s*test\s*\(/gm)].length
}

function runSuite(dir: string): boolean {
  try {
    execFileSync("node", ["--test", "--test-reporter=tap"], {
      cwd: dir,
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, FEATURE_BETA_PRICING: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Grade a test-pruning pass by MUTATION SCORE, not by which tests remain.
 *
 * Asserting that specific test names survived would grade the model's naming.
 * What actually matters is whether the behaviors are still guarded: for each
 * planted fault in `mutants/`, the pruned suite must still fail. A suite that
 * deleted the guard for a fault goes green against it, and that is the failure.
 *
 * The env-gated flag is set here on purpose. A test skipped in CI today is
 * still a real guard when the flag turns on; pruning it because it "never runs"
 * is exactly the mistake this measures.
 */
export function verifyPruning(
  fixtureName: string,
  reply: string,
  opts: {
    /** Substrings that must still appear in the pruned suite. */
    readonly requiredMarkers: readonly string[]
    /** Test names that are genuine noise and should be gone. */
    readonly noiseNames: readonly string[]
  },
): PruneVerification {
  const before = countTests(fixtureFile(fixtureName, "input.test.js"))
  const empty = { before, after: 0 }
  const candidate = extractCodeBlock(reply)
  if (candidate === null) {
    return {
      extracted: false,
      suiteGreen: false,
      killed: [],
      survived: [],
      noiseKept: [],
      missingMarkers: [],
      tests: empty,
      error: "no fenced code block in the reply",
    }
  }

  const fixtureDir = join(FIXTURE_ROOT, fixtureName)
  const mutantDir = join(fixtureDir, "mutants")
  const mutants = readdirSync(mutantDir).filter((f) => f.endsWith(".js"))
  const dir = mkdtempSync(join(tmpdir(), `eve-prune-${fixtureName}-`))
  try {
    writeFileSync(join(dir, "suite.test.js"), `${candidate}\n`)
    cpSync(join(fixtureDir, "source.js"), join(dir, "source.js"))
    const suiteGreen = runSuite(dir)

    const killed: string[] = []
    const survived: string[] = []
    for (const mutant of mutants) {
      cpSync(join(mutantDir, mutant), join(dir, "source.js"))
      // A mutant is killed when the suite FAILS against it.
      ;(runSuite(dir) ? survived : killed).push(mutant.replace(/\.js$/, ""))
    }

    return {
      extracted: true,
      suiteGreen,
      killed,
      survived,
      noiseKept: opts.noiseNames.filter((n) => candidate.includes(n)),
      missingMarkers: opts.requiredMarkers.filter((m) => !candidate.includes(m)),
      tests: { before, after: countTests(candidate) },
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export type Verification = {
  /** A fenced code block was found and it parses as a module. */
  readonly extracted: boolean
  /** The hidden suite ran to completion with every test passing. */
  readonly testsPass: boolean
  /** Test names that failed, for the assertion message. */
  readonly failures: readonly string[]
  /** Every declared export is still present. */
  readonly exportsIntact: boolean
  /** Non-comment, non-blank lines: candidate vs the fixture input. */
  readonly lines: { readonly before: number; readonly after: number }
  /** Set when extraction or the run itself broke, as opposed to tests failing. */
  readonly error?: string
}

/**
 * Pull the last fenced code block out of a reply.
 *
 * Last rather than first: models routinely show the original or an intermediate
 * step before the final version, and the final one is what shipped.
 */
export function extractCodeBlock(reply: string): string | null {
  const fences = [...reply.matchAll(/```(?:javascript|js|ts|typescript)?\n([\s\S]*?)```/g)]
  if (fences.length === 0) return null
  return fences[fences.length - 1][1].trimEnd()
}

function significantLines(source: string): number {
  return source
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("//") && !l.startsWith("*") && !l.startsWith("/*")).length
}

/** TAP `not ok` lines name the failing tests. */
function parseFailures(tap: string): string[] {
  return [...tap.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1].trim())
}

/**
 * Run a fixture's hidden suite against code the model produced.
 *
 * The candidate and the hidden suite are copied into a fresh host temp
 * directory, so a run cannot see or disturb the fixture sources, and two evals
 * running concurrently cannot collide.
 */
export function verifyCandidate(fixture: Fixture, reply: string): Verification {
  const before = significantLines(fixtureInput(fixture))
  const empty = { before, after: 0 }

  const candidate = extractCodeBlock(reply)
  if (candidate === null) {
    return {
      extracted: false,
      testsPass: false,
      failures: [],
      exportsIntact: false,
      lines: empty,
      error: "no fenced code block in the reply",
    }
  }

  const exportsIntact = fixture.exports.every((name) =>
    new RegExp(`\\b${name}\\b`).test(candidate),
  )
  const lines = { before, after: significantLines(candidate) }
  const dir = mkdtempSync(join(tmpdir(), `eve-outcome-${fixture.name}-`))
  try {
    writeFileSync(join(dir, "candidate.js"), `${candidate}\n`)
    cpSync(join(FIXTURE_ROOT, fixture.name, "hidden.test.js"), join(dir, "hidden.test.js"))

    let tap: string
    let testsPass: boolean
    try {
      tap = execFileSync("node", ["--test", "--test-reporter=tap"], {
        cwd: dir,
        encoding: "utf8",
        timeout: 60_000,
        stdio: ["ignore", "pipe", "pipe"],
      })
      testsPass = true
    } catch (err) {
      // node --test exits non-zero when any test fails; that is a result, not a
      // harness error, and its TAP output is still on stdout.
      const e = err as { stdout?: string; stderr?: string }
      tap = e.stdout ?? ""
      testsPass = false
      if (tap === "") {
        return {
          extracted: true,
          testsPass: false,
          failures: [],
          exportsIntact,
          lines,
          error: `node --test produced no output: ${(e.stderr ?? "").slice(0, 300)}`,
        }
      }
    }
    return { extracted: true, testsPass, failures: parseFailures(tap), exportsIntact, lines }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
