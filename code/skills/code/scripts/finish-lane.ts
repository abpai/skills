#!/usr/bin/env bun

import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

type PackageManager = "bun" | "pnpm" | "yarn" | "npm" | ""
type CmdResult = { cmd: string; status: "ok" | "fail" | "skip" }

type Options = {
  baseRef: string
  runFixes: boolean
  seal: boolean
  arm: boolean
  disarm: boolean
}

const usage = `Usage: finish-lane.ts [options]

Deterministic preflight for PR prep. Computes the PR scope union, runs
discovered fix/validation commands, does fast mechanical scans over changed
files, and suggests review-pattern lenses. One compact stdout summary plus
.workflow/finish-lane/changed-files.txt. Never stages, commits, pushes, or PRs.

Options:
  --base REF   Override base detection (default: origin/HEAD -> origin/main ->
               main -> HEAD).
  --fix        Also run discovered fix/format commands.
  --arm        Arm the push gate for this repo (prepare-pr Phase 1). Writes the
               arm marker the gate-before-push hook checks. Needs CLAUDE_PLUGIN_DATA.
  --seal       Write the per-branch seal sentinel after gates/QA/review pass.
               Refuses (exit 2, no sentinel) if any discovered validation
               command is failing, so the gate is never sealed red.
  --disarm     Disarm the push gate for this repo (prepare-pr Phase 5, after push).
  --help       Show this help.`

function fail(message: string, code = 1): never {
  console.error(message)
  process.exit(code)
}

function parseArgs(args: string[]): Options {
  const options: Options = { baseRef: "", runFixes: false, seal: false, arm: false, disarm: false }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    switch (arg) {
      case "--base":
        options.baseRef = args[++i] ?? fail("--base requires a value", 2)
        break
      case "--fix":
        options.runFixes = true
        break
      case "--arm":
        options.arm = true
        break
      case "--disarm":
        options.disarm = true
        break
      case "--seal":
        options.seal = true
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

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function run(command: string, cwd = process.cwd()): { output: string; status: number } {
  const result = spawnSync(command, { cwd, encoding: "utf8", shell: "/bin/bash" })
  return {
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    status: typeof result.status === "number" ? result.status : 1,
  }
}

function commandExists(command: string): boolean {
  return run(`command -v ${shellQuote(command)} >/dev/null 2>&1`).status === 0
}

function gitRefExists(ref: string): boolean {
  return run(`git rev-parse --verify --quiet ${shellQuote(ref)} >/dev/null`).status === 0
}

function detectBase(requested: string): string {
  if (requested) return requested
  const head = run("git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||'").output.trim()
  if (head && gitRefExists(`origin/${head}`)) return `origin/${head}`
  for (const candidate of ["origin/main", "origin/master", "main", "master", "HEAD"]) {
    if (gitRefExists(candidate)) return candidate
  }
  return "HEAD"
}

function packageManager(rootDir: string): PackageManager {
  if (existsSync(path.join(rootDir, "bun.lockb")) || existsSync(path.join(rootDir, "bun.lock"))) return "bun"
  if (existsSync(path.join(rootDir, "pnpm-lock.yaml"))) return "pnpm"
  if (existsSync(path.join(rootDir, "yarn.lock"))) return "yarn"
  if (existsSync(path.join(rootDir, "package-lock.json")) || existsSync(path.join(rootDir, "package.json"))) return "npm"
  return ""
}

function packageScripts(rootDir: string): Record<string, string> {
  const file = path.join(rootDir, "package.json")
  if (!existsSync(file)) return {}
  try {
    return (JSON.parse(readFileSync(file, "utf8")) as { scripts?: Record<string, string> }).scripts ?? {}
  } catch {
    return {}
  }
}

function scriptCommand(pm: PackageManager, name: string): string {
  if (pm === "bun") return `bun run ${name}`
  if (pm === "pnpm") return `pnpm run ${name}`
  if (pm === "yarn") return `yarn ${name}`
  if (pm === "npm") return `npm run ${name}`
  return ""
}

// --- Scope union ---------------------------------------------------------

function scopeFiles(rootDir: string, baseRef: string): {
  committed: string[]
  uncommitted: string[]
  untracked: string[]
  all: string[]
} {
  const lines = (cmd: string) =>
    run(cmd, rootDir)
      .output.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

  const committed = lines(`git diff --name-only ${shellQuote(baseRef)}...HEAD 2>/dev/null`)
  const uncommitted = [
    ...lines("git diff --name-only 2>/dev/null"),
    ...lines("git diff --cached --name-only 2>/dev/null"),
  ]
  const untracked = lines("git ls-files --others --exclude-standard 2>/dev/null")

  const ignore = (file: string) => file === ".workflow" || file.startsWith(".workflow/")
  const seen = new Set<string>()
  const all: string[] = []
  for (const file of [...committed, ...uncommitted, ...untracked]) {
    if (ignore(file) || seen.has(file)) continue
    seen.add(file)
    all.push(file)
  }

  const dedupe = (files: string[]) => Array.from(new Set(files.filter((file) => !ignore(file))))
  return { committed: dedupe(committed), uncommitted: dedupe(uncommitted), untracked: dedupe(untracked), all }
}

// Hash everything that changes the PR scope so the gate seal invalidates on any
// new commit, staged/unstaged edit, or new untracked file.
//
// This MUST stay byte-identical to the recompute in code/hooks/gate-before-push.sh
// or a correctly sealed branch never opens the gate. The hook hashes the stream:
//   git diff <base>...HEAD   (committed diff, ordered)
//   git diff                 (unstaged diff, ordered)
//   git diff --cached        (staged diff, ordered)
//   git ls-files --others --exclude-standard | grep -v '^\.workflow/' | LC_ALL=C sort
// concatenated with NO separator, each untracked path newline-terminated. The
// .workflow/ tree (seal sentinel + changed-files.txt) is ephemeral workflow
// state, so it is excluded here exactly as the hook excludes it — otherwise
// writing the sentinel would change the hash and self-invalidate the seal.
function scopeHash(rootDir: string, baseRef: string): string {
  const diffCommitted = run(`git diff ${shellQuote(baseRef)}...HEAD 2>/dev/null`, rootDir).output
  const diffUnstaged = run("git diff 2>/dev/null", rootDir).output
  const diffStaged = run("git diff --cached 2>/dev/null", rootDir).output
  const untracked = run("git ls-files --others --exclude-standard 2>/dev/null", rootDir)
    .output.split("\n")
    .filter((line) => line.length > 0 && !line.startsWith(".workflow/"))
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))) // LC_ALL=C byte order
  const untrackedStream = untracked.map((line) => `${line}\n`).join("")
  return createHash("sha256").update(diffCommitted + diffUnstaged + diffStaged + untrackedStream).digest("hex")
}

