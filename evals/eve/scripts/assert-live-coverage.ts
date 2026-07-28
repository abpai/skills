/**
 * Guard against a live-eval lane that passes without testing anything.
 *
 * `eve eval --tag live --strict` exits non-zero when an eval fails, and exits 2
 * when a tag matches nothing. Neither covers the quieter failure: a run that
 * executes FEWER evals than the suite defines — a broken glob, a discovery
 * regression, a file that throws at import and is silently dropped. That run
 * reports success, and the lane looks green while guarding less than it did.
 *
 * So compare what ran against what exists: parse `tests="N"` out of the JUnit
 * report and require it to equal the number of `live`-tagged evals that
 * `eve eval --list` discovers. Any shortfall fails the lane by name.
 *
 * Usage: bun scripts/assert-live-coverage.ts <junit.xml>
 */
import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const eveRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function fail(message: string): never {
  console.error(`::error::assert-live-coverage: ${message}`)
  process.exit(1)
}

/** Count `live`-tagged evals as `eve eval --list` reports them. */
function discoverLiveEvalCount(): number {
  const r = spawnSync("bunx", ["eve", "eval", "--list"], {
    cwd: eveRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  })
  if (r.status !== 0) {
    fail(`\`eve eval --list\` failed (exit ${r.status})\n${r.stderr || r.stdout}`)
  }
  // Each line looks like: `contracts/foo [live, code, contract] — description`
  const tagGroups = (r.stdout ?? "").match(/\[[^\]]*\]/g) ?? []
  return tagGroups.filter((g) => /\blive\b/.test(g)).length
}

const junitPath = process.argv[2]
if (!junitPath) fail("usage: bun scripts/assert-live-coverage.ts <junit.xml>")
if (!existsSync(junitPath)) {
  fail(
    `no JUnit report at ${junitPath} — the eval run did not produce one, so ` +
      `there is no evidence any eval executed`,
  )
}

const xml = readFileSync(junitPath, "utf8")
const testsMatch = xml.match(/\btests="(\d+)"/)
if (!testsMatch) fail(`JUnit report at ${junitPath} has no tests="N" attribute`)
const ran = Number(testsMatch[1])

const expected = discoverLiveEvalCount()
if (expected === 0) {
  fail("no live-tagged evals discovered — the suite would pass while testing nothing")
}
if (ran === 0) {
  fail(`JUnit reports 0 tests but ${expected} live evals are defined`)
}
if (ran !== expected) {
  const direction = ran < expected ? "only " : ""
  fail(
    `${direction}${ran} of ${expected} live evals ran. The report and discovered ` +
      `suite do not match; investigate discovery or stale evidence before ` +
      `trusting a green result.`,
  )
}

console.log(`assert-live-coverage: ${ran}/${expected} live evals ran.`)
