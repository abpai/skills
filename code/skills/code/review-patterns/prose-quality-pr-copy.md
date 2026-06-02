# Prose Quality And PR Copy

Role: Review changed prose and PR copy as a skeptical technical editor. Keep the
meaning; make the text specific, human, and backed by evidence a reviewer can
check.

## Goal

Catch the risk that user-facing prose ships claims no one verified: invented
behavior, hyped value props, commands or paths that do not exist, or rewritten
history. Done means every kept claim traces to the diff, a validation artifact,
a repo source, or a cited external source, and anything unverifiable is marked
unknown rather than polished over.

## Use When

Use for changed Markdown, README/docs, release notes, changelogs, handoff text,
inline user-facing guidance, or `pr-body-draft.md`.

## Success Criteria

- Every claim traces to the diff, a validation artifact, a repo source, or a
  cited external source; the rest are marked unknown.
- Commands, paths, flags, versions, links, and examples are verified against the
  repo or marked unknown.
- The PR body opens with the behavior change, then why it matters, a brief how,
  validation, selected/skipped gates, and residual risk.
- Filler, hype adjectives, formulaic contrast, and generic phrasing are cut or
  rewritten into concrete statements.
- Changelog and release claims keep real chronology and source evidence.

## Constraints

- Do not turn PR text into marketing copy.
- Do not invent value props, metrics, dates, customer impact, or roadmap status.
- Do not mechanically swap punctuation; fix the sentence.
- Do not expand a small docs edit into a full docs rewrite unless asked.

## Quick Pass

1. List the changed prose files and any generated PR text.
2. Read each for the behavior change it claims, its validation, and its stated
   risk.
3. Replace generic claims with the specific changed surface plus its evidence.
4. Verify each command, path, flag, and example against the repo; mark any you
   cannot confirm as unknown.
5. Restructure the PR copy to the section order in Success Criteria.
6. Record files reviewed and every claim left unverified.

## Deep Escalation

Use for public READMEs, release notes, changelogs, setup docs users follow, or
PRs with high reviewer or customer visibility. Run or trace each example command
where practical, verify historical claims against git history, tags, issues, and
releases, and keep a before/after prose diff.

## Evidence

Record the files reviewed (with `file:line` for changed claims), before/after
snippets for rewritten passages, the commands or links you ran to verify
examples and their results, the validation artifacts each claim leans on, and
any check you skipped.

## Skip Or Stop Rules

Skip when there is no human-facing prose and no PR copy is being prepared. Stop
when a claim needs external truth you cannot verify; mark it unknown instead of
writing around it.

## Output

Return the edits to apply or a replacement PR body in the Success Criteria
section order, the gate decision recorded in `gate-decisions.md` (`run`, `skip`,
`deep`, `override`, or `blocked`), and the supporting evidence.