// --- Mechanical scans ----------------------------------------------------

const slopPhrases = [
  "Here's why",
  "not just",
  "it's not",
  "game-changer",
  "game changer",
  "seamless",
  "robust",
  "delight",
  "leverage",
  "unlock",
  "supercharge",
]

const placeholderPattern = /\b(TODO|FIXME|HACK|stub|placeholder|not implemented)\b/i

function isDocFile(file: string): boolean {
  return /(^|\/)README(\.[^/]+)?$|(^|\/)docs\//i.test(file) || file.toLowerCase().endsWith(".md")
}

function isCodeFile(file: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java|kt|swift|sh)$/i.test(file)
}

function readSample(rootDir: string, file: string): string | null {
  const absolute = path.join(rootDir, file)
  if (!existsSync(absolute)) return null
  try {
    const buffer = readFileSync(absolute)
    if (buffer.includes(0) || buffer.length > 524288) return null
    return buffer.toString("utf8")
  } catch {
    return null
  }
}

type Scan = { slop: number; placeholder: number; hits: string[] }

function mechanicalScans(rootDir: string, files: string[]): Scan {
  const scan: Scan = { slop: 0, placeholder: 0, hits: [] }
  const emdash = /—/g

  for (const file of files) {
    const text = readSample(rootDir, file)
    if (text === null) continue
    const lines = text.split(/\r?\n/)

    lines.forEach((line, index) => {
      if (isDocFile(file)) {
        const emdashCount = (line.match(emdash) || []).length
        if (emdashCount >= 2) {
          scan.slop += 1
          if (scan.hits.length < 40) scan.hits.push(`${file}:${index + 1}: emdash-overuse`)
        }
        for (const phrase of slopPhrases) {
          if (line.toLowerCase().includes(phrase.toLowerCase())) {
            scan.slop += 1
            if (scan.hits.length < 40) scan.hits.push(`${file}:${index + 1}: slop "${phrase}"`)
          }
        }
      }
      if (placeholderPattern.test(line)) {
        scan.placeholder += 1
        if (scan.hits.length < 40) scan.hits.push(`${file}:${index + 1}: ${line.trim().slice(0, 80)}`)
      }
    })
  }
  return scan
}

