#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

type AgentMode = "none" | "claude" | "codex" | "auto" | "peer"
type ConcreteAgent = "none" | "claude" | "codex"
type Invoker = "claude" | "codex" | "unknown"
type PackageManager = "bun" | "pnpm" | "yarn" | "npm" | ""

type Options = {
  agent: AgentMode
  agentExplicit: boolean
  baseRef: string
  outDir: string
  runChecks: boolean
  runFixes: boolean
}

type Step = {
  logFile: string
  name: string
  status: number
}

type QualityGate = {
  applies: boolean
  appliesWhen: string
  deepPass: string
  evidence: string
  gate: string
  pattern: string
  quickPass: string
  signal: string
}

type ClassificationKey =
  | "api"
  | "cli"
  | "code"
  | "config"
  | "doc"
  | "golden"
  | "oracle"
  | "perf"
  | "test"
  | "ui"

type Classification = {
  flags: Record<ClassificationKey, boolean>
  reasons: Record<ClassificationKey, string[]>
  surfaces: Record<string, { reason: string; surface: string }>
}

type FileSignal = {
  file: string
  sample: string
}

type AgentPreference = {
  reviewAgent: ConcreteAgent
  updatedAt: string
}

const classificationKeys: ClassificationKey[] = [
  "api",
  "cli",
  "code",
  "config",
  "doc",
  "golden",
  "oracle",
  "perf",
  "test",
  "ui",
]

const maxSignalFiles = 80
const maxPerFileSignalChars = 14000
const maxTotalSignalChars = 120000

const usage = `Usage: finish-lane.ts [options]

Run a deterministic post-implementation finishing lane for a git checkout:
scope audit, mechanical cleanup, targeted QA plan, validation commands, and PR
prep artifacts.

Options:
  --base REF        Compare changes against REF when producing summaries.
                    Defaults to the upstream default branch when discoverable,
                    then origin/main, then main, then HEAD.
  --out DIR         Artifact directory. Defaults to
                    .workflow/finish-lane/<timestamp>.
  --fix             Run safe mechanical cleanup commands when present
                    (format, fmt, lint:fix, fix).
  --agent NAME      Also run a read-only non-interactive review/prep pass.
                    Supported: auto, none, peer, claude, codex.
                    Default: auto, which uses the saved project preference or
                    skips the agent pass when no preference exists.
                    peer means the opposite of the detected invoker.
  --no-checks       Skip discovered validation commands.
  --help            Show this help.

The script never stages, commits, pushes, or creates a PR. It writes artifacts
that the current agent can inspect before doing those higher-risk steps.`

function parseArgs(args: string[]): Options {
  const options: Options = {
    agent: "auto",
    agentExplicit: false,
    baseRef: "",
    outDir: "",
    runChecks: true,
    runFixes: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    switch (arg) {
      case "--base":
        options.baseRef = requiredValue(args, ++index, "--base")
        break
      case "--out":
        options.outDir = requiredValue(args, ++index, "--out")
        break
      case "--fix":
        options.runFixes = true
        break
      case "--agent": {
        const agent = requiredValue(args, ++index, "--agent")
        if (!["none", "claude", "codex", "auto", "peer"].includes(agent)) {
          fail("--agent must be one of: auto, none, peer, claude, codex", 2)
        }
        options.agent = agent as AgentMode
        options.agentExplicit = true
        break
      }
      case "--no-checks":
        options.runChecks = false
        break
      case "--help":
      case "-h":
        console.log(usage)
        process.exit(0)
      default:
        fail(`Unknown option: ${arg}\n\n${usage}`, 2)
    }
  }

  return options
}

function requiredValue(args: string[], index: number, flag: string): string {
  const value = args[index]
  if (!value) {
    fail(`${flag} requires a value`, 2)
  }
  return value
}

function fail(message: string, code = 1): never {
  console.error(message)
  process.exit(code)
}

function runCapture(command: string, cwd = process.cwd()): { output: string; status: number } {
  const result = spawnSync(command, {
    cwd,
    encoding: "utf8",
    shell: "/bin/bash",
  })

  return {
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    status: typeof result.status === "number" ? result.status : 1,
  }
}

function commandExists(command: string): boolean {
  return runCapture(`command -v ${shellQuote(command)} >/dev/null 2>&1`).status === 0
}

function preferencePath(rootDir: string): string {
  return path.join(rootDir, ".workflow", "finish-lane", "preferences.json")
}

function readAgentPreference(rootDir: string): AgentPreference | null {
  const file = preferencePath(rootDir)
  if (!existsSync(file)) {
    return null
  }

  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<AgentPreference>
    if (parsed.reviewAgent && ["none", "claude", "codex"].includes(parsed.reviewAgent)) {
      return {
        reviewAgent: parsed.reviewAgent as ConcreteAgent,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
      }
    }
  } catch {
    return null
  }
  return null
}

function writeAgentPreference(rootDir: string, reviewAgent: ConcreteAgent): void {
  const file = preferencePath(rootDir)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        reviewAgent,
        updatedAt: new Date().toISOString(),
      } satisfies AgentPreference,
      null,
      2,
    )}\n`,
    "utf8",
  )
}

function envValue(name: string): string {
  return (process.env[name] ?? "").toLowerCase()
}

function detectInvoker(): Invoker {
  const explicit = envValue("FINISH_LANE_INVOKER") || envValue("AGENT_INVOKER")
  if (explicit === "claude" || explicit === "codex") {
    return explicit
  }

  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE || process.env.CLAUDE_PLUGIN_ROOT) {
    return "claude"
  }
  if (process.env.CODEX_THREAD_ID || process.env.CODEX_SHELL || process.env.CODEX_HOME || process.env.CODEX_CI) {
    return "codex"
  }
  return "unknown"
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function markdownEscape(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ")
}

function jsonForHtml(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

function timestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

function log(message: string): void {
  console.log(`[finish-lane] ${message}`)
}

function gitRefExists(ref: string): boolean {
  return runCapture(`git rev-parse --verify --quiet ${shellQuote(ref)} >/dev/null`).status === 0
}

function detectBaseRef(requested: string): string {
  if (requested) {
    return requested
  }

  const upstream = runCapture("git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||'").output.trim()
  if (upstream && gitRefExists(`origin/${upstream}`)) {
    return `origin/${upstream}`
  }

  for (const candidate of ["origin/main", "origin/master", "main", "master", "HEAD"]) {
    if (gitRefExists(candidate)) {
      return candidate
    }
  }

  return "HEAD"
}

function packageManager(rootDir: string): PackageManager {
  if (existsSync(path.join(rootDir, "bun.lockb")) || existsSync(path.join(rootDir, "bun.lock"))) {
    return "bun"
  }
  if (existsSync(path.join(rootDir, "pnpm-lock.yaml"))) {
    return "pnpm"
  }
  if (existsSync(path.join(rootDir, "yarn.lock"))) {
    return "yarn"
  }
  if (existsSync(path.join(rootDir, "package-lock.json")) || existsSync(path.join(rootDir, "package.json"))) {
    return "npm"
  }
  return ""
}

function packageScripts(rootDir: string): Record<string, string> {
  const packagePath = path.join(rootDir, "package.json")
  if (!existsSync(packagePath)) {
    return {}
  }

  try {
    const parsed = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> }
    return parsed.scripts ?? {}
  } catch {
    return {}
  }
}

function packageScriptCommand(pm: PackageManager, scriptName: string): string {
  switch (pm) {
    case "bun":
      return `bun run ${scriptName}`
    case "pnpm":
      return `pnpm run ${scriptName}`
    case "yarn":
      return `yarn ${scriptName}`
    case "npm":
      return `npm run ${scriptName}`
    default:
      return ""
  }
}

function runStep(name: string, command: string, rootDir: string, logDir: string, steps: Step[]): void {
  const logFile = path.join(logDir, `${name}.log`)
  log(`running ${name}`)
  const result = runCapture(command, rootDir)
  writeFileSync(logFile, `$ ${command}\n\n${result.output}`, "utf8")
  steps.push({ logFile, name, status: result.status })

  if (result.status === 0) {
    log(`ok ${name}`)
  } else {
    log(`failed ${name} (exit ${result.status})`)
  }
}

function writeSteps(outDir: string, steps: Step[]): void {
  writeFileSync(
    path.join(outDir, "steps.tsv"),
    steps.map((step) => `${step.name}\t${step.status}\t${step.logFile}`).join("\n") + (steps.length ? "\n" : ""),
    "utf8",
  )
}

function writeChangedFiles(rootDir: string, outDir: string, outRel: string, baseRef: string): string[] {
  const sections = [
    "# tracked",
    ...runCapture(`git diff --name-only ${shellQuote(baseRef)}...HEAD 2>/dev/null`, rootDir).output.split(/\r?\n/),
    ...runCapture("git diff --name-only 2>/dev/null", rootDir).output.split(/\r?\n/),
    ...runCapture("git diff --cached --name-only 2>/dev/null", rootDir).output.split(/\r?\n/),
    "# untracked",
    ...runCapture("git ls-files --others --exclude-standard 2>/dev/null", rootDir).output.split(/\r?\n/),
  ]

  const seen = new Set<string>()
  const files: string[] = []
  for (const raw of sections) {
    const file = raw.trim()
    if (!file || seen.has(file)) {
      continue
    }
    if (file === ".workflow" || file.startsWith(".workflow/")) {
      continue
    }
    if (outRel && (file === outRel || file.startsWith(`${outRel}/`))) {
      continue
    }
    seen.add(file)
    files.push(file)
  }

  writeFileSync(path.join(outDir, "changed-files.txt"), `${files.join("\n")}\n`, "utf8")
  return files.filter((file) => !file.startsWith("#"))
}

function writeSecretRiskReport(outDir: string, changedFiles: string[]): void {
  const pattern = /(^|\/)\.env($|[.\/])|secret|token|credential|private[_-]?key|service-account|dump|export|backup|\.pem$|\.p12$|\.key$|\.sqlite$|\.db$/i
  const matches = changedFiles.filter((file) => pattern.test(file))

  writeFileSync(
    path.join(outDir, "secret-risk.md"),
    [
      "# Secret / bulky-file filename risk scan",
      "",
      "This is a filename-only scan. Inspect matches before staging.",
      "",
      ...matches.map((file) => `- ${file}`),
      "",
    ].join("\n"),
    "utf8",
  )
}

function findCandidateFiles(rootDir: string, outRel: string): string[] {
  const roots = ["scripts", "bin", ".github", "workflows", "."]
  const namePattern = /(auth|login|setup|seed|fixture|e2e|playwright)/i
  const results = new Set<string>()

  for (const root of roots) {
    const absolute = path.join(rootDir, root)
    if (!existsSync(absolute)) {
      continue
    }
    walk(absolute, rootDir, outRel, (relative) => {
      if (namePattern.test(relative)) {
        results.add(relative)
      }
    }, 3)
  }

  return Array.from(results).sort()
}

function walk(
  current: string,
  rootDir: string,
  outRel: string,
  visit: (relative: string) => void,
  maxDepth: number,
  depth = 0,
): void {
  if (depth > maxDepth) {
    return
  }

  let entries
  try {
    entries = readdirSync(current, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const absolute = path.join(current, entry.name)
    const relative = path.relative(rootDir, absolute)
    if (
      relative.startsWith(".git/") ||
      relative.startsWith("node_modules/") ||
      relative.startsWith(".workflow/") ||
      (outRel && (relative === outRel || relative.startsWith(`${outRel}/`)))
    ) {
      continue
    }
    if (entry.isDirectory()) {
      walk(absolute, rootDir, outRel, visit, maxDepth, depth + 1)
    } else if (entry.isFile()) {
      visit(relative)
    }
  }
}

function writeSetupScriptInventory(rootDir: string, outDir: string, outRel: string, scripts: Record<string, string>): void {
  const pattern = /(auth|login|setup|seed|fixture|dev|preview|serve|start|e2e|playwright|test)/i
  const scriptLines = Object.entries(scripts)
    .filter(([name, command]) => pattern.test(name) || pattern.test(command))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, command]) => `- package script \`${name}\`: \`${command}\``)
  const fileLines = findCandidateFiles(rootDir, outRel).map((file) => `- file \`${file}\``)

  writeFileSync(
    path.join(outDir, "setup-scripts.txt"),
    [
      "# Setup / auth / test-entrypoint script candidates",
      "",
      "Use deterministic setup scripts for repeated work such as login, seeded",
      "accounts, fixture loading, dev-server boot, and test data resets. Prefer",
      "these over slow browser-only setup when they exercise the same precondition.",
      "",
      ...(existsSync(path.join(rootDir, "package.json")) ? scriptLines : ["- No package.json found."]),
      ...fileLines,
      "",
    ].join("\n"),
    "utf8",
  )
}

