import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"
import { prompt } from "../support/text"
import { noFailedSkillLoads, noWrites } from "../support/tools"
import {
  MODULE,
  SERIES_DROP_OR_SPLIT,
  SERIES_REDACTION_BYPASS,
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
// series must do; keep a defect a finding wherever its fix lands; report a
// premise doubt with the smaller alternative; keep Decisions to choices only
// the requester can make, leaving out what the request already decides and
// gaps a later commit closes (one note at most).
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
    const decisions = markdownSection(reply, /^decisions?\b/i)
    const premise = markdownSection(reply, /^premise\b/i)
    const findings = markdownSection(reply, /^findings?\b/i)

    // a. The real defect, located at the helper whose output skips redaction.
    t.check(
      turn.message,
      mentionsAll(
        [/--follow|\bfollow\b/i, SERIES_REDACTION_BYPASS, /stream\.ts/],
        "reports that --follow prints secrets unredacted, located at src/stream.ts",
      ),
    )
    // d. The premise doubt, with what to do about it.
    t.check(
      premise ?? "",
      mentionsAll(
        [/\bsymbols?\b/i, SERIES_DROP_OR_SPLIT],
        "Premise names the symbols command and says to drop it or split it out of the PR",
      ),
    )
    // b and c stay out of Decisions.
    t.check(
      decisions,
      satisfies((s: unknown) => typeof s === "string", "the report has a Decisions section"),
    )
    t.check(
      decisions ?? "",
      satisfies(
        (s: unknown) => typeof s === "string" && !SERIES_UNCALLED_HELPER.test(s),
        "Decisions leaves out parseInterval, which the next commit calls",
      ),
    )
    t.check(
      decisions ?? "",
      satisfies(
        (s: unknown) => typeof s === "string" && !/--grep|\bgrep\b/i.test(s),
        "Decisions does not re-ask --grep with --follow, which the PR decides",
      ),
    )

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
    t.check(
      decisions ?? "",
      satisfies(
        (s: unknown) => typeof s === "string" && !/redact/i.test(s),
        "the redaction bypass is a finding, not a decision",
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
