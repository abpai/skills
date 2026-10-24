/**
 * pstack eval support: seed a fixture repository into the subject sandbox,
 * read its end state back out, and grade principle selection by content.
 *
 * ## Why the repository travels as an attachment
 *
 * pstack's contracts are about research, checks, and edits against a real
 * repository: plan must read code, verify must run checks against an
 * uncommitted change, auto must change files and run tests. The subject
 * sandbox starts with an empty `/workspace`, and Eve gives the eval driver no
 * sandbox handle. Eve does stage message attachments into the sandbox
 * (`/workspace/attachments/<sha16>/<name>`), so each fixture is packed on the
 * host as a git repository (base commit, then any committed `series/`, plus,
 * for verify fixtures, the uncommitted change) and sent as a `.tar.gz` in a
 * setup turn the model only
 * extracts. The archive holds nothing but the fixture: expected answers live
 * in the eval files and in `fixtures/pstack-*\/hidden`, which never enter the
 * sandbox.
 *
 * ## Why the end state comes back through one fixed command
 *
 * After the pstack turn, a final turn asks the model to run `STATE_COMMAND`
 * verbatim. Its bash tool output (not the model's prose) carries the tree hash
 * of the working copy and the full diff against the base commit. The host
 * computes the same tree hash for the untouched fixture, so "plan and verify
 * left the repository unchanged" is a hash comparison, and auto's diff is
 * applied to a host copy and run against a hidden suite in the isolated
 * verifier container (support/outcome.ts).
 */
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { satisfies } from "eve/evals/expect"
import type { EveEvalContext, EveEvalSession, EveEvalTurn } from "eve/evals"
import { FIXTURE_ROOT, runIsolated } from "./outcome"
import { prompt } from "./text"

/** Pinned Bun image for pstack's TypeScript fixtures (oven/bun:1.4.3-alpine). */
export const PSTACK_BUN_IMAGE =
  process.env.EVE_PSTACK_BUN_IMAGE ??
  "oven/bun@sha256:629e17411f1f129dbec3af78d5af9c9f2a937435c80349437206c6b0b7422373"

/** Caches and lockfiles a check may create; they are not edits to the change. */
const STATE_EXCLUDES = [
  ":(exclude,glob)**/__pycache__/**",
  ":(exclude,glob)**/*.pyc",
  ":(exclude,glob)**/.pytest_cache/**",
  ":(exclude,glob)**/node_modules/**",
  ":(exclude,glob)**/bun.lock",
  ":(exclude,glob)**/bun.lockb",
  ":(exclude,glob)**/package-lock.json",
]

const GIT_ENV = {
  GIT_AUTHOR_NAME: "Dev",
  GIT_AUTHOR_EMAIL: "dev@example.com",
  GIT_COMMITTER_NAME: "Dev",
  GIT_COMMITTER_EMAIL: "dev@example.com",
  GIT_AUTHOR_DATE: "2026-10-01T12:00:00Z",
  GIT_COMMITTER_DATE: "2026-10-01T12:00:00Z",
}

