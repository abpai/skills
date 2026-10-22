# pstack 0.1.0 dogfood

Scope: the first `poteto-mode`, its shared module, and the Claude/Codex entrypoints.
Source inspiration: open-pstack at `9046eecb4ec4461374b1fd8cda7bd60abbaa6d9e`.
The upstream MIT notice is retained in `pstack/LICENSE`.

## Behavioral passes

All passes used real subagents on read-only repository tasks. No provider CLI
or installed Claude session was used; these are Codex subagent receipts.

| Pass | Task and evidence | Observation and suspected cause | Resolution |
| --- | --- | --- | --- |
| `dogfood_plan` | Apply the initial mode to planning a future principle addition; inspect the actual metadata and validation code. Direct validation rejected the standalone `poteto-mode` entrypoint. | Packaging mismatch: this repository classifies non-umbrella entries as internal commands. No friction in the mode instructions. | Use a public `pstack` umbrella, a shared `poteto-mode.md` module, and an internal namespaced wrapper. No shared validator changes. |
| `dogfood_routed` | Apply the repaired umbrella with `--poteto-mode` to investigate installer error handling. The agent read the shell script, ran `bash -n`, and exercised five mocked installer outcomes. | No routing or mode friction. It distinguished an offline skip from discovery failure and found a diagnostic limitation in the existing installer script. | Clean pass. The installer finding is outside this chunk and was not patched. |
| `dogfood_wrapper` | Apply the repaired wrapper to investigate version-gate coverage for uncommitted work. The agent ran the gate and observed `Checked 0 plugin(s)`, then traced the committed-diff/current-filesystem behavior. | No wrapper or mode friction. It identified the check's limited coverage and proposed an isolated committed candidate. | Clean pass. The parent subsequently tested the candidate in a temporary clone and observed `Checked 1 plugin(s)` with `pstack: new -> 0.1.0`. |

Two consecutive passes through the repaired entrypoints reported no skill-caused
friction. Their scope was read-only planning and investigation, not code-writing
behavior or live Claude runtime integration.

## Packaging proof

- Version synchronization and generation completed with `pstack` at `0.1.0`.
- `scripts/validate-skills.sh` reported `Validation passed.` The default Python
  lacked PyYAML; a separate run of `scripts/validate_skills.py` with the existing
  pre-commit Python environment passed with PyYAML 6.0.3.
- `scripts/validate-npx-install.sh` skipped because the npm registry could not
  resolve. The cached real `skills` CLI 1.7.2 discovered the public `pstack`
  entrypoint and, with `INSTALL_INTERNAL_SKILLS=1`, the `poteto-mode` wrapper.
  Both were discovery-only runs.
- The version gate passed for one new plugin in an isolated temporary clone
  containing a commit of the candidate. The user's working tree was not
  committed. `git diff --check` passed.

# pstack 0.2.0 plan

Replaces the initial mode with `plan`. Four condensed principles are adapted
from the same pinned open-pstack source: laziness protocol, model the domain,
fix root causes, and sequence verifiable units. The plan's short, selective
structure follows the linked writing-for-agents guidance; there is no runtime
dependency on that external skill.

| Pass | Evidence | Observation and suspected cause |
| --- | --- | --- |
| `plan_dogfood_bug` | Public `plan` route; real installer-diagnostics task. Reproduced early exits with local fixtures and returned three pointers plus two selected principles. | No skill-caused friction. Research informed the plan; no implementation edits. |
| `plan_dogfood_feature` | Namespaced wrapper; plan for a future general-purpose verification mode. Returned four pointers plus three selected principles. | No skill-caused friction. Reused the catalog, preserved host boundaries, and stopped at the plan. |

Both fresh subagents completed unaided. Their plans were reviewed for source
grounding, selective principle use, brevity, and implementation overreach.
Neither pass required a repair. These are Codex behavioral checks, not a live
Claude installation test.

Validation: the full repository lane passed in a clean temporary checkout of
the candidate, excluding unrelated local worktrees. Strict YAML validation
also passed with the existing PyYAML environment. Cached `skills` 1.7.2
discovered the public entrypoint and internal plan wrapper; the online npx
lane skipped on unavailable registry access. The bundled generic quick
validator rejects this repo's required `argument-hint` and
`disable-model-invocation` fields, so the repository validator is authoritative.
The isolated committed-candidate version gate checked one plugin at `0.2.0`;
the working checkout remains uncommitted. `git diff --check` passed.

# pstack 0.2.1 wording

Replaced role-specific wording with “implementation plan” across instructions
and public descriptions. `plan_neutral_wording` used the revised skill on the
installer-diagnostics task, returned a concise three-step plan with two
selected principles, and reported no friction. Strict structural validation
and cached installer discovery passed. The online installer check remained
unavailable, as in the preceding run.
The full repository lane passed in the clean checkout, and the isolated
version gate confirmed `0.2.0 -> 0.2.1`. `git diff --check` passed.

# pstack 0.2.2 planning lens

Added the structural-decisions and prerequisites prompt to `plan.md`; no
separate Foundational Thinking principle was added. `plan_foundations_check`
used the revised skill on a general-purpose verification-workflow task,
produced four concise steps with two relevant principles, and reported no
friction. It identified the shared inputs and output contract before packaging
and validation. No implementation edits or external calls were made.
The full validation lane and strict structural check passed. Cached installer
discovery passed; online discovery remained unavailable. The isolated version
gate confirmed `0.2.1 -> 0.2.2`, and `git diff --check` passed.

# pstack 0.2.3 planning order

Changed the internal sequence to research, draft, then select and apply
principles. Only the refined plan is returned. `plan_order_check` researched
the installer-diagnostics task and reproduced its failures, drafted the small
fix before opening the principle catalog, then consulted Fix root causes and
Laziness protocol. Its process note confirmed that order; its final response
contained only the refined plan. No skill-caused friction was reported.
Full repository and strict structural validation passed. Cached installer
discovery passed; online discovery remained unavailable. The isolated version
gate confirmed `0.2.2 -> 0.2.3`, and `git diff --check` passed.

# pstack 0.3.0 redesign principle

Ported Redesign from First Principles as five short bullets, with a conditional
trigger and a benefit-versus-cost decision instead of a mandatory rewrite.
`redesign_principle_check` used the catalog on a multiple-public-skills planning
task and selected Model the Domain instead: the new principle did not add a
distinct useful decision for that task. `redesign_direct_check` applied the new
principle to machine-readable validator output and identified the existing
reporter as the narrow change boundary. It considered the scale of redesign
and used the cost comparison to keep the proposal small. No repair was needed.
Both were read-only design tasks; no implementation was performed.
Full repository and strict structural validation passed. Cached installer
discovery passed; online discovery remained unavailable. The isolated version
gate confirmed `0.2.3 -> 0.3.0`, and `git diff --check` passed.

# pstack 0.3.1 principle bullets

Split the existing Laziness Protocol, Model the Domain, and Sequence Verifiable
Units guidance into short bullets while retaining their meaning.
`principle_bullets_check` consulted and used all three on a real packaging-plan
task. It reported no material ambiguity, kept the proposed scope small, and
sequenced the ownership contract before consumer updates. No instruction
repair was needed.

## Expanded-library draft PR snapshot

The current draft adds the remaining reviewed principles and approved verify
and auto modules. Only plan is connected to the public router. The earlier
behavioral runs above do not validate this expanded snapshot; fresh dogfood,
focused evals, and live Claude/Codex compatibility checks remain in the handoff.

Packaging was checked from a clean temporary copy of the current draft:

- Version synchronization completed without changes; version generation passed.
- `scripts/validate-skills.sh` passed, using the existing pre-commit Python
  environment with PyYAML available.
- `scripts/validate-npx-install.sh` skipped because the npm CLI was unreachable.
  Separately, the cached real skills CLI discovered both pstack and the hidden
  plan wrapper in list-only mode. This is discovery evidence, not installation.
- All pstack Markdown links resolved and `git diff --check` passed.

The committed version-bump gate is run separately when the draft is committed.

# pstack 0.4.0 plan, verify, and auto

Scope: the 0.4.0 router (`plan|verify|auto`, optional `--`, current-task
fallback, unsupported-mode usage), the three shared modules, the principle
index, and the hidden wrappers. This is focused evidence from a small fixed
case set, not a reliability claim.

Skill snapshots (pstack content):

- `dc376f4d` (0.4.0 routing): dogfood round 1, 18:40-18:58 on 2026-10-21.
- `b2715a4a` (wider Exhaust the design space trigger, from the p12 result):
  `claude -p` host smoke and Eve iteration 1.
- `221737ac` (explicit stop on an unsupported mode, plan asks for state the
  code does not keep yet, `principles/<file>.md` link base): Eve iteration 2.
  This is the final content snapshot.

Transcripts and outputs live outside the repo in this session's scratchpad,
`/private/tmp/claude-501/-Users-andypai-worktrees-skills-pstack-plugin-handoff-18deef/492e2d26-a9b2-4aad-8b36-6f05d01a68c9/scratchpad/pstack/`
(`$S` below): fixtures in `$S/fixtures/`, hidden grading notes in
`$S/grading/`, Codex runs in `$S/runs/r1/<case>-codex.{jsonl,final.md}` with
their run copies beside them, host smoke in `$S/host/`, Eve results in
`$S/iter1/` and `$S/iter2/`. The executing agents were never shown the grading
notes. Every run was checked for an unchanged run directory (git status or the
recorded diff fingerprint).

## What ran where

- **Claude, module runs:** real Claude subagents read the shared module files
  directly in each fixture. They exercised module behavior, not slash-command
  loading.
- **Claude, host runtime:** `claude -p --plugin-dir pstack` (claude-sonnet-5-5).
  `/pstack:pstack --plan ...` loaded `pstack@inline` 0.4.0, read `plan.md`,
  then `principles.md`, and returned a plan that found the real file-name
  collision. `/pstack:verify ...` returned success with 0 turns and empty
  output: the hidden wrapper (`user-invocable: false`) is not a command in
  `-p` mode, and nothing reported that. `claude plugin validate` passed
  (only warning: ICON_MISSING). `/pstack:pstack verify` and `auto` were not run
  through the host.
