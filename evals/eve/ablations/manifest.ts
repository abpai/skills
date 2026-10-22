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
        "Read the original request, such as the task or a pull request's\n   description and linked issue, and identify what success requires. If a\n   plan is supplied, read it only after that. Then ",
        "The original request is the source of requirements; a plan may be wrong.\n",
      ],
    },
    guardedBy: ["pstack/verify-flawed-plan"],
    hypothesis:
      "Expected KILLED: these two sentences are the only place telling verify to derive success from the original request rather than the supplied plan, which omits the --since filter the request asked for. MEASURED 2026-10-21 (gpt-6-luna, --runs 2): SURVIVED 2/2; the control with pstack omitted missed --since, so the skill matters but this eval does not isolate these sentences (the prompt itself names --since). Iteration 2 (pstack at 221737ac, --runs 2): SURVIVED 2/2 again. Iteration 3 (fdc6b1eb, --runs 2): SURVIVED 2/2. Iteration 4 (d98be54b, after the wrapper removal, --runs 2): SURVIVED 2/2. Iteration 5 (pstack 0.4.1 at 0ad0de4f, --runs 2): SURVIVED 2/2. Re-spanned for pstack 0.4.2 (plan now optional; request may come from a pull request). Iteration 6 (pstack 0.4.3 at 89b0f999, --runs 2): SURVIVED 2/2 on the re-spanned text; the control with pstack omitted failed again.",
  },
  {
    id: "pstack-plan-principle-links",
    skillId: "pstack",
    span: {
      file: "plan.md",
      text: [
        "Select from [principles.md](principles.md) the principles whose triggers\n   match the task, its findings, or the draft. Read their files, use them to\n   challenge the draft, and revise it. Remove unnecessary steps.\n5. ",
        "- Selected principle names, each linked as `principles/<file>.md` relative to\n  this skill, with a short reason.\n",
      ],
    },
    guardedBy: ["pstack/plan-attack-premise", "pstack/plan-dashed-migration"],
    hypothesis:
      "Expected KILLED: without the selection step and the output bullet, plan has no instruction to read principles.md, pick principles, or link their files. MEASURED 2026-10-21 (gpt-6-luna, --runs 2): KILLED 2/2 on both evals (no principles.md read, no links, Attack the premise / Migrate callers not selected). Iteration 2 (221737ac, output bullet re-spanned to the new wording): KILLED 2/2 again. Iteration 3 (fdc6b1eb, --runs 2): KILLED 2/2. Iteration 4 (d98be54b, --runs 2): KILLED 2/2. Selection step re-spanned for pstack 0.4.1 (selection now matches task, findings and open decisions, before the draft step). Iteration 5 (pstack 0.4.1 at 0ad0de4f, --runs 2): KILLED 2/2 on the re-spanned text. Selection step re-spanned again for pstack 0.4.2 (selection after a rough draft, then a recheck). Iteration 6 (pstack 0.4.3 at 89b0f999, --runs 2): ERROR, no verdict: the unmutated baseline was red because plan-attack-premise did not select Attack the premise (it also selected Exhaust the design space and more than five principles). The same eval was red in both full runs at that snapshot, so the re-spanned text is still unmeasured.",
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
      "Expected KILLED: with no verify route, `pstack verify ...` is an unsupported mode, so verify.md should not load and the review should not run. MEASURED 2026-10-21 (gpt-6-luna, --runs 2): SURVIVED 2/2 — the model still found verify.md from the usage line and the other `verify` mentions, so the bullet alone is redundant for routing (control with pstack omitted failed). Iteration 2 (221737ac, --runs 2): SURVIVED 2/2 again, even with the explicit not-exactly-plan|verify|auto stop rule. Iteration 3 (fdc6b1eb, --runs 2): SURVIVED 2/2. Iteration 4 (d98be54b, --runs 2): SURVIVED 2/2. Iteration 5 (pstack 0.4.1 at 0ad0de4f, --runs 2): SURVIVED 2/2. Iteration 6 (pstack 0.4.3 at 89b0f999, after the shorter mode-file routing sentence, --runs 2): SURVIVED 2/2; control failed.",
  },
  {
    id: "pstack-route-unsupported-stop",
    skillId: "pstack",
    span: {
      text: [
        " If it is not exactly `plan`, `verify`, or `auto`,\nshow `pstack plan|verify|auto [task]` and stop; do not map synonyms such as\n`review`.",
      ],
    },
    guardedBy: ["pstack/route-unsupported-mode"],
    hypothesis:
      "Expected KILLED: this sentence (added in 221737ac) is the only unsupported-mode rule left in SKILL.md; without it `pstack review ...` has nothing telling the model to show usage instead of reviewing. MEASURED 2026-10-21 (gpt-6-luna, --runs 2): KILLED 2/2 (read verify.md, no usage line, read principle files); unmutated baseline green. Iteration 3 (fdc6b1eb, --runs 2): KILLED 2/2. Iteration 4 (d98be54b, --runs 2): KILLED 2/2. Iteration 5 (pstack 0.4.1 at 0ad0de4f, --runs 2): KILLED 2/2. Iteration 6 (pstack 0.4.3 at 89b0f999, --runs 2): KILLED 2/2 (no usage line, verify.md loaded).",
  },
  {
    id: "pstack-plan-missing-state",
    skillId: "pstack",
    span: {
      file: "plan.md",
      text: [
        ", including state the approach depends on that the code does not keep\n   yet",
      ],
    },
    guardedBy: ["pstack/plan-design-space"],
    hypothesis:
      "Expected KILLED: the clause (added in 221737ac) is the only prompt to surface state the code does not keep yet, which plan-design-space checks as the missing base/last-synced state. MEASURED 2026-10-21 (gpt-6-luna, --runs 2): KILLED 2/2, but only one kill was on this behavior (missing base state + Exhaust not selected); the other failed only Prioritize usability, which this clause does not touch. Treat as 1 clean kill, not 2. Iteration 3 (fdc6b1eb, --runs 2): SURVIVED 2/2: the model named the missing base state without this clause (possibly because 9fb7f086 asks plan pointers for findings and assumptions), so the clause is no longer measurably guarded. Iteration 4 (d98be54b, --runs 2): SURVIVED 2/2 again. Iteration 5 (pstack 0.4.1 at 0ad0de4f, --runs 2): SURVIVED 2/2 again. Iteration 6 (pstack 0.4.3 at 89b0f999, --runs 2): FLAKY, KILLED 1/2 and SURVIVED 1/2. The kill was on this behavior (the plan did not name the missing last-synced/base state), the first since iterations 3-5 survived; one run is not a verdict.",
  },
  {
    id: "omit-codex-session",
    skillId: "codex-session",
    retirement: ["safety/codex-session-injection"],
    hypothesis:
      "Expected KILLED under --omit: the injection/inert-data contract is load-bearing; omitting the skill should fail the outcome-only safety eval (not a retirement candidate).",
  },
]
