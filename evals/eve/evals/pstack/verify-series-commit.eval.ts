import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads, noWrites } from "../support/tools"
import {
  MODULE,
  SERIES_DROP_OR_SPLIT,
  SERIES_REPORT_GATES,
  SERIES_SYMBOLS,
  SERIES_UNCALLED_HELPER,
  TEST_RUN,
  captureState,
  checkUnchanged,
  markdownSection,
  mentionsAll,
  packRepo,
  ranCommand,
  readFileMatching,
  seedRepo,
} from "../support/pstack"

// Contract (verify.md): judge one commit of a series against what the finished
// series must do, so a piece a later commit adds is not a gap (one note at
// most); keep a defect a finding wherever its fix lands; report a premise
// doubt with the smaller alternative; keep Decisions to choices only the
// requester can make, which nothing in the request settles.
//
// Fixture pstack-v10-series-commit: base plus a three-commit series for one
// PR. The review target is the middle commit (HEAD~1, "logs: add --follow"):
//   a. `logs --follow` streams through the existing pipeFile helper in
//      src/stream.ts, which prints raw lines, so secrets that plain `logs`
//      redacts print unredacted. The fix belongs in src/stream.ts (or in how
//      logs calls it); the commit does not touch that file. Tests pass.
//   b. src/interval.ts exports parseInterval, which nothing calls until HEAD.
//   c. --follow rejects --grep, as the PR description decides.
//   d. The commit also adds an unrelated `devkit symbols` command (~130
//      lines); the README says Tracewell already symbolicates uploaded errors.
export default defineEval({
  description: "pstack verify reviews the middle commit of a series: real defect as a finding, premise doubt, no noise in Decisions.",
  tags: ["live", "pstack", "contract"],
  timeoutMs: 600_000,
  async test(t) {
    const repo = packRepo("pstack-v10-series-commit", "devkit")
    await seedRepo(t, repo)

    const turn = await t.send(
      prompt(
        "pstack verify commit HEAD~1 (\"logs: add --follow to stream new lines\"). It is",
        "the second commit of a three-commit pull request: HEAD~2 and HEAD are the",
        "other two, and reviewers take the PR one commit at a time.",
        "",
        "PR title: Add `devkit logs --follow`",
        "PR description: Developers watch service logs with `tail -f logs/app.log`,",
        "which prints tokens and passwords in the clear onto shared screens.",
        "`devkit logs` already redacts secrets, but it only prints a snapshot. This",
        "PR adds `devkit logs --follow`, which keeps printing new lines as they",
        "arrive, with the same redaction as plain `devkit logs`. --follow",
        "deliberately rejects --grep: pipe the stream to grep instead, so the live",
        "stream has one code path. Commits: (1) resolve the log file from",
        "devkit.json, (2) add --follow, (3) add --interval to tune polling.",
      ),
    )
    t.succeeded()
    t.loadedSkill("pstack")
    t.check(turn.toolCalls, noFailedSkillLoads())
    t.check(turn.toolCalls, readFileMatching(MODULE.verify, "read pstack/verify.md"))
    t.check(turn.toolCalls, ranCommand(TEST_RUN, "ran the test suite"))

    const reply = typeof turn.message === "string" ? turn.message : ""
    const premise = markdownSection(reply, /^premise\b/i)
    const findings = markdownSection(reply, /^findings?\b/i)

    // a. The redaction bypass, as a finding located at pipeFile/src/stream.ts.
    // d. The symbols premise doubt, with what to do about it.
    // b, c, and a stay out of Decisions.
    for (const gate of SERIES_REPORT_GATES) {
      t.check(reply, satisfies((s: unknown) => typeof s === "string" && gate.passes(s), gate.label))
    }
    t.check(
      premise ?? "",
      mentionsAll([SERIES_SYMBOLS, SERIES_DROP_OR_SPLIT], "the symbols doubt sits under Premise"),
    ).soft()

    // Soft evidence.
    t.check(turn.toolCalls, readFileMatching(/stream\.ts/, "inspected src/stream.ts")).soft()
    t.check(
      reply,
      satisfies(
        (s: unknown) =>
          typeof s === "string" &&
          s.split("\n").filter((line) => /parseInterval/.test(line)).length <= 1 &&
          !SERIES_UNCALLED_HELPER.test(findings ?? ""),
        "parseInterval appears at most once, as a note rather than a finding",
      ),
    ).soft()
    t.judge.autoevals.closedQA(
      prompt(
        "This report reviews one commit of a three-commit pull request. Does it",
        "report the --follow redaction bypass as a defect, question whether the",
        "unrelated symbols command belongs in the pull request, keep its",
        "Decisions to choices only the requester can make (not the --grep",
        "rejection the description already decided, and not a helper the next",
        "commit wires up), and avoid inventing defects the code does not have?",
      ),
      { on: turn.message },
    )

    t.check(turn.toolCalls, noWrites())
    checkUnchanged(t, repo, await captureState(t, repo))
  },
})
