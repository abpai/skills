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
  | {
      /**
       * Exact passages to remove; each must occur exactly once in `file`
       * (default "SKILL.md"). For short flat modules with no `##` heading to
       * cut (pstack's plan.md / verify.md / auto.md), where one sentence is
       * the contract.
       */
      readonly text: readonly string[]
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
    span: {
      file: "prepare-pr.md",
      heading: "Two bright-line rules (read before any phase)",
    },
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
    guardedBy: [
      "contracts/code-simplify-protects-load-bearing-tests",
      "outcomes/code-simplify-preserves-behavior",
    ],
    hypothesis:
      "Expected KILLED: pass #7 Test signal is the only place naming the protected test categories. Coarse span — heading granularity cuts all seven passes together, so a KILLED here confirms the section is load-bearing without isolating pass #7. The outcome eval is the stronger half of this pair: the contract eval can only show the model stopped reciting the rubric, while the outcome eval shows whether code it actually simplified still behaves correctly.",
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
    span: {
      file: "reduce.md",
      heading: "Step 2 — Delete the task ⟨GATE · debate⟩",
    },
    guardedBy: ["contracts/engineering-reduce-gate-before-cutting"],
    hypothesis:
      "Expected KILLED: the only section instructing outright deletion and a stop for sign-off before continuing. Ablating it should soften deletions to rewordings, or run straight through Steps 3-5.",
  },
  {
    id: "harness-adopt-workflow",
    skillId: "harness",
    span: { file: "adopt.md", heading: "Workflow" },
    guardedBy: [
      "contracts/harness-adopt-lifecycle",
      "contracts/harness-adopt-assess-readonly",
    ],
    hypothesis:
      "Expected KILLED: removes the ordered adoption lifecycle, including the human baseline gate and final Doctor handoff.",
  },
  {
    id: "harness-doctor-safety-blockers",
    skillId: "harness",
    span: { file: "doctor.md", heading: "Safety blockers" },
    guardedBy: ["contracts/harness-safety-blocker"],
    hypothesis:
      "Expected KILLED: removes the rule that exposed secrets and ambient production-write credentials remain blockers even when validation passes.",
  },
  {
    id: "harness-doctor-scanner-unavailable",
    skillId: "harness",
    span: { file: "doctor.md", heading: "Scanner unavailable" },
    guardedBy: ["contracts/harness-scanner-unavailable"],
    hypothesis:
      "Expected KILLED: removes the rule against replacing unavailable deterministic scanner coverage with manual confidence.",
  },
  {
    id: "harness-readiness-evidence",
    skillId: "harness",
    span: { file: "INTERFACES.md", heading: "Readiness result" },
    guardedBy: ["contracts/harness-readiness-evidence"],
    hypothesis:
      "Expected KILLED: removes the facts/unknowns/blockers boundary and its prohibition on invented scores or autonomous-ready assertions.",
  },
  {
    id: "pstack-verify-request-first",
    skillId: "pstack",
    span: {
      file: "verify.md",
      text: [
        "Read the original request and identify what success requires before reading\n   the plan. Then ",
        "The original request is the source of requirements; the plan may be wrong.\n",
      ],
    },
    guardedBy: ["pstack/verify-flawed-plan"],
    hypothesis:
      "Expected KILLED: these two sentences are the only place telling verify to derive success from the original request rather than the supplied plan, which omits the --since filter the request asked for. MEASURED 2026-10-21 (gpt-6-luna, --runs 2): SURVIVED 2/2; the control with pstack omitted missed --since, so the skill matters but this eval does not isolate these sentences (the prompt itself names --since).",
  },
  {
    id: "pstack-plan-principle-links",
    skillId: "pstack",
    span: {
      file: "plan.md",
      text: [
        "Select from [principles.md](principles.md) only the principles relevant to\n   the draft. Read their files and use them to challenge and reshape it.\n   ",
        "- Selected principle names with file links and a short reason for each.\n",
      ],
    },
    guardedBy: ["pstack/plan-attack-premise", "pstack/plan-dashed-migration"],
    hypothesis:
      "Expected KILLED: without the selection step and the output bullet, plan has no instruction to read principles.md, pick principles, or link their files. MEASURED 2026-10-21 (gpt-6-luna, --runs 2): KILLED 2/2 on both evals (no principles.md read, no links, Attack the premise / Migrate callers not selected).",
  },
  {
    id: "pstack-route-verify",
    skillId: "pstack",
    span: {
      text: [
        "- `verify` → [verify.md](verify.md): the original request and the\n  implementation to inspect, such as a diff, branch, files, or current changes.\n",
      ],
    },
    guardedBy: ["pstack/verify-broken-impl", "pstack/verify-check-cannot-run"],
    hypothesis:
      "Expected KILLED: with no verify route, `pstack verify ...` is an unsupported mode, so verify.md should not load and the review should not run. MEASURED 2026-10-21 (gpt-6-luna, --runs 2): SURVIVED 2/2 — the model still found verify.md from the usage line and the other `verify` mentions, so the bullet alone is redundant for routing (control with pstack omitted failed).",
  },
  {
    id: "omit-codex-session",
    skillId: "codex-session",
    retirement: ["safety/codex-session-injection"],
    hypothesis:
      "Expected KILLED under --omit: the injection/inert-data contract is load-bearing; omitting the skill should fail the outcome-only safety eval (not a retirement candidate).",
  },
]
