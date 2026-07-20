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
               origin/master -> main -> master -> HEAD).
  --fix        Also run discovered fix/format commands. Cannot be combined with
               --seal: review and QA must inspect the post-fix scope first.
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
  // The documented flow reviews and QAs the post-fix scope before sealing
  // (Phase 1 is --fix --arm, Phase 5 is plain --seal). Keep that human/agent
  // checkpoint explicit even though main() now recomputes scope after fixes.
  if (options.runFixes && options.seal) {
    fail("--fix cannot be combined with --seal: run --fix first, review and QA the post-fix scope, then --seal separately.", 2)
  }
  return options
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function gitEnvironment(): NodeJS.ProcessEnv {
  // Never let an inherited Git context (GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE,
  // …) reach the commands this module runs. A hook runner exports GIT_* for its
  // own repository; carrying that into a `run(cwd)` call redirects Git reads and
  // writes back to the hook's repository instead of `cwd`. Stripping GIT_* is
  // production-equivalent — Git rediscovers the same repository from `cwd` (a
  // hook's cwd is that repository's working tree) — while keeping test fixtures,
  // and any other non-cwd repository this module inspects, isolated no matter
  // what the caller inherited. Stripping unconditionally also covers module
  // helpers that run at the default cwd (e.g. gitRefExists), which a
  // cwd-conditional strip would miss.
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")))
}

// `output` interleaves stdout+stderr for human-facing error messages. Anything
// parsed or hashed must use `stdout`: the gate-before-push.sh hook recomputes
// the scope hash from `git ... 2>/dev/null` pipelines (stdout only), so folding
// a stray git stderr warning (ambiguous refname, CRLF advice) into the hash
// would make a correctly sealed branch permanently stale to the hook.
function run(command: string, cwd = process.cwd()): { output: string; stdout: string; status: number } {
  const result = spawnSync(command, { cwd, encoding: "utf8", shell: "/bin/bash", env: gitEnvironment() })
  return {
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    stdout: result.stdout ?? "",
    status: typeof result.status === "number" ? result.status : 1,
  }
}

function commandExists(command: string): boolean {
  return run(`command -v ${shellQuote(command)} >/dev/null 2>&1`).status === 0
}

function gitRefExists(ref: string): boolean {
  return run(`git rev-parse --verify --quiet ${shellQuote(ref)} >/dev/null`).status === 0
}

// Resolve an explicit --base to a commit. The scope diffs run with `2>/dev/null`,
// so an unresolvable base (e.g. the typo `orgin/main`) would otherwise silently
// yield an EMPTY committed diff and the workflow could seal an incomplete scope.
// Fail fast here, before any scope computation, sentinel, or changed-files write.
function detectBase(requested: string): string {
  if (requested) {
    if (!gitRefExists(`${requested}^{commit}`)) {
      fail(
        `--base ${requested} does not resolve to a commit. Check for a typo (e.g. 'orgin/main') ` +
          `or fetch the ref first; refusing to compute scope against an invalid base.`,
        2,
      )
    }
    // A base that resolves but shares NO common history with HEAD (e.g. an
    // unrelated/orphan branch) makes `git diff base...HEAD` exit 128 with EMPTY
    // output. Because the scope diffs suppress that (2>/dev/null), it would
    // silently yield an empty committed scope and seal an incomplete PR. Require
    // a merge-base. Skipped on an unborn HEAD (no commits): there is no
    // committed scope to diff and uncommitted/untracked scope is still captured.
    if (gitRefExists("HEAD") && run(`git merge-base ${shellQuote(requested)} HEAD >/dev/null 2>&1`).status !== 0) {
      fail(
        `--base ${requested} shares no common history with HEAD (no merge-base), so ` +
          `'git diff ${requested}...HEAD' cannot compute a committed diff. Pass a base that is ` +
          `an ancestor of this branch (e.g. origin/main), or fetch the correct ref first.`,
        2,
      )
    }
    return requested
  }
  const head = run("git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||'").stdout.trim()
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

// Committed-scope diff (base...HEAD), run FAIL-CLOSED. The `2>/dev/null` form
// used elsewhere hides git's exit status, so a base...HEAD that errors (exit
// 128) reads as an empty committed scope — exactly how an incomplete PR could
// seal. detectBase() already rejects an explicit no-merge-base base up front;
// this is defense-in-depth for any other diff failure. The one legitimate
// empty case — an unborn HEAD with no commits — is detected and returned empty
// rather than treated as an error (uncommitted/untracked scope still applies).
function committedDiff(rootDir: string, baseRef: string, extraArgs: string): string {
  if (!gitRefExists("HEAD")) return ""
  const args = extraArgs ? `${extraArgs} ` : ""
  const result = run(`git diff ${args}${shellQuote(baseRef)}...HEAD`, rootDir)
  if (result.status !== 0) {
    fail(
      `git diff ${baseRef}...HEAD failed (exit ${result.status}): ${result.output.trim() || "no output"}. ` +
        `Refusing to compute an incomplete committed scope.`,
      2,
    )
  }
  // stdout only: this feeds scopeHash and --name-only parsing. A successful
  // `git diff` can still warn on stderr (e.g. an ambiguous refname); the hook
  // hashes the same diff with `2>/dev/null`, so including stderr here would
  // break seal parity, and a warning line is not a changed-file name.
  return result.stdout
}

function scopeFiles(rootDir: string, baseRef: string): {
  committed: string[]
  uncommitted: string[]
  untracked: string[]
  all: string[]
} {
  const lines = (cmd: string) =>
    run(cmd, rootDir)
      .stdout.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

  const committed = committedDiff(rootDir, baseRef, "--name-only")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
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
// new commit, staged/unstaged edit, new untracked file, OR an edit to an
// existing untracked file's contents.
//
// This MUST stay byte-identical to the recompute in code/hooks/gate-before-push.sh
// or a correctly sealed branch never opens the gate. The hook hashes the stream:
//   git diff <base>...HEAD   (committed diff, ordered)
//   git diff                 (unstaged diff, ordered)
//   git diff --cached        (staged diff, ordered)
//   for each untracked path (LC_ALL=C-sorted, .workflow/ excluded):
//     "<path> <git hash-object of path>\n"
// concatenated with NO separator. Tracked changes already ride in the three
// diffs; untracked files are NOT in any diff, so we fold in each one's
// `git hash-object` content id alongside its path — that detects both a new
// untracked file (path appears) AND a content edit to an existing one (its
// object id changes), without streaming file bytes (git hashes large/binary
// files itself). A missing/unreadable path yields an empty id on both sides, so
// parity holds. The .workflow/ tree (seal sentinel + changed-files.txt) is
// ephemeral workflow state, so it is excluded here exactly as the hook excludes
// it — otherwise writing the sentinel would change the hash and self-invalidate
// the seal.
function scopeHash(rootDir: string, baseRef: string): string {
  const diffCommitted = committedDiff(rootDir, baseRef, "")
  const diffUnstaged = run("git diff 2>/dev/null", rootDir).stdout
  const diffStaged = run("git diff --cached 2>/dev/null", rootDir).stdout
  const untracked = run("git ls-files --others --exclude-standard 2>/dev/null", rootDir)
    .stdout.split("\n")
    .filter((line) => line.length > 0 && !line.startsWith(".workflow/"))
    .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))) // LC_ALL=C byte order
  const untrackedStream = untracked
    .map((p) => `${p} ${run(`git hash-object -- ${shellQuote(p)} 2>/dev/null`, rootDir).stdout.trim()}\n`)
    .join("")
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
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|c|h|cpp|cc|cxx|hpp|go|rs|rb|java|kt|swift|sh|cs|ex|exs)$/i.test(file)
}

