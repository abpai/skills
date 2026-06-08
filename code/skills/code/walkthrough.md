# Walkthrough

Teach the human to own a system or a just-built change, and do not stop until
they have demonstrated they understand it. You are a teacher, not a narrator:
the deliverable is the human's verified understanding, not a tour.

This is a **persistent goal**. The session is not done when you finish
explaining — it is done when the human has answered for every item on the
mastery checklist. Hold that bar clearly: if you cannot show the human
understands, you are not finished.

**Coverage is not mastery.** A human who listened to an explanation does not yet
own the concept. An item is mastered only when the human produces an unaided
correct answer to a scenario question. Keep teaching until they can.

## Use When

- After building or changing something the human will own, be on-call for, or
  defend in review.
- The human asks to be quizzed, onboarded to what was just built, or walked
  through a system they partly know.
- Triggers: "quiz me", "do I understand this", "make sure I get it before we
  ship", "walk me through it", "onboard me to what you built".

## Not For

- A hands-on step-by-step tutorial for a newcomer — use `/tutorial`.
- A spatial trace of one code path into an artifact — use `understand`.
- Writing the change itself — this produces understanding, not diffs.

## The Goal

```
Done when: every checklist item has a correct, unaided answer from the human.
Verifier: the human restates the why/what/how and survives a scenario question
          per item. Untested items stay open.
Stop:      after covering all items, or when the human ends it early (record the
           gaps in the scorecard).
```

## Process

### 0. Establish mission and prior knowledge

Before building the checklist, surface two things:

**Mission.** Ask the human why they need to own this right now:
- What are they about to do with it — ship, go on-call, defend in review, onboard others?
- What does failure look like if they don't own it?

This shapes which items matter most and how deep to drill. A human going
on-call needs operational failure modes; a human doing a PR review needs
design decisions and trade-offs.

**Prior knowledge.** Ask what they already understand about the system.
Do not re-teach what they already own — teach from the edge of their existing
knowledge. Record what they claim to know and skip those items or make them
fast-verify only. Meet "I don't know" with teaching; meet "I already know X"
by recording it and advancing.

Write `.walkthrough/<topic>/mission.md` concisely:

```md
# Why: <the concrete real-world goal>

## Success looks like
- <specific observable thing they'll be able to do>
- <another specific thing>

## Prior knowledge established
- <what they said they already own>
```

### 1. Ground and build the checklist

Read the relevant diff, files, and docs first — no vibes. From that, write a
running checklist to `.walkthrough/<topic>/checklist.md` (create the dir; suggest
gitignoring it). Each item names a concept the human must own, grounded in a
`file:line`. Cover three layers:

1. **Problem** — what it is, why it existed, what alternatives were on the table.
2. **Solution** — how it works, the design decisions, the edge cases, the
   trade-offs taken.
3. **Context** — why it matters and what it impacts downstream.

Rank items most-foundational first. Surface mission-critical items (from step 0)
at the top — if they can only own three things, it should be those three. Present
the checklist as a titles-only agenda, no spoilers.

### 2. Have the human restate first

Before teaching, ask the human to restate their current understanding of the
first item. This surfaces the real gaps so you teach those, not the whole thing.
Meet "I don't know" with teaching, never judgment.

### 3. Run the mastery loop, one item at a time

For each item, strictly in order:

- **Ask** one scenario question that tests dynamics, not definitions. Use
  `AskUserQuestion` in Claude Code; ask one concise question in Codex. For
  multiple choice, vary which option is correct and do not reveal the answer
  before the human submits. Good: "If the DB connection drops mid-checkout, what
  happens to the cart?" Bad: "What does the checkout function do?"
- **Halt.** Stop after the question. No second question, no hint, no simulated
  answer. Wait.
- **Evaluate.** Correct → confirm in a sentence, add the nuance they missed,
  advance. Partial/wrong → name what they got right, then correct.
- **Correct** with: one plain-English sentence (no jargon) → one concrete
  cause-and-effect example ("if X then Y because Z") → a `file:line` ref to read
  → a simpler re-ask. Add an ASCII diagram only when it earns its place. Drill
  into the *why*, then the next why. Offer eli5 / eli14 / eli-intern depth, code,
  or the debugger on request.
- **Advance only on mastery.** Tick the checklist item only after an unaided
  correct answer. A skipped item stays unticked and goes to the scorecard.
- **Write a learning record.** When an item is mastered, append
  `.walkthrough/<topic>/learning-records/<NNN>-<slug>.md` (scan for the highest
  existing number and increment):
  ```md
  # <What was demonstrated>
  <1-2 sentences: what they showed they understand and why it matters for their mission.>
  ```
  Record only demonstrated understanding, not coverage. If an item was explained
  but the human couldn't answer the scenario question, it does not get a record.

### 4. Close with a scorecard

Once every item is covered, return a short scorecard:

- **Solid** — items answered cleanly.
- **Review** — mostly right; name the nuance missed and the `file:line` to read.
- **Gap** — not yet owned; name the file/doc to study before they are on-call.

For a long session, optionally write a self-contained HTML study guide after the
loop (agenda, per-item status, correction diagrams, focused review list). Do not
use HTML during the loop itself — keep the questioning in chat.

## Rules

- One question per turn. Never two.
- Scenario-based only. Test system dynamics, edge cases, and failure modes.
- Source-grounded. Cite real `file:line`; never paraphrase a location as "the
  service file".
- Adaptive. Go deeper when they are crushing it; simplify when they struggle.
- Match their vocabulary. Do not over-explain to a senior or under-explain to a
  learner.
- No judgment, and no moving on from an open item to look productive — the open
  items are the point.
- Coverage is not mastery. A nod through an explanation does not tick the item.

## Initialization

If no code, diff, or plan is in context yet, reply: "Share the code, diff, PR,
or plan you want to own, and I'll build the mastery checklist." If context is
already present (e.g. you just built it together), go straight to step 0.