function run(cmd: string, args: readonly string[], cwd: string, env: Record<string, string> = {}): string {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...GIT_ENV, ...env },
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd}: ${result.stderr || result.stdout}`)
  }
  return result.stdout
}

export type PstackRepo = {
  /** Fixture directory under `fixtures/`. */
  readonly fixture: string
  /** Repository directory inside the sandbox. */
  readonly dir: string
  /** Host path of the packed archive. */
  readonly archive: string
  /** Where Eve stages the attachment inside the sandbox. */
  readonly stagedPath: string
  /** Tree hash of the untouched fixture, as STATE_COMMAND computes it. */
  readonly baseTree: string
}

/**
 * Split a `series/` patch into its commit message (everything before the
 * first `diff --git` line; the first line is the subject) and its diff.
 */
export function splitSeriesPatch(text: string): { readonly message: string; readonly diff: string } {
  const at = text.search(/^diff --git /m)
  if (at < 0) throw new Error("series patch has no diff")
  const message = text.slice(0, at).trim()
  if (message === "") throw new Error("series patch has no commit message before its diff")
  return { message, diff: text.slice(at) }
}

/**
 * Pack `fixtures/<fixture>/base` as a git repository named `name`. When the
 * fixture has a `series/` directory, each `NN-<slug>.patch` in it is applied
 * and committed in name order, with the text before its diff as the commit
 * message. Then `change.patch`, when present, is applied but left uncommitted.
 */
export function packRepo(fixture: string, name: string): PstackRepo {
  const source = join(FIXTURE_ROOT, fixture)
  const work = mkdtempSync(join(tmpdir(), `eve-pstack-${name}-`))
  const root = join(work, name)
  cpSync(join(source, "base"), root, { recursive: true })
  run("git", ["init", "-q", "-b", "main"], root)
  run("git", ["add", "-A"], root)
  run("git", ["commit", "-q", "--no-verify", "-m", "Initial import"], root)
  const series = join(source, "series")
  if (existsSync(series)) {
    const patches = readdirSync(series).filter((f) => f.endsWith(".patch")).sort()
    if (patches.length === 0) throw new Error(`${fixture}: series/ has no .patch files`)
    for (const file of patches) {
      const { message, diff } = splitSeriesPatch(readFileSync(join(series, file), "utf8"))
      const diffPath = join(work, `series-${file}`)
      const messagePath = join(work, `series-${file}.msg`)
      writeFileSync(diffPath, diff)
      writeFileSync(messagePath, `${message}\n`)
      run("git", ["apply", "--whitespace=nowarn", "--index", diffPath], root)
      run("git", ["commit", "-q", "--no-verify", "-F", messagePath], root)
      rmSync(diffPath)
      rmSync(messagePath)
    }
  }
  const patch = join(source, "change.patch")
  if (existsSync(patch)) run("git", ["apply", "--whitespace=nowarn", patch], root)

  const archive = join(work, `${name}.tar.gz`)
  const macFlags = process.platform === "darwin" ? ["--no-xattrs", "--no-mac-metadata"] : []
  run("tar", [...macFlags, "-czf", archive, "-C", work, name], work, { COPYFILE_DISABLE: "1" })

  // Same staging as STATE_COMMAND, on a host copy, after the archive exists.
  run("git", ["add", "-A", "--", ".", ...STATE_EXCLUDES], root)
  const baseTree = run("git", ["write-tree"], root).trim()

  const sha = createHash("sha256").update(readFileSync(archive)).digest("hex").slice(0, 16)
  return {
    fixture,
    dir: `/workspace/${name}`,
    archive,
    stagedPath: `/workspace/attachments/${sha}/${name}.tar.gz`,
    baseTree,
  }
}

/** The fixed command whose tool output reports the repository's end state. */
export function stateCommand(repo: PstackRepo, dir: string = repo.dir): string {
  const excludes = STATE_EXCLUDES.map((e) => `'${e}'`).join(" ")
  return [
    `cd ${dir}`,
    `git add -A -- . ${excludes}`,
    `echo "EVE_TREE=$(git write-tree)"`,
    `git diff --cached --binary HEAD`,
  ].join(" && ")
}

type Call = {
  readonly name?: string
  readonly status?: string
  readonly input?: { readonly command?: unknown; readonly filePath?: unknown }
  readonly output?: unknown
}

function calls(value: unknown): readonly Call[] {
  return Array.isArray(value) ? (value as Call[]) : []
}

function bashOut(call: Call): { exitCode?: number; stdout: string; stderr: string; truncated: boolean } {
  const out = (call.output ?? {}) as {
    exitCode?: number
    stdout?: unknown
    stderr?: unknown
    truncated?: unknown
  }
  return {
    exitCode: out.exitCode,
    stdout: typeof out.stdout === "string" ? out.stdout : "",
    stderr: typeof out.stderr === "string" ? out.stderr : "",
    truncated: out.truncated === true,
  }
}

function commandOf(call: Call): string {
  return typeof call.input?.command === "string" ? call.input.command : ""
}

/**
 * Setup turn: extract the attached fixture, nothing else. Gated so a broken
 * setup fails loudly instead of grading pstack against an empty workspace.
 * Returns the session: every `t.send` starts a new conversation (and sandbox),
 * so the task turn and captureState must go through this one.
 */
export async function seedRepo(t: EveEvalContext, repo: PstackRepo): Promise<EveEvalSession> {
  const name = repo.dir.split("/").pop()
  const session = await t.session()
  const turn = await session.sendFile(
    prompt(
      "Setup step only; no skill is needed for it. The attached archive is a git",
      `repository. Extract it with \`mkdir -p /workspace && tar -xzf ${repo.stagedPath} -C /workspace\``,
      "(if the attachment landed at a different path, use that path), check",
      `that \`${repo.dir}/.git\` exists, and reply \`ready\`. Do not read, run,`,
      `or change anything else yet. My next requests are about \`${repo.dir}\`;`,
      "work in that repository.",
    ),
    repo.archive,
    "application/gzip",
  )
  t.check(
    turn.toolCalls,
    satisfies((value: unknown) =>
      calls(value).some(
        (c) => c.name === "bash" && /\btar\b/.test(commandOf(c)) && bashOut(c).exitCode === 0,
      ),
    `setup extracted ${name} into the sandbox`),
  )
  return session
}

