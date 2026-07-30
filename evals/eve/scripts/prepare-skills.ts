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
// is dropped. Sibling files (references/, scripts/, assets/, flat `*.md`
// workflow modules beside an umbrella SKILL.md) copy as-is.
//
// Variant modes (ablation harness):
//   --ablate <ablationId>  materialize with the named heading span removed —
//                          from SKILL.md, or from a sibling workflow module
//                          when the ablation span names a `file`
//   --omit <skillId>       materialize everything except that skill
// Both hard-error on a silent no-op (missing file, missing heading, or
// byte-identical output).
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { ABLATIONS } from "../ablations/manifest"

const here = dirname(fileURLToPath(import.meta.url))
const eveRoot = resolve(here, "..")
const repoRoot = resolve(eveRoot, "..", "..")

// skill id (Eve's `agent/skills/<id>/`) -> canonical repo package dir
export const SKILLS: Record<string, string> = {
  code: "code/skills/code",
  engineering: "engineering/skills/engineering",
  harness: "harness/skills/harness",
  "hexagon-audit": "hexagon-audit/skills/hexagon-audit",
  "codex-session": "codex-session/skills/codex-session",
  "claude-session": "claude-session/skills/claude-session",
  claude: "claude/skills/claude",
  distill: "distill/skills/distill",
  "lateral-thinking": "lateral-thinking/skills/lateral-thinking",
  "human-writer": "human-writer/skills/human-writer",
  "improve-prompt": "improve-prompt/skills/improve-prompt",
  tutorial: "tutorial/skills/tutorial",
  // Routing distractor + add-a-skill README seed; no dedicated eval yet.
  "status-update": "status-update/skills/status-update",
}

// Out of scope for this lane (comment for authors): output-quality / host-specific
// skills — visualize, impeccable, frontend-design, dataviz, artifact-* — Eve can't
// grade visual output and their contracts aren't portable; manual dogfood owns them.

function parseArgs(argv: string[]): { ablateId?: string; omitId?: string } {
  let ablateId: string | undefined
  let omitId: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--ablate") {
      ablateId = argv[++i]
      if (!ablateId) throw new Error("prepare-skills: --ablate requires an ablation id")
    } else if (a === "--omit") {
      omitId = argv[++i]
      if (!omitId) throw new Error("prepare-skills: --omit requires a skill id")
    } else if (a.startsWith("-")) {
      throw new Error(`prepare-skills: unknown flag ${a}`)
    }
  }
  if (ablateId && omitId) {
    throw new Error("prepare-skills: pass --ablate or --omit, not both")
  }
  return { ablateId, omitId }
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

function buildEveSkill(description: string, body: string): string {
  return `---\ndescription: >-\n  ${description}\n---\n\n${body.trimStart()}`
}

/** Reject an ablation `file` that would write outside the materialized package. */
function isInsidePackage(packageDir: string, candidate: string): boolean {
  const root = resolve(packageDir)
  const target = resolve(candidate)
  return target === root || target.startsWith(root + "/")
}

/** Remove from `## Heading` through the next same-or-higher heading. */
export function removeHeadingSpan(
  body: string,
  heading: string,
): { result: string; found: boolean } {
  const wanted = heading.replace(/^#+\s*/, "").trim()
  const lines = body.split("\n")
  let start = -1
  let startLevel = 0
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{2,})\s+(.*)$/)
    if (!m) continue
    if (m[2].trim() === wanted) {
      start = i
      startLevel = m[1].length
      break
    }
  }
  if (start === -1) return { result: body, found: false }
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,})\s+/)
    if (m && m[1].length <= startLevel) {
      end = i
      break
    }
  }
  const next = [...lines.slice(0, start), ...lines.slice(end)]
  // Collapse runs of blank lines left by the cut.
  const collapsed: string[] = []
  for (const line of next) {
    if (line === "" && collapsed[collapsed.length - 1] === "") continue
    collapsed.push(line)
  }
  return { result: collapsed.join("\n"), found: true }
}