function ubsScan(rootDir: string, files: string[]): { available: boolean; output: string; outputLines: number; status: number | null } {
  if (!commandExists("ubs")) return { available: false, output: "", outputLines: 0, status: null }
  const code = files.filter((file) => isCodeFile(file) && existsSync(path.join(rootDir, file)))
  if (code.length === 0) return { available: true, output: "", outputLines: 0, status: 0 }
  const result = run(`ubs ${code.map(shellQuote).join(" ")} 2>&1`, rootDir)
  const output = result.output.trim()
  const outputLines = output ? output.split(/\r?\n/).filter((line) => line.trim()).length : 0
  return { available: true, output, outputLines, status: result.status }
}

// --- Surface tagger ------------------------------------------------------

const lensRules: { lens: string; test: RegExp }[] = [
  { lens: "browser-e2e-verification.md", test: /(^|\/)(routes|pages|components|ui|frontend)\/|\.(tsx|jsx|html|css|scss|sass)$/i },
  { lens: "ux-accessibility-audit.md", test: /(^|\/)(routes|pages|components|ui|frontend)\/|\.(tsx|jsx|html)$/i },
  { lens: "real-service-integration-check.md", test: /(^|\/)(api|server|workers?|db|database|migrations?|webhooks?)(\/|$)/i },
  { lens: "cli-agent-ergonomics.md", test: /(^|\/)(commands|bin|scripts|cli)(\/|$)|\.(sh|bash|zsh)$/i },
  { lens: "prose-quality-pr-copy.md", test: /(^|\/)README(\.[^/]+)?$|(^|\/)docs\/|\.md$/i },
  { lens: "config-contract-check.md", test: /(^|\/)(package|tsconfig|plugin|marketplace|versions)\.(json|jsonc)$|\.(ya?ml|toml)$/i },
  { lens: "performance-profiling.md", test: /(^|\/)(benchmarks?|perf|performance|profiles|profiling)(\/|$)|\.(bench|benchmark)\./i },
  { lens: "golden-artifact-decision.md", test: /(^|\/)(goldens?|snapshots?|__snapshots__|approvals?)(\/|$)|\.(snap|golden)(\.[^/]*)?$/i },
  { lens: "mock-stub-placeholder-sweep.md", test: /(^|\/)(__tests__|tests?|spec|fixtures?|mocks?)(\/|$)|\.(test|spec)\./i },
  { lens: "multi-pass-bug-hunting.md", test: /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java|kt|swift)$/i },
]

function suggestLenses(files: string[]): string[] {
  const selected = new Set<string>()
  for (const file of files) {
    for (const rule of lensRules) {
      if (rule.test.test(file)) selected.add(rule.lens)
    }
  }
  return Array.from(selected).sort()
}

// --- Command execution ---------------------------------------------------

function runCommands(rootDir: string, pm: PackageManager, scripts: Record<string, string>, names: string[]): CmdResult[] {
  const results: CmdResult[] = []
  if (!pm) return results
  for (const name of names) {
    if (!scripts[name]) continue
    const cmd = scriptCommand(pm, name)
    const status = run(cmd, rootDir).status === 0 ? "ok" : "fail"
    results.push({ cmd, status })
  }
  return results
}

