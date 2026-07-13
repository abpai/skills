import { afterEach, expect, test } from "bun:test"
import { classifyShortcutLine, scanSemanticShortcuts, suggestLenses } from "./finish-lane.ts"
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

// An explicit --base that resolves to a commit but shares NO common history
// with HEAD (an orphan/unrelated branch) makes `git diff base...HEAD` exit 128
// with empty output. Suppressed by 2>/dev/null, that would silently yield an
// empty committed scope and seal an incomplete PR. The merge-base guard must
// fail fast and write no scope/seal artifacts.
test("an explicit --base with no merge-base fails fast and writes no scope/seal artifacts", () => {
  const repo = makeRepo()
  // Mark the initial commit as the prospective base, then build an unrelated
  // orphan branch whose only commit shares no ancestry with `basebranch`.
  run("git", ["branch", "basebranch"], repo, { PATH: systemPath })
  run("git", ["checkout", "--orphan", "feature", "-q"], repo, { PATH: systemPath })
  run("git", ["rm", "-rf", "--quiet", "."], repo, { PATH: systemPath })
  writeRepoFile(repo, "src/app.ts", "export const value = 1\n")
  run("git", ["add", "src/app.ts"], repo, { PATH: systemPath })
  run("git", ["commit", "-qm", "feature"], repo, { PATH: systemPath })

  const result = spawnSync(process.execPath, [finishLaneScript, "--base", "basebranch", "--seal"], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, PATH: systemPath },
  })

  expect(result.status).not.toBe(0)
  expect(`${result.stdout ?? ""}${result.stderr ?? ""}`).toContain("no common history")
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

test("editing a dash-leading untracked file's contents changes scope_hash", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "--help", "first\n") // proves git hash-object gets its own -- separator

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
  writeRepoFile(repo, "--help", "second\n")
  const after = seal()

  expect(after).not.toBe(before)
})

test("--fix recomputes scope after a formatter creates another file", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "package.json", JSON.stringify({ scripts: { format: "format" } }))
  writeRepoFile(repo, "target.txt", "before\n")
  const binDir = path.join(repo, "fake-bin")
  mkdirSync(binDir, { recursive: true })
  const npm = path.join(binDir, "npm")
  writeFileSync(
    npm,
    "#!/bin/sh\nif [ \"$1\" = run ] && [ \"$2\" = format ]; then printf 'formatted\\n' > formatted.txt; fi\n",
    "utf8",
  )
  chmodSync(npm, 0o755)

  const result = runFinishLaneArgs(repo, ["--base", "HEAD", "--fix"], { PATH: `${binDir}:${systemPath}` })
  const changed = readFileSync(path.join(repo, ".workflow", "finish-lane", "changed-files.txt"), "utf8")

  expect(result.status).toBe(0)
  expect(result.stdout).toContain("npm run format -> ok")
  expect(changed).toContain("formatted.txt")
})

test("validation failure exits non-zero without requiring --seal", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "package.json", JSON.stringify({ scripts: { validate: "validate" } }))
  const binDir = path.join(repo, "fake-bin")
  mkdirSync(binDir, { recursive: true })
  const npm = path.join(binDir, "npm")
  writeFileSync(npm, "#!/bin/sh\nexit 1\n", "utf8")
  chmodSync(npm, 0o755)

  const result = runFinishLaneArgs(repo, ["--base", "HEAD"], { PATH: `${binDir}:${systemPath}` })

  expect(result.status).toBe(1)
  expect(result.stdout).toContain("npm run validate -> fail")
})

test("failed fix command exits non-zero", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "package.json", JSON.stringify({ scripts: { format: "format" } }))
  const binDir = path.join(repo, "fake-bin")
  mkdirSync(binDir, { recursive: true })
  const npm = path.join(binDir, "npm")
  writeFileSync(npm, "#!/bin/sh\nexit 7\n", "utf8")
  chmodSync(npm, 0o755)

  const result = runFinishLaneArgs(repo, ["--base", "HEAD", "--fix"], { PATH: `${binDir}:${systemPath}` })

  expect(result.status).toBe(1)
  expect(result.stdout).toContain("npm run format -> fail")
})

