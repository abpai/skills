import { afterEach, expect, test } from "bun:test"
import { suggestLenses } from "./finish-lane.ts"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

const finishLaneScript = path.join(import.meta.dir, "finish-lane.ts")
const tempDirs: string[] = []
const systemPath = "/usr/bin:/bin:/usr/sbin:/sbin"

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function run(command: string, args: string[], cwd: string, env: Record<string, string> = {}): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) {
    throw new Error(`command failed: ${command} ${args.join(" ")}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`)
  }
  return `${result.stdout ?? ""}${result.stderr ?? ""}`
}

function writeRepoFile(repo: string, file: string, text: string): void {
  const absolute = path.join(repo, file)
  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, text, "utf8")
}

function makeRepo(): string {
  const repo = mkdtempSync(path.join(tmpdir(), "finish-lane-"))
  tempDirs.push(repo)
  run("git", ["init", "-q"], repo, { PATH: systemPath })
  run("git", ["config", "user.email", "finish-lane@example.test"], repo, { PATH: systemPath })
  run("git", ["config", "user.name", "Finish Lane"], repo, { PATH: systemPath })
  writeRepoFile(repo, "README.md", "# Test repo\n")
  run("git", ["add", "README.md"], repo, { PATH: systemPath })
  run("git", ["commit", "-qm", "initial"], repo, { PATH: systemPath })
  return repo
}

function makeFakeUbs(repo: string, script: string): string {
  const binDir = path.join(repo, "fake-bin")
  mkdirSync(binDir, { recursive: true })
  const ubs = path.join(binDir, "ubs")
  writeFileSync(ubs, `#!/usr/bin/env bash\nset -euo pipefail\n${script}\n`, "utf8")
  chmodSync(ubs, 0o755)
  return binDir
}

function runFinishLane(repo: string, env: Record<string, string>): { stdout: string; status: number | null } {
  const result = spawnSync(process.execPath, [finishLaneScript, "--base", "HEAD"], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, ...env },
  })
  return { stdout: result.stdout ?? "", status: result.status }
}

test("reports skipped when ubs is absent without noisy line counts", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export const value = 1\n")

  const result = runFinishLane(repo, { PATH: systemPath })

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("status: skipped")
  expect(result.stdout).toContain("note: ubs not installed")
  expect(result.stdout).not.toContain("output line")
  expect(existsSync(path.join(repo, ".workflow/finish-lane/ubs-summary.md"))).toBe(true)
})

test("summarizes actionable source findings and keeps raw ubs noise out of stdout", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export function demo(input?: { name?: string }) {\n  return input.name\n}\n")
  writeRepoFile(repo, "tests/app.test.ts", "import '../src/app'\n")
  const fakeBin = makeFakeUbs(
    repo,
    `
findings=""
report=""
for arg in "$@"; do
  case "$arg" in
    --beads-jsonl=*) findings="\${arg#*=}" ;;
    --report-json=*) report="\${arg#*=}" ;;
  esac
done
cat > "$findings" <<'JSONL'
{"type":"totals","critical":2,"warning":2,"info":57,"good":513}
{"file":"src/app.ts","line":2,"severity":"critical","category":"1","message":"possible null access"}
{"file":"src/app.ts","line":9,"severity":"warning","category":"8","message":"swallowed error"}
{"file":"src/app.ts","line":12,"severity":"warning","category":"12","message":"TODO cleanup"}
{"file":"tests/app.test.ts","line":4,"severity":"critical","category":"1","message":"test-only finding"}
JSONL
cat > "$report" <<'JSON'
{"findings":[]}
JSON
for i in $(seq 1 100); do echo "raw-noise-$i"; done
exit 1
`,
  )

  const result = runFinishLane(repo, { PATH: `${fakeBin}:${systemPath}` })
  const summary = readFileSync(path.join(repo, ".workflow/finish-lane/ubs-summary.md"), "utf8")

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("status: advisory-findings")
  expect(result.stdout).toContain("severity totals: critical=2 warning=2 info=57 good=513")
  expect(result.stdout).toContain("actionable source findings: critical=1 warning=1")
  expect(result.stdout).not.toContain("raw-noise")
  expect(result.stdout).not.toContain("output line")
  expect(summary).toContain("- critical src/app.ts:2 [1] possible null access")
  expect(summary).toContain("- warning src/app.ts:9 [8] swallowed error")
  expect(summary).not.toContain("TODO cleanup")
  expect(summary).not.toContain("tests/app.test.ts")
})