function materialize(): void {
  const { ablateId, omitId } = parseArgs(process.argv.slice(2))

  let ablation: (typeof ABLATIONS)[number] | undefined
  if (ablateId) {
    ablation = ABLATIONS.find((a) => a.id === ablateId)
    if (!ablation) {
      throw new Error(
        `prepare-skills: unknown ablation id "${ablateId}" (known: ${ABLATIONS.map((a) => a.id).join(", ")})`,
      )
    }
    if (!ablation.span) {
      throw new Error(
        `prepare-skills: ablation "${ablateId}" has no span — use --omit ${ablation.skillId} for retirement checks`,
      )
    }
    if ("lines" in ablation.span) {
      throw new Error(
        `prepare-skills: line-span ablations are not implemented (ablation "${ablateId}")`,
      )
    }
    if (!(ablation.skillId in SKILLS)) {
      throw new Error(`prepare-skills: ablation "${ablateId}" skillId "${ablation.skillId}" not in SKILLS map`)
    }
  }
  if (omitId && !(omitId in SKILLS)) {
    throw new Error(`prepare-skills: --omit "${omitId}" is not in the SKILLS map`)
  }

  const dest = join(eveRoot, "agent", "skills")
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })

  let count = 0
  for (const [id, rel] of Object.entries(SKILLS)) {
    if (omitId && id === omitId) {
      console.log(`  omitted ${id}`)
      continue
    }

    const src = join(repoRoot, rel)
    const srcSkill = join(src, "SKILL.md")
    if (!existsSync(srcSkill)) {
      throw new Error(`prepare-skills: missing SKILL.md at ${rel} (repo layout changed?)`)
    }
    const canonical = readFileSync(srcSkill, "utf8")
    const description = extractDescription(canonical)
    if (!description) throw new Error(`prepare-skills: empty description for ${id}`)

    const skillDest = join(dest, id)
    mkdirSync(skillDest, { recursive: true })
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      if (entry.name === "SKILL.md") continue
      cpSync(join(src, entry.name), join(skillDest, entry.name), { recursive: true })
    }

    const baselineBody = stripFrontmatter(canonical)
    const baseline = buildEveSkill(description, baselineBody)
    let eveSkill = baseline
    let note = ""

    if (ablation && ablation.skillId === id && ablation.span && "heading" in ablation.span) {
      const { heading } = ablation.span
      const targetFile = ablation.span.file ?? "SKILL.md"

      if (targetFile === "SKILL.md") {
        const { result, found } = removeHeadingSpan(baselineBody, heading)
        if (!found) {
          throw new Error(
            `prepare-skills: ablation "${ablation.id}" heading "## ${heading}" not found in ${id}`,
          )
        }
        eveSkill = buildEveSkill(description, result)
        if (eveSkill === baseline) {
          throw new Error(
            `prepare-skills: ablation "${ablation.id}" is a silent no-op — materialized SKILL.md is byte-identical to baseline`,
          )
        }
      } else {
        // Sibling workflow module beside the umbrella (already copied above).
        // Mutate the copy in agent/skills/, never the canonical repo source.
        const modulePath = join(skillDest, targetFile)
        if (!isInsidePackage(skillDest, modulePath)) {
          throw new Error(
            `prepare-skills: ablation "${ablation.id}" file "${targetFile}" escapes the skill package`,
          )
        }
        if (!existsSync(modulePath)) {
          throw new Error(
            `prepare-skills: ablation "${ablation.id}" file "${targetFile}" not found in ${id} package`,
          )
        }
        const before = readFileSync(modulePath, "utf8")
        const { result, found } = removeHeadingSpan(before, heading)
        if (!found) {
          throw new Error(
            `prepare-skills: ablation "${ablation.id}" heading "## ${heading}" not found in ${id}/${targetFile}`,
          )
        }
        if (result === before) {
          throw new Error(
            `prepare-skills: ablation "${ablation.id}" is a silent no-op — ${targetFile} is byte-identical to baseline`,
          )
        }
        writeFileSync(modulePath, result)
      }
      note = ` [ablated: ${targetFile} ## ${heading}]`
    }

    writeFileSync(join(skillDest, "SKILL.md"), eveSkill)
    count++
    console.log(`  materialized ${id} <- ${rel}${note}`)
  }

  if (ablation && omitId === undefined) {
    // Ensure the target skill was actually in the map and processed.
    const targetRel = SKILLS[ablation.skillId]
    if (!targetRel) {
      throw new Error(`prepare-skills: ablation target skill "${ablation.skillId}" missing from SKILLS`)
    }
  }

  const mode = ablateId ? ` (ablate ${ablateId})` : omitId ? ` (omit ${omitId})` : ""
  console.log(`prepare-skills: ${count} skill package(s) into agent/skills/${mode}`)
}

if (import.meta.main) {
  materialize()
}
