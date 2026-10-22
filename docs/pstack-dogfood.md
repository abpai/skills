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
  Several runs searched the filesystem and read the stale 0.3.1 SKILL.md in the
  main checkout before the run copy's 0.4.0 file. The `.codex-plugin`
  marketplace install was checked statically only (manifest valid, every
  `agents/openai.yaml` has `allow_implicit_invocation: false`).
- **Eve evals (`evals/eve`, gpt-6-luna subject and judge):** 11 pstack evals,
  two full passes per iteration plus ablations. No Anthropic pass: no
  `ANTHROPIC_API_KEY`.

## Dogfood round 1 (`dc376f4d`)

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
| `p10` plan, C | Same task. The ledger handed to this write-up was truncated after criterion 1 (fallback met). | The rest of this row and the C rows for `p11`, `p12`, `r13` were not in the input, so they are not reported here. | Re-record from the subagent transcripts if they are needed. |
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

- `/pstack:verify`, `/pstack:plan`, and `/pstack:auto` hidden wrappers do
  nothing in `claude -p` and give no error. The interactive Claude path for
  them, and `/pstack:pstack verify|auto` through the host, were not run.
- Codex native `$pstack` discovery and the `.codex-plugin` marketplace install
  are unproven at runtime.
- The `221737ac` and `b2715a4a` repairs were rechecked through Eve only, not by
  repeating the failing dogfood cases (`p12` X, `r13` behavior in Claude).
- Unrepaired friction, ranked: Codex verify can skip `verify.md` entirely
  (`v03`); verify has no rule for a blocked required check (`v07`); auto's
  verify step collapses into running tests (`a06` X); plan length and nesting
  (`p01` C); Script bulk operations never fires on a rename (`p10`, Eve).
- The request-first sentences in `verify.md` and the verify routing bullet
  survive ablation; current evals do not show they matter.
- Eve still grades an infrastructure fault as failed, not errored, so an
  outage in an ablated run would read as KILLED.
- The Codex round used the host's configured model, not gpt-6-luna. The Eve
  lane already defaults to gpt-6-luna (`da68a018`).

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
- Version gate on the committed tree: see the handoff's current state.
