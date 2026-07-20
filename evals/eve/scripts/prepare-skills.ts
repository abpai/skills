// Materialize canonical marketplace SKILL.md packages into the Eve agent's
// `agent/skills/` directory. The eval harness must test the REAL skill bodies,
// so they are generated from canonical repo sources at prepare time, never
// maintained as duplicate files. `agent/skills/` is gitignored.
//
// Frontmatter is NORMALIZED to Eve's shape: Eve's authored-skill frontmatter
// accepts only `description` (plus optional license/metadata) and rejects the
// Claude/Codex host keys (`disable-model-invocation`, `user-invocable`,
// `allowed-tools`, `argument-hint`, `name`, ...). The body is copied verbatim,
// so behavioral contracts are tested exactly; only the host-specific frontmatter
// is dropped. Sibling files (references/, scripts/, assets/) copy as-is.
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const eveRoot = resolve(here, "..")
const repoRoot = resolve(eveRoot, "..", "..")

// skill id (Eve's `agent/skills/<id>/`) -> canonical repo package dir
const SKILLS: Record<string, string> = {
  code: "code/skills/code",
  "hexagon-audit": "hexagon-audit/skills/hexagon-audit",
  "codex-session": "codex-session/skills/codex-session",
  // Seeded for the add-a-skill flow (README) and as a routing distractor; no eval
  // loads it yet — intentional, not a dead entry. Add its eval under evals/ later.
  "status-update": "status-update/skills/status-update",
}

// Extract the frontmatter `description` value, handling inline and folded/block
// (`>`, `>-`, `|`) scalars. Returns the collapsed single-line text.
function extractDescription(md: string): string {
  const fm = md.match(/^---\n([\s\S]*?)\n---/)
  if (!fm) throw new Error("no frontmatter block")
  const lines = fm[1].split("\n")
  const idx = lines.findIndex((l) => /^description:/.test(l))
  if (idx === -1) throw new Error("no description key")
  const inline = lines[idx].replace(/^description:\s*/, "")
  if (inline && !/^[>|][-+]?\s*$/.test(inline)) {
    return inline.replace(/^["']|["']$/g, "").trim()
  }
  // Folded/block scalar: gather subsequent more-indented lines.
  const body: string[] = []
  for (let i = idx + 1; i < lines.length; i++) {
    if (lines[i].trim() === "") continue
    if (!/^\s/.test(lines[i])) break
    body.push(lines[i].trim())
  }
  return body.join(" ").trim()
}

function stripFrontmatter(md: string): string {
  const m = md.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/)
  return m ? m[1] : md
}

const dest = join(eveRoot, "agent", "skills")
if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })

let count = 0
for (const [id, rel] of Object.entries(SKILLS)) {
  const src = join(repoRoot, rel)
  const srcSkill = join(src, "SKILL.md")
  if (!existsSync(srcSkill)) {
    throw new Error(`prepare-skills: missing SKILL.md at ${rel} (repo layout changed?)`)
  }
  const canonical = readFileSync(srcSkill, "utf8")
  const description = extractDescription(canonical)
  if (!description) throw new Error(`prepare-skills: empty description for ${id}`)

  // Copy sibling files (references/, scripts/, assets/), skipping SKILL.md.
  const skillDest = join(dest, id)
  mkdirSync(skillDest, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.name === "SKILL.md") continue
    cpSync(join(src, entry.name), join(skillDest, entry.name), { recursive: true })
  }

  // Emit an Eve-shaped SKILL.md: description-only frontmatter + verbatim body.
  const eveSkill = `---\ndescription: >-\n  ${description}\n---\n\n${stripFrontmatter(canonical).trimStart()}`
  writeFileSync(join(skillDest, "SKILL.md"), eveSkill)
  count++
  console.log(`  materialized ${id} <- ${rel}`)
}
console.log(`prepare-skills: ${count} skill package(s) into agent/skills/`)