- **Codex:** `codex exec` with `$pstack <mode> ...`, the host's configured
  model, and the four skills symlinked into `.agents/skills/` in each run copy
  (repo-scoped discovery). Agents read the modules and principle files, but the
  logs show no skill-injection event, so native `$` discovery is not proven.
  (Superseded: in the corrected round, Codex read `SKILL.md` in 1 of 23
  runs.)
  Several runs searched the filesystem and read the stale 0.3.1 SKILL.md in the
  main checkout before the run copy's 0.4.0 file. The `.codex-plugin`
  marketplace install was checked statically only (manifest valid, every
  `agents/openai.yaml` has `allow_implicit_invocation: false`).
- **Eve evals (`evals/eve`, gpt-6-luna subject and judge):** 11 pstack evals,
  two full passes per iteration plus ablations. No Anthropic pass: no
  `ANTHROPIC_API_KEY`.

## Dogfood round 1 (`dc376f4d`)

> Superseded. Concurrent duplicate runs edited fixtures in place, and no
> repaired case was re-run. Read the
> [corrected round](#pstack-040-corrected-dogfood-round) instead. In
> particular, the Codex passes below do not hold: the corrected round's
> Codex runs never loaded the skill.

C = Claude subagent, X = Codex CLI.

| Pass | Task and evidence | Observation and suspected cause | Resolution |
| --- | --- | --- | --- |
| `p01` plan, C | Flaky tenant-report test after three timing fixes. Disproved the timing premise by running the CLI on `data/tenants.json` (5 reported, 4 files); found the `fileNameFor` collision; fix at the source; removed delay/retry/timeout; colliding-name regression test. **Fail** on length only. | About 18 bullets against ~7: an invented "What the evidence shows" section plus 11 nested sub-bullets and API-level detail (`flag: "wx"`). `plan.md` gives no count, does not forbid nesting, and has no slot for a load-bearing finding. | Open. No length repair made. |
| `p01` plan, X | Same task. Tested the premise in a separate clone, named the collision, 5 pointers, 3 principles. **Pass.** | Added unrequested scope (reject duplicate IDs, retire old files); Laziness protocol did not fire on scope growth. Missed Subtract before you add (trigger does not cover removing workarounds). | Open, low. |
| `p02` plan, C | `--plan` migration of `legacyRequest`. All 7 call sites, delete legacy API with no shim, 404→null and 422→ValidationError, rewrite spy tests against the transport fake, grep + `bun test`. **Pass.** | Outcome line says "five callers" while step 1 lists seven: model slip. | None needed. |
| `p02` plan, X | Same. **Pass.** `--plan` routed via the `--` strip. | Selected Prove it works as near-default padding; its trigger matches every plan. Ended a step with session narration. | Open, low. |
| `v03` verify, C | Orders CSV export with a plan that omitted `--since`. Wrote criteria from the ticket first; probe showed export ignoring `--since` (7 rows vs 3); said the plan was wrong; listed checks. **Pass.** | Turned a principle observation into a numbered finding and added speculative CRLF/BOM caveats. `verify.md` invites a per-principle finding and has no scope limit on "unverified". | Open, low. |
| `v03` verify, X | Same. **Fail.** Found `--since` by reading code only; no probe; no checks or unverified sections. | Never read `verify.md` or any principle file. Router said "load the sibling module" but a host that injects only SKILL.md can skip it. `verify.md` does not require executed evidence for a finding. | Open (high for Codex). Not repaired; see gaps. |
| `v04` verify, C/X | Webhook retries with two seeded defects (off-by-one cap, per-attempt idempotency key). Both found with executed probes by both hosts; weak tests named; no edits; verdict not ready. **Pass** ×2. | X wrote a second near-duplicate report (host turn behavior). | None needed. |
| `v05` verify, C/X | Correct slug change. Tests, direct probes of the request examples, a site build, 10-20k randomized comparisons. Both said no defects. **Pass** ×2. | C filed non-blocking notes under "Findings"; X omitted the "unverified" item. The report shape has no slot for notes and does not say "none". `verify.md` assumes a plan exists. | Open, low. |
| `a06` auto, C | Add duration strings to job config. Implemented `src/duration.ts`, parsed once at load, `bun test` 36/36, hidden suite 80/80, honest report (tsc could not run). **Pass.** | Final report repeated the plan's principle list. | Open, low. |
| `a06` auto, X | Same. Hidden suite 145/145; fixed its own failing test and re-ran. **Pass.** | Verify phase collapsed into `bun test`; an unrequested `null` default regression (`??` → `=== undefined`) went unreported. `auto.md` delegates verify in one line and does not require request-derived criteria. | Open, medium. |
| `v07` verify, C | Soft delete when the required `make test` cannot run (registry down). Reported the official lane as not run, ran the suite on a disclosed stand-in Postgres, no edits. **Pass.** | Headline overstated confidence ("proven by tests that ran") for stand-in evidence. Nothing asks the report to tag the environment each check ran in. | Open, low. |
| `v07` verify, X | Same. **Fail.** Never ran `python -m unittest`, so never reported the 5 skipped DB tests; replaced the suite with an AST syntax check; code-reading claims not marked as static. | `verify.md` has no rule for a blocked required check (run the nearest part and report skipped or not-run counts as such). | Open, medium. |
| `p08` plan, C/X | Parallel mirror sync losing state and redoing work after a crash. Both named the shared `state.json`/`.tmp` race, chose per-worker records over a lock, removed the unconditional `rm -rf`, kept `mirror-status` working. C reproduced the race 6/6. **Pass** ×2. | C: rsync path-semantics detail; the interruption check was a failing fetch, not a killed parent. X: invented overlapping-invocation and stale-lock handling; an assumption (refresh after full success) stated as a decision. | Open, low. |
| `v09` verify, C/X | "~3x faster" cache claim. Both found the asymmetric `RESOLVE_TRACE=1` baseline and the warm 30-resolve workload, re-measured fairly (~1.4x warm, ~1.0x cold, CLI no gain), kept the change, recommended new CHANGELOG wording, no edits. **Pass** ×2. | X did not name the violated principle; slow skill discovery (host). | None needed. |
| `p10` plan, X | Bare `pstack plan` after a message asking for the `acct.*` → `account.*` rename and an end to hand-typed event names. Used the prior message (no usage line); caught computed names in the audit trail; automated check in `bun test` plus a derived name type, noting Bun does not type-check; docs and tests. **Pass with friction.** | Did not select Script bulk operations or plan a scripted rename with a rerunnable leftover search; did not retire the checklist reminder. Eve `route-current-task` shows the same miss. | Open, low. |
| `p10` plan, C | Same task. Used the prior message; guard test `tests/event-names.test.ts` as the rerunnable leftover check, caught `` `acct.${action}` `` in `audit/trail.ts`, `EventName` union left optional (no tsc), CONTRIBUTING bullet replaced by a pointer, no aliases, docs and tests, run dir clean. Selected Script bulk operations and Encode lessons in structure. **Pass.** | Did not select Type system discipline; used only the verification half of Script bulk operations (renames listed per site). | Open, low. |
| `p11` plan, C | Partial shipments. `shipments: {trackingNumber, itemIds}[]` instead of another flag, label computed with stale o-103 named, cancel/refund rules in one place, three open questions, legacy conversion on load, run dir clean. **Pass with friction.** | Selected only Model the domain of four targets: Redesign from first principles never read, Type system discipline read and rejected (four booleans kept), Minimize reader load not cited. | `principles.md` triggers for Redesign and Model the domain overlap; Type system trigger reads as signature work. Open, medium. |
| `p12` plan, C | Base-state prerequisite, unattended reasoning, no duplicate conflict copies, run dir clean. **Fail** on criterion 2 (one mechanism asserted; Exhaust the design space never read) and criterion 5 (two open questions out of scope or answered by the README). | Same causes as `p12` X, plus `plan.md` drafting the approach before selecting principles and having no slot for alternatives. | Same repair as `p12` X. |
| `r13` route, C | Answer was exactly the usage line; read only `SKILL.md`; no findings; fingerprint unchanged. **Pass.** | None. | None needed. |
| `p11` plan, X | Partial shipments. Parcel records instead of more booleans, legacy JSON conversion, new cancel/refund rules, one useful open question. **Pass with friction.** | Did not select Redesign from first principles; stale-label cache recomputed, not removed. | Open, low. |
| `p12` plan, X | Conflicting note edits across devices. Added a last-synced fingerprint (base state), unattended path, no duplicate conflict copies. **Fail** on criterion 2: asserted one approach without comparing options; Exhaust the design space not selected. | Exhaust trigger covered only "UI interaction or architectural decision", not a product behavior policy. | Repaired in `b2715a4a`; rechecked by Eve `plan-design-space` (below), not by a fresh dogfood rerun. |
| `r13` route, X | `$pstack review the slugify change` on a dirty fixture. Showed usage, pointed to `verify`, no review, no edits. **Pass.** | Eve iteration 1 showed the same prompt treated as verify in 3 of 6 gpt-6-luna runs. The rule sat last in SKILL.md after the routing list. | Repaired in `221737ac` (explicit "not exactly plan/verify/auto → usage and stop; do not map synonyms"). |

## Eve evals

Each iteration was two full passes of the 11 pstack evals, gpt-6-luna as
subject and judge. Commits `388b436f` and `70be5bd1` changed only
`evals/eve`.

| Pass | Task and evidence | Observation and suspected cause | Resolution |
| --- | --- | --- | --- |
| Iteration 1 (`b2715a4a`) | 10/11 in both passes, with a different red each time. `route-unsupported-mode` 1/2, `plan-design-space` 1/2 (base-state gate). Ablations: `pstack-plan-principle-links` KILLED 2/2; `pstack-verify-request-first` and `pstack-route-verify` SURVIVED 2/2 (controls with pstack omitted failed). Two judges relaxed after scoring correct reports 0; `prepare-skills` fixed to skip self-referential symlinks. | Unsupported-mode rule followed only about half the time; plan could omit missing last-synced state; principle links relative to `principles.md`. | Both evals quarantined; skill fixes went into `221737ac`. |
| Iteration 2 (`221737ac`) | Full passes 11/11 and 10/11. The red was an over-strict `/acct/` gate in `route-current-task`, now widened and checked against both stored replies. `route-unsupported-mode` 6/6; `plan-design-space` 6/6 on the unmutated pack, plus one regex miss that was widened. New ablations `pstack-route-unsupported-stop` KILLED 2/2 and `pstack-plan-missing-state` KILLED 2/2 (one clean kill). Request-first and route-verify SURVIVED 2/2 again. | `route-current-task` soft checks (selects Script bulk operations, leftover search) red in every run. Prioritize usability gate looks near its threshold. | Both evals returned to `live` after six consecutive greens on the text they guard. Remaining items listed below. |

Cost: about 7-8M input tokens in iteration 1 and about 9M in iteration 2, over
92% prompt-cache reads; a full 11-eval pass takes about 3 minutes.

## Unverified and open

Updated after the [corrected round](#pstack-040-corrected-dogfood-round).

- Codex never loaded pstack under `codex exec` with the skills symlinked into
  `.agents/skills`, even with an explicit `$pstack` mention (1 of 23 runs
  read `SKILL.md`). The harness has to change before any Codex result says
  anything about the skill. Native `$pstack` discovery and the
  `.codex-plugin` marketplace install are still unproven at runtime.
- `/pstack:verify`, `/pstack:plan`, and `/pstack:auto` hidden wrappers do
  nothing in `claude -p` and give no error. The interactive Claude path for
  them, and `/pstack:pstack verify|auto` through the host, were not run.
- `9fb7f086` repaired these, rechecked in r2 by Claude subagents: Prove it
  works selection (`v07`, `a06`), probe placement (`v04`), plan findings slot
  (`p01`), and the blocked-check rule (`v07`). Still unrepaired:
  - The verify report has no bucket for request-implied decisions, so `v05`
    regressed and `v07` overloaded "Blocking".
  - Plan principle links show file paths and resolve only inside the skill.
  - The Boundary discipline trigger is too broad.
  - A substitute check's scope is unbounded (left as harness policy).
- The missing r1/r2 grades were backfilled from the workflow journals. The
  new open item is the principle count: `p12` C listed 6 in r1 and r2.
- Eve was not re-run after `9fb7f086`. The last Eve pass is at `221737ac`.
  The request-first sentences in `verify.md` and the verify routing bullet
  survived ablation there.
- Eve still grades an infrastructure fault as failed, not errored, so an
  outage in an ablated run would read as KILLED.

## Packaging proof

Run in this worktree at the final content snapshot (`221737ac` skill text),
with this record added:

- `scripts/sync-plugin-versions.sh`: 0 files updated. `scripts/generate-versions.sh`:
  `versions.json` with 22 skills.
- `scripts/validate-skills.sh`: `Validation passed.` The default Python 3.14
  has no PyYAML, so it ran with `PYTHONPATH` pointing at a cached PyYAML 6.0.3
  (pure-Python build).
- `scripts/validate-npx-install.sh`: ran online this time; all 43 skills,
  including `pstack` and its `plan`, `verify`, `auto` wrappers, are
  discoverable by the npx installer. Discovery only, not an install.
- `git diff --check` passed. In `evals/eve`: `typecheck`, `test:catalog`
  (22 public skills), and `test:coverage` (45 live evals) passed.
- `bun scripts/skill-metadata.ts check-version-bump origin/main` on the
  committed tree (`91f1bc2b`, clean worktree), exit 0:

  ```text
  [OK] pstack: new -> 0.4.0 (pstack/skills/pstack/SKILL.md)
  Checked 1 plugin(s). All changed plugins have proper version bumps.
  ```

# pstack 0.4.0 corrected dogfood round

The first 0.4.0 round above had a harness bug. Duplicate runs went at the
same time and edited fixtures in place: `fixtures/a06-job-durations` was
found with `src/duration.ts` and changes to `README.md`, `src/config.ts` and
`tests/duration.test.ts`. Its repairs were also never re-run. This round
starts again from rebuilt fixtures and re-runs the cases after a repair.
Where it contradicts the earlier round, this round supersedes it.

Skill snapshots (`git rev-parse HEAD` at run time):

- **r1**, `9abb72f6`, 21:28-21:32. The commit before the repair. Its pstack
  text is identical to `221737ac`.
- **Repair**, `9fb7f086`. Changes only `pstack/skills/pstack/{plan,principles,verify}.md`
  (+18/-11). The version stays 0.4.0, because the sync would touch files
  outside `pstack/`.
- **r2**, `9fb7f086`, 21:37-21:41. Runs the ten cases the repair touched.

Hosts: **C** is a real Claude subagent that reads the module files in its run
copy. **X** is `codex exec -m gpt-6-luna` with the four skills symlinked into
`.agents/skills/`. Outputs are in
`$S/rerun/<round>/<case>-<subagent|codex>.final.md`, with the run copy beside
each one and Codex transcripts in `.jsonl`. Fixtures are in
`$S/rerun/pristine/`. Graders read `$S/grading/`, and the runners never saw it.
A missing **bolded** should-select principle counts as a FAIL.

## Fixture setup

Every run copy started from a fixture whose HEAD tree and starting state match
what grading describes:

- **a06:** re-ran `a06.py`, using a patched `mk.py` that writes to
  `rerun/pristine`. Tree `105f4945`, clean. `bun test` gives 7 pass and 1 fail,
  because `../src/duration` is missing. The hidden output matches
  `grading/a06-job-durations/hidden`.
- **p01:** cloned from the fixture's HEAD. Tree `51ea82d4`, clean. One
  `bun test` run gave 5/0, which is consistent with a suite designed to fail
  in 25-40% of runs.
- **p02, p08, p10, p11, p12:** re-ran each builder. The trees are `9962c53c`,
  `eff3eb5d`, `fa28ba84`, `2228d5b1` and `b597b158`, all clean. Each baseline
  suite is green.
- **v03:** re-ran the builder, then restored the `.gitignore` that had been
  amended into the fixture after it was built. Tree `b828c0b5`, fingerprint
  `81931d23…bd1ed`, unittest 8 OK.
- **v04, v05, v07, v09:** re-ran each builder. The trees are `9220fa1d`,
  `95ef8fca`, `8cbdcc05` and `37c0c53f`. Each seeded working-tree change
  matches its grading fingerprint, and the suites match grading: v04 9/9,
  v05 9 OK, v07 `OK (skipped=5)`.
- **r13:** uses the v05 fixture.

## Round 1 (`9abb72f6`)

| Run | Checks and result | observation \| evidence \| suspected skill cause |
| --- | --- | --- |
| `p01` plan, C | Disproved the timing premise with `bun test` (4/1) and the CLI on `data/tenants.json` (5 reported, 4 files). Found the `fileNameFor` collision and fixed it at the source by naming files by tenant id. Removed delay, retry and timeout. Wrote a colliding-name test that checks each file's content. Run dir clean. **Pass.** | The answer added a separate Diagnosis block | `final.md` has an unlisted **Diagnosis.** section before **Plan** | `plan.md` "Return only" had no slot for findings. |
| `p02` plan, C | `--plan` routed. Migrated all callers in 4 files, deleted `legacyRequest` with no shim, kept 404→null and 422→`ValidationError`, rewrote tests against the transport fake, checks with grep plus `bun test`. Clean. **Pass.** | None. |
| `v03` verify, C | Wrote requirements from the ticket first. Probe: `export --since` returned all 7 orders. Said the plan was wrong. Unittest 8 OK. Fingerprint unchanged. **Pass.** | None. |
| `v04` verify, C | Probes showed both seeded defects: 4 requests against a cap of 3, and 3 distinct idempotency keys. Named the weak tests. Fingerprint unchanged. **Pass.** | Wrote its probe inside the tree under review, then moved it out | Runner notes; the fingerprint stayed unchanged only because of the move | `verify.md` did not say where probes go. |
| `v05` verify, C | Unittest 9 OK, 19-input old/new comparison, site build. No defects. **Pass.** | 3 principles listed, one of them padding (Laziness), and non-blocking notes filed under "Findings" | Final report | `verify.md` asked for principle adherence and had a single findings bucket. |
| `a06` auto, C | Implemented `src/duration.ts` and parsed it once at load. `bun test` 36/0, hidden suite 80/0. Honest report that tsc could not run. **Pass.** | Never named Prove it works | Read `verify.md`, but no principle-prove-it-works file | `verify.md` did not link it; the trigger read as end-of-task only. |
| `v07` verify, C | `make test` was blocked by the registry, which it reported. Ran the suite on a disclosed stand-in Postgres 17, made no edits, fingerprint unchanged. **Fail:** the bolded Prove it works was missing. | Read only the principle index, and built its stand-in with network installs | "index only; I did not open any principle files" | The verify report had no slot for applied principles, nothing required opening the principle files, and nothing covered blocked checks. |
| `p08` plan, C | Named the shared `state.json`/`.tmp` race and reproduced it with 20 mirrors at `--jobs 4`. Chose per-worker records over a lock and removed the unconditional `rm -rf`. **Fail** on criterion 4: the crash-resume test was a failing fetch, not a killed parent. | Tested one failure point only, and did not select Prove it works | Tests section of the plan | The idempotency check was one closing bullet that `plan.md` did not pull into the success checks; the Prove it works trigger read as end-of-task. |
| `v09` verify, C | Found both measurement problems (asymmetric `RESOLVE_TRACE=1`, warm 30-resolve workload). Re-measured at ~0.96x cold and ~1.5x warm. Recommended rewording, made no edits. **Pass.** | None. |
| `p10` plan, C | Used the prior message. Typed the bus with `EventName`, added tsconfig, a `typescript` devDependency and `tsc --noEmit` with a negative check, cut the CONTRIBUTING line to a pointer, updated docs and tests, rerunnable `grep -rn "acct\." src tests docs`, named the `` `acct.${action}` `` template. Run dir clean. **Fail:** the bolded Script bulk operations was missing; no script or codemod proposed. | Followed the principle without naming it \| 4 principles listed; step 5 grep \| `principles.md:12` trigger hinged on "need" tooling (repair item 7). |
| `p11` plan, C | Shipment list (tracking number plus item ids) replaces the shipping flags, `isPartiallyShipped` rejected; label computed, `updateLabel`/`statusLabel` removed, stale o-103 named; `canCancel`/`canRefund` in one place; old shape converted on load with a round-trip check; `bun test` 4/4; run dir clean. Both bolded principles. **Pass.** | Minimize reader load (not bolded) not selected \| Principles credit Model the domain for the derived label \| `principles.md:19` trigger does not mention cached values kept in sync by hand. |
| `p12` plan, C | Base hash named as the prerequisite; conflict copy, inline markers and report-only compared with prototypes suggested; unattended reasoning with non-zero exit; content-hashed copies; run dir clean; both bolded principles. **Fail:** 6 principles, over the grading limit of 5. | Over the count, and mini-spec step detail \| Principles lines 31-37; Steps 1-6 \| No count in `plan.md:22-23` or `principles.md:3-4`; `plan.md:20-21` does not bound pointer detail. |
| `r13` route, C | Whole answer was `pstack plan\|verify\|auto [task]`; no module loaded, fixture not opened, no findings; run dir matches pristine. **Pass.** | None. |
| Codex, 13 graded runs (every case) | **Fail ×13.** In 8 runs the transcript has no read of `SKILL.md` or a module. `p02` and `p08` implemented code in plan mode. `v09` read `.agents/skills/pstack/SKILL.md` and `principles.md`, but no principle file; it missed the warm-cache flaw and selected no principle. Backfilled: `p10` and `p12` X were plain plans with no principles; `p11` X implemented code in plan mode; `r13` X found no skill and reviewed the diff instead of showing usage. | Host or harness, not skill text: Codex did not inject the skill. In some runs the prompt was plain `pstack <mode>`, not `$pstack`, and `allow_implicit_invocation: false` then blocks it. `find`/`rg` without `-L` do not follow the `.agents/skills` symlinks. For `v09` X: `verify.md` linked the index, not the principle files. |

Round 1 graded results: C 9 of 13 pass, X 0 of 13.

## Repair (`9fb7f086`)

This is one change set for the recurring causes. `verify.md` now always
includes Prove it works and requires reading the selected principles' files.
It asks for applied principles in the report, a separate marked list for
non-blocking notes, temporary probes kept outside the tree, and a blocked check
reported as unverified with any substitute labelled. `principles.md` now
widens the Prove it works trigger to defining success checks, says to open
each selected file, and says to keep the few principles that matter most, with
no numeric cap. `plan.md` adds findings and assumptions, and the checks of
selected principles, to the pointers. The Script bulk operations and Minimize
reader load triggers are also wider. Not changed: `auto.md`, any install or
approval policy, and plan step detail.

## Round 2 (`9fb7f086`)

| Run | Checks and result | observation \| evidence \| suspected skill cause |
| --- | --- | --- |
| `p01` plan, C | Repeated `bun test` (2 of 5 failed) and the CLI run (5 reported, 4 files, t_1005 overwrites t_1001). Fixed at the source; removed delay, retry and timeout; colliding-name content test; 7 pointers. Clean. **Pass.** | Principle links show the file path as their text and do not resolve from the user's repo | `final.md` lines 22-26 | `plan.md:23-24` "linked as `principles/<file>.md` relative to this skill". |
| `v04` verify, C | Probes P1-P5 kept outside the tree (re-run by the grader: 2 pass, 3 fail as reported). Found both defects with line locations. Separate Unverified section. Fingerprint unchanged. Every should-select principle selected. **Pass.** | None. The v04 probe repair held. |
| `v05` verify, C | 20k-case old/new property check, builds at HEAD and on the tree, request probes. No defects. Fingerprint unchanged. **Fail** on criterion 3: the intended URL renames are filed as a Finding marked "Needs your decision", and a test-gap finding cites an invented requirement. Selected Boundary discipline as padding. | Requested consequences reported as blocking | Findings 1-2 next to a separate "Non-blocking notes" list | `verify.md:22-23` requires a violated requirement for every actionable finding and has no bucket for a decision the request implies. `principles.md:12`'s Boundary discipline trigger matches almost any code that reads files. This was a regression from r1's borderline pass. |
| `a06` auto, C | `bun test` 40/0, hidden suite 84/0. Mutation checks found a redundant lookahead, which it removed and re-checked. Report lists its gaps. Selected Prove it works. **Pass.** | None. The a06 repair held. |
| `v07` verify, C | `make test` reported as unverified, with the reason and what it needs. Stand-in Postgres run (grader reproduced 5/5 and the probe results) with every difference disclosed. No edits. Selected Prove it works. **Pass.** | Labelled email reuse "Blocking (decision needed)", and still did network installs | Findings 1; pip `psycopg` 3.3.6 | Same `verify.md:22-23` gap as v05; `verify.md:15-16` does not limit how far a substitute check may go. Also, it did not open two of its principle files, which the text requires (agent deviation). |
| `p08` plan, C | Named the shared `state.json`/`.tmp` read-modify-write and reproduced it (6 runs at `--jobs 4` over 20 mirrors: 8/6/7 entries, three 0-byte files). Per-worker records with atomic rename and one merge, `flock` only as fallback; removed the unconditional `rm -rf`, record only after the fetch exits 0, a run marker for resume; kill/fail-at-K test with a fetch-call log; `state.json` shape kept. Both bolded principles. **Pass.** | None. The r1 criterion-4 fail is fixed. |
| `v09` verify, C | Traced baseline 36.8 ms against 18.1 ms untraced; parse calls 430/430/0; CLI-shaped resolve 19.3 vs 19.3 ms. Corrected to ~1.39x warm and ~1.0x cold over 7 interleaved rounds with median, range and load stated. Change called correct (5 OK); CHANGELOG rewording recommended, not edited; probes outside the repo; fingerprint unchanged. **Pass.** | None. |
| `p10` plan, C | Used the prior message. One file by hand, script the rest, rerunnable `rg 'acct\.' src tests docs`, `` `acct.${action}` `` named; guard test under `bun test`, `EventName` union deferred to a typecheck lane as the open question; CONTRIBUTING bullet replaced; no aliases; run dir clean; 5 principles with all three should-select. **Pass.** | None. The Script bulk operations trigger repair held. |
| `p11` plan, C | Shipments as the source of truth; label, `canCancel` and `canRequestRefund` derived, stale o-103 named; cancel/refund rules with per-parcel delivery as Q1; old shape converted on load; run dir identical. Both bolded principles plus Minimize reader load. **Pass.** | Type system discipline (not bolded) dropped, so `isPaid`/`isDelivered`/`isCancelled`/`isRefunded` stay independent booleans \| Principles list; step 3 \| `principles.md:4` "Keep the few that matter most" and the signature-sounding trigger at `principles.md:29`. |
| `p12` plan, C | Per-device baseline hash; keep-both, inline markers and three-way merge compared with prototypes; unattended reasoning; content-hashed copies, baseline written last; run dir identical; both bolded principles. **Fail:** 6 principles again, over the grading limit of 5. | Over the count \| `final.md` lines 44-49 \| `principles.md:3-4` ("Keep the few that matter most") and `plan.md` give no number while grading fails more than five; `plan.md:20-22` plus the Test behavior trigger pull a tests principle into every plan. |
| Codex, 10 graded runs (every r2 case) | **Fail ×10.** All used `$pstack <mode>`, and none read `SKILL.md` or a module. The code or verdict was often right (a06 hidden suite 58/0, v04 found both defects by reading the code), but no principle was selected and the reports had no verify shape. `v07` X falsely claimed it had implemented a change that was already present. Backfilled: `p08`, `v09`, `p10`, `p11` and `p12` X also show only filename searches for `SKILL.md`, not reads. `p08` and `p11` X implemented code in plan mode; `v09` X found both measurement problems but gave single-run numbers and no principles; `p10` and `p12` X were plain plans with no principles. | Host or harness: an explicit `$pstack` mention under `codex exec` still did not inject the symlinked skill. No skill-text cause can be drawn. |

Round 2 graded results: C 8 of 10 pass, X 0 of 10. Of the C runs that failed in
r1 and were graded again, `v07`, `p08` and `p10` now pass and `p12` still fails
on the principle count. `a06` and `v04` lost their
frictions, and `v05` regressed.

Across both rounds, 1 of 23 Codex transcripts read pstack's `SKILL.md` (r1
`v09`). This supersedes the earlier round's claim that Codex agents read the
modules and principle files: that came from filesystem searches in
contaminated runs, not from skill loading.

The Eve evals were not re-run after `9fb7f086`. The latest Eve results
(iteration 2) are at `221737ac`.

## Open after the corrected round

- **Codex has not been exercised.** Codex has not run pstack in this round. A
  harness fix is needed first: real directories instead of symlinks in
  `.agents/skills`, or a confirmed skill-injection event. Until then, every
  Codex row says nothing about the skill text.
- **Verify report buckets.** The report has no place for a decision or
  consequence the request implies (`v05` regressed, and `v07` overloaded
  "Blocking").
- **Plan principle links.** They show file paths and resolve only inside the
  skill (`p01`).
- **Boundary discipline trigger** is too broad (`v05`).
- **Substitute-check scope** is unbounded, so a stand-in can involve network
  installs (`v07`). This was left deliberately as harness policy.
- **Principle count.** `p12` listed 6 principles in r1 and r2; the skill sets
  no number and the grading README fails more than five.
- **Missing grades** were backfilled from the workflow journals (see
  [Backfill](#backfill-from-workflow-journals)).
- **Eve not re-run** after `9fb7f086`.

## Lane after the repair

The lane ran at `9fb7f086` with this record added:

- `scripts/sync-plugin-versions.sh` updated 0 files.
- `scripts/generate-versions.sh` produced 22 skills.
- `scripts/validate-skills.sh` printed `Validation passed.`
- `git diff --check` passed.
- In `evals/eve`, `typecheck` and `test:catalog` (22 public skills) passed.

`validate-npx-install.sh` and the version-bump check were not re-run, because
the version is unchanged. The Eve evals were not re-run.

## Repair 2 and round 3 (`fdc6b1eb`)

**Cause of the r2 `v05` regression.** `verify.md:22-23` offered two places:
"Actionable findings", each naming a violated requirement or principle, and
non-blocking notes. The intended URL renames need a user decision, so the
agent ruled out notes, filed them as a Finding marked "Needs your decision",
and gave a test-gap finding a requirement the request never stated.

**Repair, `fdc6b1eb`.** Changes only `pstack/skills/pstack/verify.md`. The
report now has Findings (defects with location, evidence and a violated
requirement or principle; without one it is a note), Decisions (consequences
the request asks for or implies, with options; not defects), non-blocking
notes and Unverified, saying "none" for an empty section. The bar for a
Finding is unchanged, so the seeded defects in `v03`, `v04` and `v09` still
qualify, and the "unverified" wording `v07` relies on is unchanged. "none"
also covers the r1 Codex `v05` omission of the unverified item. Version stays
0.4.0.

**r3, `fdc6b1eb`.** Host: this session had no Agent tool, so the executor was
a separate fresh `claude -p` process (claude-opus-5-5) given only the skill
path, the invocation and the user context. That is a Claude host run, not the
subagent host of r1/r2. Outputs are in `$S/rerun/r3/`.

| Run | Checks and result | observation \| evidence \| suspected skill cause |
| --- | --- | --- |
| `v05` verify | Unittest 9 OK, builds before and after with file names compared, 15-input old/new probe outside the repo. Findings "None"; the two renamed URLs under Decisions, test gaps under non-blocking notes. Fingerprint unchanged. **Pass.** The regression is fixed. | Boundary discipline selected as padding (one, below the FAIL threshold) | `principles.md:12` trigger matches any slugify of front-matter titles. Also filed a "C++"/"C#" collision under Decisions although the build already raises on it | `verify.md` "asks for or implies" is loose enough to pull side observations into Decisions. |
| `v07` verify | `make test` failed at the registry and was reported unverified with what it needs. Static review labelled as such, no success claim, no edits, fingerprint unchanged, Prove it works selected; email reuse now under Decisions. **Fail** on criterion 1: it never ran `python -m unittest`, so it never reported `OK (skipped=5)`. | Stopped at the infrastructure failure instead of running the part of the suite that could run | `verify.md:15-16` "report it as unverified" has no "run what can run; skipped is not passed" clause; `principle-prove-it-works.md:18-19` does not mention skips. A `dcg` hook also blocked its stand-in Postgres probe (not skill-caused). r2 passed this case on a different host, so the cause is not proven. |
| `v03`, `v04`, `v09` | **Not run.** The reviewer subagents had no Agent tool and declined to merge executor and reviewer roles. | The claim that real defects are still flagged after `fdc6b1eb` is untested by dogfood. Eve `verify-broken-impl` and `verify-flawed-plan` passed 2/2 (below). |

**Eve iteration 3 at `fdc6b1eb`** (gpt-6-luna subject and judge, two passes,
recorded in `evals/eve` by `62df09b4`): 21 of 22. Run 1 10/11, run 2 11/11.
`verify-correct-change` (the `v05` analogue) passed 2/2 and its judge accepted
the Decisions section. The one red was `plan-design-space` in run 1: the plan
picked one sync strategy without comparing alternatives and did not select
Exhaust the design space, a skill-side principle-selection miss; the gate was
kept. Ablations: `pstack-plan-principle-links` and
`pstack-route-unsupported-stop` KILLED 2/2; `pstack-verify-request-first` and
`pstack-route-verify` SURVIVED 2/2 as before; `pstack-plan-missing-state` now
SURVIVED 2/2 (it was one clean kill), so no eval guards that clause any more.
`9fb7f086`'s plan pointers for "findings and assumptions" may cover it; that
is untested. Logs: `$S/evalrun/`.

**Codex: UNVERIFIED, by the user's decision to skip it for now.** The dogfood
harness never got Codex to load pstack: repo-scoped `.agents/skills` symlinks
were ignored, and 1 of 23 transcripts read `SKILL.md`. No Codex result speaks
to the skill text. Static Codex packaging (`.codex-plugin/plugin.json`,
`agents/openai.yaml`) passes validation, and Eve runs only against OpenAI
models through its own loader, not the Codex host. Next step: install the
skills as real directories or through the native plugin install, confirm the
skill-load event in the transcript, then re-run the graded cases.

Still open after r3: `v07` partial-suite reporting, the Boundary discipline
trigger, Decisions scope, `plan-design-space` selection, the unguarded
missing-state clause, `v03`/`v04`/`v09` not re-dogfooded, substitute-check
scope, plan principle links, and the principle count (`p12`). The missing
r1/r2 grades are backfilled below.

Lane at `62df09b4` plus this record: `sync-plugin-versions.sh` updated 0
files; `generate-versions.sh` produced 22 skills; `validate-skills.sh` printed
`Validation passed.`; `validate-npx-install.sh` found all 43 skills
discoverable, with no skips; `git diff --check` passed; in `evals/eve`,
`typecheck`, `test:catalog` (22 public skills) and `test:coverage` (45
expected evals) passed. After committing this record,
`bun scripts/skill-metadata.ts check-version-bump origin/main` printed
`[OK] pstack: new -> 0.4.0 (pstack/skills/pstack/SKILL.md)` and
`Checked 1 plugin(s). All changed plugins have proper version bumps.`

## Backfill from workflow journals

**Why grades were missing.** The orchestrating workflow scripts passed the
per-run results to the record step through `JSON.stringify(...).slice(0, N)`,
so rows after the cut never reached this file. The grades above marked
"Backfilled" were read in full from the workflow journals instead: the
corrected round from `wf_7d1d9aa2-28a/journal.jsonl` (labels
`review:<case>:<host>:<round>`) and the superseded first round from
`wf_44a61fc0-03d/journal.jsonl`. Each `result` entry is matched to its label
through the `started` entry with the same key. The parser is
`$S/tools/journal_rows.py` (`--list`, `--label-prefix`, `--match`, `--json`).

Backfilled rows: first round C `p10`, `p11`, `p12`, `r13`; corrected r1 C
`p10` (completed), `p11`, `p12`, `r13` and Codex `p10`, `p11`, `p12`, `r13`;
r2 C `p08`, `v09`, `p10`, `p11`, `p12` and Codex `p08`, `v09`, `p10`, `p11`,
`p12`.

**Codex rows.** None of the r1/r2 Codex runs loaded pstack. The skills were
symlinked into `.agents/skills`, and Codex 0.163 ignores symlinked skill
directories, so every Codex FAIL above measures plain Codex, not the skill
text.

**r3 coverage.** The `v03`, `v04` and `v09` verify reruns never ran: the
executor tool was missing. `v05` and `v07` ran through a separate `claude -p`
process, not the r1/r2 subagent host.

# pstack 0.4.0 final pass (`d98be54b`)

The last pass before review. No skill text changed after `fdc6b1eb`; the
commits since then only removed wrappers, backfilled grades and updated
`evals/eve` and the README. No repair was attempted in this pass, so every
friction below is still open.

## Wrapper removal and host evidence (`132d3f8e`)

`pstack/skills/{plan,verify,auto}` (each a hidden `SKILL.md` plus
`agents/openai.yaml`) were removed with `git rm -r`. Claude does not register
`user-invocable: false` skills as commands, so `/pstack:verify` did nothing,
and the user chose `/pstack plan|verify|auto`. The umbrella is now the only
entrypoint: `/pstack <mode>` in Claude, `$pstack <mode>` in Codex. Mode text
is unchanged.

Host check: `claude -p --plugin-dir .../pstack --output-format stream-json
--verbose --max-turns 3`. Each run loaded pstack 0.4.0 inline, the only pstack
command registered was `pstack:pstack`, and each stopped at the turn limit as
expected.

| Prompt | First read | Later reads |
| --- | --- | --- |
| `/pstack plan add a flag` | `plan.md` | none |
| `/pstack verify the app prints hi` | `verify.md` | `principles/principle-prove-it-works.md` |
| `/pstack auto add a --version flag` | `auto.md` | `plan.md`, `verify.md` |

Streams: `$S/hostcheck2/{plan,verify,auto}/stream.ndjson`. After the removal,
`validate-skills.sh` passed, `git diff --check` was clean, and `evals/eve`
`typecheck` and `test:catalog` (22 public skills) passed. Interactive Claude
was not run.

## Eve iteration 4 (`d98be54b`, recorded in `8c4934f4`)

gpt-6-luna subject and judge, two runs: 10/11 and 11/11 (21 of 22). Every eval
passed 2/2 except `plan-design-space` (1/2). Its run-1 failure is the same
skill-side miss as iteration 3: the plan chose one strategy (conflict copies on
both sides), compared no alternatives and did not select Exhaust the design
space. The reply was read to rule out a grader bug. No eval or ablation span
referenced the removed wrappers.

Ablations (`--runs 2`, every baseline green), unchanged from iteration 3:
`pstack-plan-principle-links` and `pstack-route-unsupported-stop` KILLED 2/2;
`pstack-verify-request-first`, `pstack-route-verify` and
`pstack-plan-missing-state` SURVIVED 2/2, so these evals still do not guard
those clauses. Logs: `$S/evalrun-final/{run1,run2,ablate}.log`.

## Round 4 (`d98be54b`)

All 13 scenarios on both hosts, from `$S/rerun/pristine/` fixtures, graded
against `$S/grading/` by separate reviewers. Snapshot `d98be54b`: its pstack
text equals `fdc6b1eb`.

- **C:** a Claude subagent reading the module files from
  `pstack/skills/pstack/`.
- **X:** `codex exec -m gpt-6-luna` (codex-cli 0.163) with
  `pstack/skills/pstack` **copied as a real directory** into the run copy's
  `.agents/skills/pstack`, invoked with `$pstack <mode>`. The copy is identical
  to the snapshot (`diff -r`). The load probe in `$S/codex-load/` shows why
  this changed: with symlinked skill dirs (`m1`) Codex never used the skill;
  with real directories (`m2`) it announced plan mode and read `plan.md`.

"Loaded" means the reviewer found the skill in use. For X, `SKILL.md` is
injected by the `$pstack` mention and never read by a command (0 of 13); the
column notes whether the transcript shows a read of the mode file.

Outputs: `$S/rerun/r4/<case>-<subagent|codex>` (run copy), with `.final.md`,
`.review.json`, and `.process.md` (C) or `.jsonl` plus `.prompt.txt` (X).

### Claude subagent (C)

| Case | Loaded | Result | observation \| evidence \| suspected skill cause |
| --- | --- | --- | --- |
| `p01` plan | yes (`SKILL.md`, `plan.md`) | **Pass** | Probe measured 66% single-attempt collisions; fix at `fileNameFor` with the tenant id, workarounds removed, production leak named, 5 principles. Two-sentence outcome and an extra duplicate-name guard step \| `final.md` \| `plan.md:19` (one sentence) not followed; `plan.md:11-12` smallest approach did not stop the extra step. |
| `p02` plan | yes | **Pass** | All 4 callers migrated, no shim, 404/422 kept via `HttpError.status`, spy suites rewritten, 4 principles. None. |
| `p08` plan | yes | **Fail** (criterion 3) | Race reproduced (24 mirrors, `--jobs 4`, every `state.json` 0 bytes); per-worker state merged by one writer; run marker for resume. Kept the unconditional `rm -rf "$dest"` and moved its removal to an open question, so a half-copied mirror is always re-copied; never considered `<name>.partial` plus rename \| `bin/mirror-sync-one:11` \| `plan.md:11-12` "smallest approach" read "resume" as skipping finished mirrors; temp+rename in `principle-make-operations-idempotent.md:8-12` was outweighed. r2 passed this case, so this is run-to-run variance on the same text. |
| `p10` plan | yes | **Pass** | Used the prior message, typed `EventName`, raw-string scan test, `tsc --noEmit` as an open question, CONTRIBUTING bullet updated, both bolded principles. The rename is not planned as one example then a codemod \| plan steps \| `principle-script-bulk-operations.md:12-13` lets a rerunnable scan alone satisfy the principle. Minor. |
| `p11` plan | yes | **Pass** | Parcel records replace the order booleans; label and cancel/refund derived; stale o-103 label named; old documents converted on load. Minimize reader load and Type system discipline (both non-bolded) not selected \| principles list \| `principles.md:4` "Keep the few that matter most" with no tie-break between overlapping triggers. |
| `p12` plan | yes | **Fail** (criterion 2) | Per-device base hash, unattended runs, no data loss, idempotent copies, 5 principles (count no longer over). Did not select bolded Exhaust the design space after reading it; one mechanism, no alternatives or prototypes; Redesign selected as padding \| principles list \| `plan.md:11-12` drafts one approach before selection; `principles.md:10` vs `:15` give no precedence; `principle-exhaust-the-design-space.md:3-5` "skip established patterns" excludes conflict copies. Same miss as Eve `plan-design-space`. |
| `r13` unsupported | yes (`SKILL.md` only) | **Pass** | Usage line, no module loaded, no findings; run copy unchanged. None. |
| `v03` verify | yes (`verify.md`) | **Pass** | `--since` ignored by export, shown by a list/export parity script (14 of 25 combinations differ); says plan step 3 omitted it. No requirement list in the report \| report sections \| `verify.md:18-28` has no section for the requirements derived at `verify.md:6-7`. `--output` overwrite filed as a Decision although the ticket never asks for it (`verify.md:25-26`). |
| `v04` verify | yes | **Pass** | Both defects with probes and line numbers; tests shown not to catch them; all three should-select principles. None. |
| `v05` verify | yes | **Pass** | Findings none; URL renames under Decisions; 20k-case property check. Boundary discipline as padding (3 principles where 1-2 expected); two low-stakes Decisions \| principles list \| `principles.md:12` trigger too broad; `verify.md:25-26` Decisions scope loose. |
| `v07` verify | yes (`verify.md`) | **Pass** | Tried `make test` (registry Bad Gateway), reported it unverified with what it needs, then ran a labelled stand-in Postgres with every difference listed. Never ran bare `python -m unittest` (`OK (skipped=5)`), but no FAIL clause hit. Network `pip install` of a non-pinned psycopg \| `$S/rerun/r4/v07-probe/` \| `verify.md:15-16` does not bound substitute checks. |
| `v09` verify | yes | **Pass** | Both measurement problems: trace asymmetry at `compare.sh:5` and warm-cache reuse (parse calls 430 then 0); cold single resolve 18.1 vs 18.4 ms over 35 runs; CHANGELOG rewording recommended. None. |
| `a06` auto | yes (`SKILL.md`, `auto.md`) | **Pass** | `bun test` 40/0, hidden 84/0, mutation check, gaps stated. Final report names no principles \| `final.md` \| `auto.md:14-15` asks only for changes, evidence and gaps, unlike `plan.md:23` and `verify.md:21`. |

C: **11 of 13 pass**. `p08` regressed from r2; `p12` now fails on principle
selection instead of count.

### Codex with a real skill copy (X)

| Case | Loaded (mode file read?) | Result | observation \| evidence \| suspected skill cause |
| --- | --- | --- | --- |
| `p01` plan | yes (`plan.md` read) | **Pass** | Probe showed three names mapping to `acme_corp.csv`; fix in `fileNameFor`, workarounds removed, 4 should-select principles. Filename strategy left undecided although `tenant.id` exists \| plan pointer 1 \| `plan.md:15,22` "details best resolved during implementation" / "Keep implementation details flexible". Minor. |
| `p02` plan | yes (`plan.md` read) | **Pass** | `--plan` routed to plan mode; 4 callers, no shim, spy tests rewritten, 4 principles. None. |
| `p08` plan | yes (`plan.md` read) | **Fail** | Blamed the shared `state.json`/`.tmp` and selected both bolded principles, but pointer 2 says "Preserve the existing fetch behavior", keeping the `rm -rf`; no temp+rename, no per-mirror state, separation only "safe ownership" \| `final.md` pointer 2 \| `plan.md:15,22` let the concrete finding shrink to abstractions; `plan.md:11-12` smallest approach. |
| `p10` plan | yes (`plan.md` read) | **Fail** | Typed bus, raw-literal check, dynamic `audit/trail.ts` noticed. Missed bolded Script bulk operations although it grepped 19 sites across 12 files and listed the file; no leftover grep, no `tsc` step, CONTRIBUTING line kept \| transcript and principles list \| `plan.md:12-13` selects principles against the draft, not the task and findings; `plan.md:22-23` "flexible" vs "checks of selected principles" pull apart. |
| `p11` plan | yes (`plan.md` **not** read) | **Fail** | Incremental per-item tracking on top of the five booleans; missed bolded Redesign from first principles, the cached `statusLabel` and the stored `data/orders.json` shape \| no command opens `plan.md` \| `SKILL.md:17-21` "load the sibling module" is soft enough to skip; `principles.md:10` Redesign trigger needs a concrete cue. |
| `p12` plan | yes (`plan.md` read) | **Fail** | Named the missing last-synced state and selected both bolded principles, but deferred the comparison to implementation, proposed no prototypes, chose nothing, ignored unattended runs \| `final.md` \| `principle-exhaust-the-design-space.md:8,13` never says to recommend one in plan mode; `plan.md:11,15,22` as above; `principle-prioritize-usability.md:10` leans on visual detail. |
| `r13` unsupported | yes (injected; no read expected) | **Pass** | Printed the usage line from `SKILL.md:17` and stopped; zero tool calls. None. |
| `v03` verify | yes (`verify.md` read) | **Fail** (criterion 3) | Found `--since` ignored with executed evidence, no invented defects, but never said the supplied plan omitted `--since` \| report sections \| `verify.md:18-28` has no section for gaps in the supplied plan, though `verify.md:6-7,30` ask the agent to judge it. |
| `v04` verify | yes (`verify.md` **not** read; report matches its sections) | **Pass** (borderline) | Both defects with a probe (4 attempts, 4 distinct keys). Read but did not list Make operations idempotent; passed on the explicit retry-safety reasoning \| "Principles applied" \| `principle-make-operations-idempotent.md:3-14` covers restartable commands, not idempotency keys; `principles.md:25` trigger reads as jobs, not HTTP retries. |
| `v05` verify | yes (`verify.md` **not** read; report matches its sections) | **Pass** | Unittest 9 OK and a build; no findings; Prove it works plus one neutral principle. Wrote "Decisions: None" despite the visible URL change (allowed). Mode-file load unconfirmed \| no read in transcript \| `SKILL.md:17-19`, low severity. |
| `v07` verify | yes (`verify.md` read) | **Fail** | Never ran `make test`, `unittest` or Docker, yet reported that `make test` could not start because Docker access was denied: a fabricated check result \| three commands in the `.jsonl`, none a test \| `verify.md:15-16` lets "report it as unverified" stand without an attempt and quoted output; `verify.md:20` does not tie "checks performed" to executed commands. |
| `v09` verify | yes (`verify.md` **not** read; report matches its sections) | **Fail** | Selected both should-select principles, fixed the trace asymmetry (~1.4x warm), but missed the warm-cache artifact and filed end to end as Unverified instead of running one cold resolve \| report \| `benchmark-checklist.md:23-24` places cache state under tuning; `benchmark-checklist.md:42-44` and `verify.md:15-16` let a runnable check be deferred; `principle-explain-the-number.md:10-11`. |
| `a06` auto | yes (`plan.md`, `verify.md` read; `auto.md` **not** read) | **Pass** | Hidden 70/0, visible 26/0; its `git diff --check` caught a duplicated import, fixed and re-checked. Thin report (no principles, no gaps line, the fixed fault unmentioned), a slight overclaim about added tests, and a mid-run claim of a test run that had not happened \| `final.md`, `.jsonl` \| `auto.md:14-15` report contract never read; `auto.md:10-12` "use verify.md" collapsed to running tests. |

X: **6 of 13 pass**. Codex followed the mode module by command in 7 of 12
mode runs; in `p11` that skip is the likely cause of the failure.

## What each product shows now

| | Claude | Codex |
| --- | --- | --- |
| Static packaging | `.claude-plugin/plugin.json`, `validate-skills.sh` passes | `.codex-plugin/plugin.json`, `agents/openai.yaml`, `validate-skills.sh` passes; `validate-npx-install.sh` discovers the skills |
| Entrypoint at runtime | `/pstack <mode>` via `claude -p --plugin-dir`: all three modes route; `pstack:pstack` is the only command. Interactive Claude not run | `$pstack <mode>` with a repo-scoped real-directory copy under `codex exec`: the skill was in use in 13 of 13 (`SKILL.md` came from the mention, never a read), routing and the unsupported-mode stop work. The native plugin install and interactive Codex were not run |
| Graded behavior | 11 of 13 (subagent host) | 6 of 13 |

This replaces "Codex: unverified". Codex runtime use is now verified for a
real skill copy under `codex exec`, not for the native plugin install. The
earlier r1/r2 Codex rows still measure plain Codex because of the symlinks.

## Remaining friction (not repaired)

- **Mode-file read is optional in practice (Codex).** `SKILL.md:17-21`; X
  skipped the mode file in `a06`, `p11`, `v04`, `v05`, `v09` (5 of 12).
- **Plan flexibility drops concrete findings.** `plan.md:11-12,15,22`; `p08`
  on both hosts kept the destructive `rm -rf`; X `p01`, `p10`, `p12` deferred
  decisions.
- **Exhaust the design space under-selected.** C and X `p12`, Eve
  `plan-design-space` again; the `pstack-plan-missing-state` clause is still
  unguarded.
- **Principle selection anchored on the draft.** `plan.md:12-13`; X `p10`
  missed Script bulk operations; the Redesign trigger needs a concrete cue (X
  `p11`); no tie-break for overlapping triggers (C `p11`).
- **Verify report gaps.** No section for derived requirements or plan gaps
  (`v03`); "unverified" can be claimed without an attempt, and a listed check
  need not have run (X `v07` fabricated one); a runnable check can be deferred
  (X `v09`).
- **Auto report contract.** No principles in either `a06` report; X never
  read `auto.md`.
- **Still open from before:** Boundary discipline trigger too broad (C `v05`),
  Decisions scope loose (C `v03`, `v05`), substitute-check scope (C `v07`),
  Make operations idempotent omits request-level keys (X `v04`), plan
  principle links resolve only inside the skill.
- **Not run:** interactive Claude, interactive Codex, and the native Codex
  plugin install.

## Lane at `8c4934f4` plus this record

`sync-plugin-versions.sh` updated 0 files; `generate-versions.sh` produced 22
skills; `validate-skills.sh` printed `Validation passed.`;
`validate-npx-install.sh` found all 40 skills discoverable (43 before the
three wrappers were removed); `git diff --check` passed; in `evals/eve`,
`typecheck`, `test:catalog` (22 public skills) and `test:coverage` (45
expected evals) passed. The version-bump check result is reported with the
commit that adds this record, since it evaluates committed changes only.

# pstack 0.4.1 friction repair and rerun (`8c395a22`)

The four friction areas and the auto report gap from round 4 were repaired in
`8c395a22` (pstack 0.4.0 → 0.4.1). Round 5 then re-ran only the seven
scenarios that failed on Codex in round 4 (`p08`, `p10`, `p11`, `p12`, `v03`,
`v07`, `v09`), on both hosts. The six Codex passes and the six other Claude
passes from round 4 (`p01`, `p02`, `r13`, `v04`, `v05`, `a06`) were **not**
re-run at this snapshot, so their round-4 results are for 0.4.0 text. `a06`
was listed for a rerun to check the new auto report contract and was not run
on either host. Eve covers part of the gap (below).

## Repair (`8c395a22`)

- **Mode-file read (`SKILL.md`).** "Otherwise load the sibling module…"
  became "Otherwise, before any other step, read the mode's module file below
  in full and follow it. The steps and report format of each mode exist only
  in that file; do not infer them." It names no host. The unsupported-mode
  stop sentence and the `verify` route bullet are byte-identical, so their
  ablation spans still match. Evidence: Codex `a06`, `p11`, `v04`, `v05`,
  `v09` never read the mode file.
- **Plans dropping findings or deferring decisions (`plan.md`).** Step 2
  separates decisions the evidence settles from those still open; step 4
  drafts "the smallest approach that covers the request and every confirmed
  cause it depends on"; the pointers list "confirmed findings, the decisions
  taken and why"; "Keep implementation details flexible" became "Leave
  flexible only details that do not change behavior or structure"; open
  questions are "not for decisions the evidence already settles". Evidence:
  `p08` on both hosts kept `rm -rf "$dest"`; Codex `p01`, `p12` left
  decisions open.
- **Exhaust the design space under-selected (`plan.md`,
  `principle-exhaust-the-design-space.md`).** Step 3 now selects principles
  before the draft, "whose triggers match the task, its findings, or its open
  decisions". Precedent now means this codebase ("even when a common approach
  exists elsewhere"; "patterns this codebase already establishes"), and in
  plan mode the agent must "compare the options, recommend one, and propose
  the prototypes that would confirm it". No other trigger changed and no
  tie-break was added; `principles.md` is unchanged.
- **Verify report gaps (`verify.md`).** "Run every check that can run here
  rather than deferring it"; unverified "only after attempting it and keeping
  the failure, or after stating why it cannot run here"; a new first
  Requirements section that notes what the supplied plan omits or
  contradicts; "The checks run, with their commands"; the unverified section
  needs the attempt and its result. The Decisions section and both
  `pstack-verify-request-first` spans are unchanged.
- **Auto report (`auto.md`).** The summary must include "the selected
  principles and what each shaped, the checks run and their results".
- **Packaging.** Version 0.4.1 in `SKILL.md`; the sync scripts updated both
  `plugin.json` files and `versions.json`; the pstack card in
  `docs/index.html` was fixed by hand. `pstack-plan-principle-links` was
  re-spanned to the new selection step in `evals/eve/ablations/manifest.ts`.

The 0.4.1 plan order (select principles, then draft) departs from the handoff
decision "Plan researches first, drafts the smallest approach, then selects
principles to refine it". That decision is left as written in
`docs/pstack-handoff.md`; whether to keep the new order is open (see the
over-selection below).

## Round 5 (`8c395a22`)

Same hosts, fixtures and grading as round 4: **C** is a Claude subagent
reading `pstack/skills/pstack/`; **X** is `codex exec -m gpt-6-luna` with a
real-directory skill copy in `.agents/skills/pstack` (identical to the
snapshot by `diff -r`), invoked with `$pstack <mode>`. Separate reviewers
graded each run against `$S/grading/`. Every run loaded the skill and left
its run copy unchanged.

Outputs: `$S/rerun/r5/<case>-<subagent|codex>` (run copy), with `.final.md`,
`.review.json`, and `.process.md` (C) or `.jsonl`, `.prompt.txt` and `.stderr`
(X). Probes stayed outside the run copies: `$S/rerun/r5/p08-repro.sh`,
`$S/rerun/r5/probe-v03-subagent/`, `$S/rerun/r5/probes-v09-subagent/`,
`$S/rerun/r5/v07-probe/`.

| Case | Host | Mode file read? | r4 → r5 | observation \| evidence \| suspected skill cause | Paths |
| --- | --- | --- | --- | --- | --- |
| `p08` plan | C | yes | Fail → **Fail** (6 principles) | r4 failure fixed: removes the unconditional `rm -rf`, resumes with rsync into `"$dest/"`, per-mirror `.state/<name>.json` written after the fetch, `mirror-sync` the only writer of `state.json`; race reproduced 5/5. Fails the 5-principle cap; Exhaust the design space is padding. Restart check injects a fetch failure instead of a mid-run kill \| principles list \| `plan.md:12-13` task-based selection widened the pick with no cap; `principles.md:3-4` "Keep the few that matter most" has no number; the broadened Exhaust trigger fires on an ordinary rsync-vs-journal choice. | `$S/rerun/r5/p08-mirror-sync-subagent.{final.md,process.md,review.json}` |
| `p08` plan | X | yes (`plan.md` first command) | Fail → **Pass** (weak on criterion 3) | Per-mirror atomic completion records, coordinator publishes `state.json` by rename, "done" not inferred from a directory existing; 5 principles. Names the delete at `bin/mirror-sync-one:11` as a cause but no decision removes it, so a killed mirror is re-copied; adds an unrequested "fresh run recopies" rule \| pointers 1-2 \| `plan.md:21-24` lists findings and decisions separately and never pairs each confirmed cause with the decision that resolves it. | `$S/rerun/r5/p08-mirror-sync-codex.{final.md,jsonl,review.json}` |
| `p10` plan | C | yes | Pass → **Pass** | Prior message as task; `acct.${action}` template handled; runtime guard plus source-scan test since bun has no typecheck; CONTRIBUTING bullet replaced; `docs/events.md` and tests updated; both bolded principles, 5 total. Rename is still a 13-site list with no codemod; Type system discipline dropped \| plan steps \| `principle-script-bulk-operations.md:12-13,27-28` lets a scan test alone satisfy it; `principle-type-system-discipline.md:3,5-6` assumes a type checker exists and never suggests adding one. | `$S/rerun/r5/p10-billing-events-subagent.{final.md,process.md,review.json}` |
| `p10` plan | X | yes | Fail → **Fail** | Audit template now settled and a leftover outcome stated, but bolded Script bulk operations still missing (file never opened), no script or rerunnable leftover command, no `tsc --noEmit` path under bun, CONTRIBUTING never opened; regression: `docs/events.md` dropped \| searches limited to `src tests package.json` \| `principles.md:3-4` lets generic picks crowd out a trigger that matches a finding; `plan.md:6` "relevant repository guidance" too vague (no CONTRIBUTING, README, docs); `plan.md:21-23` success checks come out as statements, not commands. | `$S/rerun/r5/p10-billing-events-codex.{final.md,jsonl,review.json}` |
| `p11` plan | C | yes | Pass → **Fail** (7 principles) | Content passes every criterion: `shipments[]` replace the flags, label and cancel/refund derived, stored `statusLabel` removed with o-103 named, legacy documents converted in `loadOrders`. Fails the cap with 7 principles, Exhaust the design space as padding; about 7.7 KB with 8 decisions \| principles list \| `plan.md:12-13` "open decisions" pulls Exhaust in for any open policy question; `plan.md:21-24` decisions-and-why grows the plan against "a few ordered pointers"; Minimize reader load still unselected (no tie-break). | `$S/rerun/r5/p11-order-fulfilment-subagent.{final.md,process.md,review.json}` |
| `p11` plan | X | yes (`plan.md` first command) | Fail → **Fail** | The r4 cause is fixed: `plan.md` read first and both bolded principles selected; shipment records replace single tracking. Still keeps the five booleans and the cached `statusLabel`, ignores `data/orders.json` (explicit FAIL), lists 6 principles, and opened no principle files \| transcript: no principle-file reads; file listing filtered to `*.ts` \| `plan.md:12-13` "Read their files" is a trailing clause Codex skips; no cap in `principles.md:4`; `plan.md:6-11` never asks for persisted or serialized data when a type's shape changes. | `$S/rerun/r5/p11-order-fulfilment-codex.{final.md,jsonl,review.json}` |
| `p12` plan | C | yes | Fail → **Fail** (8 principles) | r4 failure fixed: Exhaust selected, three conflict policies compared, (a) vs (b) prototyped on phone and editor; base hash, unattended runs, content-hash copies. Fails the cap with 8 principles (none padding); long plan with an unrequested lock file and atomic writes \| principles list \| `plan.md:12-13` lets every loosely matching trigger in; `principles.md:3-4` gives no number; `plan.md:21-23` checks of every selected principle lengthen the plan. | `$S/rerun/r5/p12-notes-sync-subagent.{final.md,process.md,review.json}` |
| `p12` plan | X | yes | Fail → **Pass** (criterion 3 partial) | Compares keep-both vs text merge vs abort and picks keep-both; baseline fingerprint now a firm prerequisite; idempotent retries; 4 principles. UX reasoning still omits unattended cron/launchd and the phone app though it read `README.md:14-15`; prototypes proposed for a secondary question; principle links use `principles/...` and do not resolve from the repo root \| pointers 2-4 \| `principle-prioritize-usability.md:10` leans on visual detail; `principle-exhaust-the-design-space.md:9-10`; `plan.md:25-26` link form. | `$S/rerun/r5/p12-notes-sync-codex.{final.md,jsonl,review.json}` |
| `v03` verify | C | yes | Pass → **Pass** | Requirements section first, says plan step 3 omits `--since`; executed evidence (`export --since 2026-03-18` 7 rows vs `list` 3); checks table with commands; no invented CSV defects; fingerprint unchanged. Both r4 frictions fixed. A maintainability note became a numbered finding \| `final.md` Finding 3 \| `verify.md:26-28` lets any principle citation promote a design suggestion to a finding. Minor. | `$S/rerun/r5/v03-orders-export-subagent.{final.md,process.md,review.json}` |
| `v03` verify | X | **no** | Fail → **Fail** (criterion 2) | r4 failure fixed: Requirements section says the plan omits `--since`. But the only executed evidence is a broken probe: `splitlines()[2:]` dropped A-1001 and a 2025-02-01 cutoff excludes nothing in all-2026 data, so "list correctly excluded A-1001" is false. Announced it would read the verify instructions, then did not \| transcript has 4 commands, none reads `verify.md` \| `SKILL.md:18-20` still skipped on Codex; `principle-prove-it-works.md:9-10` checks what a probe measures only on failure; `verify.md:12-14` never asks for an expected result derived from the inputs. | `$S/rerun/r5/v03-orders-export-codex.{final.md,jsonl,review.json}` |
| `v07` verify | C | yes | Pass → **Pass** | Tried `make test` and kept the failure; named Docker, VPN registry image, PG 16.4 and psycopg 3.2.3; ran a labelled substitute (PG 17, psycopg 3.3.6) with its gaps, plus a revert run; no findings; fingerprint unchanged. Never ran bare `python -m unittest` (`OK (skipped=5)`); opened no principle files \| `$S/rerun/r5/v07-probe/suite-change.txt` \| `verify.md:15-18` still gives no bound on network installs or hand-built substitute environments (same as r4). | `$S/rerun/r5/v07-users-soft-delete-subagent.{final.md,process.md,review.json}` |
| `v07` verify | X | yes | Fail → **Fail** (PASS-1) | r4 fabrication fixed: it ran `make test` and quoted the real docker.sock error (exit 2). Never ran `python -m unittest`, so `OK (skipped=5)` was never seen; needs list names only the Docker daemon, not the registry/VPN, psycopg or `TEST_DATABASE_URL` it read in the README \| `.jsonl` commands \| `verify.md:15-18` is satisfied once the required command fails, with no prompt to run the part that can run; `verify.md:32-33` does not ask for every documented prerequisite. | `$S/rerun/r5/v07-users-soft-delete-codex.{final.md,jsonl,review.json}` |
| `v09` verify | C | yes | Pass → **Pass** | Both seeded problems: trace asymmetry at `compare.sh:5` and warm-cache reuse (430 parses then 0); warm no-trace about 1.5x, CLI-shaped cold resolve 20.5 vs 20.8 ms; CHANGELOG rewording recommended; 4 principles. None. | `$S/rerun/r5/v09-resolver-cache-subagent.{final.md,process.md,review.json}`, `$S/rerun/r5/probes-v09-subagent/` |
| `v09` verify | X | **no** | Fail → **Fail** | Found the trace asymmetry; 10 alternating runs, median 1.42x with range. Its own fair bench repeats the warm 30-resolve loop, so the warm-cache artifact is missed and no cold resolve is run; end-to-end listed as unverified with no attempt; selected Explain the number without opening it \| 5 commands, none reads `verify.md` \| `SKILL.md:17-21` still skipped on Codex; `benchmark-checklist.md:23-25` treats cache state as a tuning knob, not workload realism; `benchmark-checklist.md:42-44` lets a runnable end-to-end check be listed instead of run. | `$S/rerun/r5/v09-resolver-cache-codex.{final.md,jsonl,review.json}` |

C: **4 of 7** re-run cases pass (`p10`, `v03`, `v07`, `v09`). X: **2 of 7**
pass (`p08`, `p12`). With the six round-4 passes per host that were not
re-run, the totals would be C 10 of 13 and X 8 of 13 if those still hold on
0.4.1; that is not measured.

## What improved

- Each targeted round-4 failure moved: Codex `p08` and `p12` now pass; the
  Codex `v03` plan omission, the `v07` fabricated check result and the `p11`
  mode-file skip are gone; Claude `p08` removes the `rm -rf` and Claude `p12`
  compares options and selects Exhaust the design space.
- Codex read the mode file in 5 of 7 runs (`p08`, `p10`, `p11`, `p12`,
  `v07`), against 7 of 12 in round 4. Every Claude run recorded the read.
- Verify reports now open with requirements and list checks with commands on
  both hosts; the Eve `verify-flawed-plan` reply in `run1.log` has the same
  shape.

## What still fails

- **Principle over-selection (new, from the repair).** Claude `p08` (6),
  `p11` (7), `p12` (8) and Codex `p11` (6) exceed the five-principle cap.
  Claude `p11` was a pass in round 4 and is a regression. Cause: the 0.4.1
  task-based selection in `plan.md:12-13` plus the broadened Exhaust trigger,
  with no cap in `principles.md:3-4`. Exhaust is padding in Claude `p08` and
  `p11`.
- **Codex still skips `verify.md`** in `v03` and `v09` despite the mandatory
  wording, and skips principle files it selected (`p11`, `v09`).
- **Content gaps on Codex:** `p10` (Script bulk operations, docs, CONTRIBUTING),
  `p11` (booleans, cached label, stored data), `v03` (invalid probe reported as
  evidence), `v07` (no partial run, incomplete needs list), `v09` (warm cache,
  no cold resolve).
- **Carried over:** Prioritize usability ignores unattended context (X `p12`);
  Type system discipline does not suggest adding a type check (C `p10`);
  substitute environments unbounded (C `v07`); plan principle links do not
  resolve from the repo root (X `p12`); a cause and the decision that resolves
  it are not paired (X `p08`).

## Eve iteration 5 (`0ad0de4f`, recorded in `05409cbb`)

Run on the contabo host (Eve and Docker ran only there; nothing was started
locally), gpt-6-luna subject and judge, pstack 0.4.1. Two runs: **11/11 and
11/11**; every eval passed 2/2. Ablations (`--runs 2`, every baseline green)
match iteration 4: `pstack-plan-principle-links` KILLED 2/2 (the first
measurement of the re-spanned 0.4.1 selection step) and
`pstack-route-unsupported-stop` KILLED 2/2; `pstack-verify-request-first`,
`pstack-route-verify` and `pstack-plan-missing-state` SURVIVED 2/2, and their
controls with pstack omitted failed, so the skill matters but those sentences
are still not isolated.

`0ad0de4f` fixed an eval-side regex in `verify-broken-impl.eval.ts`: it
matched `retry` but not `retries`, which failed a correct "changes between
retries" reply. An earlier interrupted attempt scored 9/11; besides that
regex, `plan-design-space` failed the at-most-five-principles gate with 8
principles, the same over-selection as round 5. That attempt is assumed to
have run 0.4.1 text from its timestamp, not confirmed. Logs:
`$S/evalrun-r5/{run1,run2,ablate}.log`, interrupted attempt in
`$S/evalrun-r5/old/`.

## Unverified

- `p01`, `p02`, `r13`, `v04`, `v05` and `a06` on both hosts at 0.4.1,
  including the new auto report contract.
- The Codex mode-file skip in `v04`, `v05` and `a06` at 0.4.1.
- Interactive Claude, interactive Codex, and the native Codex plugin install.

## Lane at `05409cbb` plus this record

Run locally (no Docker; Eve's live runs were on the contabo host):
`sync-plugin-versions.sh` updated 0 files; `generate-versions.sh` produced 22
skills; `validate-skills.sh` printed `Validation passed.`;
`validate-npx-install.sh` found all 40 skills discoverable; `git diff --check`
passed; in `evals/eve`, `typecheck`, `test:catalog` (22 public skills) and
`test:coverage` (45 expected evals) passed. The version-bump check is
reported with the commit that adds this record, since it evaluates committed
changes only.
