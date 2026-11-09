export type EvalMode = "eve" | "deterministic" | "host" | "browser";

export type SkillCatalogEntry = {
  readonly source: string;
  readonly mode: EvalMode;
  readonly owner: string;
};

/** Every public marketplace skill must name its proof surface here. */
export const SKILL_CATALOG = {
  antigravity: {
    source: "antigravity/skills/antigravity",
    mode: "host",
    owner: "wrapper parity, fake CLI, and live dogfood",
  },
  claude: {
    source: "claude/skills/claude",
    mode: "eve",
    owner: "Eve plus fake CLI",
  },
  "cli-design-expert": {
    source: "cli-design-expert/skills/cli-design-expert",
    mode: "deterministic",
    owner: "fixture CLI outcomes",
  },
  code: {
    source: "code/skills/code",
    mode: "eve",
    owner: "Eve plus host parity",
  },
  "codex-exec": {
    source: "codex-exec/skills/codex-exec",
    mode: "host",
    owner: "wrapper parity and fake CLI",
  },
  cursor: {
    source: "cursor/skills/cursor",
    mode: "host",
    owner: "wrapper parity and fake CLI",
  },
  distill: { source: "distill/skills/distill", mode: "eve", owner: "Eve" },
  engineering: {
    source: "engineering/skills/engineering",
    mode: "eve",
    owner: "Eve plus host parity",
  },
  harness: {
    source: "harness/skills/harness",
    mode: "eve",
    owner: "Eve plus host parity",
  },
  "hexagon-audit": {
    source: "hexagon-audit/skills/hexagon-audit",
    mode: "eve",
    owner: "Eve",
  },
  "lateral-thinking": {
    source: "lateral-thinking/skills/lateral-thinking",
    mode: "eve",
    owner: "Eve",
  },
  pstack: {
    source: "pstack/skills/pstack",
    mode: "eve",
    owner: "Eve plus subagent/Codex dogfood",
  },
  "show-me": {
    source: "show-me/skills/show-me",
    mode: "eve",
    owner: "Eve plus subagent dogfood",
  },
  tutorial: {
    source: "tutorial/skills/tutorial",
    mode: "eve",
    owner: "Eve plus blank-environment outcome",
  },
  "visual-pr": {
    source: "visual-pr/skills/visual-pr",
    mode: "host",
    owner: "live gh dogfood",
  },
  visualize: {
    source: "visualize/skills/visualize",
    mode: "browser",
    owner: "browser rendering and accessibility",
  },
  yo: {
    source: "yo/skills/yo",
    mode: "host",
    owner: "subagent dogfood of the router",
  },
} as const satisfies Record<string, SkillCatalogEntry>;

export const EVE_SKILLS = Object.fromEntries(
  Object.entries(SKILL_CATALOG)
    .filter(([, entry]) => entry.mode === "eve")
    .map(([id, entry]) => [id, entry.source]),
) as Record<string, string>;
