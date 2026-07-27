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
  | {
      readonly heading: string
      /**
       * Skill-package-relative file the heading lives in. Defaults to
       * "SKILL.md". Grouped workflow packs (code, engineering, harness) keep
       * almost every behavioral contract in a flat sibling module beside the
       * umbrella, so without this the harness cannot reach them at all.
       * Must stay inside the package: no absolute paths, no "..".
       */
      readonly file?: string
    }
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
    id: "code-prepare-pr-bright-lines",
    skillId: "code",
    span: { file: "prepare-pr.md", heading: "Two bright-line rules (read before any phase)" },
    guardedBy: ["contracts/code-prepare-pr-gate-fail-closed"],
    hypothesis:
      "Expected KILLED: this heading owns BRIGHT LINE 1 (gate before push). Under Codex there is no enforcing hook, so the model's own refusal to push unsealed is the only guard.",
  },
  {
    id: "code-simplify-scope-contract",
    skillId: "code",
    span: { file: "simplify.md", heading: "Scope contract" },
    guardedBy: ["contracts/code-simplify-proposal-no-edits"],
    hypothesis:
      "Expected KILLED: Scope contract is the only place drawing the scoped-execution vs whole-repository-proposal line and stating 'do not edit code until the user selects or approves a batch.'",
  },
  {
    id: "code-simplify-review-passes",
    skillId: "code",
    span: { file: "simplify.md", heading: "Review passes" },
    guardedBy: ["contracts/code-simplify-protects-load-bearing-tests"],
    hypothesis:
      "Expected KILLED: pass #7 Test signal is the only place naming the protected test categories. Coarse span — heading granularity cuts all seven passes together, so a KILLED here confirms the section is load-bearing without isolating pass #7.",
  },
  {
    id: "engineering-tdd-anti-horizontal-slices",
    skillId: "engineering",
    span: { file: "tdd.md", heading: "Anti-Pattern: Horizontal Slices" },
    guardedBy: ["contracts/engineering-tdd-vertical-slices"],
    hypothesis:
      "Expected KILLED: the only place forbidding batched tests before implementation. Workflow describes a single RED/GREEN cycle in isolation and does not forbid batching.",
  },
  {
    id: "engineering-complexity-report-rules",
    skillId: "engineering",
    span: { file: "complexity-report.md", heading: "Report Rules" },
    guardedBy: ["contracts/engineering-complexity-report-read-only"],
    hypothesis:
      "Expected KILLED: Report Rules carries 'end report-only work with a clear statement that no files were modified.' Note the lead-in 'Default to read-only' sentence sits above any heading, so this span does not cover it.",
  },
  {
    id: "engineering-reduce-step2-delete-gate",
    skillId: "engineering",
    span: { file: "reduce.md", heading: "Step 2 — Delete the task ⟨GATE · debate⟩" },
    guardedBy: ["contracts/engineering-reduce-gate-before-cutting"],
    hypothesis:
      "Expected KILLED: the only section instructing outright deletion and a stop for sign-off before continuing. Ablating it should soften deletions to rewordings, or run straight through Steps 3-5.",
  },
  {
    id: "harness-doctor-loop-readiness-verdict",
    skillId: "harness",
    span: { file: "doctor.md", heading: "Loop-readiness verdict" },
    guardedBy: ["contracts/harness-d7-safety-cap"],
    hypothesis:
      "Expected KILLED: owns the D7 safety cap and the verdict-tier derivation. Ablating it removes the only rule stopping a high D1-D6 average from rounding up to autonomous-ready over a real secrets/blast-radius gap.",
  },
  {
    id: "harness-doctor-scanner-unavailable",
    skillId: "harness",
    span: { file: "doctor.md", heading: "Scanner unavailable" },
    guardedBy: ["contracts/harness-scanner-unavailable-mechanical-first"],
    hypothesis:
      "Expected KILLED: the only rule against hand-deriving D5/D6 when the CLI cannot run. Without it the model likely scores those dimensions from the user's own description instead of marking them unreviewed and the score provisional.",
  },
  {
    id: "harness-onboard-verdict-gate",
    skillId: "harness",
    span: { file: "onboard.md", heading: "3. Apply the verdict gate" },
    guardedBy: ["contracts/harness-onboard-verdict-gate"],
    hypothesis:
      "Expected KILLED: removes the 'only when earned' rule for autonomous-ready, so the model is likelier to hand-write a readiness manifest under time pressure with no audit behind it.",
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