test("handles real ubs jsonl finding counts and report sample paths", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export async function demo(url: string) {\n  fetch(url)\n  return open(url)\n}\n")
  const fakeBin = makeFakeUbs(
    repo,
    `
findings=""
report=""
for arg in "$@"; do
  case "$arg" in
    --beads-jsonl=*) findings="\${arg#*=}" ;;
    --report-json=*) report="\${arg#*=}" ;;
  esac
done
cat > "$findings" <<'JSONL'
{"type":"finding","project":"/tmp/project","language":"js","severity":"warning","count":1,"title":"fetch() without AbortSignal cancellation","description":"Pass a signal from AbortSignal.timeout()"}
{"type":"finding","project":"/tmp/project","language":"js","severity":"info","count":1,"title":"Deep property access detected","description":""}
{"type":"scanner","project":"/tmp/project","language":"js","files":1,"critical":0,"warning":2,"info":1,"timestamp":"2026-06-07T00:00:00Z"}
{"type":"totals","project":"/tmp/project","files":1,"critical":0,"warning":2,"info":1,"timestamp":"2026-06-07T00:00:00Z"}
JSONL
cat > "$report" <<'JSON'
{
  "project": "/tmp/project",
  "scanners": [
    {
      "language": "js",
      "files": 1,
      "critical": 0,
      "warning": 2,
      "info": 1,
      "extras": {
        "resource_lifecycle": {
          "severity": "warning",
          "samples": [
            {
              "file": "/private/var/folders/example/files_scan/src/app.ts",
              "line": 3,
              "code": "return open(url)"
            }
          ]
        }
      }
    }
  ],
  "totals": { "critical": 0, "warning": 2, "info": 1, "files": 1 }
}
JSON
exit 0
`,
  )

  const result = runFinishLane(repo, { PATH: `${fakeBin}:${systemPath}` })
  const summary = readFileSync(path.join(repo, ".workflow/finish-lane/ubs-summary.md"), "utf8")

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("status: advisory-findings")
  expect(result.stdout).toContain("severity totals: critical=0 warning=2 info=1 good=0")
  expect(result.stdout).toContain("actionable source findings: critical=0 warning=2")
  expect(summary).toContain("warning source scan [js] fetch() without AbortSignal cancellation: Pass a signal from AbortSignal.timeout()")
  expect(summary).toContain("warning src/app.ts:3 [resource_lifecycle] return open(url)")
})

test("passes ubs file paths without a literal end-of-options marker", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "--help.ts", "export const value = 1\n")
  const fakeBin = makeFakeUbs(
    repo,
    `
findings=""
report=""
seen_dash_path=0
for arg in "$@"; do
  case "$arg" in
    --beads-jsonl=*) findings="\${arg#*=}" ;;
    --report-json=*) report="\${arg#*=}" ;;
    --) echo "unexpected literal -- arg" >&2; exit 2 ;;
    --help.ts) echo "dash-leading path was not protected" >&2; exit 2 ;;
    ./--help.ts) seen_dash_path=1 ;;
  esac
done
[ "$seen_dash_path" -eq 1 ] || { echo "missing protected dash-leading path" >&2; exit 2; }
cat > "$findings" <<'JSONL'
{"type":"totals","critical":0,"warning":0,"info":0,"good":0}
JSONL
cat > "$report" <<'JSON'
{"totals":{"critical":0,"warning":0,"info":0,"good":0}}
JSON
exit 0
`,
  )

  const result = runFinishLane(repo, { PATH: `${fakeBin}:${systemPath}` })

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("status: clean")
  expect(result.stdout).not.toContain("status: tool-failure")
})