function repoValidationCommands(rootDir: string): string[] {
  const scriptsDir = path.join(rootDir, "scripts")
  if (!existsSync(scriptsDir)) return []

  let entries: string[]
  try {
    entries = readdirSync(scriptsDir)
  } catch {
    return []
  }

  const commands: string[] = []
  for (const entry of entries.sort()) {
    if (!/^(check|test|validate)[A-Za-z0-9_.-]*\.(sh|bash|zsh)$/.test(entry)) continue

    const absolute = path.join(scriptsDir, entry)
    try {
      if (!statSync(absolute).isFile()) continue
    } catch {
      continue
    }

    commands.push(`bash scripts/${entry}`)
  }
  return commands
}

function runValidation(rootDir: string, pm: PackageManager, scripts: Record<string, string>): CmdResult[] {
  const results = runCommands(rootDir, pm, scripts, ["validate", "check", "lint", "typecheck", "test", "build"])
  const seen = new Set(results.map((result) => result.cmd))

  for (const cmd of repoValidationCommands(rootDir)) {
    if (seen.has(cmd)) continue
    results.push({ cmd, status: run(cmd, rootDir).status === 0 ? "ok" : "fail" })
    seen.add(cmd)
  }

  if ((existsSync(path.join(rootDir, "pyproject.toml")) || existsSync(path.join(rootDir, "pytest.ini")) || existsSync(path.join(rootDir, "tests"))) && commandExists("pytest")) {
    results.push({ cmd: "pytest", status: run("pytest", rootDir).status === 0 ? "ok" : "fail" })
  }
  if (existsSync(path.join(rootDir, "go.mod")) && commandExists("go")) {
    results.push({ cmd: "go test ./...", status: run("go test ./...", rootDir).status === 0 ? "ok" : "fail" })
  }
  if (existsSync(path.join(rootDir, "Cargo.toml")) && commandExists("cargo")) {
    results.push({ cmd: "cargo test", status: run("cargo test", rootDir).status === 0 ? "ok" : "fail" })
  }
  return results
}

// --- Seal ----------------------------------------------------------------

function branchSlug(branch: string): string {
  return (branch || "detached").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "detached"
}

function sealPath(rootDir: string, slug: string): string {
  return path.join(rootDir, ".workflow", "finish-lane", "seal", `${slug}.sealed`)
}

// Per-repo id, byte-identical to gate-before-push.sh: sha256(toplevel abs path)
// truncated to 16 hex chars. The hook keys the arm marker by this exact value,
// so arming/disarming via this script must compute it the same way.
function repoId(rootDir: string): string {
  return createHash("sha256").update(rootDir).digest("hex").slice(0, 16)
}

function armMarkerPath(rootDir: string): string | null {
  const dataDir = process.env.CLAUDE_PLUGIN_DATA
  if (!dataDir) return null
  return path.join(dataDir, "prepare-pr", "armed", `${repoId(rootDir)}.armed`)
}

function writeSeal(rootDir: string, baseRef: string, branch: string, hash: string): { slug: string; head: string; hash: string } {
  const slug = branchSlug(branch)
  const head = run("git rev-parse HEAD 2>/dev/null", rootDir).output.trim()
  const file = sealPath(rootDir, slug)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(
    file,
    `${JSON.stringify({ head, scope_hash: hash, sealed_at: new Date().toISOString(), base: baseRef }, null, 2)}\n`,
    "utf8",
  )
  return { slug, head, hash }
}

// --- Main ----------------------------------------------------------------