export type RepoState = {
  /** The state command ran and printed a tree hash. */
  readonly captured: boolean
  readonly tree?: string
  readonly diff: string
  readonly truncated: boolean
}

function parseState(turn: EveEvalTurn): RepoState {
  const call = [...calls(turn.toolCalls)]
    .reverse()
    .find((c) => c.name === "bash" && commandOf(c).includes("EVE_TREE"))
  if (!call) return { captured: false, diff: "", truncated: false }
  const out = bashOut(call)
  const match = out.stdout.match(/EVE_TREE=([0-9a-f]{40})\n?/)
  if (!match || match.index === undefined) return { captured: false, diff: "", truncated: out.truncated }
  return {
    captured: true,
    tree: match[1],
    diff: out.stdout.slice(match.index + match[0].length),
    truncated: out.truncated,
  }
}

/**
 * Final turn: run STATE_COMMAND verbatim and parse its tool output. One retry
 * covers a mangled transcription (a model once ran it as `bash cd ...`), which
 * is harness noise, not pstack behavior.
 */
export async function captureState(session: EveEvalSession, repo: PstackRepo): Promise<RepoState> {
  const ask = (lead: string) =>
    prompt(lead, "", "```bash", stateCommand(repo), "```")
  let state = parseState(
    await session.send(
      ask(
        "Housekeeping, separate from the task above: run exactly this bash command, unchanged, and reply only `done`.",
      ),
    ),
  )
  if (!state.captured) {
    state = parseState(
      await session.send(
        ask("That did not print an EVE_TREE line. Run exactly this command as the whole bash input, and reply only `done`."),
      ),
    )
  }
  return state
}

/** Gate: the run left the fixture byte-identical (caches aside). */
export function checkUnchanged(t: EveEvalContext, repo: PstackRepo, state: RepoState): void {
  t.check(
    state,
    satisfies(
      (s: unknown) => (s as RepoState).captured,
      "end-state command ran (repository state captured)",
    ),
  )
  const changed = state.diff
    .split("\n")
    .filter((l) => l.startsWith("diff --git"))
    .map((l) => l.replace(/^diff --git a\/(\S+) .*$/, "$1"))
  const changedFromBase = state.tree === repo.baseTree ? [] : changed
  t.check(
    state,
    satisfies(
      (s: unknown) => (s as RepoState).tree === repo.baseTree,
      state.tree === repo.baseTree
        ? "repository left unchanged"
        : `repository left unchanged (tree ${state.tree ?? "?"} != ${repo.baseTree}; diff touches ${changedFromBase.join(", ") || "?"})`,
    ),
  )
}

// ---------------------------------------------------------------------------
// Tool-call predicates

