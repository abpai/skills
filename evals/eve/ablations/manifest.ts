/**
 * External ablation manifest for the Eve skill eval lane.
 *
 * Published skill sources stay clean — mutations live here and are applied at
 * prepare-skills time (`--ablate` / `--omit`). Keep this list small: each entry
 * is a full materialize + live-eval cycle.
 *
 * Classification (see scripts/ablate.ts):
 *   SURVIVED — all guarded/retirement evals still pass → directive may be a
 *              no-op (cut candidate) or uncovered (write a covering eval);
 *              for --omit, the skill is a retirement candidate.
 *   KILLED   — an eval fails → directive/skill is load-bearing and now
 *              regression-guarded.
 */

export type AblationSpan =
  | { readonly heading: string }
  /** Reserved for future line-granularity cuts — not implemented yet. */
  | { readonly lines: readonly [number, number] }

export type Ablation = {
  readonly id: string
  readonly skillId: string
  /**
   * Heading (or future line) span to remove under `--ablate <id>`.
   * Omit for retirement-only entries that run under `--omit <skillId>`.
   */
  readonly span?: AblationSpan
  /** Eval ids that should detect this heading ablation (may include loadedSkill gates). */
  readonly guardedBy?: readonly string[]
  /**
   * Outcome-only eval ids for `--omit` retirement checks. MUST NOT assert
   * `loadedSkill` — that gate fails mechanically when the skill is absent and
   * would be misread as "skill still needed."
   */
  readonly retirement?: readonly string[]
  /** Author's guess about the expected outcome. */
  readonly hypothesis: string
}

export const ABLATIONS: readonly Ablation[] = [
  {
    id: "code-subcommand-invocation",
    skillId: "code",
    span: { heading: "Subcommand invocation" },
    guardedBy: ["code/removed-command-migration", "code/argument-form-equivalence"],
    hypothesis:
      "Expected KILLED: Subcommand invocation owns -- stripping, removed-token migration, and the primary router contract — ablating it should break routing evals.",
  },
  {
    id: "hexagon-layout-notes",
    skillId: "hexagon-audit",
    span: { heading: "Layout Notes" },
    guardedBy: ["contracts/hexagon-not-applicable"],
    hypothesis:
      "Candidate SURVIVED / no-op: Layout Notes is advisory monorepo lore; the not-applicable contract lives in Process. If this survives, cut or demote the section.",
  },
  {
    id: "omit-codex-session",
    skillId: "codex-session",
    retirement: ["safety/codex-session-injection"],
    hypothesis:
      "Expected KILLED under --omit: the injection/inert-data contract is load-bearing; omitting the skill should fail the outcome-only safety eval (not a retirement candidate).",
  },
]
