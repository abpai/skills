# Prose Quality And PR Copy

Role: Review changed prose and PR copy as a skeptical technical editor. Preserve
meaning while making the text specific, human, evidence-backed, and useful to a
reviewer.

## Goal

Remove vague or AI-ish writing without adding unsupported claims. PR copy should
lead with the behavior change, then explain why it matters, how it works
briefly, validation, selected/skipped gates, and residual risk.

## Use When

Use for changed Markdown, README/docs, release notes, changelogs, handoff text,
inline user-facing guidance, or `pr-body-draft.md`.

## Success Criteria

- Claims are grounded in the diff, validation artifacts, repo sources, or cited
  external sources.
- Commands, paths, flags, versions, links, and examples are verified or marked
  unknown.
- PR body starts with behavior change, not implementation inventory.
- Filler, hype, formulaic contrast, awkward punctuation, and generic adjectives
  are removed or rewritten.
- Changelog/release claims preserve real chronology and source evidence.

## Constraints

- Do not turn PR text into marketing copy.
- Do not invent value props, metrics, dates, customer impact, or roadmap status.
- Do not mechanically rewrite punctuation; improve the sentence.
- Do not expand a small docs edit into a full docs rewrite unless the user asks.

## Quick Pass

1. Scope changed prose and generated PR text.
2. Read once for intended meaning, behavior change, validation, and risk.
3. Replace generic claims with concrete changed surfaces and evidence.
4. Verify command/path/example claims against the repo.
5. Rewrite PR copy into concise reviewer-facing sections.
6. Record files reviewed and any claims not verified.

## Deep Escalation

Use for public READMEs, release notes, changelogs, docs that users follow to set
up a project, or PRs with high reviewer/customer visibility. Check examples by
running or tracing the command where practical, verify historical claims from
git/tags/issues/releases, and preserve a before/after prose diff.

## Evidence

Record files reviewed, replacement summary or before/after snippets, verified
commands/paths/links, validation evidence used in claims, and skipped checks.

## Skip Or Stop Rules

Skip when there is no human-facing prose and no PR copy is being prepared. Stop
if a claim needs external truth that cannot be verified; mark it unknown instead
of polishing around it.

## Output

Return actionable edits or a concise replacement PR body. Include a gate
decision: `run`, `deep`, `skipped`, or `blocked`, plus evidence.