// --- suggestLenses routing (lensRules coverage) ---------------------------

test("suggestLenses: plain code does not invent a generic review lens", () => {
  expect(suggestLenses(["src/foo.ts"])).toEqual([])
  expect(suggestLenses(["src/main.cpp"])).toEqual([])
})

test("suggestLenses: doc prose never routes code-only lenses", () => {
  const setupDoc = suggestLenses(["docs/setup-guide.md"])
  expect(setupDoc).toContain("prose-quality-check.md")
  expect(setupDoc).not.toContain("doctor-self-healing-candidate.md")

  const parserDoc = suggestLenses(["docs/parser-guide.md"])
  expect(parserDoc).toContain("prose-quality-check.md")
  expect(parserDoc).not.toContain("invariant-testing-check.md")

  // The real-service `test*db*` fragment is extension-anchored: a doc whose name
  // merely contains the substrings "test" and "db" must not route the code lens.
  const dbDoc = suggestLenses(["docs/latestdberby.md"])
  expect(dbDoc).toContain("prose-quality-check.md")
  expect(dbDoc).not.toContain("real-service-integration-check.md")
})

test("suggestLenses: service & test-harness surfaces route real-service integration", () => {
  expect(suggestLenses(["tests/factories/user.ts"])).toEqual(
    expect.arrayContaining([
      "real-service-integration-check.md",
      "mock-stub-placeholder-sweep.md",
    ]),
  )
  expect(suggestLenses(["src/harness.ts"])).toContain("real-service-integration-check.md")
  expect(suggestLenses(["lib/billing/cancel.ts"])).toContain("real-service-integration-check.md")
})

test("suggestLenses: doctor & invariant testing route on code surfaces, not prose", () => {
  expect(suggestLenses(["scripts/bootstrap.sh"])).toContain("doctor-self-healing-candidate.md")
  expect(suggestLenses(["src/parser.ts"])).toContain("invariant-testing-check.md")
})

test("suggestLenses: config surfaces route the contract lens", () => {
  expect(suggestLenses(["code/skills/code/SKILL.md"])).toContain("config-contract-check.md")
})

test("suggestLenses: snapshot residue extensions route the snapshot lens", () => {
  expect(suggestLenses(["build/foo.actual"])).toContain("snapshot-testing-check.md")
  expect(suggestLenses(["__snapshots__/x.received"])).toContain("snapshot-testing-check.md")
})

test("suggestLenses: an extensionless CHANGELOG routes prose-quality", () => {
  expect(suggestLenses(["CHANGELOG"])).toContain("prose-quality-check.md")
  expect(suggestLenses(["docs/HISTORY"])).toContain("prose-quality-check.md")
})

// --- seal <-> gate-before-push.sh parity -----------------------------------
//
// finish-lane.ts writes the seal sentinel; the hook decides push/PR access by
// recomputing the branch slug and scope hash itself. These tests run the REAL
// hook script against repos sealed by the real finish-lane, so any drift
// between the two implementations (slug rules, hash inputs, stderr handling)
// fails here instead of silently bricking the gate.

const gateHook = path.join(import.meta.dir, "..", "..", "..", "hooks", "gate-before-push.sh")
// The hook needs jq; it may live outside the stripped-down systemPath.
const jqBin = spawnSync("sh", ["-c", "command -v jq"], { encoding: "utf8" }).stdout?.trim() ?? ""
const hookPath = jqBin ? `${path.dirname(jqBin)}:${systemPath}` : systemPath
const testIfJq = jqBin ? test : test.skip

function makePluginData(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "finish-lane-plugin-data-"))
  tempDirs.push(dir)
  return dir
}

function runFinishLaneArgs(repo: string, args: string[], env: Record<string, string> = {}): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(process.execPath, [finishLaneScript, ...args], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, PATH: systemPath, ...env },
  })
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", status: result.status }
}

function runHook(repo: string, pluginData: string, command = "git push"): { status: number | null; stdout: string } {
  const event = JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: repo })
  const result = spawnSync("sh", [gateHook], {
    cwd: repo,
    encoding: "utf8",
    input: event,
    env: { ...process.env, PATH: hookPath, CLAUDE_PLUGIN_DATA: pluginData },
  })
  return { status: result.status, stdout: result.stdout ?? "" }
}

