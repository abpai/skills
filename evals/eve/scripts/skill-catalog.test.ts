import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EVE_SKILLS, SKILL_CATALOG } from "../skill-catalog";

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const publicSkills = readdirSync(repoRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) =>
    existsSync(join(repoRoot, name, "skills", name, "SKILL.md")),
  )
  .sort();

assert.deepEqual(
  Object.keys(SKILL_CATALOG).sort(),
  publicSkills,
  "every public skill must have exactly one eval-mode classification",
);

for (const [id, entry] of Object.entries(SKILL_CATALOG)) {
  assert.ok(entry.owner.trim(), `${id} must name its proof owner`);
  const skillPath = join(repoRoot, entry.source, "SKILL.md");
  assert.ok(existsSync(skillPath), `${id} source is missing: ${entry.source}`);
  assert.match(
    readFileSync(skillPath, "utf8"),
    /disable-model-invocation:\s*true/,
    `${id} must remain explicit-only`,
  );
  if (entry.mode === "eve") assert.equal(EVE_SKILLS[id], entry.source);
}

console.log(`Skill catalog covers ${publicSkills.length} public skills.`);