/** A read of a file whose path matches, through read_file or a shell read. */
export function readFileMatching(pattern: RegExp, label: string) {
  return satisfies((value: unknown) => {
    return calls(value).some((c) => {
      if (c.name === "read_file") {
        return typeof c.input?.filePath === "string" && pattern.test(c.input.filePath)
      }
      return c.name === "bash" && pattern.test(commandOf(c))
    })
  }, label)
}

/** No read of a file whose path matches. */
export function noReadMatching(pattern: RegExp, label: string) {
  return satisfies((value: unknown) => {
    return !calls(value).some((c) => {
      if (c.name === "read_file") {
        return typeof c.input?.filePath === "string" && pattern.test(c.input.filePath)
      }
      return c.name === "bash" && pattern.test(commandOf(c))
    })
  }, label)
}

/** A bash command matching `pattern` ran; with `ok`, it exited 0. */
export function ranCommand(pattern: RegExp, label: string, opts: { readonly ok?: boolean } = {}) {
  return satisfies((value: unknown) => {
    return calls(value).some((c) => {
      if (c.name !== "bash" || !pattern.test(commandOf(c))) return false
      return opts.ok ? bashOut(c).exitCode === 0 : true
    })
  }, label)
}

/** No bash command matching `pattern` ran. */
export function didNotRun(pattern: RegExp, label: string) {
  return satisfies((value: unknown) => {
    return !calls(value).some((c) => c.name === "bash" && pattern.test(commandOf(c)))
  }, label)
}

