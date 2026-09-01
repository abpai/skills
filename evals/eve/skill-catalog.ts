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
  "bun-expert": {
    source: "bun-expert/skills/bun-expert",
    mode: "deterministic",
    owner: "fixture command outcomes",
  },
  "ci-efficiency": {
    source: "ci-efficiency/skills/ci-efficiency",
    mode: "host",
    owner: "live dogfood and repository validation",
  },
  "claude-session": {
    source: "claude-session/skills/claude-session",
    mode: "eve",
    owner: "Eve",
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
  "codex-session": {
    source: "codex-session/skills/codex-session",
    mode: "eve",
    owner: "Eve",
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
  "human-writer": {
    source: "human-writer/skills/human-writer",
    mode: "eve",
    owner: "Eve retirement test",
  },
  "improve-prompt": {
    source: "improve-prompt/skills/improve-prompt",
    mode: "eve",
    owner: "Eve retirement test",
  },
  "lateral-thinking": {
    source: "lateral-thinking/skills/lateral-thinking",
    mode: "eve",
    owner: "Eve",
  },
  "status-update": {
    source: "status-update/skills/status-update",
    mode: "eve",
    owner: "Eve",
  },
  tutorial: {
    source: "tutorial/skills/tutorial",
    mode: "eve",
    owner: "Eve plus blank-environment outcome",
  },
  visualize: {
    source: "visualize/skills/visualize",
    mode: "browser",
    owner: "browser rendering and accessibility",
  },
} as const satisfies Record<string, SkillCatalogEntry>;

export const EVE_SKILLS = Object.fromEntries(
  Object.entries(SKILL_CATALOG)
    .filter(([, entry]) => entry.mode === "eve")
    .map(([id, entry]) => [id, entry.source]),
) as Record<string, string>;