function writeSetupBlueprintTemplate(outDir: string): void {
  writeFileSync(
    path.join(outDir, "setup-blueprint-template.yml"),
    `# Save hard-won setup knowledge here when QA required manual discovery.
# Move the useful parts into a repo-owned testing skill, script, or fixture when
# it becomes repeatable.
name: finish-lane-setup
trigger:
  when_needed: []
environment:
  required_services: []
  required_secrets: []
  feature_flags: []
  seed_data: []
steps:
  - name: ""
    deterministic_command: ""
    manual_fallback: ""
    expected_ready_signal: ""
reuse_candidate:
  should_promote_to_repo_skill: false
  reason: ""
`,
    "utf8",
  )
}

function writeVerificationTimeline(outDir: string): void {
  writeFileSync(
    path.join(outDir, "verification-timeline.md"),
    `# Verification Timeline

Use this as the chronological proof trail. Before taking an action, write the
expected behavior. After the action, mark it \`passed\`, \`failed\`, or \`untested\`
with evidence.

| Time | Phase | Action | Expected Before Action | Result | Evidence |
|---|---|---|---|---|---|
| | setup | | | untested | |

## Guardrails

- Prefer real user-path actions for UI verification. Do not use browser
  JavaScript to force state unless you label it as a lower-level probe and still
  cover the user path.
- For timing-sensitive UI such as toasts, loading states, animations, or
  redirects, capture evidence around the action instead of one arbitrary
  screenshot.
- If setup required secrets, OTP, VPN, or a manual handoff, record that blocker
  and the repeatable setup path to create next.
`,
    "utf8",
  )
}

function emptyFlags(): Record<ClassificationKey, boolean> {
  return Object.fromEntries(classificationKeys.map((key) => [key, false])) as Record<ClassificationKey, boolean>
}

function emptyReasons(): Record<ClassificationKey, string[]> {
  return Object.fromEntries(classificationKeys.map((key) => [key, []])) as Record<ClassificationKey, string[]>
}

function addReason(classification: Classification, key: ClassificationKey, file: string, reason: string): void {
  classification.flags[key] = true
  const entry = `\`${file}\`: ${reason}`
  if (!classification.reasons[key].includes(entry) && classification.reasons[key].length < 5) {
    classification.reasons[key].push(entry)
  }
}

function isConfigPath(file: string): boolean {
  return (
    /(^|\/)\.gitignore$/i.test(file) ||
    /(^|\/)(package|tsconfig|jsconfig|vite|next|nuxt|astro|eslint|prettier|biome|wrangler|turbo|nx|deno|bunfig|versions)\.(json|jsonc|ya?ml|toml|js|mjs|cjs|ts)$/i.test(
      file,
    ) ||
    /(^|\/)(plugin|marketplace)\.json$/i.test(file) ||
    /\.(json|jsonc|ya?ml|toml)$/i.test(file)
  )
}

function isDocPath(file: string): boolean {
  return /(^|\/)README(?:\.[^/]+)?$|(^|\/)docs\/|\.md$/i.test(file)
}

function isCliPath(file: string): boolean {
  return /(^|\/)(commands|bin|scripts|cli)(\/|$)|\.(sh|bash|zsh)$/i.test(file)
}

function isSourcePath(file: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java|kt|swift|sh)$/i.test(file)
}

function isUiPath(file: string): boolean {
  return /routes\/|app\/components\/|pages\/|components\/|ui\/|frontend\/|\.(tsx|jsx|html|css|scss|sass)$/i.test(file)
}

function isApiPath(file: string): boolean {
  return /api|server|worker|edge|db|database|migration|webhook/i.test(file)
}

function isGoldenPath(file: string): boolean {
  return /golden|snapshot|\.snap$|\.golden$|approval/i.test(file)
}

function isOraclePath(file: string): boolean {
  return /(^|\/)ml\/|search|compiler|extractor|parser|ranking|query|graphics|scientific/i.test(file)
}

function isPerfPath(file: string): boolean {
  return /perf|profile|benchmark|hotpath|cache|latency|throughput/i.test(file)
}

function isTestPath(file: string): boolean {
  return /(^|\/)(__tests__|tests?|spec|fixtures?|mocks?|msw)(\/|$)|\.(test|spec)\./i.test(file)
}

function fileTextSample(rootDir: string, file: string): string {
  const absolute = path.join(rootDir, file)
  if (!existsSync(absolute)) {
    return ""
  }

  try {
    const stats = statSync(absolute)
    if (!stats.isFile() || stats.size > 262144) {
      return ""
    }
    const buffer = readFileSync(absolute)
    if (buffer.includes(0)) {
      return ""
    }
    return buffer.toString("utf8").slice(0, maxPerFileSignalChars)
  } catch {
    return ""
  }
}

function gitDiffSample(rootDir: string, baseRef: string, file: string): string {
  const quoted = shellQuote(file)
  const sections = [
    ["base", `git diff --unified=40 ${shellQuote(baseRef)}...HEAD -- ${quoted} 2>/dev/null`],
    ["working", `git diff --unified=40 -- ${quoted} 2>/dev/null`],
    ["cached", `git diff --unified=40 --cached -- ${quoted} 2>/dev/null`],
  ]
  const output = sections
    .map(([label, command]) => {
      const result = runCapture(command, rootDir).output.trim()
      return result ? `# ${label} diff\n${result}` : ""
    })
    .filter(Boolean)
    .join("\n\n")
  return output.slice(0, maxPerFileSignalChars)
}

function fileSignal(rootDir: string, baseRef: string, file: string): FileSignal {
  const sample = [gitDiffSample(rootDir, baseRef, file), fileTextSample(rootDir, file)]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, maxPerFileSignalChars)
  return { file, sample }
}

function hasCliSignal(signal: FileSignal): boolean {
  return /\b(process\.argv|parseArgs|commander|yargs|argparse|click\.command|cobra\.Command|clap::|subcommand|stdio|stdout|stderr)\b/i.test(
    signal.sample,
  )
}

