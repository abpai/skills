---
name: explain-concisely
disable-model-invocation: true
description: >
  Turn explanations, instructions, debugging guidance, plans, and status updates
  into concise, action-first responses that are easy to scan and act on. Use
  when the user asks for a concise, brief, direct, plain-language, low-cognitive-load,
  or ADHD-friendly answer; asks what to do next; or invokes explain-concisely.
  Preserve necessary nuance, safety warnings, and requested depth.
license: MIT
metadata:
  author: Andy Pai
  version: "1.0.1"
  upstream_author: Ayoub Ghriss
  upstream_license: MIT
  upstream_skill: "https://github.com/ayghri/i-have-adhd/blob/72c33eee81ea439cf01991e93729adfce2ffc99e/skills/i-have-adhd/SKILL.md"
---

# Explain Concisely

Make the response easy to understand, scan, and act on. Concise means removing
friction, not removing information the user needs.

Adapted from Ayoub Ghriss's
[i-have-adhd](https://github.com/ayghri/i-have-adhd/tree/72c33eee81ea439cf01991e93729adfce2ffc99e)
skill under the MIT License. This port renames the skill, narrows its trigger,
and generalizes its action-first guidance beyond ADHD-specific framing.

## Shape the Response

1. **Lead with the answer or next action.** Do not open by announcing the
   approach. Put the command, decision, result, or essential explanation first.
2. **Make multi-step work executable.** Use a numbered list when order matters.
   Keep each step to one bounded action and include exact commands, paths, or
   acceptance checks when available.
3. **Externalize state.** For ongoing work, state what is done, what is active,
   and what comes next. Do not require the reader to remember prior-turn state.
4. **Keep one main thread.** Finish the requested topic before mentioning a
   secondary issue. Omit tangents that do not change the answer or next action.
5. **Use concrete language.** State evidence, cause, impact, and fix directly.
   Replace vague effort language with an honest range when an estimate is useful;
   do not invent precision.
6. **Make outcomes visible.** Say what now works or what decision was reached.
   Prefer a runnable proof or observable result over a generic recap.
7. **Limit visual load.** Keep flat lists to five items or fewer. Group longer
   material under descriptive headings such as `Do now` and `Later`.
8. **End cleanly.** Stop when the answer is complete. If work remains, end with
   one concrete next action rather than a generic offer to help.

## Preserve What Matters

Do not trade correctness for brevity.

- Give a full explanation when the user asks for a walkthrough, but lead with a
  short summary and use headings so the detail remains skimmable.
- Pause for confirmation before destructive or irreversible actions.
- Ask one short question when real ambiguity would materially change the answer.
- Preserve caveats that change safety, correctness, cost, authority, or scope.
- After repeated failed fixes, stop the loop, name the uncertain assumption, and
  ask for the smallest diagnostic that can test it.

## Pre-Send Check

Before sending:

1. Delete any opening sentence that only announces the response.
2. Remove sidebars, repeated context, and hedging that adds no information.
3. Confirm the first line carries the answer, result, or next action.
4. Confirm the final line closes the answer or names one concrete next action.
5. Restore any detail whose absence could cause a wrong or unsafe action.
