import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  fixtureInput,
  verifyCandidate,
  type Fixture,
} from "../evals/support/outcome"

const FIXTURE: Fixture = {
  name: "normalize-config",
  exports: ["normalizeConfig", "classify"],
}

const hostDir = mkdtempSync(join(tmpdir(), "eve-outcome-host-"))
const hostSentinel = join(hostDir, "sentinel.txt")
const originalKey = process.env.OPENAI_API_KEY

try {
  writeFileSync(hostSentinel, "unchanged")
  process.env.OPENAI_API_KEY = "host-secret-must-not-enter-container"
  const probe = `
import { existsSync, writeFileSync } from "node:fs"
import { networkInterfaces } from "node:os"

if (process.env.OPENAI_API_KEY) {
  throw new Error("host secret reached the verifier container")
}
if (existsSync(${JSON.stringify(hostSentinel)})) {
  throw new Error("host filesystem reached the verifier container")
}

let wroteHost = false
try {
  writeFileSync(${JSON.stringify(hostSentinel)}, "changed")
  wroteHost = true
} catch {}
if (wroteHost) throw new Error("candidate wrote outside its fixture")

let wroteFixture = false
try {
  writeFileSync("./candidate.js", "changed")
  wroteFixture = true
} catch {}
if (wroteFixture) throw new Error("candidate wrote inside the read-only fixture")

const nonLoopback = Object.entries(networkInterfaces()).flatMap(([name, addresses]) =>
  name === "lo" ? [] : (addresses ?? [])
)
if (nonLoopback.length > 0) throw new Error("candidate received a non-loopback network interface")
`
  const candidate = `${probe}\n${fixtureInput(FIXTURE)}`
  const result = verifyCandidate(FIXTURE, `\`\`\`javascript\n${candidate}\n\`\`\``)

  assert.equal(result.error, undefined)
  assert.equal(result.testsPass, true, JSON.stringify(result))
  assert.equal(readFileSync(hostSentinel, "utf8"), "unchanged")
  console.log("Outcome verifier isolation passed.")
} finally {
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = originalKey
  rmSync(hostDir, { recursive: true, force: true })
}