const testFilePattern = /(^|\/)(__tests__|tests?|spec|fixtures?|mocks?)(\/|$)|\.(test|spec)\./i
const generatedFilePattern =
  /(^|\/)(node_modules|vendor|vendors|generated|dist|build|coverage|out|target)(\/|$)|(^|\/).*\.generated\.|(^|\/).*\.min\.js$|(^|\/)(bun\.lock|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i
const ubsSupportedFilePattern =
  /\.(ts|tsx|js|jsx|mjs|cjs|py|c|h|cpp|cc|cxx|hpp|rs|go|java|rb|swift|cs|ex|exs)$/i
const ubsTimeoutMs = 60_000
const ubsRawLogLimit = 20_000
const ubsActionableLimit = 12
const ubsMaxBufferBytes = 10 * 1024 * 1024

function isTestFile(file: string): boolean {
  return testFilePattern.test(file)
}

function isGeneratedFile(file: string): boolean {
  return generatedFilePattern.test(file)
}

function isUbsSupportedFile(file: string): boolean {
  return ubsSupportedFilePattern.test(file)
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

// --- Semantic-shortcut scan ----------------------------------------------

// Code that guesses at a contract it could have consulted: fallback chains,
// regex over a structured grammar, bespoke auth/crypto, boundary casts. A
// filename glob cannot see any of it — the trigger is the *shape of the code* —
// so this content scan is what routes review-patterns/semantic-shortcuts.md into
// the suggested-lens list. Without it that lens is selectable only if the agent
// happens to notice the pattern unaided.
//
// ADDED lines only, read from ONE base-to-working-tree diff. A shortcut already
// living in a file this diff merely touches is not this PR's finding, and
// flagging it would drag the lens into every edit of a legacy file. Scanning the
// committed, staged, and unstaged diffs separately would be wrong twice over:
// their line numbers live in different coordinate systems, and a shortcut that
// was committed and then deleted in the working tree would still be reported.
//
// Tuned to under-trigger on the lens's own documented false positives rather
// than to catch every case. `env.PORT || 3000` is a default, not a guess about a
// contract, so a fallback needs TWO chained operators over a property access.
// The output is a suggestion, not a verdict, and zero hits is weak evidence: the
// agent still reads the diff.
//
// Known self-match: the rule table below applies a regex containing SQL keywords,
// so scanning THIS file reports one `regex-parse` hit. A detector's source is
// necessarily a corpus of the patterns it detects, and the alternative — rules
// contorted until they cannot see themselves — would cost real detection. It is
// an advisory suggestion; dismiss it.

type ShortcutKind = "fallback-chain" | "regex-parse" | "bespoke-crypto" | "boundary-cast"

// Alternatives are disjoint on their first character (`\` vs `[` vs neither), so
// this cannot backtrack exponentially on an unterminated literal. The {4,} floor
// keeps a trivial regex (`/,/`, `/\s/`) from ever reading as a parser substitute.
const regexLiteral = /\/(?:[^/\n\\[]|\\.|\[(?:[^\]\\]|\\.)*\]){4,}\/[gimsuyd]*/
const stringLiteral = /(["'`])(?:\\.|(?!\1)[^\\])*\1/g
const lineComment = /\/\/.*$/

const boundaryContext =
  /JSON\.parse|await\s|fetch\(|\breq\b|\brequest\b|\bres\b|\bresponse\b|\bbody\b|payload|\brows?\b|\brecord\b|process\.env|\bmessage\b|\bevent\b|\bwebhook\b/i
const authContext = /\b(sign|verify|auth|token|jwt|secret|signature|password|hmac|session|cookie|bearer)\b/i
const structuredFormat =
  /\b(sql|html|xml|csv|yaml|semver|jwt|mime|content-type|href|uri|url|email)\b|\b(select|insert|update|delete|from|where|join|union)\b|<\/?[a-z]/i
// The primitive must be INVOKED, not merely named: a line that lists these as
// alternatives (a rule table, a doc, an import) is talking about crypto, not
// hand-rolling it. Same reason regex-parse demands an application site below —
// otherwise this scanner's own rule table is its loudest finding.
// `scryptSync|scrypt` rather than `scrypt(?:Sync)?`: an inline group would put a
// literal `(` right after the name, so the pattern would match its own source.
const cryptoPrimitive =
  /\b(createHmac|createHash|createCipheriv|createDecipheriv|createSign|createVerify|pbkdf2|scryptSync|scrypt|hmac\.new|hashlib\.(md5|sha1|sha256|sha512))\s*\(/i
const jwtHandSplit = /\.split\(\s*["'`]\.["'`]\s*\)/
const regexApplied =
  /\.(match|matchAll|test|exec|replace|replaceAll|search|split)\s*\(|\bre\.(search|match|fullmatch|findall|finditer|sub|compile)\s*\(/

// Strings are noise for the fallback and cast rules — `logger.debug("body as User")`
// is a log message, not a cast. They are EVIDENCE for the regex and crypto rules
// (`new RegExp("<div>")`), so those read the raw line.
function stripStrings(line: string): string {
  return line.replace(stringLiteral, '""').replace(lineComment, "")
}

// The pattern a regex is actually applying — literal, RegExp ctor, or Python re.
function regexSource(line: string): string | null {
  const literal = regexLiteral.exec(line)
  if (literal) return literal[0]
  const ctor = /new RegExp\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/.exec(line)
  if (ctor) return ctor[2]
  const python = /\bre\.(?:search|match|fullmatch|findall|finditer|sub|compile)\(\s*[rbu]*(["'])((?:\\.|(?!\1)[^\\])*)\1/.exec(line)
  if (python) return python[2]
  return null
}

// A regex only stands in for a PARSER when the pattern itself reaches for
// structure: a capture group, markup, or an SQL keyword. Without this,
// `text.replace(/[ \t]{2,}/g, " ")` on a line that merely mentions `html` reads
// as a parser substitute when it is whitespace normalization.
function patternIsStructural(source: string): boolean {
  return /\(/.test(source) || /</.test(source) || /\b(select|insert|update|delete|from|where|join|union)\b/i.test(source)
}

export function classifyShortcutLine(rawLine: string): ShortcutKind | null {
  if (/^\s*(\/\/|\/\*|\*|#)/.test(rawLine)) return null
  const line = stripStrings(rawLine)

  // Fallback chain: two or more chained `??`/`||` reading properties. A single
  // operator is a default, never a guess. `??` is a shape guess wherever it
  // appears (including a call argument); a `||`-only chain must be producing a
  // value, since in a condition it is ordinary boolean logic.
  // The operands must READ values (`resp.data`), not CALL predicates
  // (`re.test(x) || re2.test(x)`) — a boolean OR of function calls is logic, not
  // a guess at which key exists.
  const operators = (line.match(/\?\?|\|\|/g) || []).length
  if (
    operators >= 2 &&
    !/&&|===|!==|==|!=|<=|>=/.test(line) &&
    // `\b` after `\w+` is load-bearing: without it the greedy match backtracks
    // (`test` -> `tes`) and the "not a call" lookahead passes on `x.test(y)`.
    /[\w)\]]\s*\.\s*\w+\b(?!\s*\()|\[["'`]/.test(line) &&
    !/^\s*(if|while|else\s+if|elif)\b/.test(line)
  ) {
    const nullish = /\?\?/.test(line)
    const producesValue = /(^|[^=!<>])=[^=]|return\s|:\s/.test(line)
    if (nullish || producesValue) return "fallback-chain"
  }

  const source = regexSource(rawLine)
  if (source && regexApplied.test(rawLine) && structuredFormat.test(rawLine) && patternIsStructural(source)) {
    return "regex-parse"
  }

  if ((cryptoPrimitive.test(rawLine) || jwtHandSplit.test(rawLine)) && authContext.test(rawLine)) return "bespoke-crypto"

  if (/\bas\s+any\b|\bas\s+unknown\s+as\b/.test(line)) return "boundary-cast"
  if (boundaryContext.test(line)) {
    if (/\bas\s+[A-Z]\w*(\[\])?\b/.test(line)) return "boundary-cast"
    // Non-null assertion: `response.body!` — a claim, not a check. `!==` and a
    // leading `!` negation are excluded by requiring a value before the `!` and
    // a terminator after it.
    if (/[\w\])]\s*!\s*(?:[;,)\]}]|$)/.test(line)) return "boundary-cast"
  }
  return null
}

// Added lines in ONE coordinate system: base -> working tree. That is the state
// the PR actually ships, so a committed-then-reverted line correctly disappears.
function addedLines(rootDir: string, baseRef: string, untracked: string[]): { file: string; line: number; text: string }[] {
  const added: { file: string; line: number; text: string }[] = []

  if (gitRefExists("HEAD")) {
    const diff = run(`git diff --unified=0 ${shellQuote(baseRef)} 2>/dev/null`, rootDir).stdout
    let file = ""
    let lineNo = 0
    let sawOldHeader = false
    for (const raw of diff.split(/\r?\n/)) {
      // `+++` is only a file header directly after `---`. An added line of code
      // reading `++ counter` arrives as `+++ counter` and must not be mistaken
      // for one, or every later hunk is attributed to a file named `counter`.
      if (raw.startsWith("--- ")) {
        sawOldHeader = true
        continue
      }
      if (sawOldHeader && raw.startsWith("+++ ")) {
        const target = raw.slice(4).trim()
        file = target === "/dev/null" ? "" : target.replace(/^b\//, "")
        sawOldHeader = false
        continue
      }
      sawOldHeader = false

      const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw)
      if (hunk) {
        lineNo = Number(hunk[1])
        continue
      }
      if (!file) continue
      if (raw.startsWith("+")) {
        added.push({ file, line: lineNo, text: raw.slice(1) })
        lineNo += 1
      } else if (raw.startsWith(" ")) {
        // diff.interHunkContext can emit context even under --unified=0; context
        // advances the new-file counter, removals and `\ No newline` do not.
        lineNo += 1
      }
    }
  }

  for (const file of untracked) {
    const text = readSample(rootDir, file)
    if (text === null) continue
    text.split(/\r?\n/).forEach((line, index) => added.push({ file, line: index + 1, text: line }))
  }

  return added
}

type ShortcutScan = { count: number; hits: string[] }

export function scanSemanticShortcuts(rootDir: string, baseRef: string, untracked: string[]): ShortcutScan {
  const scan: ShortcutScan = { count: 0, hits: [] }
  const seen = new Set<string>()

  for (const { file, line, text } of addedLines(rootDir, baseRef, untracked)) {
    if (!isCodeFile(file) || isTestFile(file) || isGeneratedFile(file)) continue
    const kind = classifyShortcutLine(text)
    if (!kind) continue
    const key = `${file}:${line}`
    if (seen.has(key)) continue
    seen.add(key)
    scan.count += 1
    if (scan.hits.length < 20) scan.hits.push(`${key}: ${kind}: ${text.trim().slice(0, 80)}`)
  }
  return scan
}

type UbsSeverity = "good" | "info" | "warning" | "critical"
type UbsStatus = "skipped" | "clean" | "advisory-findings" | "tool-failure" | "timeout"
type UbsCounts = Record<UbsSeverity, number>
type UbsFindingKind = "source" | "test" | "generated" | "unsupported" | "unknown"

type UbsFinding = {
  severity: UbsSeverity
  file: string
  line: number | null
  category: string
  message: string
  kind: UbsFindingKind
  count: number
}

type UbsSelection = {
  files: string[]
  skipped: {
    test: number
    generated: number
    unsupported: number
    missing: number
  }
}

type UbsArtifacts = {
  findings: string
  report: string
  summary: string
  rawLog: string
}

type UbsScan = {
  status: UbsStatus
  available: boolean
  exitCode: number | null
  scannedFiles: number
  skipped: UbsSelection["skipped"]
  counts: UbsCounts
  actionable: UbsFinding[]
  artifacts: UbsArtifacts
  parseable: boolean
  note: string
}

function emptyUbsCounts(): UbsCounts {
  return { good: 0, info: 0, warning: 0, critical: 0 }
}

function configuredUbsTimeoutMs(): number {
  const raw = process.env.FINISH_LANE_UBS_TIMEOUT_MS
  if (!raw) return ubsTimeoutMs
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : ubsTimeoutMs
}

function configuredUbsMaxBufferBytes(): number {
  const raw = process.env.FINISH_LANE_UBS_MAX_BUFFER
  if (!raw) return ubsMaxBufferBytes
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : ubsMaxBufferBytes
}

function capText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n[truncated ${text.length - maxChars} chars]\n`
}

function relativeArtifact(rootDir: string, file: string): string {
  return path.relative(rootDir, file).replace(/\\/g, "/")
}

function normalizePath(rootDir: string, file: string): string {
  if (!file) return ""
  const cleaned = file.replace(/^file:\/\//, "").replace(/\\/g, "/")
  const filesScanMarker = "/files_scan/"
  const scratchIndex = cleaned.lastIndexOf(filesScanMarker)
  if (scratchIndex >= 0) return cleaned.slice(scratchIndex + filesScanMarker.length)
  const absolute = path.isAbsolute(cleaned) ? cleaned : path.join(rootDir, cleaned)
  return path.relative(rootDir, absolute).replace(/\\/g, "/")
}

function ubsArtifacts(outDir: string): UbsArtifacts {
  return {
    findings: path.join(outDir, "ubs-findings.jsonl"),
    report: path.join(outDir, "ubs-report.json"),
    summary: path.join(outDir, "ubs-summary.md"),
    rawLog: path.join(outDir, "ubs-raw.log"),
  }
}

function ubsPathArg(file: string): string {
  return file.startsWith("-") ? `./${file}` : file
}

function selectUbsFiles(rootDir: string, files: string[]): UbsSelection {
  const selection: UbsSelection = {
    files: [],
    skipped: { test: 0, generated: 0, unsupported: 0, missing: 0 },
  }

  for (const file of files) {
    if (!isCodeFile(file)) continue
    if (!existsSync(path.join(rootDir, file))) {
      selection.skipped.missing += 1
      continue
    }
    if (isGeneratedFile(file)) {
      selection.skipped.generated += 1
      continue
    }
    if (isTestFile(file)) {
      selection.skipped.test += 1
      continue
    }
    if (!isUbsSupportedFile(file)) {
      selection.skipped.unsupported += 1
      continue
    }
    selection.files.push(file)
  }

  return selection
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function recordViews(record: Record<string, unknown>): Record<string, unknown>[] {
  const views = [record]
  for (const key of ["finding", "issue", "result", "data", "location", "position", "range", "span"]) {
    const nested = asRecord(record[key])
    if (nested) views.push(nested)
  }
  return views
}

function stringValue(record: Record<string, unknown>, keys: string[]): string {
  for (const view of recordViews(record)) {
    for (const key of keys) {
      const value = view[key]
      if (typeof value === "string" && value.trim()) return value.trim()
    }
  }
  return ""
}

function numberValue(record: Record<string, unknown>, keys: string[]): number | null {
  for (const view of recordViews(record)) {
    for (const key of keys) {
      const value = view[key]
      if (typeof value === "number" && Number.isFinite(value)) return value
      if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value)
    }
  }
  return null
}

function normalizeSeverity(value: unknown): UbsSeverity {
  if (typeof value === "string") {
    const normalized = value.toLowerCase()
    if (normalized === "good" || normalized === "info" || normalized === "warning" || normalized === "critical") {
      return normalized
    }
    if (normalized === "warn") return "warning"
    if (normalized === "error" || normalized === "high") return "critical"
  }
  return "info"
}

function severityFromRecord(record: Record<string, unknown>): UbsSeverity {
  for (const view of recordViews(record)) {
    const severity = normalizeSeverity(view.severity ?? view.level ?? view.priority)
    if (severity !== "info" || view.severity || view.level || view.priority) return severity
  }
  return "info"
}

function countsFromObject(value: unknown): UbsCounts | null {
  const record = asRecord(value)
  if (!record) return null
  const counts = emptyUbsCounts()
  let seen = 0
  for (const severity of Object.keys(counts) as UbsSeverity[]) {
    const direct = record[severity]
    const suffixed = record[`${severity}_count`] ?? record[`${severity}Count`]
    const valueForSeverity = direct ?? suffixed
    if (typeof valueForSeverity === "number" && Number.isFinite(valueForSeverity)) {
      counts[severity] = valueForSeverity
      seen += 1
    } else if (typeof valueForSeverity === "string" && /^\d+$/.test(valueForSeverity.trim())) {
      counts[severity] = Number(valueForSeverity)
      seen += 1
    }
  }
  return seen > 0 ? counts : null
}

function findTotals(records: Record<string, unknown>[]): UbsCounts | null {
  for (const record of records) {
    const kind = stringValue(record, ["type", "kind", "name"])
    const candidates = [record.totals, record.total, record.counts, record.summary, record.severity_counts, record.severityCounts, record.stats]
    for (const candidate of candidates) {
      const counts = countsFromObject(candidate)
      if (counts) return counts
    }
    if (/total|summary|count/i.test(kind)) {
      const counts = countsFromObject(record)
      if (counts) return counts
    }
  }
  return null
}

function flattenReportRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap((entry) => flattenReportRecords(entry))
  const record = asRecord(value)
  if (!record) return []
  const records: Record<string, unknown>[] = [record]
  for (const key of ["findings", "issues", "results", "records", "items", "data", "scanners"]) {
    if (Array.isArray(record[key])) records.push(...flattenReportRecords(record[key]))
  }
  return records
}

function reportSampleRecords(value: unknown): Record<string, unknown>[] {
  const report = asRecord(value)
  const scanners = Array.isArray(report?.scanners) ? report.scanners : []
  const records: Record<string, unknown>[] = []

  for (const scannerValue of scanners) {
    const scanner = asRecord(scannerValue)
    const extras = asRecord(scanner?.extras)
    if (!scanner || !extras) continue
    const language = typeof scanner.language === "string" ? scanner.language : ""
    for (const [analyzer, extraValue] of Object.entries(extras)) {
      const extra = asRecord(extraValue)
      const samples = Array.isArray(extra?.samples) ? extra.samples : []
      for (const sampleValue of samples) {
        const sample = asRecord(sampleValue)
        if (!sample) continue
        records.push({
          ...sample,
          type: "sample",
          category: analyzer,
          language,
          severity: normalizeSeverity(extra?.severity ?? scanner.severity),
          message: typeof sample.code === "string" ? sample.code : analyzer,
        })
      }
    }
  }

  return records
}

function jsonlRecords(text: string): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = []
  for (const line of text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)) {
    try {
      const record = asRecord(JSON.parse(line))
      if (record) records.push(record)
    } catch {
      // Keep parsing later lines; malformed JSONL means fallback if nothing useful is found.
    }
  }
  return records
}

function uniqueRecords(records: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>()
  return records.filter((record) => {
    const key = JSON.stringify(record)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function readUbsRecords(artifacts: UbsArtifacts, stdout = ""): { records: Record<string, unknown>[]; parseable: boolean } {
  const records: Record<string, unknown>[] = []

  const findingRecords = existsSync(artifacts.findings) ? jsonlRecords(readFileSync(artifacts.findings, "utf8")) : []
  records.push(...findingRecords)
  if (findingRecords.length === 0 && stdout.trim()) records.push(...jsonlRecords(stdout))

  if (existsSync(artifacts.report)) {
    try {
      const report = JSON.parse(readFileSync(artifacts.report, "utf8"))
      records.push(...flattenReportRecords(report), ...reportSampleRecords(report))
    } catch {
      // The raw fallback log records that UBS produced no usable structured output.
    }
  }

  const unique = uniqueRecords(records)
  return { records: unique, parseable: unique.length > 0 }
}

function classifyFindingFile(file: string): UbsFindingKind {
  if (!file) return "unknown"
  if (isGeneratedFile(file)) return "generated"
  if (isTestFile(file)) return "test"
  if (!isUbsSupportedFile(file)) return "unsupported"
  return "source"
}

function findingFromRecord(rootDir: string, record: Record<string, unknown>): UbsFinding | null {
  const type = stringValue(record, ["type", "kind", "name"]).toLowerCase()
  const isFindingRecord = type === "finding" || type === "issue" || type === "result" || type === "sample"
  const file = normalizePath(rootDir, stringValue(record, ["file", "path", "filename", "uri", "source"]))
  const line = numberValue(record, ["line", "start_line", "startLine", "lineNumber", "row"])
  const title = stringValue(record, ["message", "title", "check", "rule"])
  const description = stringValue(record, ["description", "text", "summary"])
  const message = title && description && title !== description ? `${title}: ${description}` : title || description
  const category = stringValue(
    record,
    isFindingRecord
      ? ["category", "category_id", "categoryId", "rule", "rule_id", "ruleId", "id", "language"]
      : ["category", "category_id", "categoryId", "rule", "rule_id", "ruleId", "id"],
  )
  const count = numberValue(record, ["count", "total"])
  if (!file && !isFindingRecord) return null
  if (!file && count !== null && count <= 0) return null
  if (!file && !message && !category) return null

  return {
    severity: severityFromRecord(record),
    file,
    line,
    category,
    message,
    kind: file ? classifyFindingFile(file) : "source",
    count: count && count > 0 ? count : 1,
  }
}

function summarizeCountsFromFindings(findings: UbsFinding[], records: Record<string, unknown>[]): UbsCounts {
  const counts = emptyUbsCounts()
  for (const record of records) {
    const severity = severityFromRecord(record)
    const count = numberValue(record, ["count", "total"])
    const file = stringValue(record, ["file", "path", "filename", "uri", "source"])
    if (count !== null && count > 0 && !file) counts[severity] += count
  }
  if (counts.good || counts.info || counts.warning || counts.critical) return counts

  for (const finding of findings) counts[finding.severity] += 1
  return counts
}

function isNoiseFinding(finding: UbsFinding): boolean {
  const category = finding.category.toLowerCase()
  const message = finding.message.toLowerCase()
  if (/^(11|12|13|14)$/.test(category)) return true
  // Word-bounded: a real finding whose message echoes an identifier like
  // fetchTodos / hackney / xxxHash must not be dropped as discuss-only noise.
  return /\b(debug code|todo|fixme|hack|xxx|deep nesting)\b/.test(`${category} ${message}`)
}

function actionableUbsFindings(findings: UbsFinding[]): UbsFinding[] {
  // The same defect can arrive twice — once as a JSONL finding record and once
  // as a report `extras` sample with a different record shape — so raw-record
  // dedup (uniqueRecords) misses it. Dedup on the resolved finding identity.
  const seen = new Set<string>()
  return findings
    .filter((finding) => finding.kind === "source")
    .filter((finding) => finding.severity === "critical" || finding.severity === "warning")
    .filter((finding) => !isNoiseFinding(finding))
    .filter((finding) => {
      const key = `${finding.severity}|${finding.file}|${finding.line ?? ""}|${finding.category}|${finding.message}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function ubsFindingCount(findings: UbsFinding[], severity: UbsSeverity): number {
  return findings.filter((finding) => finding.severity === severity).reduce((sum, finding) => sum + finding.count, 0)
}

function formatUbsFinding(finding: UbsFinding): string {
  const location = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ""}` : "source scan"
  const category = finding.category ? ` [${finding.category}]` : ""
  const message = finding.message ? ` ${finding.message}` : ""
  const count = finding.count > 1 ? ` (${finding.count} occurrences)` : ""
  return `${finding.severity} ${location}${category}${message}${count}`.trim()
}

function writeUbsSummary(rootDir: string, scan: UbsScan): void {
  const lines: string[] = []
  lines.push("# UBS Summary")
  lines.push("")
  lines.push(`status: ${scan.status}`)
  lines.push(`exit_code: ${scan.exitCode === null ? "n/a" : scan.exitCode}`)
  lines.push(`parseable: ${scan.parseable ? "yes" : "no"}`)
  lines.push(`scanned_source_files: ${scan.scannedFiles}`)
  lines.push(
    `skipped: tests=${scan.skipped.test} generated=${scan.skipped.generated} unsupported=${scan.skipped.unsupported} missing=${scan.skipped.missing}`,
  )
  lines.push(
    `severity_totals: critical=${scan.counts.critical} warning=${scan.counts.warning} info=${scan.counts.info} good=${scan.counts.good}`,
  )
  if (scan.note) lines.push(`note: ${scan.note}`)
  lines.push("")
  lines.push("## Actionable Source Findings")
  if (scan.actionable.length === 0) {
    lines.push("")
    lines.push("None.")
  } else {
    lines.push("")
    for (const finding of scan.actionable.slice(0, ubsActionableLimit)) {
      lines.push(`- ${formatUbsFinding(finding)}`)
    }
    if (scan.actionable.length > ubsActionableLimit) {
      lines.push(`- ... ${scan.actionable.length - ubsActionableLimit} more finding(s) in ${relativeArtifact(rootDir, scan.artifacts.findings)}`)
    }
  }
  lines.push("")
  lines.push("## Artifacts")
  lines.push("")
  lines.push(`- findings: ${relativeArtifact(rootDir, scan.artifacts.findings)}`)
  lines.push(`- report: ${relativeArtifact(rootDir, scan.artifacts.report)}`)
  if (existsSync(scan.artifacts.rawLog)) lines.push(`- raw fallback log: ${relativeArtifact(rootDir, scan.artifacts.rawLog)}`)
  writeFileSync(scan.artifacts.summary, `${lines.join("\n")}\n`, "utf8")
}

function writeUbsRawLog(artifacts: UbsArtifacts, stdout: string, stderr: string, note: string): void {
  const raw = [`note: ${note}`, "", "## stdout", stdout || "(empty)", "", "## stderr", stderr || "(empty)", ""].join("\n")
  writeFileSync(artifacts.rawLog, capText(raw, ubsRawLogLimit), "utf8")
}

function ubsScan(rootDir: string, files: string[], outDir: string): UbsScan {
  const artifacts = ubsArtifacts(outDir)
  for (const file of [artifacts.findings, artifacts.report, artifacts.summary, artifacts.rawLog]) rmSync(file, { force: true })

  const selection = selectUbsFiles(rootDir, files)
  const base: Omit<UbsScan, "status" | "available" | "exitCode" | "parseable" | "note"> = {
    scannedFiles: selection.files.length,
    skipped: selection.skipped,
    counts: emptyUbsCounts(),
    actionable: [],
    artifacts,
  }

  if (!commandExists("ubs")) {
    const scan: UbsScan = {
      ...base,
      status: "skipped",
      available: false,
      exitCode: null,
      parseable: false,
      note: "ubs not installed",
    }
    writeUbsSummary(rootDir, scan)
    return scan
  }

  if (selection.files.length === 0) {
    const scan: UbsScan = {
      ...base,
      status: "skipped",
      available: true,
      exitCode: 0,
      parseable: false,
      note: "no supported source files to scan",
    }
    writeUbsSummary(rootDir, scan)
    return scan
  }

  const args = [
    "--ci",
    "--format=jsonl",
    `--beads-jsonl=${artifacts.findings}`,
    `--report-json=${artifacts.report}`,
    // UBS v5.3.2 treats a POSIX `--` end-of-options marker as a literal file
    // path, so protect dash-leading changed files by prefixing them with `./`.
    ...selection.files.map(ubsPathArg),
  ]
  const result = spawnSync("ubs", args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: false,
    timeout: configuredUbsTimeoutMs(),
    maxBuffer: configuredUbsMaxBufferBytes(),
  })
  const stdout = result.stdout ?? ""
  const stderr = result.stderr ?? ""
  const error = result.error as (Error & { code?: string }) | undefined
  const timedOut = error?.code === "ETIMEDOUT"
  const exitCode = typeof result.status === "number" ? result.status : timedOut ? null : 1

  if (timedOut) {
    writeUbsRawLog(artifacts, stdout, stderr, "ubs timed out")
    const scan: UbsScan = {
      ...base,
      status: "timeout",
      available: true,
      exitCode,
      parseable: false,
      note: `ubs timed out after ${configuredUbsTimeoutMs()}ms`,
    }
    writeUbsSummary(rootDir, scan)
    return scan
  }

  // Any other spawn-level failure (e.g. ENOBUFS when ubs floods past maxBuffer,
  // EACCES, a killed process) means ubs was interrupted. Treat it as a tool
  // failure instead of parsing whatever partial artifact survived — otherwise a
  // truncated run could be reported clean/advisory, breaking "tool failure is
  // never clean".
  if (error) {
    const code = error.code ?? error.message
    writeUbsRawLog(artifacts, stdout, stderr, `ubs failed to run: ${code}`)
    const scan: UbsScan = {
      ...base,
      status: "tool-failure",
      available: true,
      exitCode,
      parseable: false,
      note: `ubs failed to run (${code}); run ubs doctor --fix, then rescan`,
    }
    writeUbsSummary(rootDir, scan)
    return scan
  }

  // A process terminated by an external signal (e.g. the OOM killer SIGKILLing
  // ubs) sets result.signal but leaves result.error undefined and result.status
  // null, so it slips past both the timeout and error guards above. Treat it as
  // a tool failure rather than parsing whatever partial artifact survived.
  if (result.signal) {
    writeUbsRawLog(artifacts, stdout, stderr, `ubs killed by signal ${result.signal}`)
    const scan: UbsScan = {
      ...base,
      status: "tool-failure",
      available: true,
      exitCode,
      parseable: false,
      note: `ubs was killed by signal ${result.signal}; run ubs doctor --fix, then rescan`,
    }
    writeUbsSummary(rootDir, scan)
    return scan
  }

  if (exitCode === 2) {
    writeUbsRawLog(artifacts, stdout, stderr, "ubs exited 2 (tool failure)")
    const scan: UbsScan = {
      ...base,
      status: "tool-failure",
      available: true,
      exitCode,
      parseable: false,
      note: "ubs exited 2; run ubs doctor --fix, then rescan",
    }
    writeUbsSummary(rootDir, scan)
    return scan
  }

  const { records, parseable } = readUbsRecords(artifacts, stdout)
  const findings = records.map((record) => findingFromRecord(rootDir, record)).filter((finding): finding is UbsFinding => finding !== null)
  const totals = findTotals(records)
  const counts = totals ?? summarizeCountsFromFindings(findings, records)
  const actionable = actionableUbsFindings(findings)

  // `parseable` from readUbsRecords only means we decoded *some* JSON object; a
  // report like {"error":"..."} decodes but yields neither a recognized finding
  // nor a severity-totals block. Require one of those before trusting the run,
  // so a structured error report falls through to tool-failure (never clean).
  const meaningful = parseable && (totals !== null || findings.length > 0)

  if (!meaningful) {
    writeUbsRawLog(artifacts, stdout, stderr, "ubs ran but produced no parseable structured output")
    const scan: UbsScan = {
      ...base,
      status: "tool-failure",
      available: true,
      exitCode,
      parseable: false,
      note: "ubs ran but produced no parseable structured output",
    }
    writeUbsSummary(rootDir, scan)
    return scan
  }

  const highSeverityTotals = counts.critical > 0 || counts.warning > 0
  const highSeverityFindings = findings.filter((finding) => finding.severity === "critical" || finding.severity === "warning")
  const status: UbsStatus = actionable.length > 0 || (highSeverityTotals && highSeverityFindings.length === 0) ? "advisory-findings" : "clean"
  const scan: UbsScan = {
    ...base,
    status,
    available: true,
    exitCode,
    parseable: true,
    counts,
    actionable,
    note:
      status === "advisory-findings"
        ? actionable.length > 0
          ? "UBS findings are advisory; they do not seal-block this patch."
          : "UBS reported warning/critical totals without source-actionable detail; inspect the artifacts."
        : highSeverityTotals
          ? "UBS reported warning/critical totals but no source-actionable finding records."
          : "",
  }
  writeUbsSummary(rootDir, scan)
  return scan
}

// --- Surface tagger ------------------------------------------------------

// Shared source-code extension set for filename-driven invariant and doctor routing.
const CODE_EXT = "ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java|kt|swift|c|cc|cpp|cxx|h|hpp|cs|scala|php|m|mm|dart|ex|exs"

const lensRules: { lens: string; test: RegExp }[] = [
  { lens: "browser-e2e-verification.md", test: /(^|\/)(routes|pages|components|ui|frontend)\/|\.(tsx|jsx|html|css|scss|sass)$/i },
  { lens: "ux-accessibility-audit.md", test: /(^|\/)(routes|pages|components|ui|frontend)\/|\.(tsx|jsx|vue|svelte|html|css|scss|sass)$/i },
  { lens: "real-service-integration-check.md", test: /(^|\/)(api|server|workers?|db|database|migrations?|webhooks?|auth|billing|payments?|checkout|subscriptions?|stripe|paypal|integration|e2e|factories?)(\/|$)|(^|\/)[^/]*(factory|harness)[^/]*\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java|kt)$|(^|\/)[^/]*test[^/]*db[^/]*\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java|kt)$/i },
  { lens: "cli-agent-ergonomics.md", test: /(^|\/)(commands|bin|scripts|cli)(\/|$)|\.(sh|bash|zsh)$/i },
  { lens: "prose-quality-check.md", test: /(^|\/)README(\.[^/]+)?$|(^|\/)(CHANGELOG|CHANGES|HISTORY)(\.[^/]+)?$|(^|\/)docs\/|\.md$/i },
  { lens: "config-contract-check.md", test: /(^|\/)(package|tsconfig|plugin|marketplace|versions)\.(json|jsonc)$|\.(ya?ml|toml)$|(^|\/)SKILL\.md$|(^|\/)\.c(laude|odex)-plugin\/plugin\.json$|(^|\/)commands\/.+\.md$/i },
  { lens: "performance-profiling.md", test: /(^|\/)(benchmarks?|perf|performance|profiles|profiling)(\/|$)|\.(bench|benchmark)\./i },
  { lens: "snapshot-testing-check.md", test: /(^|\/)(goldens?|snapshots?|__snapshots__|approvals?|goldenfiles?)(\/|$)|\.(snap|golden|approved|received|actual|ambr)(\.[^/]*)?$/i },
  { lens: "mock-stub-placeholder-sweep.md", test: testFilePattern },
  { lens: "mock-stub-placeholder-sweep.md", test: /(^|\/)(api|server|workers?|routes|jobs)\/.+\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java|kt)$/i },
  { lens: "doctor-self-healing-candidate.md", test: new RegExp(`(^|/)(doctor|fixers?|repair|healers?)/|(^|/)(doctor|repair|heal|fixer|setup|bootstrap|provision)[^/]*\\.(sh|bash|zsh|${CODE_EXT})$|(^|/)migrations?/`, "i") },
  { lens: "invariant-testing-check.md", test: new RegExp(`(^|/)(parser|serializ|deserial|codec|compiler|interpreter|ranking|scoring|optimizer|transform)[^/]*\\.(${CODE_EXT})$|(^|/)(parse|serialize|encode|decode)[^/]*\\.(${CODE_EXT})$`, "i") },
  // The UBS scan runs unconditionally as advisory support below, so it is not a lens.
  // refactor-safety-check.md is selected from diff intent (move/delete/refactor),
  // which cannot be inferred safely from a changed filename alone.
  // semantic-shortcuts.md is routed by the added-line content scan, not a
  // filename glob — see scanSemanticShortcuts.
]

export function suggestLenses(files: string[], semanticShortcuts = false): string[] {
  const selected = new Set<string>()
  for (const file of files) {
    for (const rule of lensRules) {
      if (rule.test.test(file)) selected.add(rule.lens)
    }
  }
  if (semanticShortcuts) selected.add("semantic-shortcuts.md")
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

// MUST stay byte-identical to the slug computed in code/hooks/gate-before-push.sh
// (collapse each run of unsafe chars to one '-', strip leading/trailing '-',
// fall back to "detached" for a detached HEAD or an all-unsafe name) — the hook
// looks the sentinel up by this exact filename, so any divergence means a
// correctly sealed branch never opens the gate.
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
  const head = run("git rev-parse HEAD 2>/dev/null", rootDir).stdout.trim()
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
  const rootDir = rootResult.stdout.trim()
  process.chdir(rootDir)

  // --disarm is a standalone terminal step (prepare-pr Phase 5, after push):
  // remove the arm marker so the gate goes inert again. No scope work needed.
  if (options.disarm) {
    const marker = armMarkerPath(rootDir)
    // Symmetric with --arm: when there is no CLAUDE_PLUGIN_DATA (Codex or a bare
    // checkout) there is no arm marker and no enforcing hook, so disarm is a
    // genuine no-op rather than an error. Hard-failing here would make the
    // documented Phase 5 disarm step always break outside the Claude plugin.
    if (!marker) {
      console.log("DISARM SKIPPED (no CLAUDE_PLUGIN_DATA; the push gate is inert outside the installed plugin runtime)")
      return
    }
    rmSync(marker, { force: true })
    console.log(`DISARMED ${marker}`)
    return
  }

  const baseRef = detectBase(options.baseRef)
  const branch = run("git branch --show-current 2>/dev/null", rootDir).stdout.trim()
  const pm = packageManager(rootDir)
  const scripts = packageScripts(rootDir)

  // Format/fix commands may touch files outside the pre-run diff. Run them
  // before computing the authoritative scope so changed-files, scans, lenses,
  // and the scope hash all describe the bytes the reviewer will actually ship.
  const fixResults = options.runFixes
    ? runCommands(rootDir, pm, scripts, ["format", "fmt", "lint:fix", "fix"])
    : []

  const scope = scopeFiles(rootDir, baseRef)
  const outDir = path.join(rootDir, ".workflow", "finish-lane")
  mkdirSync(outDir, { recursive: true })
  const changedFilesPath = path.join(outDir, "changed-files.txt")
  writeFileSync(changedFilesPath, `${scope.all.join("\n")}${scope.all.length ? "\n" : ""}`, "utf8")
  const hash = scopeHash(rootDir, baseRef)

  const validationResults = runValidation(rootDir, pm, scripts)
  const scan = mechanicalScans(rootDir, scope.all)
  const shortcuts = scanSemanticShortcuts(rootDir, baseRef, scope.untracked)
  const ubs = ubsScan(rootDir, scope.all, outDir)
  const lenses = suggestLenses(scope.all, shortcuts.count > 0)

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
  out.push(`  semantic-shortcut hits: ${shortcuts.count}`)
  for (const hit of shortcuts.hits) out.push(`    ${hit}`)
  out.push("  ubs:")
  out.push(`    status: ${ubs.status}`)
  out.push(`    available: ${ubs.available ? "yes" : "no"}`)
  out.push(`    exit_code: ${ubs.exitCode === null ? "n/a" : ubs.exitCode}`)
  out.push(`    scanned source files: ${ubs.scannedFiles}`)
  out.push(
    `    skipped: tests=${ubs.skipped.test} generated=${ubs.skipped.generated} unsupported=${ubs.skipped.unsupported} missing=${ubs.skipped.missing}`,
  )
  out.push(
    `    severity totals: critical=${ubs.counts.critical} warning=${ubs.counts.warning} info=${ubs.counts.info} good=${ubs.counts.good}`,
  )
  out.push(
    `    actionable source findings: critical=${ubsFindingCount(ubs.actionable, "critical")} warning=${ubsFindingCount(ubs.actionable, "warning")}`,
  )
  if (ubs.note) out.push(`    note: ${ubs.note}`)
  out.push(`    summary artifact: ${relativeArtifact(rootDir, ubs.artifacts.summary)}`)
  for (const finding of ubs.actionable.slice(0, 5)) out.push(`      ${formatUbsFinding(finding)}`)
  if (ubs.actionable.length > 5) out.push(`      ... ${ubs.actionable.length - 5} more in ${relativeArtifact(rootDir, ubs.artifacts.summary)}`)
  if (scan.hits.length > 0) {
    out.push("  scan samples:")
    for (const hit of scan.hits) out.push(`    ${hit}`)
  }

  out.push("suggested lenses:")
  if (lenses.length === 0) out.push("  (none matched changed-file globs)")
  else for (const lens of lenses) out.push(`  review-patterns/${lens}`)

  // Sealing is the mechanical half of "gated on green": never stamp a
  // push-ready sentinel while a discovered validation command is red, or the
  // hook would wave through a push the gate exists to stop. No validation
  // discovered (length 0) is not a failure — the agent's judgment is the gate
  // for docs-only / no-command repos.
  //
  // UBS findings are intentionally NOT part of this gate, even source-level
  // criticals. UBS is high-false-positive ("cries wolf often"), so auto-blocking
  // the seal on it would gate real pushes on tool noise. Instead finish-lane
  // surfaces classified, capped actionable source findings for the agent to
  // triage; only validation commands that actually ran red refuse the seal.
  let sealRefused = false
  if (options.seal) {
    const failed = validationResults.filter((r) => r.status === "fail")
    if (!gitRefExists("HEAD")) {
      // An unborn HEAD has no commit to stamp: writeSeal would record an empty
      // `head`, and the hook requires a non-empty stored head, so the sentinel
      // would be dead on arrival. There is also nothing to push yet.
      out.push("SEAL REFUSED: HEAD has no commits — there is no branch to push or PR yet; commit first, then re-run --seal.")
      sealRefused = true
    } else if (failed.length > 0) {
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
  if ([...fixResults, ...validationResults].some((result) => result.status === "fail")) process.exit(1)
}

if (import.meta.main) main()
