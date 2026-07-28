import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const list = spawnSync("bunx", ["eve", "eval", "--list"], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
})
assert.equal(list.status, 0, list.stderr || list.stdout)

const groups = (list.stdout ?? "").match(/\[[^\]]*\]/g) ?? []
const expected = groups.filter((group) => /\blive\b/.test(group)).length
assert.ok(expected > 0, "the test suite must discover at least one live eval")

const dir = mkdtempSync(join(tmpdir(), "eve-live-coverage-"))
const run = (path: string) =>
  spawnSync("bun", ["scripts/assert-live-coverage.ts", path], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  })

try {
  const exact = join(dir, "exact.xml")
  const short = join(dir, "short.xml")
  const extra = join(dir, "extra.xml")
  writeFileSync(exact, `<testsuites tests="${expected}"></testsuites>\n`)
  writeFileSync(short, `<testsuites tests="${expected - 1}"></testsuites>\n`)
  writeFileSync(extra, `<testsuites tests="${expected + 1}"></testsuites>\n`)

  assert.equal(run(exact).status, 0, "an exact report must pass")
  assert.equal(run(short).status, 1, "a short report must fail")
  assert.equal(run(extra).status, 1, "a report with extra or stale cases must fail")
  assert.equal(run(join(dir, "missing.xml")).status, 1, "a missing report must fail")
  console.log(`Live coverage controls passed at ${expected} expected evals.`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