// Branch names with runs of unsafe chars exercise the slug rules end-to-end:
// both sides must collapse the run to one '-' and strip edge dashes, or the
// hook looks up a sentinel filename finish-lane never wrote and a correctly
// sealed branch stays blocked forever.
testIfJq("hook parity: a sealed branch with slug-hostile name opens the gate, and goes stale on edit", () => {
  const repo = makeRepo()
  const pluginData = makePluginData()
  run("git", ["checkout", "-q", "-b", "feat(scope)/x"], repo, { PATH: systemPath })
  writeRepoFile(repo, "notes.txt", "in scope\n")

  const arm = runFinishLaneArgs(repo, ["--base", "HEAD", "--arm"], { CLAUDE_PLUGIN_DATA: pluginData })
  expect(arm.status).toBe(0)
  expect(arm.stdout).toContain("ARMED")

  // Armed but unsealed: the terminal action must be denied.
  const blocked = runHook(repo, pluginData)
  expect(blocked.status).toBe(0)
  expect(blocked.stdout).toContain('"permissionDecision": "deny"')

  const seal = runFinishLaneArgs(repo, ["--base", "HEAD", "--seal"], { CLAUDE_PLUGIN_DATA: pluginData })
  expect(seal.status).toBe(0)
  expect(seal.stdout).toContain("SEALED feat-scope-x ")

  // Fresh seal: the hook recomputes slug + scope hash and must agree.
  const allowed = runHook(repo, pluginData)
  expect(allowed.status).toBe(0)
  expect(allowed.stdout).toBe("")

  // Any scope change after sealing re-blocks the push.
  writeRepoFile(repo, "notes.txt", "edited after seal\n")
  const stale = runHook(repo, pluginData)
  expect(stale.status).toBe(0)
  expect(stale.stdout).toContain('"permissionDecision": "deny"')
})

// An ambiguous refname (a branch AND a tag named the same) makes a successful
// `git diff base...HEAD` warn on stderr. The hook hashes the diff with
// 2>/dev/null, so finish-lane must hash stdout only — folding the warning in
// would make every seal in such a repo permanently stale.
testIfJq("hook parity: a git stderr warning during the scope diff does not poison the seal", () => {
  const repo = makeRepo()
  const pluginData = makePluginData()
  run("git", ["branch", "ambig"], repo, { PATH: systemPath })
  run("git", ["tag", "ambig"], repo, { PATH: systemPath })
  run("git", ["checkout", "-q", "-b", "work"], repo, { PATH: systemPath })
  writeRepoFile(repo, "src/app.ts", "export const value = 1\n")
  run("git", ["add", "src/app.ts"], repo, { PATH: systemPath })
  run("git", ["commit", "-qm", "feature"], repo, { PATH: systemPath })

  const arm = runFinishLaneArgs(repo, ["--base", "ambig", "--arm"], { CLAUDE_PLUGIN_DATA: pluginData })
  expect(arm.status).toBe(0)

  const seal = runFinishLaneArgs(repo, ["--base", "ambig", "--seal"], { CLAUDE_PLUGIN_DATA: pluginData })
  expect(seal.status).toBe(0)
  expect(seal.stdout).toContain("SEALED")

  const allowed = runHook(repo, pluginData)
  expect(allowed.status).toBe(0)
  expect(allowed.stdout).toBe("")
})

// Detached HEAD: finish-lane's `git branch --show-current` prints empty and it
// seals as "detached"; the hook must derive the same name, not "HEAD".
testIfJq("hook parity: a detached-HEAD seal opens the gate", () => {
  const repo = makeRepo()
  const pluginData = makePluginData()
  run("git", ["checkout", "-q", "--detach"], repo, { PATH: systemPath })
  writeRepoFile(repo, "notes.txt", "in scope\n")

  const arm = runFinishLaneArgs(repo, ["--base", "HEAD", "--arm"], { CLAUDE_PLUGIN_DATA: pluginData })
  expect(arm.status).toBe(0)

  const seal = runFinishLaneArgs(repo, ["--base", "HEAD", "--seal"], { CLAUDE_PLUGIN_DATA: pluginData })
  expect(seal.status).toBe(0)
  expect(seal.stdout).toContain("SEALED detached ")

  const allowed = runHook(repo, pluginData)
  expect(allowed.status).toBe(0)
  expect(allowed.stdout).toBe("")
})

