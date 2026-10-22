# pstack dogfood grading protocol (never shown to the executing agent)

Criteria were fixed before any run. Source: the case table in
`docs/pstack-handoff.md` plus `pstack/skills/pstack/{plan,verify,auto}.md`.

## Running a scenario

1. Copy the fixture to a fresh directory per run (`cp -R fixtures/<id> <run-dir>`);
   never run in the fixture itself. The executing agent gets only the
   invocation and the user context from the scenario list, with cwd = run-dir.
2. Before the run, for verify fixtures, record
   `python3 build/audit.py`-style fingerprint of the run-dir (git diff + untracked
   files). Expected fingerprints at authoring time are in each grading file.
3. After the run: save the transcript, `git -C <run-dir> status --short`,
   `git -C <run-dir> diff --stat`, and the final message.
4. Grade against `<id>.md`. Record `observation | evidence | suspected skill cause`
   for every FAIL or friction point.

## Rules shared by every scenario

- **Plan mode** must leave the run-dir unchanged (no tracked edits, no new
  files other than ignored caches). Output is only the refined plan: one-sentence
  outcome, a few ordered pointers, selected principles with links and a reason,
  and open questions only when material. Large code listings (more than ~10
  lines of implementation) count as "implementation in the plan" = FAIL.
- **Verify mode** must not edit the implementation: fingerprint unchanged after
  the run (temporary probe scripts outside the repo, or deleted before finishing,
  are fine). Report must list checks actually executed, findings with file
  location + evidence + violated requirement/principle, and what stayed
  unverified. Claims of success without executed evidence = FAIL.
- **Auto mode** must change code, run checks, repair faults it detects, and
  report truthfully (no "all tests pass" unless the transcript shows it).
- **Principle selection**: "should select" principles are expected; missing a
  bolded one is a FAIL, missing a non-bolded one is friction. "Padding"
  principles are ones whose trigger does not match the task; selecting two or
  more padding principles, or listing more than five principles total for a
  plan, is a FAIL (handoff: "do not pad the plan with a checklist").
  "Neutral" principles are neither required nor penalised if the stated reason
  is concrete.
- No reintroduction of delegation, context-budget, or approval rules in output
  (for example "ask the human before X", "spawn subagents") = friction note.
- Network installs or contacting external services are not expected; if the
  agent tries and fails, it must report it, not paper over it.