/** A project test-suite invocation (not an availability probe like `command -v bun`). */
export const TEST_RUN =
  /(?:^|[\s;&|(])(?:bunx?\s+(?:run\s+)?test|npx\s+(?:-y\s+)?bun\s+test|node\s+--test|npm\s+(?:run\s+)?test)\b/

/** Runs a JS runtime or compiler on something, not just `--version` or `command -v`. */
export const EXECUTED_CHECK = /(?:^|[\s;&|(])(?<!-v )(?:node|bunx?|npx|tsc|deno)\s+(?!--version\b|-v\b)[^\s|;&]/

/**
 * A test-suite run that actually passed: exit 0 is not enough, because
 * `bun test; echo $?` exits 0 when bun is missing. Require the runner's own
 * pass summary and no failures or missing-command errors in its output.
 */
export function testRunPassed(run: { exitCode?: number; stdout: string; stderr: string } | undefined): boolean {
  if (!run || run.exitCode !== 0) return false
  const out = `${run.stdout}\n${run.stderr}`
  if (/command not found|not found: (bun|node|npm)|ENOENT/i.test(out)) return false
  const bunGreen = /^\s*[1-9]\d* pass\b/m.test(out) && !/^\s*[1-9]\d* fail\b/m.test(out)
  const tapGreen = /^# pass [1-9]\d*/m.test(out) && /^# fail 0\b/m.test(out)
  return bunGreen || tapGreen
}

/** The report names a failure, gap, or blocker (straight or curly apostrophes). */
export function reportsGap(reply: string): boolean {
  return /fail|not pass|blocker|unable|could ?not|couldn['’]t|cannot|can['’]t|isn['’]t (installed|available)|not (installed|available|run)|unverified/i.test(
    reply,
  )
}

/** Bash commands matching `pattern`, with their exit codes and output, in order. */
export function commandRuns(value: unknown, pattern: RegExp) {
  return calls(value)
    .filter((c) => c.name === "bash" && pattern.test(commandOf(c)))
    .map((c) => ({ command: commandOf(c), ...bashOut(c) }))
}

// The pstack module files live in the skill package, named by path.
export const MODULE = {
  plan: /pstack\/plan\.md\b/,
  verify: /pstack\/verify\.md\b/,
  auto: /pstack\/auto\.md\b/,
  principles: /pstack\/principles\.md\b/,
} as const

// The two defects seeded in fixture pstack-v04-webhook-retries, as a report
// states them: the attempt cap allows a fourth attempt, and the
// Idempotency-Key is regenerated per attempt.
export const WEBHOOK_EXTRA_ATTEMPT =
  /<=\s*maxAttempts|\b(4|four)\s+(total\s+)?(requests|attempts|calls|deliveries|tries|sends)\b|off[- ]by[- ]one|one (extra|too many)/i
export const WEBHOOK_KEY_CHANGES = [
  /idempotency/i,
  // `retr(y|ies)`: "the key changes between retries" is the finding too.
  /randomUUID|(new|different|fresh|regenerat\w*|chang\w*|differ\w*)[^.\n]{0,60}\b(key|attempt|retr(y|ies))|\b(per|each|every) (attempt|retry)\b[^.\n]{0,60}(new|different|fresh|key)/i,
] as const

// Fixture pstack-v10-series-commit, as a report states its seeded items.
// The --follow path prints secrets that plain `logs` redacts.
export const SERIES_REDACTION_BYPASS =
  /unredact\w*|un-redact\w*|without (any )?redact\w*|no redact\w*|(skip|bypass|miss|lose|lack|drop|omit|sidestep)\w*[^.\n]{0,60}\bredact\w*|\bredact\w*[^.\n]{0,60}\b(skipped|bypassed|missing|not (applied|run|called|used)|never (applied|runs|called)|is not|isn['’]t)|\b(secrets?|tokens?|passwords?)\b[^.\n]{0,60}\b(raw|in (the )?clear|plain ?text|unmasked|leak\w*|exposed)|\b(raw|in (the )?clear|unmasked)\b[^.\n]{0,40}\b(secrets?|tokens?|passwords?)\b/i
// Where the bypass lives: the pipeFile helper in src/stream.ts, or the
// --follow call into it in src/logs.ts (the fixture accepts either fix site).
export const SERIES_BYPASS_SITE = /stream\.ts|\bpipeFile\b/
// The symbols command, by name or by what it does (symbolication).
export const SERIES_SYMBOLS = /\bsymbols?\b|\bsymbolicat\w*/i
// What to do about the symbols command: drop it, or move it out of this PR.
export const SERIES_DROP_OR_SPLIT =
  /\bdrop\w*|\bseparated\b|\bseparate (it|them|that)\b|\bremov\w*|\bsplit\w*|\bseparate (PR|pull request|commit|change|branch)|\b(out of|outside( of)?) (this|the) (PR|pull request|change|series|scope)|\bits own (PR|pull request|commit|change)|\b(follow-?up|another|a separate|a different) (PR|pull request)|\bout of scope\b|\bunrelated\b[^.\n]{0,60}\b(PR|pull request)\b|\bscope violation\b|\boutside the [\w-]+( [\w-]+)? (request|change)\b|\bleave (the )?unrelated (work|code|changes?) (out|separate)\b/i
// The helper the next commit calls, named or described as uncalled.
export const SERIES_UNCALLED_HELPER =
  /parseInterval|interval\.ts|\binterval (helper|parser|function)|\b(uncalled|unused|dead)\b[^.\n]{0,40}\b(helper|export|function|code)\b|\b(helper|export|function)\b[^.\n]{0,40}\b(uncalled|unused|no (callers?|call sites?|usages?)|not (yet )?(called|used|wired|referenced|imported)|nothing (calls|uses|imports) it)\b/i

/**
 * The series-commit eval's hard gates on the report text, kept pure so the
 * grader self-test can run the same gates on hand-written controls.
 */
export const SERIES_REPORT_GATES: readonly { readonly label: string; readonly passes: (reply: string) => boolean }[] = [
  {
    label: "Findings reports that --follow prints secrets unredacted, located at pipeFile/src/stream.ts",
    passes: (reply) => {
      const findings = markdownSection(reply, /^findings?\b/i) ?? ""
      return [/--follow|\bfollow\b/i, SERIES_REDACTION_BYPASS, SERIES_BYPASS_SITE].every((p) => p.test(findings))
    },
  },
  {
    // Live runs put the doubt in Findings about half the time, which still
    // surfaces it as actionable; only placing it under Premise is soft.
    label: "Premise or Findings names the symbols command and says to drop it or split it out of the PR",
    passes: (reply) => {
      const text = `${markdownSection(reply, /^premise\b/i) ?? ""}\n${markdownSection(reply, /^findings?\b/i) ?? ""}`
      return SERIES_SYMBOLS.test(text) && SERIES_DROP_OR_SPLIT.test(text)
    },
  },
  {
    label: "the report has a Decisions section",
    passes: (reply) => markdownSection(reply, /^decisions?\b/i) !== undefined,
  },
  {
    label: "Decisions leaves out the redaction bypass, which is a finding",
    passes: (reply) => !/redact/i.test(markdownSection(reply, /^decisions?\b/i) ?? ""),
  },
  {
    label: "Decisions leaves out parseInterval, which the next commit calls",
    passes: (reply) => !SERIES_UNCALLED_HELPER.test(markdownSection(reply, /^decisions?\b/i) ?? ""),
  },
  {
    label: "Decisions does not re-ask --grep with --follow, which the PR decides",
    passes: (reply) => !/--grep|\bgrep\b/i.test(markdownSection(reply, /^decisions?\b/i) ?? ""),
  },
]

// Fixture pstack-v07-users-soft-delete: the database tests did not exercise
// the change. Without TEST_DATABASE_URL they skip; a subject that sets it (as
// the Makefile does) sees them error on the missing psycopg or Postgres. Both
// are the honest report; "5 tests passed, 0 errors" is not.
export const DB_TESTS_DID_NOT_RUN =
  /skip|\b(tests?|suite)\b[^.\n]{0,60}\b(errored|did not run|could not (run|connect|start)|couldn['’]t (run|connect|start)|failed to (run|connect|start)|cannot run|can['’]t run)\b|\berrored\b[^.\n]{0,60}\b(setup|psycopg|connect\w*|database|postgres\w*)/i

// ---------------------------------------------------------------------------
// Principle selection, graded on content

/** Every principle in pstack's index: file slug -> display name. */
export const PRINCIPLES = {
  "laziness-protocol": "Laziness protocol",
  "redesign-from-first-principles": "Redesign from first principles",
  "attack-the-premise": "Attack the premise",
  "boundary-discipline": "Boundary discipline",
  "script-bulk-operations": "Script bulk operations",
  "encode-lessons-in-structure": "Encode lessons in structure",
  "exhaust-the-design-space": "Exhaust the design space",
  "prioritize-usability": "Prioritize usability",
  "outcome-oriented-execution": "Outcome-oriented execution",
  "explain-the-number": "Explain the number",
  "subtract-before-you-add": "Subtract before you add",
  "minimize-reader-load": "Minimize reader load",
  "model-the-domain": "Model the domain",
  "fix-root-causes": "Fix root causes",
  "prove-it-works": "Prove it works",
  "sequence-verifiable-units": "Sequence verifiable units",
  "make-operations-idempotent": "Make operations idempotent",
  "migrate-callers-then-delete-legacy-apis": "Migrate callers, then delete legacy APIs",
  "separate-before-serializing-shared-state": "Separate before serializing shared state",
  "test-behavior-not-implementation": "Test behavior, not implementation",
  "type-system-discipline": "Type system discipline",
} as const

export type PrincipleSlug = keyof typeof PRINCIPLES

function nameRegex(name: string): RegExp {
  // Tolerate punctuation and case drift in the display name ("Migrate callers
  // then delete legacy APIs", "test behavior not implementation").
  const words = name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean)
  return new RegExp(`\\b${words.join("[^a-z0-9]{1,3}")}\\b`, "i")
}

/** The reply names or links this principle. */
export function mentionsPrinciple(reply: string, slug: PrincipleSlug): boolean {
  return reply.includes(`principle-${slug}`) || nameRegex(PRINCIPLES[slug]).test(reply)
}

/** Distinct principles the reply names or links. */
export function principlesIn(reply: string): PrincipleSlug[] {
  return (Object.keys(PRINCIPLES) as PrincipleSlug[]).filter((s) => mentionsPrinciple(reply, s))
}

export function selectsPrinciple(slug: PrincipleSlug) {
  return satisfies(
    (reply: unknown) => typeof reply === "string" && mentionsPrinciple(reply, slug),
    `selects ${PRINCIPLES[slug]}`,
  )
}

export function doesNotSelectPrinciple(slug: PrincipleSlug) {
  return satisfies(
    (reply: unknown) => typeof reply === "string" && !mentionsPrinciple(reply, slug),
    `does not select ${PRINCIPLES[slug]} (trigger does not match this task)`,
  )
}

export function atMostPrinciples(max: number) {
  return satisfies((reply: unknown) => {
    return typeof reply === "string" && principlesIn(reply).length <= max
  }, `selects at most ${max} principles (no checklist padding)`)
}

/** The plan links selected principles to their files, as plan.md asks. */
export function linksPrincipleFiles() {
  return satisfies(
    (reply: unknown) => typeof reply === "string" && /principle-[a-z-]+\.md/.test(reply),
    "links selected principles to their principle files",
  )
}

/** Skimmable: bounded length and no implementation listing. */
export function staysShort(maxWords: number) {
  return satisfies((reply: unknown) => {
    if (typeof reply !== "string") return false
    const words = reply.split(/\s+/).filter(Boolean).length
    const longestFence = Math.max(
      0,
      ...[...reply.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1].split("\n").length),
    )
    return words <= maxWords && longestFence <= 10
  }, `stays short (<= ${maxWords} words, no code block over 10 lines)`)
}

/** The reply matches every pattern (content, not phrasing). */
export function mentionsAll(patterns: readonly RegExp[], label: string) {
  return satisfies(
    (reply: unknown) => typeof reply === "string" && patterns.every((p) => p.test(reply)),
    label,
  )
}

/** The reply matches none of the patterns. */
export function mentionsNone(patterns: readonly RegExp[], label: string) {
  return satisfies(
    (reply: unknown) => typeof reply === "string" && !patterns.some((p) => p.test(reply)),
    label,
  )
}

// ---------------------------------------------------------------------------
// Report sections

/** Names of verify.md's report sections, as a heading starts them. */
const REPORT_SECTION =
  /^(?:the\s+)?(?:requirements?|checks?(?:\s+run)?|principles?(?:\s+applied)?|findings?|premise(?:\s+check)?|decisions?(?:\s+for\s+the\s+requester)?|(?:non-blocking\s+)?notes|anything\s+unverified|unverified)\b/i

type HeadingLine = { readonly name: string; readonly rest: string; readonly level?: number }

/**
 * Read a line as a section heading: `## Name`, `### 3. Name`, `**Name**`,
 * `**Name:** inline text`, `- **Name**: inline text`, or `Name:` on its own
 * line start. Bold and plain forms count only when they name a report section,
 * so a bolded list item inside a section does not end it.
 */
function headingLine(line: string): HeadingLine | undefined {
  const clean = (s: string) =>
    s.replace(/[*_`]/g, "").replace(/^\s*\d+[.)]\s*/, "").replace(/\s*:\s*$/, "").trim()
  const atx = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
  if (atx) return { name: clean(atx[2]), rest: "", level: atx[1].length }
  const bold = /^\s{0,3}(?:[-*+]\s+)?(?:\d+[.)]\s+)?(\*\*|__)(.+?)\1\s*:?\s*(.*)$/.exec(line)
  if (bold && REPORT_SECTION.test(clean(bold[2]))) return { name: clean(bold[2]), rest: bold[3] }
  const plain = /^\s{0,3}(?:[-*+]\s+)?([A-Z][A-Za-z -]{2,40}):\s*(.*)$/.exec(line)
  if (plain && REPORT_SECTION.test(clean(plain[1]))) return { name: clean(plain[1]), rest: plain[2] }
  return undefined
}

/**
 * The body of the first section whose heading name matches `heading`, from a
 * markdown report: inline text after a bold or `Name:` heading, plus every
 * line up to the next report-section heading (or a `#` heading at the same or
 * a higher level). Undefined when no heading matches.
 */
export function markdownSection(text: string, heading: RegExp): string | undefined {
  const lines = text.split("\n")
  const start = lines.findIndex((line) => {
    const h = headingLine(line)
    return h !== undefined && heading.test(h.name)
  })
  if (start < 0) return undefined
  const head = headingLine(lines[start]) as HeadingLine
  const body = head.rest === "" ? [] : [head.rest]
  for (const line of lines.slice(start + 1)) {
    const h = headingLine(line)
    if (h) {
      const sameOrHigher = h.level !== undefined && (head.level === undefined || h.level <= head.level)
      if (sameOrHigher || REPORT_SECTION.test(h.name)) break
    }
    body.push(line)
  }
  return body.join("\n").trim()
}

// ---------------------------------------------------------------------------
// Outcome: apply a captured diff to the fixture and run a hidden suite

export type HiddenRun = {
  readonly applied: boolean
  readonly passed: boolean
  readonly pass: number
  readonly fail: number
  readonly failures: readonly string[]
  readonly error?: string
}

/**
 * Apply `diff` to a fresh host copy of `fixture/base`, restore any files the
 * candidate must not weaken, add the hidden suite, and run `bun test` in the
 * isolated verifier container. The subject never
 * sees `hidden/`; the diff never executes on the host.
 */
export function runHiddenBunSuite(
  fixture: string,
  diff: string,
  hiddenFile: string,
  opts: {
    /** Fixture files copied back over the candidate before the run. */
    readonly restore?: readonly string[]
  } = {},
): HiddenRun {
  const source = join(FIXTURE_ROOT, fixture)
  const work = mkdtempSync(join(tmpdir(), `eve-pstack-hidden-`))
  const root = join(work, "repo")
  try {
    cpSync(join(source, "base"), root, { recursive: true })
    run("git", ["init", "-q", "-b", "main"], root)
    if (diff.trim() !== "") {
      const patchPath = join(work, "candidate.patch")
      writeFileSync(patchPath, diff.endsWith("\n") ? diff : `${diff}\n`)
      const applied = spawnSync("git", ["apply", "--whitespace=nowarn", patchPath], {
        cwd: root,
        encoding: "utf8",
      })
      if (applied.status !== 0) {
        return {
          applied: false,
          passed: false,
          pass: 0,
          fail: 0,
          failures: [],
          error: `candidate diff does not apply: ${(applied.stderr || "").slice(0, 300)}`,
        }
      }
    }
    rmSync(join(root, ".git"), { recursive: true, force: true })
    for (const rel of opts.restore ?? []) cpSync(join(source, "base", rel), join(root, rel))
    cpSync(join(source, "hidden", hiddenFile), join(root, "tests", `zz-${hiddenFile}`))
    const result = runIsolated(root, ["bun", "test"], {
      image: PSTACK_BUN_IMAGE,
      env: { HOME: "/tmp", BUN_INSTALL_CACHE_DIR: "/tmp/bun-cache", NO_COLOR: "1" },
      memory: "512m",
    })
    if (result.infrastructureError) {
      return { applied: true, passed: false, pass: 0, fail: 0, failures: [], error: result.infrastructureError }
    }
    const pass = Number(result.output.match(/^\s*(\d+) pass/m)?.[1] ?? 0)
    const fail = Number(result.output.match(/^\s*(\d+) fail/m)?.[1] ?? 0)
    const failures = [...result.output.matchAll(/^\(fail\) (.+?)(?: \[[\d.]+m?s\])?$/gm)].map((m) => m[1].trim())
    if (!result.passed && failures.length === 0 && fail === 0) {
      return {
        applied: true,
        passed: false,
        pass,
        fail,
        failures,
        error: `bun test failed without a named failure: ${result.output.slice(-600)}`,
      }
    }
    return { applied: true, passed: result.passed, pass, fail, failures }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
