# pstack handoff

## Goal and current state

Finish the general-purpose pstack plugin for Codex and Claude. Keep its text
short, concrete, and independent of Garage roles or a particular harness.

All 24 upstream principles have been considered. Version 0.4.4 routes `plan`,
`verify`, and `auto` from the umbrella, the only entrypoint (`/pstack <mode>`
in Claude, `$pstack <mode>` in Codex), and the router stops with usage on any
other mode. Implementation items 1-4 below are done. The hidden per-mode
wrappers were removed in `132d3f8e`; a `claude -p --plugin-dir` host check
routed all three modes with `pstack:pstack` as the only command.

`7ad0641a` (0.4.2) returned plan to the preserved order below (rough draft,
then select principles, then recheck and drop), added an options comparison
for unprecedented decisions before the draft, capped selection at five,
rewrote 12 trigger rows, let verify start from a pull request description
with no plan, and applied four prompt-audit hunks. `89b0f999` (0.4.3) applied
the held audit hunk that shortens the `SKILL.md` mode-file sentence.
`09fa61c8` (0.4.4) compares options only for a still-open decision that
nothing settles (no inline Exhaust link), replaces the five-principle cap with
a short-list rule, and keeps plan pointers to behavior and structure. The
skill text has not changed since.

Latest evidence ([dogfood record](pstack-dogfood.md#current-state-at-044)):

- **Round 7, Claude subagent, 0.4.4:** the 6 plan cases twice each. Exhaust
  appeared only in `p12`, all 12 plans were judged reasonable, every plan was
  shorter than in round 6, and 6 of 12 passed the strict criteria (the rest
  are the accepted recheck drops, one 7-principle list, and one `p08` keeping
  the delete).
- **Round 8, Claude subagent, 0.4.4:** the 7 non-plan cases (`v03`, `v04`,
  `v05`, `v07`, `v09`, `a06`, `r13`) once each: **7 of 7** pass and
  reasonable, the same as round 6, with no padding (round 6: one in `v05`).
  `v07` passed every criterion in full for the first time.
- **Eve iteration 7, 0.4.4** (contabo host, `gpt-6-luna`, one full run):
  **11 of 12** (iteration 6: 10/12 and 9/12). `plan-attack-premise` selected
  Attack the premise for the first time; the one red is `plan-design-space`
  selecting 6 principles against the eval's at-most-5 gate.
- **Round 6, both hosts, 0.4.2** is the latest Codex evidence: Claude
  subagent 10 of 13, Codex `gpt-6.1-sol` 12 of 13 (fails `p11`). Rounds 4
  and 5 used `gpt-6-luna`, so the Codex gain mixes a model change with the
  skill change.

The user accepted Claude-only evidence for 0.4.4. The dogfood harness
(scenarios, fixture builders, grading notes, Codex runner) is in
`evals/pstack-dogfood/`, and a fresh build reproduces all 12 fixtures. The
dogfood record is now a short summary; the full round-by-round history is in
the pull request description and in git history at `c208f986`.

Keep the PR draft; merging or releasing requires a separate request.

Product status:

- **Claude:** static packaging validates; `/pstack <mode>` routes in
  `claude -p` (checked at 0.4.0); the subagent's process log shows `SKILL.md`
  and then the mode file in every round-7 and round-8 mode run. Interactive
  Claude was not run.
- **Codex:** static packaging validates; runtime use is verified for a
  repo-scoped real-directory skill copy under `codex exec` (`SKILL.md` comes
  from the `$pstack` mention). `gpt-6.1-sol` read the mode file as its first
  command in all 12 round-6 mode runs, and none for the unsupported mode. Not
  rerun at 0.4.3 or 0.4.4. The native plugin install and interactive Codex
  were not run.

Open (details in the dogfood record):

- **Principle-count gate (decided):** 0.4.4 has no numeric cap, but four Eve
  evals keep `atMostPrinciples(5)` and the dogfood grading README keeps its
  more-than-five rule, as a padding heuristic. A red like iteration 7's
  `plan-design-space` (6 listed, two only restating its check step) is
  accepted when the plan is otherwise reasonable. Do not add a numeric cap
  back to the skill to make the gate pass.
- **Not rerun at 0.4.4:** Codex (any case), `claude -p` routing, and the
  ablations (last at 0.4.3: `pstack-verify-request-first` and
  `pstack-route-verify` survive, `pstack-plan-missing-state` is flaky,
  `pstack-plan-principle-links` is unmeasured).
- **Accepted:** the plan recheck dropping a should-select principle the draft
  already follows.
- `p08`: the confirmed cause at `bin/mirror-sync-one:11` (the unconditional
  delete) is still not always paired with a decision that resolves it.
- Minor verify-text frictions from round 8: every Decision gets options
  (0.4.4 changed that only in plan); a Decision can come from a plan's goal;
  non-blocking notes are always present; probes are "temporary" while Prove
  it works asks for repeatable checks; substitute-check installs need not be
  reported; the reworded Exhaust trigger matches verify product choices.
- Carried from round 6, not rechecked at 0.4.4: the auto report does not ask
  for behavior changes (Codex `a06`); Codex `v05` Boundary discipline
  padding; Type system discipline assumes a type checker; Minimize reader
  load unselected in `p11`; plan principle links resolve only inside the
  skill; planning-time probes are left behind.
- Verify from a pull request alone is covered only by Eve `verify-pr-only`.
- `evals/pstack-dogfood/README.md` ("Record results") still says to add each
  round to the dogfood record in full; it should match the short format.

Key files:

- [Entry point](../pstack/skills/pstack/SKILL.md)
- [Plan](../pstack/skills/pstack/plan.md),
  [verify](../pstack/skills/pstack/verify.md), and
  [auto](../pstack/skills/pstack/auto.md)
- [Principle selection index](../pstack/skills/pstack/principles.md)
- [Approval ledger](pstack-approval-ledger.md)
- [Dogfood record](pstack-dogfood.md): current state at 0.4.4, the rounds
  table, round 8 and Eve iteration 7; the full history is in the PR and at
  `c208f986`
- [Dogfood harness](../evals/pstack-dogfood/README.md): scenarios, fixture
  builders, grading notes and the Codex runner
- [Prompt audit](pstack-prompt-audit.md): the 0.4.2 audit and which hunks
  were applied

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

Read [skill authoring](skill-authoring.md). The version is 0.4.4 (new relative
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