test("treats test-only findings as clean in the primary status", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export const value = 1\n")
  const fakeBin = makeFakeUbs(
    repo,
    `
findings=""
for arg in "$@"; do
  case "$arg" in --beads-jsonl=*) findings="\${arg#*=}" ;; esac
done
cat > "$findings" <<'JSONL'
{"type":"totals","critical":1,"warning":0,"info":0,"good":0}
{"file":"tests/app.test.ts","line":4,"severity":"critical","category":"1","message":"test-only finding"}
JSONL
exit 1
`,
  )

  const result = runFinishLane(repo, { PATH: `${fakeBin}:${systemPath}` })

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("status: clean")
  expect(result.stdout).toContain("actionable source findings: critical=0 warning=0")
})

test("records tool failures in a capped raw fallback artifact", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export const value = 1\n")
  const fakeBin = makeFakeUbs(
    repo,
    `
echo "engine missing" >&2
exit 2
`,
  )

  const result = runFinishLane(repo, { PATH: `${fakeBin}:${systemPath}` })
  const rawLog = readFileSync(path.join(repo, ".workflow/finish-lane/ubs-raw.log"), "utf8")

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("status: tool-failure")
  expect(result.stdout).not.toContain("engine missing")
  expect(rawLog).toContain("engine missing")
})

test("treats exit 2 as tool failure even when ubs writes structured artifacts", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export const value = maybe.missing\n")
  const fakeBin = makeFakeUbs(
    repo,
    `
findings=""
report=""
for arg in "$@"; do
  case "$arg" in
    --beads-jsonl=*) findings="\${arg#*=}" ;;
    --report-json=*) report="\${arg#*=}" ;;
  esac
done
cat > "$findings" <<'JSONL'
{"type":"totals","critical":1,"warning":0,"info":0,"good":0}
{"file":"src/app.ts","line":1,"severity":"critical","category":"1","message":"possible null access"}
JSONL
cat > "$report" <<'JSON'
{"totals":{"critical":1,"warning":0,"info":0,"good":0}}
JSON
echo "doctor needed" >&2
exit 2
`,
  )

  const result = runFinishLane(repo, { PATH: `${fakeBin}:${systemPath}` })
  const summary = readFileSync(path.join(repo, ".workflow/finish-lane/ubs-summary.md"), "utf8")
  const rawLog = readFileSync(path.join(repo, ".workflow/finish-lane/ubs-raw.log"), "utf8")

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("status: tool-failure")
  expect(result.stdout).toContain("exit_code: 2")
  expect(result.stdout).not.toContain("status: advisory-findings")
  expect(summary).toContain("run ubs doctor --fix")
  expect(rawLog).toContain("doctor needed")
})

test("treats a maxBuffer/stdout-flood failure as tool-failure, not a parsed clean run", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export const value = maybe.missing\n")
  // ubs writes a fully-parseable critical finding to the findings artifact, then
  // floods stdout past the (lowered) maxBuffer so spawnSync kills it with
  // ENOBUFS. Without the non-timeout error guard, the surviving artifact would
  // be parsed and reported as advisory-findings instead of a tool failure.
  const fakeBin = makeFakeUbs(
    repo,
    `
findings=""
for arg in "$@"; do
  case "$arg" in --beads-jsonl=*) findings="\${arg#*=}" ;; esac
done
cat > "$findings" <<'JSONL'
{"type":"totals","critical":1,"warning":0,"info":0,"good":0}
{"file":"src/app.ts","line":1,"severity":"critical","category":"1","message":"possible null access"}
JSONL
head -c 5000 /dev/zero | tr '\\0' x
echo
`,
  )

  const result = runFinishLane(repo, {
    PATH: `${fakeBin}:${systemPath}`,
    FINISH_LANE_UBS_MAX_BUFFER: "1024",
  })
  const rawLog = readFileSync(path.join(repo, ".workflow/finish-lane/ubs-raw.log"), "utf8")

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("status: tool-failure")
  expect(result.stdout).not.toContain("status: advisory-findings")
  expect(rawLog).toContain("ubs failed to run")
})

