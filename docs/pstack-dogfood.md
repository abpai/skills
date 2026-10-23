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

## Current state at 0.4.5

0.4.5 changes only `verify.md` (round 9). Plan, auto and routing text is
unchanged since `09fa61c8` (0.4.4).

| Mode | Claude subagent | Codex `gpt-6.1-sol` | Eve `gpt-6-luna` |
| --- | --- | --- | --- |
| plan | r7 at 0.4.4: 12 of 12 plans reasonable, 6 of 12 pass the strict criteria | r6 at 0.4.2: 5 of 6 (`p11` fails on Redesign; `p08` weak) | iteration 7 at 0.4.4: 3 of 4 plan evals (`plan-design-space` fails the 5-principle gate with 6) |
| verify | r8 at 0.4.4: 5 of 5; r9 at 0.4.5: 10 of 11 real commits better than 0.4.4 | r6 at 0.4.2: 5 of 5 | iteration 7: 5 of 5, including `verify-pr-only` |
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
  more-than-five rule stay as a padding heuristic (user decision, after
  iteration 7): an occasional red like `plan-design-space` is accepted when
  the plan is otherwise reasonable.
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
| r9 | 0.4.5 `verify.md` | C (Sonnet subagents), 11 commits of a private 50-commit series, 0.4.4 and 0.4.5 side by side | 0.4.5 preferred on 10 of 11; decisions 29 to 14; real defects 14 to 21 | 0.4.5: series-aware verify, premise check, narrower Decisions. |

The X move from 6 of 13 (r4) to 12 of 13 (r6) mixes a model change
(`gpt-6-luna` to `gpt-6.1-sol`) with the skill change; no run separates them.

## Round 9: verify noise on a real commit series (0.4.5)

Source: a private 50-commit series reviewed by pstack verify 0.4.4 plus
Codex, with a triage step that turned unpatched findings into decisions.
142 decisions reached the human. A label pass (kept outside the repo) found
only 18 should have been decisions: 48 were gaps a later commit closed, 22
were real defects, 27 were "keep" or already decided, and 16 were commit-message
nits. Premise doubts were asked but answered weakly. Verify reports were 2.6
times the size of Codex's.

0.4.5 changes `verify.md` only:

- A commit in a series is judged against the finished series; a piece a
  later commit adds (a caller, a doc update) is not a defect, but behavior
  the commit breaks still is.
- A premise check (step 2) with its own report section, which names the
  smaller alternative when in doubt.
- A defect stays a Finding when its fix belongs in another file or commit.
- Decisions are only choices the requester can make that change what ships;
  already-decided items, later-commit gaps and "keep" recommendations stay out.
- Checks are one line each; commit-message fixes and follow-ups are notes, and
  series gaps share one note.

Evidence (Claude Sonnet subagents, the run's original prompt, 0.4.4 and 0.4.5
on the same 11 commits the same day, one neutral reviewer per pair checking
disputed defects in the code):

| Measure | 0.4.4 | 0.4.5 |
| --- | ---: | ---: |
| Preferred report | 1 | 10 |
| Decisions | 29 | 14 |
| Genuine decisions | 6 | 6 |
| Real defects found | 14 | 21 |
| Series gaps filed as decision or defect | 13 | 7 |
| Bytes | 96,275 | 96,921 |

The one loss (a rename that broke the intermediate commit, filed as a later
gap) led to the "behavior the commit breaks still is" clause; two reruns of
that commit then reported it as a defect. Not fixed: reports are no shorter,
and premise doubts on weakly justified commits still often end in "keep"
with visible reasons rather than a drop decision.

## Eve

Iteration 8 (0.4.5 `verify.md`, contabo, `gpt-6-luna`): the 12 existing pstack
evals passed in one full run, and `verify-broken-impl` and
`verify-correct-change` passed again on the final text. The new
`verify-series-commit` eval: every graded run kept the uncalled helper and the
already-decided `--grep` rule out of Decisions and reported the `--follow`
redaction bypass. Early reds were grader wording (the `symbols` doubt phrased
as "separated" or "outside the requested change"); the graders now accept
those, with near misses in `test:pstack-graders` (19 blocks, passed). The
model puts that doubt under Findings more often than under Premise, so only
the Premise placement is soft. The final run passed 14/14; one run hung on its
own `logs --follow` probe until the 10-minute timeout. The sandbox has no
`bun`, so these runs probe with Node.

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
- Run-to-run variance: r8 ran each case once, and Eve iteration 7 once;
  r9 ran each commit once per version.
- 0.4.5 `verify.md` on Codex, and on the round 1-8 verify fixtures other
  than the Eve verify evals.
- Verify from a pull request description alone, other than Eve
  `verify-pr-only` on `gpt-6-luna`.
- Which ablated sentences each eval guards at 0.4.4.
