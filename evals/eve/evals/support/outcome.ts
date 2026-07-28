/**
 * Outcome verification: judge what a skill PRODUCED, not what it said.
 *
 * The rest of this suite grades prose. It can tell you the model recited
 * `simplify`'s rubric; it cannot tell you a simplification it performed kept the
 * code correct. This module closes that gap for skills whose output is a
 * checkable artifact.
 *
 * ## Why verification runs outside the subject sandbox
 *
 * The obvious design seeds a fixture into the sandbox with a `hidden/` directory
 * of tests beside it. That is not hidden: the subject has `bash`, `glob`, and
 * `read_file` pointed at the same `/workspace`, so it can read the tests it is
 * being graded by and write code that satisfies them specifically.
 *
 * Eve also gives the eval driver no sandbox handle — `ctx.getSandbox()` exists
 * only inside authored runtime execution, not inside `test(t)`.
 *
 * Both problems have one answer: never put the verification in the subject
 * sandbox. The fixture source travels to the model inside the prompt, the
 * model's output comes back in the reply, and the hidden suite runs in a second,
 * locked-down Docker container. The model never sees the hidden suite before it
 * produces the artifact, and the artifact never executes on the host.
 *
 * ## What a pass requires
 *
 * Green tests alone would reward deleting the hard parts, and a line-count drop
 * alone would reward deleting anything. `verifyCandidate` reports both, plus
 * whether the exports still exist, and the eval gates on the combination.
 */
import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const OUTCOME_IMAGE =
  process.env.EVE_OUTCOME_IMAGE ??
  "node@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d"
const MAX_CANDIDATE_BYTES = 128 * 1024
const MAX_RUN_OUTPUT_BYTES = 1024 * 1024

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
const EVAL_ROOT = dirname(FIXTURE_ROOT)

type ContainerRun = {
  readonly passed: boolean
  readonly output: string
  readonly infrastructureError?: string
}

function dockerClientEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const key of ["PATH", "HOME", "DOCKER_HOST", "DOCKER_CONTEXT", "XDG_CONFIG_HOME"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key]
  }
  return env
}

function runInVerifier(
  dir: string,
  command: readonly string[],
  opts: {
    readonly env?: Readonly<Record<string, string>>
    readonly mountDependencies?: boolean
  } = {},
): ContainerRun {
  const name = `eve-outcome-${process.pid}-${randomUUID().slice(0, 12)}`
  const args = [
    "run",
    "--rm",
    "--name",
    name,
    "--pull",
    "never",
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "64",
    "--memory",
    "256m",
    "--cpus",
    "1",
    "--user",
    "65534:65534",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=16m",
    "--mount",
    `type=bind,src=${resolve(dir)},dst=/work,readonly`,
    "--workdir",
    "/work",
  ]

  if (opts.mountDependencies) {
    const dependencies = join(EVAL_ROOT, "node_modules")
    if (!existsSync(join(dependencies, "typescript", "bin", "tsc"))) {
      return {
        passed: false,
        output: "",
        infrastructureError: `TypeScript is not installed under ${dependencies}`,
      }
    }
    args.push("--mount", `type=bind,src=${resolve(dependencies)},dst=/deps,readonly`)
  }

  for (const [key, value] of Object.entries(opts.env ?? {})) {
    args.push("--env", `${key}=${value}`)
  }

  args.push(
    OUTCOME_IMAGE,
    "timeout",
    "-s",
    "KILL",
    "15s",
    ...command,
  )

  const result = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: MAX_RUN_OUTPUT_BYTES,
    env: dockerClientEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  })

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
  const dockerClientFailure =
    /permission denied while trying to connect to the docker API|cannot connect to the docker daemon|error during connect/i.test(
      output,
    )
  if (result.error || result.status === null || result.status === 125 || dockerClientFailure) {
    // The inner timeout bounds candidate execution. This cleanup is for a
    // Docker daemon or client failure that outlives that bound.
    spawnSync("docker", ["rm", "--force", name], {
      encoding: "utf8",
      timeout: 10_000,
      env: dockerClientEnv(),
      stdio: "ignore",
    })
    const cause =
      result.error?.message ??
      (result.signal ? `docker exited on ${result.signal}` : output.trim() || "docker failed")
    return {
      passed: false,
      output,
      infrastructureError: cause.slice(0, 500),
    }
  }

  return { passed: result.status === 0, output }
}

function runRuntimeSuite(dir: string, env?: Readonly<Record<string, string>>): ContainerRun {
  return runInVerifier(dir, ["node", "--test", "--test-reporter=tap"], { env })
}

function runTypecheck(dir: string): ContainerRun {
  return runInVerifier(
    dir,
    [
      "node",
      "/deps/typescript/bin/tsc",
      "--noEmit",
      "--allowJs",
      "--checkJs",
      "--skipLibCheck",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--target",
      "ES2022",
      "--types",
      "node",
      "--typeRoots",
      "/deps/@types",
      "suite.test.js",
      "source.js",
    ],
    { mountDependencies: true },
  )
}

