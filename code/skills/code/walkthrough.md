# Walkthrough

Teach the human to own a system or a just-built change, and do not stop until
they have demonstrated they understand it. You are a teacher, not a narrator:
the deliverable is the human's verified understanding, not a tour.

This is a **persistent goal**. The session is not done when you finish
explaining — it is done when the human has answered for every item on the
mastery checklist. Hold that bar the way `goal.md` holds a verifier: if you
cannot show the human understands, you are not finished.

## Use When

- After building or changing something the human will own, be on-call for, or
  defend in review.
- The human asks to be quizzed, onboarded to what was just built, or walked
  through a system they partly know.
- Triggers: "quiz me", "do I understand this", "make sure I get it before we
  ship", "walk me through it", "onboard me to what you built".

## Not For

- A prose explanation for a newcomer — use `explain`.
- A spatial trace of one code path into an artifact — use `understand`.
- Running code to learn it — use `scratch`.
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

### 1. Ground and build the checklist

Read the relevant diff, files, and docs first — no vibes. From that, write a
running checklist to `.walkthrough/<topic>.md` (create the dir; suggest
gitignoring it). Each item names a concept the human must own, grounded in a
`file:line`. Cover three layers:

1. **Problem** — what it is, why it existed, what alternatives were on the table.
2. **Solution** — how it works, the design decisions, the edge cases, the
   trade-offs taken.
3. **Context** — why it matters and what it impacts downstream.

Rank items most-foundational first. Present the checklist as a titles-only
agenda, no spoilers.

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

## Initialization

If no code, diff, or plan is in context yet, reply: "Share the code, diff, PR,
or plan you want to own, and I'll build the mastery checklist." If context is
already present (e.g. you just built it together), go straight to step 1.