// --fix mutates files after the scope hash is computed, so combining it with
// --seal would always write an immediately-stale sentinel. Refuse up front.
test("--fix combined with --seal is refused before any work", () => {
  const repo = makeRepo()
  const result = runFinishLaneArgs(repo, ["--fix", "--seal"])

  expect(result.status).toBe(2)
  expect(result.stderr).toContain("--fix cannot be combined with --seal")
  expect(existsSync(path.join(repo, ".workflow"))).toBe(false)
})

// An unborn HEAD has no commit to stamp into the sentinel; the hook requires a
// non-empty stored head, so a seal written there would be dead on arrival.
// Refuse it instead (there is nothing to push yet either).
test("--seal on an unborn HEAD is refused and writes no sentinel", () => {
  const repo = mkdtempSync(path.join(tmpdir(), "finish-lane-unborn-"))
  tempDirs.push(repo)
  run("git", ["init", "-q"], repo, { PATH: systemPath })
  writeRepoFile(repo, "notes.txt", "in scope\n")

  const result = runFinishLaneArgs(repo, ["--seal"])

  expect(result.status).toBe(2)
  expect(result.stdout).toContain("SEAL REFUSED: HEAD has no commits")
  expect(existsSync(path.join(repo, ".workflow/finish-lane/seal"))).toBe(false)
})

// --- semantic-shortcut scan (content routing for semantic-shortcuts.md) ----

test("classifyShortcutLine: catches code that guesses at a contract", () => {
  // Chained fallbacks over property reads — a guess at a payload shape.
  expect(classifyShortcutLine("  const orders = resp.data ?? resp.result ?? resp.body")).toBe("fallback-chain")
  expect(classifyShortcutLine("return cfg.host || cfg.hostname || cfg.addr")).toBe("fallback-chain")
  // Regex standing in for a parser on a structured grammar.
  expect(classifyShortcutLine(`const table = sql.match(/FROM\\s+(\\w+)/i)`)).toBe("regex-parse")
  expect(classifyShortcutLine(`if (new RegExp("<div[^>]*>").test(html)) return true`)).toBe("regex-parse")
  // Hand-rolled auth/crypto.
  expect(classifyShortcutLine(`  const sig = createHmac("sha256", secret).digest("hex")`)).toBe("bespoke-crypto")
  expect(classifyShortcutLine(`const [header, payload, sig] = token.split(".")`)).toBe("bespoke-crypto")
  // Casts asserting a shape nothing validated.
  expect(classifyShortcutLine("const order = JSON.parse(rawBody) as Order")).toBe("boundary-cast")
  expect(classifyShortcutLine("const user = row as any")).toBe("boundary-cast")
})

test("classifyShortcutLine: leaves the lens's documented false positives alone", () => {
  // A single operator is a DEFAULT, not a guess about a contract. This is the
  // de-minimis floor the lens spells out; it is the scan's most important no.
  expect(classifyShortcutLine("export const port = Number(process.env.PORT) || 3000")).toBeNull()
  expect(classifyShortcutLine("const retries = opts.retries ?? 3")).toBeNull()
  // Boolean logic and comparisons are conditions, not payload-shape guesses.
  expect(classifyShortcutLine("if (user.isAdmin && user.isActive) return true")).toBeNull()
  expect(classifyShortcutLine("if (a.kind === 'x' || a.kind === 'y') return")).toBeNull()
  // Regex doing ordinary regex work on unstructured text.
  expect(classifyShortcutLine("const words = line.split(/\\s+/)")).toBeNull()
  // Crypto primitive without an auth/signature context (e.g. a cache key).
  expect(classifyShortcutLine(`const key = createHash("sha256").update(buf).digest("hex")`)).toBeNull()
  // A named cast away from any boundary.
  expect(classifyShortcutLine("const n = value as number")).toBeNull()
  // Comments describing a shortcut are not a shortcut.
  expect(classifyShortcutLine("// const orders = resp.data ?? resp.result ?? resp.body")).toBeNull()
})