function hasUiSignal(signal: FileSignal): boolean {
  return /<(!doctype|html|body|script|button|form|input)\b|document\.|addEventListener\(|className|useState\(|onClick=|aria-|role=/i.test(
    signal.sample,
  )
}

function hasApiSignal(signal: FileSignal): boolean {
  return /\b(export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)|app\.(get|post|put|patch|delete)\(|router\.(get|post|put|patch|delete)\(|new\s+Response\(|NextResponse|RequestHandler|prisma\.|db\.(query|select|insert|update|delete)|sql`|webhook\s+secret)\b/i.test(
    signal.sample,
  )
}

function hasTestSignal(signal: FileSignal): boolean {
  return /(^|[^.A-Za-z0-9_])(describe|it|test|expect|assert)\s*\(|pytest|toMatchSnapshot|snapshot\(/i.test(signal.sample)
}

function hasGoldenSignal(signal: FileSignal): boolean {
  return /\b(toMatchSnapshot|snapshot\(|approval\s+test|golden\s+update)\b/i.test(signal.sample)
}

function hasOracleSignal(signal: FileSignal): boolean {
  return /\b(parser\.parse|ranker|ranking\s+score|compiler\s+pass|tokenizer|ast\s+node|embedding\s+score|model\s+score)\b/i.test(
    signal.sample,
  )
}

function hasPerfSignal(signal: FileSignal): boolean {
  return /\b(Benchmark|benchmark\(|performance\.mark|performance\.measure|p95|latency|throughput|hot\s+path)\b/i.test(
    signal.sample,
  )
}

function allowsCliSignal(file: string): boolean {
  return isCliPath(file) || isSourcePath(file)
}

function allowsUiSignal(file: string): boolean {
  return isUiPath(file) || isSourcePath(file)
}

function allowsApiSignal(file: string): boolean {
  return isApiPath(file) || isSourcePath(file)
}

function allowsTestSignal(file: string): boolean {
  return isTestPath(file) || isSourcePath(file)
}

function allowsGoldenSignal(file: string): boolean {
  return isGoldenPath(file) || isTestPath(file) || isSourcePath(file)
}

function allowsOracleSignal(file: string): boolean {
  return isOraclePath(file) || isTestPath(file) || isSourcePath(file)
}

function allowsPerfSignal(file: string): boolean {
  return isPerfPath(file) || isSourcePath(file)
}

function surfaceForSignal(signal: FileSignal): { reason: string; surface: string } {
  const file = signal.file
  if (isConfigPath(file)) {
    return { reason: "config or manifest path", surface: "config/manifest surface" }
  }
  if (isCliPath(file)) {
    return { reason: "command, script, or shell path", surface: "CLI/script surface" }
  }
  if (isUiPath(file)) {
    return { reason: "frontend path or browser asset extension", surface: "UI/browser surface" }
  }
  if (isApiPath(file)) {
    return { reason: "backend, worker, database, or integration path", surface: "API/edge/server surface" }
  }
  if (isTestPath(file)) {
    return { reason: "test, fixture, mock, or spec path", surface: "test/fixture surface" }
  }
  if (isDocPath(file)) {
    return { reason: "docs or Markdown path", surface: "docs surface" }
  }
  if (allowsCliSignal(file) && hasCliSignal(signal)) {
    return { reason: "bounded diff/content shows CLI argument or stdio handling", surface: "CLI/script surface" }
  }
  if (allowsUiSignal(file) && hasUiSignal(signal)) {
    return { reason: "bounded diff/content shows browser DOM or HTML behavior", surface: "UI/browser surface" }
  }
  if (allowsApiSignal(file) && hasApiSignal(signal)) {
    return { reason: "bounded diff/content shows route, response, database, or webhook handling", surface: "API/edge/server surface" }
  }
  if (allowsTestSignal(file) && hasTestSignal(signal)) {
    return { reason: "bounded diff/content shows test assertions", surface: "test/fixture surface" }
  }
  return { reason: isSourcePath(file) ? "source file extension" : "default changed-file fallback", surface: "code surface" }
}

function classify(rootDir: string, baseRef: string, files: string[]): Classification {
  const classification: Classification = {
    flags: emptyFlags(),
    reasons: emptyReasons(),
    surfaces: {},
  }
  let sampledFiles = 0
  let totalSignalChars = 0

  for (const file of files) {
    const shouldSample = sampledFiles < maxSignalFiles && totalSignalChars < maxTotalSignalChars
    const signal = shouldSample ? fileSignal(rootDir, baseRef, file) : { file, sample: "" }
    if (signal.sample) {
      sampledFiles += 1
      totalSignalChars += signal.sample.length
    }

    if (isConfigPath(file)) addReason(classification, "config", file, "config/manifest path")
    if (isDocPath(file)) addReason(classification, "doc", file, "docs or Markdown path")
    if (isCliPath(file)) addReason(classification, "cli", file, "command/script path")
    if (isSourcePath(file)) addReason(classification, "code", file, "source file path")
    if (isUiPath(file)) addReason(classification, "ui", file, "frontend or browser asset path")
    if (isApiPath(file)) addReason(classification, "api", file, "backend/integration path")
    if (isTestPath(file)) addReason(classification, "test", file, "test/fixture/mock path")
    if (isGoldenPath(file)) addReason(classification, "golden", file, "snapshot/golden/approval path")
    if (isOraclePath(file)) addReason(classification, "oracle", file, "oracle-free domain path")
    if (isPerfPath(file)) addReason(classification, "perf", file, "performance-sensitive path")

    if (allowsCliSignal(file) && hasCliSignal(signal)) {
      addReason(classification, "cli", file, "bounded diff/content shows CLI argument or stdio handling")
    }
    if (allowsUiSignal(file) && hasUiSignal(signal)) {
      addReason(classification, "ui", file, "bounded diff/content shows browser DOM or HTML behavior")
    }
    if (allowsApiSignal(file) && hasApiSignal(signal)) {
      addReason(classification, "api", file, "bounded diff/content shows route, response, database, or webhook handling")
    }
    if (allowsTestSignal(file) && hasTestSignal(signal)) {
      addReason(classification, "test", file, "bounded diff/content shows test assertions")
    }
    if (allowsGoldenSignal(file) && hasGoldenSignal(signal)) {
      addReason(classification, "golden", file, "bounded diff/content shows snapshot or approval-test behavior")
    }
    if (allowsOracleSignal(file) && hasOracleSignal(signal)) {
      addReason(classification, "oracle", file, "bounded diff/content shows parser, ranking, compiler, or model-scoring behavior")
    }
    if (allowsPerfSignal(file) && hasPerfSignal(signal)) {
      addReason(classification, "perf", file, "bounded diff/content shows benchmark or performance metric")
    }

    classification.surfaces[file] = surfaceForSignal(signal)
  }

  return classification
}

function gateSignal(classification: Classification, keys: ClassificationKey[]): string {
  const reasons = keys.flatMap((key) => classification.reasons[key].map((reason) => `${key}: ${reason}`))
  return reasons.length ? reasons.slice(0, 4).join("; ") : "No matching bounded signal."
}

function hasGateReason(classification: Classification, key: ClassificationKey, pattern: RegExp): boolean {
  return classification.reasons[key].some((reason) => pattern.test(reason))
}

function classificationReasonRows(classification: Classification): string[] {
  const rows = classificationKeys.flatMap((key) =>
    classification.reasons[key].map((reason) => `| \`${key}\` | ${markdownEscape(reason)} |`),
  )
  return rows.length ? rows : ["| `none` | No changed-file signals detected. |"]
}

function qualityGates(classification: Classification): QualityGate[] {
  const { flags } = classification
  return [
    {
      applies: flags.doc,
      appliesWhen: "Changed Markdown, docs, README, handoff text, or PR body copy.",
      deepPass: "For substantial public docs, do a line-by-line rewrite pass and verify every command, path, flag, and example against the live repo.",
      evidence: "Before/after diff with removed filler, verified commands/paths, and a PR body that matches the actual diff.",
      gate: "Prose quality and PR copy cleanup",
      pattern: "prose-quality",
      quickPass: "Manually read changed prose and remove AI-ish filler, formulaic phrasing, hype, awkward punctuation, and vague claims.",
      signal: gateSignal(classification, ["doc"]),
    },
    {
      applies: flags.config,
      appliesWhen: "Changed package metadata, plugin manifests, tool configs, version maps, ignore files, JSON, YAML, or TOML.",
      deepPass: "For published packages or plugins, verify loader/schema behavior and cross-file version, description, command, and documentation references.",
      evidence: "Validator output or schema check, plus the exact manifests/config files reviewed and any intentional version/reference decisions.",
      gate: "Manifest and config consistency",
      pattern: "config-contract-check",
      quickPass: "Run the repo validator or nearest schema/config check, then compare changed manifests, versions, command names, descriptions, and docs references.",
      signal: gateSignal(classification, ["config"]),
    },
    {
      applies: flags.code || flags.test,
      appliesWhen: "Changed implementation, tests, fixtures, scripts, or generated-looking code.",
      deepPass: "For large or multi-agent-written diffs, combine keyword search with a short-function/no-op scan and inspect suspicious minimal implementations.",
      evidence: "Search output, reviewed suspects with file:line refs, and either fixes or concrete skip rationales.",
      gate: "Mock / stub / placeholder sweep",
      pattern: "placeholder-detection",
      quickPass: "Search changed files for TODOs, fake implementations, placeholder data, overbroad mocks, and suspicious no-op paths.",
      signal: gateSignal(classification, ["code", "test"]),
    },
    {
      applies: flags.code || flags.api || flags.cli,
      appliesWhen: "Changed behavior, trust boundaries, control flow, parsing, persistence, concurrency, or error handling.",
      deepPass: "For correctness-sensitive diffs, run a second review pass after fixes with fresh assumptions; use a static risk scanner when available.",
      evidence: "Findings list, fixes applied or rejected, second-pass notes after fixes, and validation for each real bug.",
      gate: "Multi-pass bug hunting",
      pattern: "iterative-correctness-review",
      quickPass: "Do one correctness/security pass, fix findings, then do a fresh-eyes pass over the updated diff.",
      signal: gateSignal(classification, ["code", "api", "cli"]),
    },
    {
      applies: (flags.code || flags.api || flags.cli) && commandExists("ubs"),
      appliesWhen: "Changed code and `ubs` is installed.",
      deepPass: "If UBS flags real findings, follow its fix/triage loop; if false positive, suppress only with a concrete safety reason.",
      evidence: "`ubs` command, exit code, finding triage, fixes, suppressions, or skip reason if the tool cannot run.",
      gate: "UBS / static risk scanner",
      pattern: "tool-backed-static-risk-scan",
      quickPass: "Run `ubs --diff` or `ubs <changed-files>` and triage every finding before commit or PR prep.",
      signal: gateSignal(classification, ["code", "api", "cli"]),
    },
    {
      applies: flags.code,
      appliesWhen: "Changed code contains duplicated logic, accidental complexity, or cleanup opportunities after behavior is protected.",
      deepPass: "For larger refactors, write a behavior-preservation note first: tests/goldens/invariants, one lever per change, and rerun proof after each edit.",
      evidence: "Tests/goldens/invariants proving behavior unchanged, plus a small note on why the simplification is safe.",
      gate: "Isomorphic simplification",
      pattern: "behavior-preserving-simplification",
      quickPass: "After behavior is protected, remove accidental complexity only where tests, goldens, or explicit invariants prove behavior unchanged.",
      signal: gateSignal(classification, ["code"]),
    },
    {
      applies: flags.ui,
      appliesWhen: "Changed routes, components, UI state, browser behavior, or frontend assets.",
      deepPass: "For auth-heavy, cross-page, or visual-regression risk, use Playwright or a persistent browser session with trace/screenshot artifacts.",
      evidence: "Route, user action, expected result, screenshot/trace, console/network notes, and any residual manual QA.",
      gate: "Web/UI E2E verification",
      pattern: "browser-e2e-verification",
      quickPass: "Exercise the real route/component through browser or Playwright, with console/network checks and screenshot/trace evidence.",
      signal: gateSignal(classification, ["ui"]),
    },
    {
      applies: flags.ui,
      appliesWhen: "Changed interface copy, layout, interaction, forms, navigation, empty/loading/error states, or accessibility surface.",
      deepPass: "For launch-quality UI changes, produce a prioritized UX/a11y report covering flow, cognitive load, keyboard path, contrast, and screen-reader basics.",
      evidence: "Keyboard path, responsive check, visible states checked, accessibility notes, and screenshots when useful.",
      gate: "UX and accessibility audit",
      pattern: "heuristic-ux-a11y-review",
      quickPass: "Check obviousness, keyboard path, error states, loading/empty states, responsive layout, and accessibility basics.",
      signal: gateSignal(classification, ["ui"]),
    },
    {
      applies: flags.api,
      appliesWhen: "Changed auth, billing, webhooks, persistence, migrations, cache/proxy behavior, or integration boundaries.",
      deepPass: "When mocks could hide production failures, use real test infrastructure, isolated fixtures, structured logs, and sanitized evidence.",
      evidence: "Real-service command/request, status, sanitized response/log snippet, isolation strategy, and any unsafe-to-run rationale.",
      gate: "Real-service integration check",
      pattern: "mock-free-integration-risk",
      quickPass: "Prefer real DB/API/service test paths for auth, billing, webhooks, data deletion, migrations, and cache/proxy behavior.",
      signal: gateSignal(classification, ["api"]),
    },
    {
      applies: flags.golden,
      appliesWhen: "Changed snapshots, golden files, approval tests, compiler/query/serialization output, or other complex stable artifacts.",
      deepPass: "For durable golden suites, define canonicalization/scrubbing, update commands, human-review diff flow, and CI behavior.",
      evidence: "Golden generation/update command, canonicalization note, diff reviewed by a human/agent, and update rationale.",
      gate: "Golden artifact decision",
      pattern: "golden-output-regression",
      quickPass: "If outputs are complex but reviewable, capture/canonicalize a golden and require human diff review for updates.",
      signal: gateSignal(classification, ["golden"]),
    },
    {
      applies: flags.oracle,
      appliesWhen: "Changed ML, search, ranking, compiler, parser, graphics, scientific, or other oracle-free behavior.",
      deepPass: "When fixed examples are weak, design property/metamorphic tests with generated inputs and transformations that should preserve known relationships.",
      evidence: "Named invariant, input transformation, expected relationship, property test or skip rationale.",
      gate: "Metamorphic/property test decision",
      pattern: "oracle-free-invariant-testing",
      quickPass: "If exact expected output is hard, define invariant-preserving transformations and property tests instead of weak examples.",
      signal: gateSignal(classification, ["oracle"]),
    },
    {
      applies: flags.cli,
      appliesWhen: "Changed commands, scripts, CLI args, non-TTY behavior, robot/json output, or agent-facing errors.",
      deepPass: "For agent-facing CLI changes, score the CLI against canonical tasks: discoverability, dry-run/JSON support, actionable errors, and automation safety.",
      evidence: "Help output, success/failure commands, exit codes, stdout/stderr split, non-TTY check, JSON/robot mode notes.",
      gate: "CLI agent ergonomics",
      pattern: "agent-friendly-cli-contract",
      quickPass: "Verify help, exit codes, stdout/stderr split, JSON/robot mode if present, non-TTY behavior, and actionable errors.",
      signal: gateSignal(classification, ["cli"]),
    },
    {
      applies: flags.cli && hasGateReason(classification, "cli", /setup|auth|login|bootstrap|doctor|diagnos|repair|seed|fixture/i),
      appliesWhen: "Changed setup, repair, auth/bootstrap, diagnostics, or repeated failure-recovery paths.",
      deepPass: "Before building serious self-healing, specify detect-before-fix behavior, backups/undo, idempotence, dry-run, and clear repair evidence.",
      evidence: "Failure mode, detector idea, safe fixer/undo notes, or why a doctor command is not warranted.",
      gate: "Doctor/self-healing candidate",
      pattern: "diagnose-and-repair-contract",
      quickPass: "If setup or failure recovery is recurring, propose a doctor/check/repair command or deterministic setup skill.",
      signal: gateSignal(classification, ["cli"]),
    },
    {
      applies: flags.perf,
      appliesWhen: "Changed performance-sensitive code or made performance claims.",
      deepPass: "For speed-critical code, define scenario/metric, capture baseline, profile ranked hotspots, change one lever, and prove behavior unchanged.",
      evidence: "Baseline, scenario, metric, profile or benchmark output, changed lever, and behavior proof.",
      gate: "Performance profiling",
      pattern: "profile-before-optimization",
      quickPass: "If performance was changed or claimed, baseline first, profile or benchmark, change one lever, and prove behavior unchanged.",
      signal: gateSignal(classification, ["perf"]),
    },
  ]
}

function writeQualityGates(outDir: string, rootDir: string, classification: Classification): QualityGate[] {
  const gates = qualityGates(classification)
  const changedFilesPath = path.join(outDir, "changed-files.txt")
  writeFileSync(
    path.join(outDir, "quality-gates.md"),
    [
      "# Quality Gates",
      "",
      "These gates are self-contained PR-prep checks. The script makes a cheap",
      "recommendation from bounded path, diff, and text samples; the active",
      "agent makes the final applicability call in `gate-decisions.md`. For each",
      "selected gate, run the quick pass and record evidence, or mark it skipped",
      "with a reason. Use the deep pass only when the diff risk justifies the",
      "extra ceremony.",
      "",
      `Detection caps: first ${maxSignalFiles} changed files, ${maxPerFileSignalChars} chars per file, ${maxTotalSignalChars} chars total.`,
      "",
      "## Agent Applicability Review",
      "",
      "Before running QA, open `gate-decisions.md` and make a quick judgment pass:",
      "",
      "1. Accept or override the recommended gates using the actual project intent and diff.",
      "2. Add a one-off local gate if new functionality introduces a surface or risk the defaults missed.",
      "3. Summarize intentionally skipped gates so the user can see what was not exercised.",
      "",
      "## Why These Gates Apply",
      "",
      "| Signal | Reason |",
      "|---|---|",
      ...classificationReasonRows(classification),
      "",
      "| Gate | Recommended | Signal | Pattern | Applies when | Quick pass | Deep pass | Evidence / skip rationale |",
      "|---|---|---|---|---|---|---|---|",
      ...gates.map(
        (gate) =>
          `| ${markdownEscape(gate.gate)} | ${gate.applies} | ${markdownEscape(gate.signal)} | ${markdownEscape(gate.pattern)} | ${markdownEscape(gate.appliesWhen)} | ${markdownEscape(gate.quickPass)} | ${markdownEscape(gate.deepPass)} | ${markdownEscape(gate.evidence)} |`,
      ),
      "",
      "## Fast Local Scans",
      "",
      "Run these only on changed files or relevant directories, then record",
      "the result in the Evidence / skip rationale column above:",
      "",
      "```bash",
      `repo_root=${shellQuote(rootDir)}`,
      `changed_file_list=${shellQuote(changedFilesPath)}`,
      "if [[ ! -f \"$changed_file_list\" ]]; then",
      "  echo \"changed-files.txt is missing: $changed_file_list\" >&2",
      "  exit 1",
      "fi",
      "cd \"$repo_root\" || exit 1",
      "mapfile -t changed_files < <(grep -v '^#' \"$changed_file_list\" | sed '/^[[:space:]]*$/d')",
      "if (( ${#changed_files[@]} == 0 )); then",
      "  echo \"No changed files to scan.\"",
      "  exit 0",
      "fi",
      "",
      "# Placeholder sweep",
      "rg -n \"TODO|FIXME|HACK|stub|mock|placeholder|fake|not implemented|throw new Error|return null|return undefined\" \"${changed_files[@]}\" 2>/dev/null",
      "",
      "# UBS/static risk scan when installed",
      "command -v ubs >/dev/null 2>&1 && ubs \"${changed_files[@]}\"",
      "",
      "# Public prose quality scan on changed docs only",
      "changed_doc_files=()",
      "for file in \"${changed_files[@]}\"; do",
      "  if [[ \"$file\" =~ (^|/)README([^/]*)?$ || \"$file\" =~ (^|/)docs/ || \"$file\" == *.md ]]; then",
      "    changed_doc_files+=(\"$file\")",
      "  fi",
      "done",
      "if (( ${#changed_doc_files[@]} > 0 )); then",
      "  rg -n \"Here's why|not just|it's not|game[- ]changer|seamless|robust|delight|leverage|unlock|supercharge\" \"${changed_doc_files[@]}\" 2>/dev/null",
      "fi",
      "```",
      "",
    ].join("\n"),
    "utf8",
  )
  return gates
}

function writeGateDecisions(outDir: string, gates: QualityGate[]): void {
  const selectedGates = gates.filter((gate) => gate.applies)
  const unselectedGates = gates.filter((gate) => !gate.applies)
  const selectedRows =
    selectedGates.length > 0
      ? selectedGates.map(
          (gate) =>
            `| ${markdownEscape(gate.gate)} | ${markdownEscape(gate.signal)} | TODO: run / skip / deep / override | TODO | ${markdownEscape(gate.evidence)} |`,
        )
      : ["| `none` | No gates were recommended from bounded signals. | n/a | n/a | n/a |"]
  const unselectedRows =
    unselectedGates.length > 0
      ? unselectedGates.map(
          (gate) =>
            `| ${markdownEscape(gate.gate)} | not selected | ${markdownEscape(gate.signal)} | Override only if project context makes it applicable. |`,
        )
      : ["| `none` | n/a | n/a | n/a |"]

  writeFileSync(
    path.join(outDir, "gate-decisions.md"),
    [
      "# Gate Decisions",
      "",
      "The script recommends gates from bounded static signals. The active agent",
      "owns the final decision because it has task intent, project context, and",
      "recent model judgment that a regex cannot see.",
      "",
      "## Decision Rules",
      "",
      "- Prefer the recommended gate set unless project intent or the actual diff shows it is wrong.",
      "- Add a one-off local gate when the change introduces a new user-facing surface, runtime, integration, data contract, security boundary, or operational path.",
      "- Do not run a gate just because it exists; do record the reason when an obvious gate is intentionally skipped.",
      "- Keep evidence concrete: command output, file refs, route checked, screenshot/trace path, response snippet, or explicit blocker.",
      "",
      "## Recommended Gates To Decide",
      "",
      "Only these rows require an agent decision by default.",
      "",
      "| Gate | Signal | Agent decision | Reason | Evidence target or skip rationale |",
      "|---|---|---|---|---|",
      ...selectedRows,
      "",
      "## Not Selected By The Script",
      "",
      "Do not justify every row here. Override only when project context or new",
      "functionality makes one applicable.",
      "",
      "| Gate | Default | Signal | Override rule |",
      "|---|---|---|---|",
      ...unselectedRows,
      "",
      "## New Gate Check",
      "",
      "- [ ] Did the change add a new surface that was not already part of the project, such as a first web UI, new CLI, new API, new background job, new database migration path, new billing/auth boundary, or new deploy/runtime target?",
      "- [ ] Did the change create a risk that deserves a project-specific gate that is absent above?",
      "",
      "| Local gate | Applies because | Quick pass | Evidence target | Decision |",
      "|---|---|---|---|---|",
      "| TODO or `none` | TODO | TODO | TODO | TODO |",
      "",
      "## Intentionally Skipped Gates",
      "",
      "Fill this before handing work back to the user, even if the answer is `none`.",
      "",
      "| Gate | Why skipped | Residual risk or follow-up |",
      "|---|---|---|",
      "| TODO or `none` | TODO | TODO |",
      "",
    ].join("\n"),
    "utf8",
  )
}

function qaProbe(surface: string): { evidence: string; probe: string } {
  switch (surface) {
    case "UI/browser surface":
      return {
        evidence: "Screenshot plus console/network notes",
        probe: "Open affected route/component, exercise changed interaction, check console and network",
      }
    case "API/edge/server surface":
      return {
        evidence: "Status, headers, sanitized response snippet, logs",
        probe: "Call representative endpoint/path with changed inputs, auth, headers, and cache cases",
      }
    case "CLI/script surface":
      return {
        evidence: "Command, exit code, stdout/stderr, generated files",
        probe: "Run user-facing command and failure-path variant",
      }
    case "config/manifest surface":
      return {
        evidence: "Validator/schema output and checked manifest/config refs",
        probe: "Run repo validator or nearest schema/config check, then compare version/name/command references",
      }
    case "docs surface":
      return {
        evidence: "Checked command/path list",
        probe: "Verify paths, commands, flags, and examples against the live repo",
      }
    default:
      return {
        evidence: "Test name/output and behavior notes",
        probe: "Run narrow automated test and one user-path probe for changed behavior",
      }
  }
}

function writeQaPlan(outDir: string, baseRef: string, files: string[], classification: Classification): void {
  const rows = files.map((file) => {
    const inferred = classification.surfaces[file] ?? { reason: "default fallback", surface: "code surface" }
    const surface = inferred.surface
    const { evidence, probe } = qaProbe(surface)
    return `| \`${file}\` | ${surface} | ${markdownEscape(inferred.reason)} | file:line refs or command docs | write before testing | ${probe} | ${evidence} |`
  })

  writeFileSync(
    path.join(outDir, "qa-plan.md"),
    [
      "# Targeted QA Plan",
      "",
      `Base ref: \`${baseRef}\``,
      "",
      "Use this as the manual QA checklist before staging or PR prep. Surfaces",
      "are inferred from bounded path, diff, and text signals; correct any false",
      "positive before testing. Replace generic expectations with exact URLs,",
      "commands, accounts, payloads, and visible results once the current agent",
      "inspects the diff.",
      "",
      "This plan is a lightweight evidence harness. It is not a full",
      "test-framework generator; use the evidence standards below when the diff",
      "risk or surface complexity calls for deeper proof.",
      "",
      "| Changed file | Surface | Why inferred | Source grounding to fill | Expected behavior before action | QA probe to define | Evidence to capture |",
      "|---|---|---|---|---|---|---|",
      ...rows,
      "",
      "## Evidence Standards By Surface",
      "",
      "| Surface | Minimum useful evidence | Deep escalation trigger |",
      "|---|---|---|",
      "| UI/browser | route, user action, screenshot or trace, console/network notes | auth-heavy flows, cross-page journeys, visual regression, persistent browser debugging |",
      "| API/edge/server | command/request, status, headers, sanitized response/log snippet | auth, billing, webhooks, migrations, cache/proxy, or real-service contract risk |",
      "| CLI/script | command, exit code, stdout/stderr split, generated files, failure-path variant | agent-facing CLI, JSON/robot output, non-TTY behavior, recurring setup failures |",
      "| Config/manifest | validator/schema output, version/name/command reference check, changed config list | published package/plugin metadata, release manifests, CI/tooling config |",
      "| Docs | checked command/path/example list and before/after prose diff | public README/API docs, release docs, or repeated setup instructions |",
      "| Complex output | golden diff, canonicalization note, review/update rationale | compiler/query/serialization/snapshot output that is easier to diff than assert field-by-field |",
      "| Oracle-free behavior | named invariant, input transformation, expected relationship | search, ranking, parser, ML, graphics, scientific, or other behavior without a trusted exact oracle |",
      "",
      "## Assertion Discipline",
      "",
      "- Ground every named test in source, docs, or a user-visible contract before testing.",
      "- Add each test action to `verification-timeline.md` before performing it.",
      "- Mark every assertion as `passed`, `failed`, or `untested`; do not leave implied passes.",
      "- Store screenshots, recordings, traces, logs, or response snippets under `evidence/` when practical.",
      "",
      "## Residual Manual QA",
      "",
      "- [ ] Confirm the changed behavior through the closest real user path.",
      "- [ ] Check at least one relevant error/empty/loading state.",
      "- [ ] Capture exact evidence or explain why live QA was blocked.",
      "",
    ].join("\n"),
    "utf8",
  )
}

function subagentTasks(gates: QualityGate[]): { name: string; run: boolean; task: string }[] {
  return [
    {
      name: "docs-copy-reviewer",
      run: gateApplies(gates, "Prose quality and PR copy cleanup"),
      task: "Read changed docs and PR draft only. Report concise de-slop edits; do not modify files.",
    },
    {
      name: "mock-stub-sweeper",
      run: gateApplies(gates, "Mock / stub / placeholder sweep"),
      task: "Search changed code for TODOs, fake implementations, placeholders, and suspicious no-op paths. Report file:line findings only.",
    },
    {
      name: "bug-hunter",
      run: gateApplies(gates, "Multi-pass bug hunting"),
      task: "Do a read-only correctness/security pass over the current diff. Prioritize real behavioral defects and missing tests.",
    },
    {
      name: "ux-a11y-reviewer",
      run: gateApplies(gates, "UX and accessibility audit"),
      task: "Review affected UI for usability, keyboard path, error/loading/empty states, responsive layout, and accessibility basics.",
    },
    {
      name: "cli-ergonomics-reviewer",
      run: gateApplies(gates, "CLI agent ergonomics"),
      task: "Review CLI/script changes for help, exit codes, stdout/stderr split, JSON/robot mode, non-TTY behavior, and actionable errors.",
    },
    {
      name: "test-strategy-reviewer",
      run: gateApplies(gates, "Golden artifact decision") || gateApplies(gates, "Metamorphic/property test decision"),
      task: "Design test strategy for complex outputs or oracle-free behavior. Recommend goldens, property tests, or skip rationale.",
    },
  ]
}

function gateApplies(gates: QualityGate[], name: string): boolean {
  return Boolean(gates.find((gate) => gate.gate === name)?.applies)
}

function writeSubagentPlan(outDir: string, gates: QualityGate[]): void {
  const tasks = subagentTasks(gates)
  writeFileSync(
    path.join(outDir, "subagent-plan.md"),
    [
      "# Subagent Plan",
      "",
      "Default mode: run the deterministic lane sequentially, then fan out only",
      "read-only specialist reviews that apply to the current diff. The main agent",
      "owns synthesis, edits, final QA, staging, and PR narrative.",
      "",
      "| Subagent | Suggested | Read-only task |",
      "|---|---|---|",
      ...tasks.map((task) => `| ${task.name} | ${task.run} | ${markdownEscape(task.task)} |`),
      "",
      "## Rules",
      "",
      "- Do not let subagents mutate the working tree unless the user explicitly asks.",
      "- Give each subagent the current diff, quality-gates.md, qa-plan.md, and a narrow output format.",
      "- Main agent triages findings; subagents do not decide commit or PR readiness.",
      "- Keep browser, real-service, golden updates, and profiling sequential unless each run has isolated state.",
      "",
    ].join("\n"),
    "utf8",
  )
}

function writeAgentPrompt(outDir: string): void {
  const prompt = path.join(outDir, "prompts", "finish-review.md")
  writeFileSync(
    prompt,
    `You are running the finish lane after implementation.

Goal: inspect the current working tree, clean up accidental complexity,
verify behavior with targeted QA, and prepare PR-ready summary text.

Default mode for second-pass agents: read-only review. Do not edit, stage,
commit, push, deploy, or create a PR unless the user explicitly asks after this
review.

Read these artifacts first:
- ${outDir}/workflow-status.html
- ${outDir}/workflow-status.md
- ${outDir}/report.md
- ${outDir}/changed-files.txt
- ${outDir}/qa-plan.md
- ${outDir}/secret-risk.md
- ${outDir}/setup-scripts.txt
- ${outDir}/setup-blueprint-template.yml
- ${outDir}/verification-timeline.md
- ${outDir}/quality-gates.md
- ${outDir}/gate-decisions.md
- ${outDir}/subagent-plan.md
- ${outDir}/steps.tsv

Then do the following:
1. Review the diff for correctness, security, contract drift, missing tests, and accidental complexity.
2. Convert qa-plan.md into source-grounded named tests with expected behavior written before action.
3. Run feasible QA through real user paths when applicable; use JavaScript/state injection only as a labeled lower-level probe.
4. Annotate verification-timeline.md with setup notes, named test starts, pass/fail/untested assertions, and evidence paths.
5. Review gate-decisions.md: accept or override recommended gates, add any one-off gate for new functionality, and list intentionally skipped gates.
6. Run each selected quick pass in quality-gates.md or write a concrete skip rationale; escalate only when risk justifies it.
7. Use subagent-plan.md for read-only specialist reviews when subagents are available and worthwhile.
8. Active prepare-pr agent only: apply safe, scoped fixes. Second-pass agents report findings only. Do not stage, commit, push, or create a PR unless the user asks.
9. If setup was painful or repeated, fill setup-blueprint-template.yml and propose a repo-owned deterministic setup skill or script.
10. Produce PR text with: behavior change, why it matters, how it works, validation evidence, quality gates, skipped gates, and residual risk.

Be explicit about skipped checks and blockers. Keep unrelated worktree changes out of scope.
`,
    "utf8",
  )
}

function writeAgentReviewPlaceholder(outDir: string, message: string): void {
  writeFileSync(path.join(outDir, "agent-review.md"), `# Agent Review\n\n${message}\n`, "utf8")
}

function writePrDraft(outDir: string, steps: Step[]): void {
  const validation = steps.map((step) =>
    step.status === 0
      ? `- \`${step.name}\`: passed`
      : `- \`${step.name}\`: failed (see \`${step.logFile}\`)`,
  )

  writeFileSync(
    path.join(outDir, "pr-body-draft.md"),
    [
      "This PR changes ...",
      "",
      "## Behavior Change",
      "",
      "- Replace with the user-visible or operator-visible behavior that now changes.",
      "",
      "## Why It Matters",
      "",
      "- Replace with the bug, workflow friction, safety issue, or capability this addresses.",
      "",
      "## How It Works",
      "",
      "- Keep this to the smallest useful implementation explanation.",
      "",
      "## Validation",
      "",
      ...validation,
      "",
      "## Verification Evidence",
      "",
      "- Source-grounded QA plan: `qa-plan.md`",
      "- Timeline/assertions: `verification-timeline.md`",
      "- Evidence artifacts: `evidence/`",
      "",
      "## Quality Gates",
      "",
      "- See `gate-decisions.md` and `quality-gates.md`; replace with gates selected, quick passes run, deep passes, and skip rationales.",
      "- Intentionally skipped gates: replace with `none` or the skipped-gate summary.",
      "",
      "## Residual Risk",
      "",
      "- Replace with any skipped manual QA, flaky environment, or known follow-up.",
      "",
    ].join("\n"),
    "utf8",
  )
}

function workflowNextAction(steps: Step[], gates: QualityGate[]): string {
  const failedSteps = steps.filter((step) => step.status !== 0)
  const applicableGates = gates.filter((gate) => gate.applies)

  if (failedSteps.length > 0) {
    return `Inspect failed logs for ${failedSteps.map((step) => `\`${step.name}\``).join(", ")}.`
  }
  if (applicableGates.length > 0) {
    return "Fill gate-decisions.md, add any missing local gate, then run selected gates and source-grounded QA."
  }
  return "Confirm gate-decisions.md, fill QA expectations, and prepare PR text."
}

function workflowPhases(steps: Step[], gates: QualityGate[], agent: AgentMode): {
  artifact: string
  detail: string
  status: string
  title: string
}[] {
  const failedSteps = steps.filter((step) => step.status !== 0)
  const applicableGates = gates.filter((gate) => gate.applies)

  return [
    {
      artifact: "changed-files.txt, secret-risk.md",
      detail: "Changed file inventory and filename-only risk scan are ready.",
      status: "complete",
      title: "Scope",
    },
    {
      artifact: "setup-scripts.txt, setup-blueprint-template.yml",
      detail: "Setup, auth, fixture, and test entrypoint candidates are listed.",
      status: "complete",
      title: "Setup Discovery",
    },
    {
      artifact: "steps.tsv, logs/",
      detail: failedSteps.length > 0 ? `${failedSteps.length} command(s) need review.` : "All recorded commands exited successfully.",
      status: failedSteps.length > 0 ? "attention" : "complete",
      title: "Validation",
    },
    {
      artifact: "quality-gates.md, gate-decisions.md",
      detail:
        applicableGates.length > 0
          ? `${applicableGates.length} gate(s) are recommended; agent must accept, override, or add local gates.`
          : "No gate was auto-recommended; agent still checks whether new functionality needs a local gate.",
      status: "todo",
      title: "Quality Gates",
    },
    {
      artifact: "qa-plan.md, verification-timeline.md, evidence/",
      detail: "Fill exact expectations before testing, then record pass, fail, or untested evidence.",
      status: "todo",
      title: "Source-Grounded QA",
    },
    {
      artifact: "subagent-plan.md",
      detail:
        agent === "none"
          ? "Read-only specialist reviews are optional for this run."
          : "An independent agent review was requested; inspect its artifact if produced.",
      status: agent === "none" ? "optional" : "requested",
      title: "Subagent Reviews",
    },
    {
      artifact: "pr-body-draft.md",
      detail: "Draft exists as raw material; rewrite it against the actual diff and evidence.",
      status: "scaffolded",
      title: "PR Draft",
    },
    {
      artifact: "prepare-pr output",
      detail: "Stage, commit, push, or edit PR only after explicit user approval.",
      status: "pending",
      title: "Commit Plan",
    },
  ]
}

function writeWorkflowStatus(outDir: string, steps: Step[], gates: QualityGate[], agent: AgentMode): void {
  const failedSteps = steps.filter((step) => step.status !== 0)
  const next = workflowNextAction(steps, gates)
  const phases = workflowPhases(steps, gates, agent)

  writeFileSync(
    path.join(outDir, "workflow-status.md"),
    [
      "# Prepare PR Workflow Status",
      "",
      `Current next action: ${next}`,
      "",
      "```mermaid",
      "flowchart LR",
      "  A[Scope] --> B[Setup Discovery]",
      "  B --> C[Validation]",
      "  C --> D[Quality Gates]",
      "  D --> E[Source-Grounded QA]",
      "  E --> F[Subagent Reviews]",
      "  F --> G[PR Draft]",
      "  G --> H[Commit Plan]",
      "  classDef done fill:#dcfce7,stroke:#166534,color:#14532d;",
      "  classDef attention fill:#fee2e2,stroke:#991b1b,color:#7f1d1d;",
      "  classDef todo fill:#fef9c3,stroke:#854d0e,color:#713f12;",
      "  class A,B done;",
      `  class C ${failedSteps.length ? "attention" : "done"};`,
      "  class D,E,F,G,H todo;",
      "```",
      "",
      "| Phase | Status | Where to look |",
      "|---|---|---|",
      ...phases.map((phase) => `| ${phase.title} | ${phase.status} | \`${phase.artifact}\` |`),
      "",
    ].join("\n"),
    "utf8",
  )
}