test("times out ubs without hanging finish-lane", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export const value = 1\n")
  const fakeBin = makeFakeUbs(repo, "sleep 5")

  const result = runFinishLane(repo, {
    PATH: `${fakeBin}:${systemPath}`,
    FINISH_LANE_UBS_TIMEOUT_MS: "100",
  })

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("status: timeout")
  expect(result.stdout).toContain("ubs timed out after 100ms")
})

// UBS is advisory by design: even a source-level critical is surfaced for the
// agent to triage, never an automatic seal block. Only red validation commands
// gate the seal (see the "gated on green" comment in finish-lane.ts).
test("ubs source-critical findings are advisory and do not block seal creation", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export const value = maybe.missing\n")
  const fakeBin = makeFakeUbs(
    repo,
    `
findings=""
for arg in "$@"; do
  case "$arg" in --beads-jsonl=*) findings="\${arg#*=}" ;; esac
done
cat > "$findings" <<'JSONL'
{"type":"totals","critical":1,"warning":0,"info":0,"good":0}
{"file":"src/app.ts","line":1,"severity":"critical","category":"1","message":"possible null access"}
JSONL
exit 1
`,
  )

  const result = spawnSync(process.execPath, [finishLaneScript, "--base", "HEAD", "--seal"], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, PATH: `${fakeBin}:${systemPath}` },
  })

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("status: advisory-findings")
  expect(result.stdout).toContain("SEALED")
})

// A real critical whose message echoes an identifier containing a noise word
// (fetchTodos -> "todo") must stay actionable; the noise filter is word-bounded.
test("a critical whose message contains a noise substring is not dropped", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export const value = maybe.missing\n")
  const fakeBin = makeFakeUbs(
    repo,
    `
findings=""
for arg in "$@"; do
  case "$arg" in --beads-jsonl=*) findings="\${arg#*=}" ;; esac
done
cat > "$findings" <<'JSONL'
{"type":"totals","critical":1,"warning":0,"info":0,"good":0}
{"file":"src/app.ts","line":1,"severity":"critical","category":"1","message":"possible null access on result of fetchTodos()"}
JSONL
exit 1
`,
  )

  const result = runFinishLane(repo, { PATH: `${fakeBin}:${systemPath}` })

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("status: advisory-findings")
  expect(result.stdout).toContain("actionable source findings: critical=1 warning=0")
})

// A defect emitted both as a JSONL finding and as a report `extras` sample is
// the same finding; it must be listed once, not double-counted.
test("a finding duplicated across jsonl and report samples is listed once", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export async function demo(url: string) {\n  return open(url)\n}\n")
  const fakeBin = makeFakeUbs(
    repo,
    `
findings=""
report=""
for arg in "$@"; do
  case "$arg" in
    --beads-jsonl=*) findings="\${arg#*=}" ;;
    --report-json=*) report="\${arg#*=}" ;;
  esac
done
cat > "$findings" <<'JSONL'
{"type":"totals","critical":0,"warning":1,"info":0,"good":0}
{"type":"finding","file":"src/app.ts","line":2,"severity":"warning","category":"resource_lifecycle","message":"return open(url)"}
JSONL
cat > "$report" <<'JSON'
{"scanners":[{"language":"ts","extras":{"resource_lifecycle":{"severity":"warning","samples":[{"file":"/x/files_scan/src/app.ts","line":2,"code":"return open(url)"}]}}}],"totals":{"critical":0,"warning":1,"info":0}}
JSON
exit 0
`,
  )

  const result = runFinishLane(repo, { PATH: `${fakeBin}:${systemPath}` })

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("actionable source findings: critical=0 warning=1")
})