test("scanSemanticShortcuts: reads added lines only, not the whole file", () => {
  const repo = makeRepo()
  // A shortcut that is already in the tree before this PR.
  writeRepoFile(repo, "src/legacy.ts", "export const v = a.one ?? a.two ?? a.three\n")
  run("git", ["add", "src/legacy.ts"], repo, { PATH: systemPath })
  run("git", ["commit", "-qm", "pre-existing"], repo, { PATH: systemPath })

  // Touching that file without adding a shortcut must not route the lens: the
  // pre-existing chain is not this PR's finding.
  writeRepoFile(repo, "src/legacy.ts", "export const v = a.one ?? a.two ?? a.three\nexport const n = 1\n")
  expect(scanSemanticShortcuts(repo, "HEAD", []).count).toBe(0)

  // Adding one does.
  writeRepoFile(repo, "src/legacy.ts", "export const v = a.one ?? a.two ?? a.three\nconst o = r.data ?? r.result ?? r.body\n")
  const scan = scanSemanticShortcuts(repo, "HEAD", [])
  expect(scan.count).toBe(1)
  expect(scan.hits[0]).toContain("fallback-chain")
})

test("scanSemanticShortcuts: ignores tests and generated code", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/api.test.ts", "const o = r.data ?? r.result ?? r.body\n")
  writeRepoFile(repo, "dist/bundle.js", "const o = r.data ?? r.result ?? r.body\n")
  expect(scanSemanticShortcuts(repo, "HEAD", ["src/api.test.ts", "dist/bundle.js"]).count).toBe(0)
})

test("suggestLenses: semantic-shortcuts.md is content-routed, never glob-routed", () => {
  // No filename can imply it...
  expect(suggestLenses(["src/orders.ts"])).not.toContain("semantic-shortcuts.md")
  // ...only the content scan can.
  expect(suggestLenses(["src/orders.ts"], true)).toContain("semantic-shortcuts.md")
})

test("finish-lane routes the semantic-shortcuts lens from an added fallback chain", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/orders.ts", "export const orders = resp.data ?? resp.result ?? resp.body\n")

  const result = runFinishLaneArgs(repo, ["--base", "HEAD"])

  expect(result.stdout).toContain("semantic-shortcut hits: 1")
  expect(result.stdout).toContain("fallback-chain")
  expect(result.stdout).toContain("review-patterns/semantic-shortcuts.md")
})

test("finish-lane leaves the semantic-shortcuts lens out of a clean diff", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/config.ts", "export const port = Number(process.env.PORT) || 3000\n")

  const result = runFinishLaneArgs(repo, ["--base", "HEAD"])

  expect(result.stdout).toContain("semantic-shortcut hits: 0")
  expect(result.stdout).not.toContain("review-patterns/semantic-shortcuts.md")
})

// --- semantic-shortcut scan: regressions from independent review -----------

test("classifyShortcutLine: catches the shapes a value-context rule used to miss", () => {
  // A `??` chain is a shape guess wherever it sits, including a call argument.
  expect(classifyShortcutLine("send(resp.data ?? resp.result ?? resp.body)")).toBe("fallback-chain")
  // Python regex over SQL is still a parser substitute.
  expect(classifyShortcutLine('rows = re.search(r"FROM\\s+(\\w+)", sql)')).toBe("regex-parse")
  // createHash over a password is bespoke crypto.
  expect(classifyShortcutLine('const h = createHash("sha256").update(password).digest()')).toBe("bespoke-crypto")
  // A non-null assertion at a boundary is a claim about someone else's data.
  expect(classifyShortcutLine("const user = response.body!")).toBe("boundary-cast")
})

test("classifyShortcutLine: strings and conditions are not shortcuts", () => {
  // String CONTENT must not classify — this is a log line, not a cast.
  expect(classifyShortcutLine('logger.debug("response body as User")')).toBeNull()
  // A `||` chain inside a condition is boolean logic, not a payload-shape guess.
  expect(classifyShortcutLine("if (user.isAdmin || user.isOwner || user.isEditor) return")).toBeNull()
  // Whitespace normalization is not a parser, even on a line that says "html".
  expect(classifyShortcutLine('const html = text.replace(/[ \\t]{2,}/g, " ")')).toBeNull()
  // Negation and inequality are not non-null assertions.
  expect(classifyShortcutLine("if (!response.ok) return null")).toBeNull()
  expect(classifyShortcutLine("if (res.status !== 200) return")).toBeNull()
})