function writeWorkflowStatusHtml(outDir: string, steps: Step[], gates: QualityGate[], agent: AgentMode, baseRef: string): void {
  const phases = workflowPhases(steps, gates, agent)
  const data = {
    agent,
    artifacts: [
      { href: "workflow-status.md", label: "Markdown Status" },
      { href: "report.md", label: "Report" },
      { href: "changed-files.txt", label: "Changed Files" },
      { href: "secret-risk.md", label: "Secret Risk" },
      { href: "quality-gates.md", label: "Quality Gates" },
      { href: "gate-decisions.md", label: "Gate Decisions" },
      { href: "qa-plan.md", label: "QA Plan" },
      { href: "verification-timeline.md", label: "Verification Timeline" },
      { href: "subagent-plan.md", label: "Subagent Plan" },
      { href: "agent-review.md", label: "Agent Review" },
      { href: "pr-body-draft.md", label: "PR Draft" },
      { href: "logs/", label: "Logs" },
      { href: "evidence/", label: "Evidence" },
    ],
    baseRef,
    generatedAt: new Date().toISOString(),
    gates: gates.map((gate) => ({
      applies: gate.applies,
      appliesWhen: gate.appliesWhen,
      deepPass: gate.deepPass,
      evidence: gate.evidence,
      gate: gate.gate,
      pattern: gate.pattern,
      quickPass: gate.quickPass,
      signal: gate.signal,
    })),
    nextAction: workflowNextAction(steps, gates).replace(/`/g, ""),
    phases,
    steps: steps.map((step) => ({
      href: path.relative(outDir, step.logFile),
      name: step.name,
      status: step.status,
    })),
  }

  writeFileSync(
    path.join(outDir, "workflow-status.html"),
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Prepare PR Workflow Status</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f8f3e8;
      --paper: #fffaf0;
      --ink: #24201b;
      --muted: #75695d;
      --line: #ded2bd;
      --clay: #b66a50;
      --clay-dark: #7f3f2f;
      --green: #2f7d51;
      --green-bg: #e4f3df;
      --red: #a33a35;
      --red-bg: #f7dddd;
      --gold: #9a6a19;
      --gold-bg: #f5ebc9;
      --blue: #486b8f;
      --blue-bg: #ddebf5;
      --radius: 8px;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
    }

    main {
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 30px 0 42px;
    }

    header {
      display: grid;
      gap: 12px;
      margin-bottom: 22px;
    }

    h1 {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(2rem, 5vw, 4.8rem);
      font-weight: 500;
      letter-spacing: 0;
      line-height: 0.95;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: var(--muted);
      font: 0.82rem ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }

    .next {
      display: grid;
      gap: 6px;
      padding: 16px;
      border: 1px solid var(--line);
      border-left: 5px solid var(--clay);
      border-radius: var(--radius);
      background: var(--paper);
    }

    .eyebrow {
      color: var(--clay-dark);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .next strong {
      font-size: 1.08rem;
      line-height: 1.35;
    }

    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
      gap: 18px;
      align-items: start;
    }

    .panel {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--paper);
      overflow: hidden;
    }

    .panel h2 {
      margin: 0;
      padding: 16px 16px 10px;
      font-size: 0.92rem;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    .flow {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      padding: 0 16px 16px;
    }

    .phase {
      min-height: 138px;
      display: grid;
      gap: 8px;
      align-content: start;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fffdf8;
      position: relative;
    }

    .phase::after {
      content: "";
      position: absolute;
      top: 50%;
      right: -11px;
      width: 11px;
      height: 1px;
      background: var(--line);
    }

    .phase:nth-child(4n)::after,
    .phase:last-child::after {
      display: none;
    }

    .phase-title {
      font-weight: 750;
    }

    .phase-detail {
      color: var(--muted);
      font-size: 0.88rem;
      line-height: 1.35;
    }

    .pill {
      width: max-content;
      max-width: 100%;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .complete { background: var(--green-bg); color: var(--green); }
    .attention { background: var(--red-bg); color: var(--red); }
    .todo { background: var(--gold-bg); color: var(--gold); }
    .optional,
    .requested,
    .scaffolded,
    .pending { background: var(--blue-bg); color: var(--blue); }

    .phase a,
    .links a,
    .table a {
      color: var(--clay-dark);
      text-decoration-color: rgba(127, 63, 47, 0.35);
      text-underline-offset: 3px;
    }

    .stack {
      display: grid;
      gap: 18px;
    }

    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0 16px 16px;
    }

    .links a {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 7px 10px;
      background: #fffdf8;
      font-size: 0.86rem;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    .table th,
    .table td {
      padding: 10px 16px;
      border-top: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }

    .table th {
      color: var(--muted);
      font-size: 0.74rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .gate-list {
      display: grid;
      gap: 8px;
      padding: 0 16px 16px;
    }

    .gate {
      display: grid;
      gap: 8px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #fffdf8;
    }

    .gate-pattern {
      color: var(--muted);
      font: 0.75rem ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }

    .gate-field {
      display: grid;
      gap: 2px;
    }

    .gate-field span {
      color: var(--clay-dark);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .gate p {
      margin: 0;
      color: var(--muted);
      font-size: 0.86rem;
      line-height: 1.35;
    }

    .toolbar {
      display: flex;
      gap: 8px;
      padding: 0 16px 12px;
    }

    button {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: #fffdf8;
      color: var(--ink);
      cursor: pointer;
      font: inherit;
      font-size: 0.84rem;
      padding: 7px 10px;
    }

    button[aria-pressed="true"] {
      background: var(--clay);
      border-color: var(--clay);
      color: white;
    }

    @media (max-width: 860px) {
      main {
        width: min(100vw - 20px, 720px);
        padding-top: 20px;
      }

      .grid {
        grid-template-columns: 1fr;
      }

      .flow {
        grid-template-columns: 1fr;
      }

      .phase::after {
        display: none;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="eyebrow">Finish Lane</div>
      <h1>Prepare PR Workflow Status</h1>
      <div class="meta" id="meta"></div>
      <section class="next">
        <span class="eyebrow">Current next action</span>
        <strong id="next-action"></strong>
      </section>
    </header>

    <section class="grid">
      <div class="stack">
        <section class="panel">
          <h2>Phase Map</h2>
          <div class="flow" id="phase-map"></div>
        </section>

        <section class="panel">
          <h2>Validation Steps</h2>
          <table class="table">
            <thead>
              <tr>
                <th>Step</th>
                <th>Exit</th>
                <th>Log</th>
              </tr>
            </thead>
            <tbody id="steps"></tbody>
          </table>
        </section>
      </div>

      <div class="stack">
        <section class="panel">
          <h2>Artifacts</h2>
          <nav class="links" id="artifact-links" aria-label="Workflow artifacts"></nav>
        </section>

        <section class="panel">
          <h2>Quality Gates</h2>
          <div class="toolbar" aria-label="Gate filters">
            <button type="button" data-filter="all" aria-pressed="true">All</button>
            <button type="button" data-filter="applies" aria-pressed="false">Applies</button>
            <button type="button" data-filter="optional" aria-pressed="false">Optional</button>
          </div>
          <div class="gate-list" id="gates"></div>
        </section>
      </div>
    </section>
  </main>

  <script>
    const workflowData = ${jsonForHtml(data)};

    function element(tag, attrs, children) {
      const node = document.createElement(tag);
      Object.entries(attrs || {}).forEach(function(entry) {
        const key = entry[0];
        const value = entry[1];
        if (value === undefined || value === null) return;
        if (key === "className") node.className = value;
        else if (key === "text") node.textContent = value;
        else node.setAttribute(key, String(value));
      });
      (children || []).forEach(function(child) {
        if (typeof child === "string") node.appendChild(document.createTextNode(child));
        else if (child) node.appendChild(child);
      });
      return node;
    }

    function pill(status) {
      return element("span", { className: "pill " + status, text: status }, []);
    }

    function link(href, label) {
      return element("a", { href: href, text: label }, []);
    }

    function renderMeta() {
      const meta = document.getElementById("meta");
      [
        "base: " + workflowData.baseRef,
        "agent: " + workflowData.agent,
        "generated: " + workflowData.generatedAt
      ].forEach(function(text) {
        meta.appendChild(element("span", { text: text }, []));
      });
    }

    function renderPhases() {
      const container = document.getElementById("phase-map");
      workflowData.phases.forEach(function(phase) {
        const artifactHref = firstArtifactHref(phase.artifact);
        const artifactNode = artifactHref
          ? link(artifactHref, phase.artifact)
          : element("span", { text: phase.artifact }, []);
        const card = element("article", { className: "phase" }, [
          pill(phase.status),
          element("div", { className: "phase-title", text: phase.title }, []),
          element("div", { className: "phase-detail", text: phase.detail }, []),
          element("div", {}, [artifactNode])
        ]);
        container.appendChild(card);
      });
    }

    function firstArtifactHref(label) {
      const first = label.split(",")[0].trim();
      if (first.indexOf(".") === -1 && first.indexOf("/") === -1) return "";
      return first;
    }

    function renderArtifacts() {
      const container = document.getElementById("artifact-links");
      workflowData.artifacts.forEach(function(item) {
        container.appendChild(link(item.href, item.label));
      });
    }

    function renderSteps() {
      const body = document.getElementById("steps");
      workflowData.steps.forEach(function(step) {
        const row = element("tr", {}, [
          element("td", { text: step.name }, []),
          element("td", {}, [pill(step.status === 0 ? "complete" : "attention")]),
          element("td", {}, [link(step.href, "open log")])
        ]);
        body.appendChild(row);
      });
    }

    function renderGates(filter) {
      const container = document.getElementById("gates");
      container.textContent = "";
      workflowData.gates
        .filter(function(gate) {
          if (filter === "applies") return gate.applies;
          if (filter === "optional") return !gate.applies;
          return true;
        })
        .forEach(function(gate) {
          container.appendChild(element("article", { className: "gate" }, [
            pill(gate.applies ? "todo" : "optional"),
            element("strong", { text: gate.gate }, []),
            element("div", { className: "gate-pattern", text: gate.pattern }, []),
            gateField("Signal", gate.signal),
            gateField("When", gate.appliesWhen),
            gateField("Quick pass", gate.quickPass),
            gateField("Deep pass", gate.deepPass),
            gateField("Evidence", gate.evidence)
          ]));
        });
    }

    function gateField(label, value) {
      return element("div", { className: "gate-field" }, [
        element("span", { text: label }, []),
        element("p", { text: value }, [])
      ]);
    }

    function bindFilters() {
      document.querySelectorAll("[data-filter]").forEach(function(button) {
        button.addEventListener("click", function() {
          document.querySelectorAll("[data-filter]").forEach(function(other) {
            other.setAttribute("aria-pressed", String(other === button));
          });
          renderGates(button.getAttribute("data-filter"));
        });
      });
    }

    document.getElementById("next-action").textContent = workflowData.nextAction;
    renderMeta();
    renderPhases();
    renderArtifacts();
    renderSteps();
    renderGates("all");
    bindFilters();
  </script>
</body>
</html>
`,
    "utf8",
  )
}

function writeReport(
  outDir: string,
  rootDir: string,
  baseRef: string,
  options: Options,
  steps: Step[],
): string {
  const branch = runCapture("git branch --show-current 2>/dev/null", rootDir).output.trim()
  const lines = [
    "# Finish Lane Report",
    "",
    `- Run directory: \`${outDir}\``,
    `- Repository: \`${rootDir}\``,
    `- Branch: \`${branch}\``,
    `- Base ref: \`${baseRef}\``,
    `- Mechanical fixes: \`${options.runFixes}\``,
    `- Validation checks: \`${options.runChecks}\``,
    `- Agent pass: \`${options.agent}\``,
    "",
    "## Artifacts",
    "",
    "- `workflow-status.html` - browser-friendly phase map, artifact links, gates, and validation status",
    "- `workflow-status.md` - visual phase map and next action",
    "- `changed-files.txt` - scoped file inventory",
    "- `secret-risk.md` - filename-only secret/bulky-file risk scan",
    "- `setup-scripts.txt` - deterministic setup/auth/test entrypoint candidates",
    "- `setup-blueprint-template.yml` - template for saving hard-won setup knowledge",
    "- `quality-gates.md` - self-contained gate manifest with patterns, quick passes, deep passes, and evidence requirements",
    "- `gate-decisions.md` - agent applicability ledger, one-off local gate check, and skipped-gate summary",
    "- `qa-plan.md` - targeted manual QA starter",
    "- `verification-timeline.md` - chronological setup/action/assertion ledger",
    "- `subagent-plan.md` - read-only specialist review suggestions",
    "- `agent-review.md` - optional read-only Claude/Codex review output when requested",
    "- `evidence/` - screenshots, recordings, traces, logs, and snippets",
    "- `prompts/finish-review.md` - prompt for the active agent or a second pass",
    "- `pr-body-draft.md` - PR body skeleton seeded with validation results",
    "- `logs/` - command outputs",
    "",
    "## Step Results",
    "",
    "| Step | Exit | Log |",
    "|---|---:|---|",
    ...steps.map((step) => `| \`${step.name}\` | ${step.status} | \`${step.logFile}\` |`),
    "",
    "## Next Agent Actions",
    "",
    "1. Open `workflow-status.html` or `workflow-status.md` to see the current phase and next action.",
    "2. Read `qa-plan.md` and replace generic probes with source-grounded exact routes, commands, payloads, and expected results.",
    "3. Write expectations into `verification-timeline.md` before taking each QA action, then mark assertions passed, failed, or untested.",
    "4. Fill `gate-decisions.md`: accept or override recommended gates, add any one-off local gate for new functionality, and summarize intentional skips.",
    "5. Run each selected quick pass in `quality-gates.md`, escalate only when risk justifies it, or write a concrete skip rationale.",
    "6. Use `subagent-plan.md` for read-only specialist reviews when useful, while keeping fixes sequential.",
    "7. Inspect failed logs and decide whether each failure is a code defect, environment blocker, or unrelated pre-existing issue.",
    "8. Apply scoped cleanup only where behavior can be proved unchanged.",
    "9. Promote repeated setup pain into a deterministic setup script or repo skill using `setup-blueprint-template.yml`.",
    "10. Re-run this script after fixes, then use `pr-body-draft.md` for PR creation or update.",
    "",
  ]

  const report = lines.join("\n")
  writeFileSync(path.join(outDir, "report.md"), report, "utf8")
  return report
}

function resolveAgentPass(agentMode: AgentMode, agentExplicit: boolean, rootDir: string): { agent: ConcreteAgent; reason: string } {
  const invoker = detectInvoker()
  const preference = readAgentPreference(rootDir)

  if (agentMode === "none") {
    if (agentExplicit) {
      writeAgentPreference(rootDir, "none")
    }
    return { agent: "none", reason: agentExplicit ? "Project preference saved as no independent reviewer." : "No independent reviewer requested." }
  }

  if (agentMode === "auto") {
    if (!preference || preference.reviewAgent === "none") {
      return {
        agent: "none",
        reason: "No project independent-review preference is saved. Run with `--agent peer`, `--agent codex`, or `--agent claude` to opt in.",
      }
    }
    if (!commandExists(preference.reviewAgent)) {
      return {
        agent: "none",
        reason: `Saved reviewer \`${preference.reviewAgent}\` is not available on PATH. Re-run with an available explicit reviewer to update the project preference.`,
      }
    }
    return { agent: preference.reviewAgent, reason: `Using saved project reviewer preference: \`${preference.reviewAgent}\`.` }
  }

  if (agentMode === "peer") {
    if (invoker === "unknown") {
      return {
        agent: "none",
        reason: "Could not detect whether the invoker is Claude or Codex. Set `FINISH_LANE_INVOKER=claude` or `FINISH_LANE_INVOKER=codex`, or pass `--agent codex` / `--agent claude` explicitly.",
      }
    }
    const peer: ConcreteAgent = invoker === "claude" ? "codex" : "claude"
    if (!commandExists(peer)) {
      return {
        agent: "none",
        reason: `Detected invoker \`${invoker}\`, but peer reviewer \`${peer}\` is not available on PATH. No project preference was saved.`,
      }
    }
    writeAgentPreference(rootDir, peer)
    return { agent: peer, reason: `Detected invoker \`${invoker}\`; using peer reviewer \`${peer}\` and saving it as the project preference.` }
  }

  if (!commandExists(agentMode)) {
    return { agent: "none", reason: `Requested reviewer \`${agentMode}\` is not available on PATH. No project preference was saved.` }
  }
  writeAgentPreference(rootDir, agentMode)
  return { agent: agentMode, reason: `Using explicit reviewer \`${agentMode}\` and saving it as the project preference.` }
}

function runAgentPass(agentMode: AgentMode, agentExplicit: boolean, outDir: string, rootDir: string, logDir: string, steps: Step[]): ConcreteAgent {
  const resolved = resolveAgentPass(agentMode, agentExplicit, rootDir)
  const agent = resolved.agent
  const prompt = path.join(outDir, "prompts", "finish-review.md")
  const output = path.join(outDir, "agent-review.md")

  if (agent === "none") {
    log("skipping agent pass")
    writeAgentReviewPlaceholder(outDir, resolved.reason)
    return "none"
  }

  log(resolved.reason)
  const reviewPrompt = `Read ${prompt} and complete the requested finish-lane review. Stay read-only: do not edit, stage, commit, push, deploy, or create a PR.`

  if (agent === "claude") {
    const allowedTools = "Read,Grep,Glob,Bash(git status *),Bash(git diff *),Bash(git log *),Bash(git rev-parse *)"
    const disallowedTools = "Edit,Write,MultiEdit,NotebookEdit,Bash(git add *),Bash(git commit *),Bash(git push *),Bash(git reset *),Bash(git checkout *)"
    runStep(
      "agent-review",
      `claude -p --permission-mode plan --no-session-persistence --allowedTools ${shellQuote(allowedTools)} --disallowedTools ${shellQuote(disallowedTools)} --output-format text ${shellQuote(reviewPrompt)} > ${shellQuote(output)} < /dev/null`,
      rootDir,
      logDir,
      steps,
    )
  }

  if (agent === "codex") {
    runStep(
      "agent-review",
      `codex exec --sandbox read-only -c model_reasoning_effort="medium" ${shellQuote(reviewPrompt)} > ${shellQuote(output)} < /dev/null`,
      rootDir,
      logDir,
      steps,
    )
  }
  return agent
}

function main(): void {
  const options = parseArgs(process.argv.slice(2))
  const rootResult = runCapture("git rev-parse --show-toplevel 2>/dev/null")
  if (rootResult.status !== 0) {
    fail("finish-lane must run inside a git checkout.")
  }
  const rootDir = rootResult.output.trim()
  process.chdir(rootDir)

  const baseRef = detectBaseRef(options.baseRef)
  const outDir = path.resolve(rootDir, options.outDir || `.workflow/finish-lane/${timestamp()}`)
  const outRel = path.relative(rootDir, outDir)
  const logDir = path.join(outDir, "logs")
  const promptDir = path.join(outDir, "prompts")
  const evidenceDir = path.join(outDir, "evidence")

  mkdirSync(logDir, { recursive: true })
  mkdirSync(promptDir, { recursive: true })
  mkdirSync(path.join(evidenceDir, "screenshots"), { recursive: true })
  mkdirSync(path.join(evidenceDir, "videos"), { recursive: true })
  mkdirSync(path.join(evidenceDir, "traces"), { recursive: true })

  const scripts = packageScripts(rootDir)
  const pm = packageManager(rootDir)
  const steps: Step[] = []
  const changedFiles = writeChangedFiles(rootDir, outDir, outRel, baseRef)
  const classification = classify(rootDir, baseRef, changedFiles)

  writeSecretRiskReport(outDir, changedFiles)
  writeSetupScriptInventory(rootDir, outDir, outRel, scripts)
  writeSetupBlueprintTemplate(outDir)
  writeVerificationTimeline(outDir)
  const gates = writeQualityGates(outDir, rootDir, classification)
  writeGateDecisions(outDir, gates)
  writeSubagentPlan(outDir, gates)
  writeQaPlan(outDir, baseRef, changedFiles, classification)
  writeAgentPrompt(outDir)
  writeAgentReviewPlaceholder(outDir, "No independent agent review was requested for this run.")

  runStep("git-status", "git status --short", rootDir, logDir, steps)
  runStep("diff-stat", `git diff --stat ${shellQuote(baseRef)}...HEAD && git diff --stat && git diff --cached --stat`, rootDir, logDir, steps)
  runStep("diff-check", "git diff --check && git diff --cached --check", rootDir, logDir, steps)

  if (options.runFixes && pm) {
    for (const script of ["format", "fmt", "lint:fix", "fix"]) {
      if (scripts[script]) {
        runStep(`fix-${script}`, packageScriptCommand(pm, script), rootDir, logDir, steps)
      }
    }
  }

  if (options.runChecks) {
    if (pm) {
      for (const script of ["validate", "check", "lint", "typecheck", "test", "build"]) {
        if (scripts[script]) {
          runStep(`package-${script}`, packageScriptCommand(pm, script), rootDir, logDir, steps)
        }
      }
    }

    if ((existsSync("pyproject.toml") || existsSync("pytest.ini") || existsSync("tests")) && commandExists("pytest")) {
      runStep("pytest", "pytest", rootDir, logDir, steps)
    }

    if (existsSync("go.mod") && commandExists("go")) {
      runStep("go-test", "go test ./...", rootDir, logDir, steps)
    }

    if (existsSync("Cargo.toml") && commandExists("cargo")) {
      runStep("cargo-test", "cargo test", rootDir, logDir, steps)
    }
  }

  writeSteps(outDir, steps)
  writePrDraft(outDir, steps)

  const resolvedAgent = runAgentPass(options.agent, options.agentExplicit, outDir, rootDir, logDir, steps)
  writeSteps(outDir, steps)
  writePrDraft(outDir, steps)

  writeWorkflowStatus(outDir, steps, gates, resolvedAgent)
  writeWorkflowStatusHtml(outDir, steps, gates, resolvedAgent, baseRef)
  const report = writeReport(outDir, rootDir, baseRef, { ...options, agent: resolvedAgent }, steps)
  log(`wrote ${path.join(outDir, "report.md")}`)
  console.log(report)
}

main()