function main(): void {
  const options = parseArgs(process.argv.slice(2))
  const rootResult = run("git rev-parse --show-toplevel 2>/dev/null")
  if (rootResult.status !== 0) fail("finish-lane must run inside a git checkout.")
  const rootDir = rootResult.output.trim()
  process.chdir(rootDir)

  // --disarm is a standalone terminal step (prepare-pr Phase 5, after push):
  // remove the arm marker so the gate goes inert again. No scope work needed.
  if (options.disarm) {
    const marker = armMarkerPath(rootDir)
    if (!marker) fail("--disarm needs CLAUDE_PLUGIN_DATA (run inside the installed plugin runtime).", 2)
    rmSync(marker, { force: true })
    console.log(`DISARMED ${marker}`)
    return
  }

  const baseRef = detectBase(options.baseRef)
  const branch = run("git branch --show-current 2>/dev/null", rootDir).output.trim()
  const pm = packageManager(rootDir)
  const scripts = packageScripts(rootDir)

  const scope = scopeFiles(rootDir, baseRef)
  const outDir = path.join(rootDir, ".workflow", "finish-lane")
  mkdirSync(outDir, { recursive: true })
  const changedFilesPath = path.join(outDir, "changed-files.txt")
  writeFileSync(changedFilesPath, `${scope.all.join("\n")}${scope.all.length ? "\n" : ""}`, "utf8")
  const hash = scopeHash(rootDir, baseRef)

  const fixResults = options.runFixes
    ? runCommands(rootDir, pm, scripts, ["format", "fmt", "lint:fix", "fix"])
    : []
  const validationResults = runValidation(rootDir, pm, scripts)
  const scan = mechanicalScans(rootDir, scope.all)
  const ubs = ubsScan(rootDir, scope.all)
  const lenses = suggestLenses(scope.all)

  const out: string[] = []
  out.push(`FINISH_LANE ${new Date().toISOString()}`)
  out.push(`base=${baseRef} branch=${branch || "(detached)"}`)
  out.push(
    `scope: committed=${scope.committed.length} uncommitted=${scope.uncommitted.length} untracked=${scope.untracked.length} total=${scope.all.length}`,
  )
  out.push(`changed-files: ${changedFilesPath}`)
  out.push(`scope_hash=${hash}`)

  out.push("fix commands:")
  if (!options.runFixes) out.push("  (skipped; pass --fix to run format/fmt/lint:fix/fix)")
  else if (fixResults.length === 0) out.push("  (none discovered)")
  else for (const r of fixResults) out.push(`  ${r.cmd} -> ${r.status}`)

  out.push("validation commands:")
  if (validationResults.length === 0) out.push("  (none discovered)")
  else for (const r of validationResults) out.push(`  ${r.cmd} -> ${r.status}`)

  out.push("mechanical scans:")
  out.push(`  slop hits: ${scan.slop}`)
  out.push(`  placeholder hits: ${scan.placeholder}`)
  out.push(
    `  ubs: ${
      ubs.available
        ? `exit ${ubs.status ?? "?"}, ${ubs.outputLines} output line${ubs.outputLines === 1 ? "" : "s"}`
        : "not installed"
    }`,
  )
  for (const hit of scan.hits) out.push(`    ${hit}`)
  if (ubs.available && ubs.status !== 0 && ubs.output) {
    for (const line of ubs.output.split(/\r?\n/).slice(-40)) out.push(`    ubs: ${line}`)
  }

  out.push("suggested lenses:")
  if (lenses.length === 0) out.push("  (none matched changed-file globs)")
  else for (const lens of lenses) out.push(`  review-patterns/${lens}`)

  // Sealing is the mechanical half of "gated on green": never stamp a
  // push-ready sentinel while a discovered validation command is red, or the
  // hook would wave through a push the gate exists to stop. No validation
  // discovered (length 0) is not a failure — the agent's judgment is the gate
  // for docs-only / no-command repos.
  let sealRefused = false
  if (options.seal) {
    const failed = validationResults.filter((r) => r.status === "fail")
    if (failed.length > 0) {
      out.push(`SEAL REFUSED: ${failed.length} validation command(s) failed — fix and re-run --seal; the push gate stays closed:`)
      for (const r of failed) out.push(`  ${r.cmd} -> fail`)
      sealRefused = true
    } else {
      const sealed = writeSeal(rootDir, baseRef, branch, hash)
      out.push(`SEALED ${sealed.slug} head=${sealed.head} scope_hash=${sealed.hash}`)
    }
  }

  if (options.arm) {
    const marker = armMarkerPath(rootDir)
    if (!marker) {
      out.push("arm: SKIPPED (no CLAUDE_PLUGIN_DATA; the push gate is inert outside the installed plugin runtime)")
    } else {
      mkdirSync(path.dirname(marker), { recursive: true })
      writeFileSync(marker, `${new Date().toISOString()}\n`, "utf8")
      out.push(`ARMED ${marker}`)
    }
  }

  console.log(out.join("\n"))
  if (sealRefused) process.exit(2)
}

main()
