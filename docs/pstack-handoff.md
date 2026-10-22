# pstack handoff

## Goal and current state

Finish the general-purpose pstack plugin for Codex and Claude. Keep its text
short, concrete, and independent of Garage roles or a particular harness.

All 24 upstream principles have been considered. Version 0.4.0 routes `plan`,
`verify`, and `auto` from the umbrella, the only entrypoint (`/pstack <mode>`
in Claude, `$pstack <mode>` in Codex), and the router stops with usage on any
other mode. Implementation items 1-4 below are done.
A `claude -p` host smoke and two live Eve iterations (at `221737ac`) are
recorded in [the dogfood record](pstack-dogfood.md#pstack-040-plan-verify-and-auto).
The first dogfood round there is superseded by the
[corrected round](pstack-dogfood.md#pstack-040-corrected-dogfood-round), which
started from rebuilt fixtures. Its r1 ran at `9abb72f6`, the repair landed in
`9fb7f086` (skill text only, still 0.4.0), and r2 re-ran the ten affected
cases. Graded Claude subagent runs passed 7 of 10 in r1 and 4 of 5 in r2. All
graded Codex runs failed (0 of 9, then 0 of 5), because Codex did not load the
skill. A second repair, `fdc6b1eb` (`verify.md` only, still 0.4.0), gave the
verify report a Decisions section and fixed the `v05` regression: r3 on a
`claude -p` host passed `v05` and failed `v07` on one criterion, and Eve
iteration 3 at `fdc6b1eb` passed 21 of 22. Codex runtime behavior is
unverified by the user's decision to skip it for now. Keep the PR draft;
merging or releasing requires a separate request.

Unverified and open (details in the dogfood record):

- **Codex: unverified** (skipped for now by the user). The dogfood harness
  never loaded pstack: `.agents/skills` symlinks were ignored even with
  `$pstack`, and 1 of 23 transcripts read `SKILL.md`. Static packaging passes
  validation. Next: real skill dirs or the native plugin install, confirm the
  skill load, re-run the graded cases.
- `v07` (r3): stopped at the failed `make test` and never ran the runnable
  part of the suite to report `OK (skipped=5)`. `verify.md:15-16` has no
  "run what can run; skipped is not passed" clause. Cause not proven, since r2
  passed on another host.
- `v03`, `v04` and `v09` were not re-dogfooded after `fdc6b1eb`; only Eve's
  verify evals cover defect detection there.
- Decisions scope is loose: `v05` r3 put an already-guarded collision there.
- The Boundary discipline trigger is too broad (padding in `v05` r2 and r3).
- `plan-design-space` missed Exhaust the design space once in Eve iteration
  3, and the `pstack-plan-missing-state` ablation now survives, so no eval
  guards that clause.
- Plan principle links show paths and resolve only inside the skill.
- Substitute-check scope is unbounded.
- Some r1/r2 grades were not recorded.
- The hidden `plan`/`verify`/`auto` wrappers were removed because
  `/pstack:verify` was a silent no-op in `claude -p`; `/pstack <mode>` routes
  all three on a `claude -p` host. Interactive Claude was not run.

Key files:

- [Entry point](../pstack/skills/pstack/SKILL.md)
- [Plan](../pstack/skills/pstack/plan.md),
  [verify](../pstack/skills/pstack/verify.md), and
  [auto](../pstack/skills/pstack/auto.md)
- [Principle selection index](../pstack/skills/pstack/principles.md)
- [Approval ledger](pstack-approval-ledger.md)
- [Dogfood record](pstack-dogfood.md): 0.4.0 runs at the end; earlier
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

Read [skill authoring](skill-authoring.md). The version is 0.4.0 (new relative
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
