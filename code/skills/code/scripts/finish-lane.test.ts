import { afterEach, expect, test } from "bun:test"
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
beads=""
report=""
for arg in "$@"; do
  case "$arg" in
    --beads-jsonl=*) beads="\${arg#*=}" ;;
    --report-json=*) report="\${arg#*=}" ;;
  esac
done
cat > "$beads" <<'JSONL'
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
beads=""
report=""
for arg in "$@"; do
  case "$arg" in
    --beads-jsonl=*) beads="\${arg#*=}" ;;
    --report-json=*) report="\${arg#*=}" ;;
  esac
done
cat > "$beads" <<'JSONL'
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

test("treats test-only findings as clean in the primary status", () => {
  const repo = makeRepo()
  writeRepoFile(repo, "src/app.ts", "export const value = 1\n")
  const fakeBin = makeFakeUbs(
    repo,
    `
beads=""
for arg in "$@"; do
  case "$arg" in --beads-jsonl=*) beads="\${arg#*=}" ;; esac
done
cat > "$beads" <<'JSONL'
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
beads=""
report=""
for arg in "$@"; do
  case "$arg" in
    --beads-jsonl=*) beads="\${arg#*=}" ;;
    --report-json=*) report="\${arg#*=}" ;;
  esac
done
cat > "$beads" <<'JSONL'
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
beads=""
for arg in "$@"; do
  case "$arg" in --beads-jsonl=*) beads="\${arg#*=}" ;; esac
done
cat > "$beads" <<'JSONL'
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