// An external signal kill leaves result.signal set but result.error undefined;
// it must surface as a tool failure, never a parsed clean/advisory run.
test("a signal-killed ubs is a tool failure, not a parsed clean run", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export const value = maybe.missing\n")
  const fakeBin = makeFakeUbs(
    repo,
    `
findings=""
for arg in "$@"; do
  case "$arg" in --beads-jsonl=*) findings="\${arg#*=}" ;; esac
done
cat > "$findings" <<'JSONL'
{"type":"totals","critical":1,"warning":0,"info":0,"good":0}
{"file":"src/app.ts","line":1,"severity":"critical","category":"1","message":"possible null access"}
JSONL
kill -KILL $$
`,
  )

  const result = runFinishLane(repo, { PATH: `${fakeBin}:${systemPath}` })

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("status: tool-failure")
  expect(result.stdout).not.toContain("status: advisory-findings")
})

// A report that decodes to JSON but carries no finding or totals block (e.g. an
// error envelope) must fall through to tool-failure, not be reported clean.
test("a structured error-only report is a tool failure, not clean", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export const value = 1\n")
  const fakeBin = makeFakeUbs(
    repo,
    `
report=""
for arg in "$@"; do
  case "$arg" in --report-json=*) report="\${arg#*=}" ;; esac
done
cat > "$report" <<'JSON'
{"error":"engine unavailable"}
JSON
exit 0
`,
  )

  const result = runFinishLane(repo, { PATH: `${fakeBin}:${systemPath}` })

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("status: tool-failure")
  expect(result.stdout).not.toContain("status: clean")
})

// Without CLAUDE_PLUGIN_DATA (Codex / bare checkout) there is no arm marker and
// no enforcing hook, so --disarm must no-op cleanly, not fail — otherwise the
// documented Phase 5 disarm step always errors outside the Claude plugin.
test("--disarm is a clean no-op when CLAUDE_PLUGIN_DATA is unset", () => {
  const repo = makeRepo()
  const result = spawnSync(process.execPath, [finishLaneScript, "--disarm"], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, PATH: systemPath, CLAUDE_PLUGIN_DATA: "" },
  })

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("DISARM SKIPPED")
})

// An explicit --base that does not resolve to a commit (e.g. the typo
// `orgin/main`) must fail fast: the scope diffs run with `2>/dev/null`, so an
// unvalidated bad base would silently yield an empty committed diff and the
// workflow could seal an incomplete scope. It must NOT write changed-files.txt
// or any seal sentinel.
test("an invalid explicit --base fails fast and writes no scope/seal artifacts", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export const value = 1\n")

  const result = spawnSync(process.execPath, [finishLaneScript, "--base", "orgin/main", "--seal"], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, PATH: systemPath },
  })

  expect(result.status).not.toBe(0)
  expect(`${result.stdout ?? ""}${result.stderr ?? ""}`).toContain("does not resolve to a commit")
  expect(existsSync(path.join(repo, ".workflow/finish-lane/changed-files.txt"))).toBe(false)
  expect(existsSync(path.join(repo, ".workflow/finish-lane/seal"))).toBe(false)
})

// A valid explicit base still computes scope and seals as before.
test("a valid explicit --base still computes scope and seals", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export const value = 1\n")

  const result = spawnSync(process.execPath, [finishLaneScript, "--base", "HEAD", "--seal"], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, PATH: systemPath },
  })

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("base=HEAD")
  expect(result.stdout).toContain("SEALED")
  expect(existsSync(path.join(repo, ".workflow/finish-lane/changed-files.txt"))).toBe(true)
})

