---
name: human-writer
description: >-
  Rewrite AI-sounding drafts into natural, specific prose. Use when asked to
  humanize, deslop, or remove model-generated patterns, or when prose feels
  generic, over-polished, promotional, repetitive, or too tidy.
metadata:
  author: Andy Pai
  version: "1.4.1"
  upstream_skill: "https://github.com/blader/humanizer"
  tags: "writing editing humanize voice anti-slop GEO"
---

# Human Writer

Use this skill to make text sound like a person wrote it, not a model.

Read `references/patterns.md` only when diagnosing AI tells, doing a second
pass, or explaining remaining patterns.

## Working stance

- Preserve the author's meaning, facts, and intended register.
- Fix the strongest AI tells first. Do not force extra personality if plain prose already works.
- Match the audience and medium. Technical writing can stay direct; casual writing can stay casual.
- Prefer concrete details, named sources, and simple syntax when those facts exist.
- If a line sounds like a press release when read aloud, rewrite it.

## Review flow

1. Read once for meaning and tone.
2. Mark the spots that feel inflated, repetitive, vague, or too tidy.
3. Revise in a second pass using the pattern catalog as a checklist, not a script.
4. Read aloud and trim anything that still feels synthetic.

This flow is complete when the intended meaning and register are preserved,
suspect spans have been handled, and the final read-aloud pass no longer sounds
inflated, vague, or synthetic.

## Heuristics

- Cut empty praise, grand claims, and fake certainty.
- Swap abstractions for specifics when the source material supports it.
- Keep useful repetition; avoid synonym cycling just to sound varied.
- Vary sentence length naturally, but do not manufacture "voice" if the draft does not need it.
- Add one honest opinion or aside when the context calls for it. Small amounts of personality go further than elaborate rhetorical tricks.

## Output

Return the revised text. Add notes only when the user asks, when meaning changed
materially, or when an AI tell remains.