test("classifyShortcutLine: an unterminated regex literal does not hang the scan", () => {
  // Exponential backtracking on overlapping alternatives would stall the finish
  // lane on a single pathological added line.
  const pathological = `const html = /${"[]".repeat(40)}X`
  const started = Date.now()
  classifyShortcutLine(pathological)
  expect(Date.now() - started).toBeLessThan(250)
})

test("scanSemanticShortcuts: a shortcut committed then reverted in the tree is not reported", () => {
  const repo = makeRepo()
  run("git", ["commit", "-q", "--allow-empty", "-m", "base"], repo, { PATH: systemPath })
  const base = run("git", ["rev-parse", "HEAD"], repo, { PATH: systemPath }).trim()

  writeRepoFile(repo, "src/x.ts", "const x = r.data ?? r.result ?? r.body\n")
  run("git", ["add", "src/x.ts"], repo, { PATH: systemPath })
  run("git", ["commit", "-qm", "add shortcut"], repo, { PATH: systemPath })
  expect(scanSemanticShortcuts(repo, base, []).count).toBe(1)

  // The working tree is what ships. Once the line is gone, it is not a finding.
  writeRepoFile(repo, "src/x.ts", "const x = 1\n")
  expect(scanSemanticShortcuts(repo, base, []).count).toBe(0)
})

test("scanSemanticShortcuts: an added `++ x` line is not parsed as a diff file header", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/a.ts", "let counter = 0\n")
  run("git", ["add", "src/a.ts"], repo, { PATH: systemPath })
  run("git", ["commit", "-qm", "seed"], repo, { PATH: systemPath })
  const base = run("git", ["rev-parse", "HEAD"], repo, { PATH: systemPath }).trim()

  // `++ counter` arrives in the diff as `+++ counter`. If that is read as a file
  // header, the real shortcut below it gets attributed to a file named "counter"
  // and silently dropped.
  writeRepoFile(repo, "src/a.ts", "let counter = 0\n++ counter\nconst o = r.data ?? r.result ?? r.body\n")

  const scan = scanSemanticShortcuts(repo, base, [])
  expect(scan.count).toBe(1)
  expect(scan.hits[0]).toContain("src/a.ts")
  expect(scan.hits[0]).toContain("fallback-chain")
})

test("classifyShortcutLine: naming a pattern is not using one", () => {
  // A rule table, import, or doc line that LISTS these constructs is talking
  // about them, not hand-rolling them. Without this the scanner's own source is
  // its loudest finding.
  expect(classifyShortcutLine("const cryptoPrimitive = /\\b(createHmac|createHash|createSign)\\b/i")).toBeNull()
  expect(classifyShortcutLine("const structuredFormat = /\\b(sql|html|xml|csv)\\b/i")).toBeNull()
  expect(classifyShortcutLine('import { createHmac } from "node:crypto"')).toBeNull()
  // A boolean OR of predicate CALLS is logic, not a fallback chain.
  expect(classifyShortcutLine("return /\\(/.test(src) || /</.test(src) || /x/.test(src)")).toBeNull()
})

test("classifyShortcutLine: a chain of method calls is not a fallback chain", () => {
  // Regression: `\w+(?!\s*\()` backtracks (`test` -> `tes`) so the "not a call"
  // guard passed on `x.test(y) || z.test(y)`. Any `||` chain over method calls
  // false-positived. The `\b` after `\w+` is what closes it.
  expect(classifyShortcutLine("return a.test(src) || b.test(src) || c.test(src)")).toBeNull()
  expect(classifyShortcutLine("const ok = check.run(x) || other.run(x)")).toBeNull()
  // ...while a chain over property READS still classifies.
  expect(classifyShortcutLine("const v = resp.data ?? resp.result ?? resp.body")).toBe("fallback-chain")
})
