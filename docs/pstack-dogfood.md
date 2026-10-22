# pstack dogfood record

Short record of how pstack was dogfooded and where each mode stands at
0.4.4. The full round-by-round history (every run, its evidence and suspected
cause) is in the pull request description and in git history at `c208f986`
(`git show c208f986:docs/pstack-dogfood.md`).

## Method

- **Scenarios.** 13 fixed cases with grading criteria written before any run:
  six plan cases (`p01` tenant reports, `p02` ledger client migration, `p08`
  mirror sync race, `p10` billing events from the prior message, `p11` order
  fulfilment, `p12` notes sync), five verify cases (`v03` flawed plan, `v04`
  broken retries, `v05` correct change, `v07` required check cannot run,
  `v09` benchmark claim), one auto case (`a06` job durations, with hidden
  tests) and one unsupported mode (`r13`, `pstack review ...`).
- **Runs.** Each run starts from a fresh copy of a pristine fixture. The
  executing agent never sees the grading notes. A separate reviewer grades
  each run against its criteria, judges whether the result is reasonable even
  when a strict criterion fails, and checks that the run copy is unchanged
  (git status or the verify diff fingerprint).
- **Hosts.** **C** is a fresh Claude subagent reading the skill files from
  this worktree. **X** is `codex exec` with `pstack/skills/pstack` copied as a
  real directory into the run copy's `.agents/skills/pstack` (Codex ignores
  symlinked skill directories) and the prompt `$pstack <mode> ...`. **Eve** is
  the `evals/eve` lane: `gpt-6-luna` as subject and judge through Eve's own
  skill loader, so it is not the Codex host.
- **Rerun.** Fixtures, grading notes, scenarios and the Codex runner are in
  `evals/pstack-dogfood/`; its README says how to build fixtures, run a round
  on either host and review it. A fresh build reproduces all 12 fixtures
  exactly (HEAD trees and verify fingerprints match the graded rounds). Run
  outputs stayed outside the repo; this record quotes the evidence it uses.

## Current state at 0.4.4

The skill text is unchanged since `09fa61c8` (0.4.4).

| Mode | Claude subagent | Codex `gpt-6.1-sol` | Eve `gpt-6-luna` |
| --- | --- | --- | --- |
| plan | r7 at 0.4.4: 12 of 12 plans reasonable, 6 of 12 pass the strict criteria | r6 at 0.4.2: 5 of 6 (`p11` fails on Redesign; `p08` weak) | iteration 7 at 0.4.4: 3 of 4 plan evals (`plan-design-space` fails the 5-principle gate with 6) |
| verify | r8 at 0.4.4: 5 of 5 | r6 at 0.4.2: 5 of 5 | iteration 7: 5 of 5, including `verify-pr-only` |
| auto | r8 at 0.4.4: `a06` pass | r6 at 0.4.2: `a06` pass, weak report | iteration 7: `auto-job-durations` pass |
| routing | r8 at 0.4.4: `r13` pass; `claude -p --plugin-dir` routed all three modes at 0.4.0 (`132d3f8e`) | r6 at 0.4.2: `r13` pass | iteration 7: `route-unsupported-mode` and `route-no-task-asks` pass |

Eve's fourth plan eval is `route-current-task` (plan from the prior message).

- **Claude:** static packaging validates; `/pstack <mode>` is the only
  command and routes in `claude -p`; every r7 and r8 mode run read
  `SKILL.md` and then the mode file. Interactive Claude was not run.
- **Codex:** static packaging validates; runtime use is verified for a
  repo-scoped real-directory copy under `codex exec`, where `SKILL.md` comes
  from the `$pstack` mention. `gpt-6.1-sol` read the mode file as its first
  command in all 12 r6 mode runs. Codex was not rerun at 0.4.3 or 0.4.4.

Open frictions at 0.4.4:

- **Accepted behavior:** the plan recheck drops a should-select principle
  when the draft already does what it says (r7 `p10` #1, `p11` #1 and #2,
  `p12` #2). Graded strictly, these are FAILs.
- **`p08`:** the unconditional `rm -rf` at `bin/mirror-sync-one:11` is a
  confirmed cause that a plan can still leave as an open question (r7 #1;
  r6 C fail, X weak pass).
- **Principle count:** without a numeric cap, r7 `p12` #1 listed 7 and Eve
  `plan-design-space` listed 6, two of which only restated its check step.
  The Eve gate `atMostPrinciples(5)` (four evals) and the grading README's
  more-than-five rule predate 0.4.4; whether to keep, loosen or replace them
  is a policy choice.
- **Verify text (r8, minor):** every Decision gets options although 0.4.4
  limited that in plan only (`verify.md:33-34`); a Decision can come from a
  plan's goal rather than the request; Non-blocking notes are always present
  next to "concise"; probes are "temporary" while Prove it works asks for
  repeatable checks; a substitute check's installs need not be reported
  (`verify.md:17-20`, carried since r4).
- **Exhaust the design space in verify:** its reworded trigger matches the
  product choices a verify turns up, and the file has no verify branch (r8
  `v07` opened and dropped it).
- **Carried from r6, not rechecked at 0.4.4:** the auto report does not ask
  for behavior changes (X `a06`); Codex `v05` Boundary discipline padding;
  Type system discipline assumes a type checker; Minimize reader load
  unselected in `p11`; plan principle links resolve only inside the skill;
  planning-time probes left behind; a money-affecting policy decided without
  an open question (X `p11`).

## Rounds

C is the Claude subagent unless noted; X is Codex.

| Round | Snapshot | Hosts | Result | What changed because of it |
| --- | --- | --- | --- | --- |
| 0.1.0-0.3.1 | each version | Codex subagents, one to three read-only passes per version | No skill friction after the 0.1.0 entrypoint fix | 0.1.0: the validator rejected a standalone `poteto-mode`, so pstack became a public umbrella with a shared module. Later passes needed no repair. |
| r1 (superseded) | `dc376f4d` (0.4.0) | C, X | Invalid: concurrent duplicate runs edited fixtures in place; X never loaded the skill | `b2715a4a` widened the Exhaust trigger (`p12`); `221737ac` made the unsupported-mode stop explicit (`r13`, Eve). The round was redone. |
| corrected r1 | `9abb72f6` (text of `221737ac`) | C, X `gpt-6-luna` (symlinked skill) | C 9 of 13, X 0 of 13 (skill never loaded) | `9fb7f086`: verify always includes Prove it works, opens selected principle files, keeps probes outside the tree, reports a blocked check as unverified; plan gets a findings slot; wider Script bulk and Minimize reader load triggers. |
| r2 | `9fb7f086` | C, X (10 cases) | C 8 of 10, X 0 of 10 | `v05` regressed (intended URL renames filed as a Finding), so `fdc6b1eb` added the verify Decisions section. |
| r3 | `fdc6b1eb` | `claude -p` (opus 5.5), `v05` and `v07` only | `v05` pass, `v07` fail (never ran the part of the suite that could run) | No skill change. Before r4, the hidden per-mode wrappers were removed (`132d3f8e`, user's choice) and a load probe showed Codex needs a real-directory skill copy. |
| r4 | `d98be54b` (0.4.0) | C, X `gpt-6-luna` (real copy), all 13 | C 11 of 13, X 6 of 13 | 0.4.1 (`8c395a22`): mandatory mode-file read, plans keep findings and decisions, principles selected before the draft, verify Requirements section and attempt-before-unverified, auto report lists principles and checks. |
| r5 | `8c395a22` (0.4.1) | C, X `gpt-6-luna`, 7 cases | C 4 of 7, X 2 of 7 | Over-selection (6 to 8 principles). With the prompt audit, 0.4.2 (`7ad0641a`): draft, then select, then recheck; an options comparison for unprecedented decisions; at most five principles; 12 trigger rows rewritten; verify from a PR description. |
| r6 | `7ad0641a` (0.4.2) | C, X `gpt-6.1-sol` fast tier, all 13 | C 10 of 13, X 12 of 13 | Sol read the mode file first in 12 of 12, so 0.4.3 (`89b0f999`) shortened the routing sentence. Exhaust padding in 8 of 12 plans, the cap read as a quota, and longer plans led to 0.4.4 (`09fa61c8`). |
| r7 | `09fa61c8` (0.4.4) | C only, 6 plan cases twice | 12 of 12 reasonable, 6 of 12 strict; Exhaust only in `p12`; every plan shorter than r6 | Recheck drops accepted as intended. No skill change. |
| r8 | `09fa61c8` (0.4.4) | C only, 7 non-plan cases | 7 of 7 pass and reasonable | No skill change. |

The X move from 6 of 13 (r4) to 12 of 13 (r6) mixes a model change
(`gpt-6-luna` to `gpt-6.1-sol`) with the skill change; no run separates them.

## Round 8: verify, auto and unsupported mode at 0.4.4

Claude subagent, one run per case at `09fa61c8`, from fresh fixture copies,
each graded by a separate reviewer. This checks the 0.4.4 changes (no numeric
cap, no inline Exhaust link) against the cases round 7 did not run. Every run
read `SKILL.md` first and then its mode file (`r13` correctly read only
`SKILL.md`), and every run copy was unchanged at the end.

| Case | Result | Principles | Evidence | Friction |
| --- | --- | --- | --- | --- |
| `v03` verify | **Pass** | Prove it works, Test behavior, Laziness protocol | Requirements taken from the ticket before the plan; says plan step 3 applies only `--status`; list-vs-export parity table, with a fixed copy matching all 7 cases; quoting checked by a CLI round trip and a mutant. 1,167 words (r6: 1,206). | One Decision comes from the plan's goal, not the ticket (`verify.md:33-34`; two in r6); coverage pulls against "concise" (`verify.md:17-20` vs `:22`). Minor, eased. |
| `v04` verify | **Pass** | Prove it works, Make operations idempotent, Test behavior, Laziness protocol | `attempt <= maxAttempts` at `src/dispatch.ts:38` (4 requests, delays 200/400/800 for a 500 and for ECONNREFUSED); `randomUUID()` per attempt at `:43` (3 keys); the existing tests pass on both the change and a corrected copy (9/9), so they catch neither defect. | None. |
| `v05` verify | **Pass** | Prove it works, Test behavior | Unittest 9 OK; HEAD `slugify` fails 3 new tests; old and new site builds compared; an all-code-point equivalence probe found 0 mismatches and caught two mutants; URL rename under Decisions. r6 padding (Script bulk) gone. | Every Decision gets options (`verify.md:33-34`), so the settled rename got three plus a hypothetical second Decision; Non-blocking notes always present (`verify.md:22,35`); probes "temporary" vs repeatable (`verify.md:15-16`, `principle-prove-it-works.md:15-16`). Minor. |
| `v07` verify | **Pass** | Prove it works, Test behavior | Kept the `make test` failure; ran bare `python -m unittest` and called `OK (skipped=5)` non-evidence, which the r4-r6 Claude runs never did; labelled stand-in Postgres 17 run. Every criterion passes in full for the first time. | Opened Exhaust and dropped it (`principles.md:16` trigger, no verify branch in the file); the psycopg install into a venv is not in the report, so the substitute cannot be repeated from it (`verify.md:17-20`). |
| `v09` verify | **Pass** | Prove it works, Explain the number | Trace only on the baseline at `compare.sh:5` (16.4 ms of the 23.8 ms gap); one `Registry` for 30 resolves (430 parses and 0 hits on the first resolve); fair warm about 1.5x, cold about 1.0x, no CLI difference. | None. |
| `a06` auto | **Pass** | Boundary discipline, Test behavior, Prove it works | `src/duration.ts` with exact BigInt rounding; `config.ts` wraps errors as `ConfigError` naming job and field; `runner.ts` untouched; `bun test` 60/0, `run-hidden.sh` 104/0 (60 visible plus 44 hidden). Never opened Exhaust (r6 did). | None. |
| `r13` unsupported | **Pass** | none | Whole reply is `pstack plan\|verify\|auto [task]`; read only `SKILL.md`; no command run in the fixture. | None. |

Result: 7 of 7, the same as round 6 on this host, with no regression.
Padding went from 1 (r6 `v05`) to 0, and the six mode runs list 16 principles
against 21 in r6 (2 to 4 each), so removing the cap did not inflate them.

## Eve

Iteration 7 tested `1e5c4916` (0.4.4; skill text from `09fa61c8`) with one
full live run on the contabo host and the lane's default `gpt-6-luna`:
**11 of 12** (iteration 6 at 0.4.3: 10 of 12 and 9 of 12).
`bun run test:pstack-graders` passed all 15 checks.

- `plan-attack-premise` passed: it selected Attack the premise for the first
  time (0 of 3 in iteration 6) and did not select Exhaust.
- `route-current-task` passed with 3 principles, none of them Exhaust.
- `plan-design-space` failed only the gate "selects at most 5 principles": it
  selected 6, including both Exhaust and Prioritize usability, passed the
  judge, and stayed at 414 words. Test behavior and Prove it works only
  restated its check step, which 0.4.4's `principles.md` says to leave out.
  Recorded as skill-side; the eval was not changed or re-run.
- Every other eval passed. `auto-job-durations` again failed a soft check
  (the suite exited 127 in the sandbox), as in iteration 6.

Ablations were not run in iteration 7. The last ones (iteration 6, 0.4.3):
`pstack-route-unsupported-stop` KILLED; `pstack-verify-request-first` and
`pstack-route-verify` SURVIVED with failing controls;
`pstack-plan-missing-state` FLAKY; `pstack-plan-principle-links` unmeasured
(red baseline). Iterations 1-7 are described in `evals/eve/README.md`.

## Lane

At `c208f986` plus this record: `sync-plugin-versions.sh` updated 0 files;
`generate-versions.sh` produced 22 skills; `validate-skills.sh` passed;
`validate-npx-install.sh` found all 40 skills discoverable;
`git diff --check` passed; in `evals/eve`, `typecheck`, `test:catalog` (22
public skills) and `test:coverage` (46 expected evals) passed. The
version-bump check runs on the commit that adds this record.

## Not verified

- Codex at 0.4.3 or 0.4.4, and the plan cases on Codex since r6.
- The native Codex plugin install, interactive Codex and interactive Claude;
  `claude -p` routing since 0.4.0.
- Run-to-run variance: r8 ran each case once, and Eve iteration 7 once.
- Verify from a pull request description alone, other than Eve
  `verify-pr-only` on `gpt-6-luna`.
- Which ablated sentences each eval guards at 0.4.4.
