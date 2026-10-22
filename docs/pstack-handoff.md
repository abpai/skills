# pstack handoff

## Goal and current state

Finish the general-purpose pstack plugin for Codex and Claude. Keep its text
short, concrete, and independent of Garage roles or a particular harness.

All 24 upstream principles have been considered. Version 0.4.1 routes `plan`,
`verify`, and `auto` from the umbrella, the only entrypoint (`/pstack <mode>`
in Claude, `$pstack <mode>` in Codex), and the router stops with usage on any
other mode. Implementation items 1-4 below are done. The hidden per-mode
wrappers were removed in `132d3f8e`; a `claude -p --plugin-dir` host check
routed all three modes with `pstack:pstack` as the only command.

`8c395a22` (0.4.1) repaired the round-4 friction: a mandatory mode-file read,
plans that settle decisions the evidence supports and cover every confirmed
cause, principle selection against the task before drafting, a narrower
"precedent" for Exhaust the design space with a recommendation in plan mode,
verify report sections for requirements, commands and attempted checks, and
principles plus checks in the auto report. The latest evidence is
[round 5](pstack-dogfood.md#pstack-041-friction-repair-and-rerun-8c395a22):

- Round 5 re-ran only the 7 cases that failed on Codex in round 4 (`p08`,
  `p10`, `p11`, `p12`, `v03`, `v07`, `v09`) on both hosts: Claude subagent
  4 of 7, Codex (`codex exec -m gpt-6-luna`, real skill copy) 2 of 7. The
  other 6 cases per host (`p01`, `p02`, `r13`, `v04`, `v05`, `a06`) passed in
  round 4 on 0.4.0 and were not re-run; `a06` was meant to check the new auto
  report and was not run.
- Eve iteration 5 on 0.4.1 (run on the contabo host): 22 of 22 (11/11,
  11/11); ablations unchanged from iteration 4.
- Round 4 at `d98be54b` (Claude 11 of 13, Codex 6 of 13) and earlier rounds
  are history for 0.4.0.

Keep the PR draft; merging or releasing requires a separate request.

Product status:

- **Claude:** static packaging validates; `/pstack <mode>` routes in
  `claude -p`. Interactive Claude was not run.
- **Codex:** static packaging validates; runtime use is verified for a
  repo-scoped real-directory skill copy under `codex exec` (`SKILL.md` comes
  from the `$pstack` mention). The native plugin install and interactive
  Codex were not run. Codex read the mode file in 5 of 7 round-5 runs; it
  still skipped `verify.md` in `v03` and `v09`.

Open (details in the dogfood record):

- Principle over-selection, introduced by the 0.4.1 repair: Claude `p08` (6),
  `p11` (7), `p12` (8) and Codex `p11` (6) exceed five, and Claude `p11`
  regressed from a pass. Task-based selection (`plan.md:12-13`) and the
  broadened Exhaust trigger have no cap (`principles.md:3-4`). The 0.4.1
  order (select, then draft) also departs from the preserved decision below
  that plan drafts first and then selects; decide which to keep.
- Codex still skips the mode file sometimes (`v03`, `v09`) and skips principle
  files it selected (`p11`, `v09`).
- Codex content gaps: `p10` (Script bulk operations, docs, CONTRIBUTING),
  `p11` (booleans, cached label, stored data), `v03` (a broken probe reported
  as evidence), `v07` (no partial run, incomplete needs list), `v09`
  (warm-cache artifact, no cold resolve).
- Not re-run at 0.4.1: `p01`, `p02`, `r13`, `v04`, `v05`, `a06` on both
  hosts, so the auto report change is unobserved. Required by the dogfood
  rule before 0.4.1 counts as ready.
- `pstack-verify-request-first`, `pstack-route-verify` and
  `pstack-plan-missing-state` ablations still survive.
- Carried over: Prioritize usability ignores unattended context; Type system
  discipline does not suggest adding a type check; Boundary discipline
  trigger too broad; Decisions scope loose; substitute-check scope
  unbounded; Make operations idempotent omits request-level keys; plan
  principle links resolve only inside the skill.

Key files:

- [Entry point](../pstack/skills/pstack/SKILL.md)
- [Plan](../pstack/skills/pstack/plan.md),
  [verify](../pstack/skills/pstack/verify.md), and
  [auto](../pstack/skills/pstack/auto.md)
- [Principle selection index](../pstack/skills/pstack/principles.md)
- [Approval ledger](pstack-approval-ledger.md)
- [Dogfood record](pstack-dogfood.md): 0.4.1 round 5 at the end; earlier
  sections are historical

## Preserve these decisions

- Principles stay shared reference files, not separate public skills.
- Plan researches first, drafts the smallest approach, then selects principles
  to refine it. Output only the refined plan, with implementation left flexible.
- Verify derives success criteria from the original request before consulting
  the plan. It reviews the actual implementation against relevant principles,
  runs checks, and reports evidence and actionable findings without editing.
- Auto plans, implements, verifies, and fixes findings within the task scope.
- Foundational Thinking was split among the plan and existing principles.
- Build the Lever became Script Bulk Operations; its scope still includes
  one-off verification tooling. Experience First became Prioritize Usability.
- Guard the Context Window and Never Block on the Human were excluded because
  they overlap with harness policy. Do not reintroduce their delegation,
  context-budget, or approval rules.
- Keep principle triggers narrow. Keep upstream insight, not unnecessary length.
- User requested drafting first and validation afterward. Drafting is now done;
  behavioral and packaging validation remain.

## Remaining implementation (done in 0.4.0)

1. Reconcile the ledger against the actual files and conversation. Fix Root
   Causes, Model the Domain, and Sequence Verifiable Units still have historical
   individual-review flags despite earlier drafting and the approved wording
   pass. The user explicitly wanted to skip redoing them. Record that accurately
   rather than inventing a fresh approval. Update the stale Foundational Thinking
   note now that concurrency and behavior-testing destinations are approved.
2. Check all retained principles are discoverable through the index, with useful
   triggers and valid relative links. Check for unresolved references and overlap.
3. Route `plan`, `verify`, and `auto` in the umbrella, accepting the existing
   optional `--` prefix. Update the argument hint and description. Preserve
   explicit-only policy. Per-mode wrappers were added, then removed: Claude
   does not register hidden wrappers as commands, so the umbrella is the only
   entrypoint.
4. Keep instructions in the shared modules; the umbrella only routes and
   passes inputs. Preserve current-task fallback and clear missing-input
   behavior.

The handoff preparation moved auto.md and verify.md from the plugin root into
the shared module directory so their existing relative links resolve. Their
approved text was unchanged.

## Behavioral validation and focused evals

Follow [the dogfood workflow](../harness/skills/harness/dogfood.md): real subagent
runs on representative tasks, transcript inspection, evidence-backed repairs,
and repeat runs after repairs. Deterministic packaging checks do not replace it.
Use isolated fixtures or checkouts. Do not modify live applications or contact
external services just to test the skill.

Use a small fixed set of realistic cases with pass/fail criteria decided before
the run:

| Case | What to observe |
| --- | --- |
| Plan a small bug fix | Relevant research and principles; short useful pointers; no implementation or unnecessary workflow. |
| Plan an internal API migration | Appropriate migration, sequencing, and final-state guidance; no needless compatibility layer. |
| Verify a change with a flawed supplied plan | Original request remains authoritative; the missed requirement is detected. |
| Verify a plausible but broken implementation | Concrete defect or principle violation detected with evidence, beyond compilation or self-report. |
| Verify a correct small change | No invented findings or demand to apply every principle. |
| Auto complete a bounded change with meaningful tests | Actual implementation, executed checks, repair of detected faults, and truthful completion report. |
| A required check cannot run | Reports the verification gap rather than claiming success. |

Observe routed invocation and current-task fallback as well as direct module
behavior. Verify Claude and Codex entrypoint compatibility; distinguish static
packaging evidence from actual runtime use in each product.

Record task, inputs, skill version/snapshot, transcript or output location,
checks executed, result, and `observation | evidence | suspected skill cause`.
Do not give the executing agent the seeded defects or expected answer. Repeat
cases with material friction after a minimal repair. Treat a small eval set as
focused evidence, not a broad reliability claim. No model comparison is required.

## Packaging and completion

Read [skill authoring](skill-authoring.md). The version is 0.4.1 (new relative
to `origin/main`). Update the public
metadata and applicable descriptions/docs, then run the repository lane:

```sh
scripts/sync-plugin-versions.sh
scripts/generate-versions.sh
scripts/validate-skills.sh
scripts/validate-npx-install.sh
git diff --check
bun scripts/skill-metadata.ts check-version-bump origin/main
```

The version-bump check only evaluates committed changes. Do not present
`Checked 0 plugin(s)` on a dirty tree as proof; report that limitation if no
commit is authorized. Preserve unrelated files and any existing worktrees.
If unrelated scratch trees interfere with checks, use a clean temporary copy.

Done means all three routes work, relevant principle selection and verification
behavior have been observed, skill-caused friction has been repaired and
rechecked, and packaging results are recorded at the final content snapshot.
Report separately what passed locally, what ran in each product, and anything
still unverified. Do not claim the plugin is ready from file checks alone.