// The scope hash must fold in untracked file CONTENT, not just paths — an
// untracked file is in PR scope but rides in no git diff, so editing its
// contents after a seal would otherwise leave scope_hash unchanged and let the
// push gate stay green on unreviewed bytes. git hash-object per path closes that.
test("editing an untracked file's contents changes scope_hash", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "notes.txt", "first\n") // untracked: in no diff, only scope-hashed

  const seal = (): string => {
    const r = spawnSync(process.execPath, [finishLaneScript, "--base", "HEAD", "--seal"], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, PATH: systemPath },
    })
    const match = `${r.stdout ?? ""}`.match(/scope_hash=([0-9a-f]{64})/)
    if (!match) throw new Error(`no scope_hash in output:\n${r.stdout}\n${r.stderr}`)
    return match[1]
  }

  const before = seal()
  writeRepoFile(repo, "notes.txt", "second\n") // same path, different contents
  const after = seal()

  expect(after).not.toBe(before)
})

// --- suggestLenses routing (lensRules coverage) ---------------------------

test("suggestLenses: a plain code file routes bug-hunting + simplification", () => {
  expect(suggestLenses(["src/foo.ts"])).toEqual([
    "isomorphic-simplification.md",
    "multi-pass-bug-hunting.md",
  ])
  // compiled languages now covered too
  expect(suggestLenses(["src/main.cpp"])).toContain("multi-pass-bug-hunting.md")
})

test("suggestLenses: doc prose never routes code-only lenses", () => {
  const setupDoc = suggestLenses(["docs/setup-guide.md"])
  expect(setupDoc).toContain("prose-quality-pr-copy.md")
  expect(setupDoc).not.toContain("doctor-self-healing-candidate.md")

  const parserDoc = suggestLenses(["docs/parser-guide.md"])
  expect(parserDoc).toContain("prose-quality-pr-copy.md")
  expect(parserDoc).not.toContain("metamorphic-property-test-decision.md")

  // The real-service `test*db*` fragment is extension-anchored: a doc whose name
  // merely contains the substrings "test" and "db" must not route the code lens.
  const dbDoc = suggestLenses(["docs/latestdberby.md"])
  expect(dbDoc).toContain("prose-quality-pr-copy.md")
  expect(dbDoc).not.toContain("real-service-integration-check.md")
})

test("suggestLenses: service & test-harness surfaces route real-service integration", () => {
  expect(suggestLenses(["tests/factories/user.ts"])).toEqual(
    expect.arrayContaining([
      "real-service-integration-check.md",
      "mock-stub-placeholder-sweep.md",
      "multi-pass-bug-hunting.md",
      "isomorphic-simplification.md",
    ]),
  )
  expect(suggestLenses(["src/harness.ts"])).toContain("real-service-integration-check.md")
  expect(suggestLenses(["lib/billing/cancel.ts"])).toContain("real-service-integration-check.md")
})

test("suggestLenses: doctor & metamorphic route on code surfaces, not prose", () => {
  expect(suggestLenses(["scripts/bootstrap.sh"])).toContain("doctor-self-healing-candidate.md")
  expect(suggestLenses(["src/parser.ts"])).toContain("metamorphic-property-test-decision.md")
})

test("suggestLenses: config surfaces route the contract lens", () => {
  expect(suggestLenses(["code/skills/code/SKILL.md"])).toContain("config-contract-check.md")
})

test("suggestLenses: golden residue extensions route the golden lens", () => {
  expect(suggestLenses(["build/foo.actual"])).toContain("golden-artifact-decision.md")
  expect(suggestLenses(["__snapshots__/x.received"])).toContain("golden-artifact-decision.md")
})

test("suggestLenses: an extensionless CHANGELOG routes prose-quality", () => {
  expect(suggestLenses(["CHANGELOG"])).toContain("prose-quality-pr-copy.md")
  expect(suggestLenses(["docs/HISTORY"])).toContain("prose-quality-pr-copy.md")
})