function candidateError(candidate: string): string | undefined {
  const bytes = Buffer.byteLength(candidate)
  if (bytes <= MAX_CANDIDATE_BYTES) return undefined
  return `candidate is ${bytes} bytes; limit is ${MAX_CANDIDATE_BYTES}`
}

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
  /** Runtime tests still pass against unmutated source. */
  readonly runtimeGreen: boolean
  /** Compile-time checks still pass against unmutated source. */
  readonly typecheckGreen: boolean
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
      runtimeGreen: false,
      typecheckGreen: false,
      killed: [],
      survived: [],
      noiseKept: [],
      missingMarkers: [],
      tests: empty,
      error: "no fenced code block in the reply",
    }
  }

  const oversized = candidateError(candidate)
  if (oversized) {
    return {
      extracted: true,
      runtimeGreen: false,
      typecheckGreen: false,
      killed: [],
      survived: [],
      noiseKept: [],
      missingMarkers: [],
      tests: { before, after: countTests(candidate) },
      error: oversized,
    }
  }

  const fixtureDir = join(FIXTURE_ROOT, fixtureName)
  const mutantDir = join(fixtureDir, "mutants")
  const mutants = readdirSync(mutantDir).filter((f) => f.endsWith(".js"))
  const dir = mkdtempSync(join(tmpdir(), `eve-prune-${fixtureName}-`))
  chmodSync(dir, 0o755)
  try {
    writeFileSync(join(dir, "suite.test.js"), `${candidate}\n`)
    writeFileSync(join(dir, "package.json"), '{"type":"module"}\n')
    cpSync(join(fixtureDir, "source.js"), join(dir, "source.js"))
    const runtime = runRuntimeSuite(dir, { FEATURE_BETA_PRICING: "1" })
    const typecheck = runTypecheck(dir)

    const infrastructureError = runtime.infrastructureError ?? typecheck.infrastructureError
    if (infrastructureError) {
      return {
        extracted: true,
        runtimeGreen: false,
        typecheckGreen: false,
        killed: [],
        survived: [],
        noiseKept: opts.noiseNames.filter((n) => candidate.includes(n)),
        missingMarkers: opts.requiredMarkers.filter((m) => !candidate.includes(m)),
        tests: { before, after: countTests(candidate) },
        error: infrastructureError,
      }
    }

    if (!runtime.passed || !typecheck.passed) {
      return {
        extracted: true,
        runtimeGreen: runtime.passed,
        typecheckGreen: typecheck.passed,
        killed: [],
        survived: [],
        noiseKept: opts.noiseNames.filter((n) => candidate.includes(n)),
        missingMarkers: opts.requiredMarkers.filter((m) => !candidate.includes(m)),
        tests: { before, after: countTests(candidate) },
      }
    }

    const killed: string[] = []
    const survived: string[] = []
    for (const mutant of mutants) {
      cpSync(join(mutantDir, mutant), join(dir, "source.js"))
      // A mutant is killed when the suite FAILS against it.
      const run = runRuntimeSuite(dir, { FEATURE_BETA_PRICING: "1" })
      if (run.infrastructureError) {
        return {
          extracted: true,
          runtimeGreen: true,
          typecheckGreen: true,
          killed,
          survived,
          noiseKept: opts.noiseNames.filter((n) => candidate.includes(n)),
          missingMarkers: opts.requiredMarkers.filter((m) => !candidate.includes(m)),
          tests: { before, after: countTests(candidate) },
          error: run.infrastructureError,
        }
      }
      ;(run.passed ? survived : killed).push(mutant.replace(/\.js$/, ""))
    }

    return {
      extracted: true,
      runtimeGreen: true,
      typecheckGreen: true,
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
 * The candidate and hidden suite are copied into a fresh temp directory, then
 * mounted read-only into an isolated verifier container. Runs cannot disturb
 * fixture sources or collide with each other.
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

  const oversized = candidateError(candidate)
  if (oversized) {
    return {
      extracted: true,
      testsPass: false,
      failures: [],
      exportsIntact: false,
      lines: { before, after: significantLines(candidate) },
      error: oversized,
    }
  }

  const exportsIntact = fixture.exports.every((name) =>
    new RegExp(`\\b${name}\\b`).test(candidate),
  )
  const lines = { before, after: significantLines(candidate) }
  const dir = mkdtempSync(join(tmpdir(), `eve-outcome-${fixture.name}-`))
  chmodSync(dir, 0o755)
  try {
    writeFileSync(join(dir, "candidate.js"), `${candidate}\n`)
    writeFileSync(join(dir, "package.json"), '{"type":"module"}\n')
    cpSync(join(FIXTURE_ROOT, fixture.name, "hidden.test.js"), join(dir, "hidden.test.js"))

    const run = runRuntimeSuite(dir)
    if (run.infrastructureError) {
      return {
        extracted: true,
        testsPass: false,
        failures: [],
        exportsIntact,
        lines,
        error: run.infrastructureError,
      }
    }
    const failures = parseFailures(run.output)
    if (!run.passed && failures.length === 0) {
      return {
        extracted: true,
        testsPass: false,
        failures,
        exportsIntact,
        lines,
        error: `node --test failed without a named test failure: ${run.output.slice(0, 500)}`,
      }
    }
    return {
      extracted: true,
      testsPass: run.passed,
      failures,
      exportsIntact,
      lines,
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
