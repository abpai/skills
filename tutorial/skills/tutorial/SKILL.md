---
name: tutorial
description: >
  Write hands-on, code-first tutorials where every step ends in a runnable
  action and the reader finishes able to do the thing. Trigger on: "write a
  tutorial", "show me how to", "step-by-step guide", "teach me to build",
  "how do I set up", "walk me through building", or any request for
  instructions the reader follows along with.
argument-hint: "[topic or concept to teach]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
license: MIT
metadata:
  author: Andy Pai
  version: "1.0.0"
---

# Tutorial

Write tutorials that are dense, hands-on, and code-first. The reader finishes
able to do the thing. Knowing the name is not enough. Every step ends with an
action the reader takes.

## Before writing

Identify (infer from context, don't interrogate):

- **Audience and entry point** — what does the reader already know?
- **Concrete outcome** — what can the reader build or do when finished?
- **Runtime and toolchain** — what versions, package managers, or platform does the reader need?

State assumptions briefly if load-bearing. Only ask when the answer would materially change the structure.

## Step stack (the spine)

Order steps into a dependency chain. Step N uses only what steps 1…N-1 established. No forward references. Each step does exactly one thing.

```
A (setup) → B (first working thing) → C (extend it) → D (ship/use)
```

The first working thing must appear no later than step 2. Don't defer visible results past the second step.

## Voice

- **Sentences: 5–12 words.** Rhythm is short-short-earned-long — two short declarative sentences, then a longer one when the concept demands it.
- **Paragraphs: max 2 sentences.** More goes into code or a table.
- **Everyday verbs** — run, wrap, pull, swap, check, build, set, add, read, find, make, start, stop.
- **Contractions always.** First and second person only. Zero passive voice. No hedging.
- **Show before tell.** Lead with the code snippet, then explain it. Never explain then show.
- **Repetition is clarity.** If it's called a "handler," call it "handler" every time.
- **Define terms inline on first use.** `"a JWT (JSON Web Token)"`. No footnotes, no forward references.

## Structure

- **Numbered steps** — the reader always knows where they are.
- **Opening: name what you'll build, in one sentence.** No preamble. `"You'll build a rate limiter in 5 steps."`
- **Prerequisites block** — what the reader needs before step 1 (tools, versions, prior knowledge). Exact versions. Keep it short.
- **Each step: show → explain → run.**
  1. Code block first, complete and runnable as written.
  2. One short paragraph explaining what it does and why.
  3. A command to run, or output to verify the step worked.
- **Checkpoint every 2–3 steps.** One line showing what the reader should see. Lets readers self-diagnose before moving on.
- **Closing: one sentence pointing forward.** Where does the reader go next? Never summarize what was just done.

## Code blocks

- Runnable as written. No pseudocode. No placeholder stubs.
- Filename comment at the top when the block's location matters: `// src/server.ts`
- Inline comments only for non-obvious behavior.
- Show the command to run immediately after code that requires it.
- Show expected output (trimmed) when it confirms the step worked.

```
$ npm start
Server listening on :3000
```

## Checkpoints

After every 2–3 steps, add a checkpoint callout:

> **Checkpoint** — running `npm start` should print `Server listening on :3000`.

If they don't see it, they stop here, not three steps later.

## Banned

| Category | Don't use |
|---|---|
| Verbs | utilize, facilitate, leverage, implement, initialize, instantiate, orchestrate, architect |
| Adverbs | especially, basically, essentially, simply, actually |
| Openers | "In this tutorial…", "It's worth noting that…", "In this step, we'll…" |
| Transitions | "Now let's turn to…", "With that out of the way…", "As mentioned…" |
| Closers | "Happy coding!", summary sections, "In the next step…" |
| Other | exclamation marks for enthusiasm, bold whole sentences, pseudocode, placeholder stub code |

## Audit pass

Before returning, verify:

1. Every step ends with an action the reader takes (run a command, write a file, open a URL)
2. Step 2 or earlier produces something visible — a working result, not scaffolding alone
3. Every code block is complete and runnable as written
4. No step teaches two things
5. Checkpoints are present after every 2–3 steps
6. No passive voice (is/was/been + past participle)
7. No paragraph over 2 sentences, no step teaching two things

## Format

Return Markdown by default. If the tutorial has many code files or exceeds 50 lines, write to a descriptive local path. For tutorials with visual structure (architecture diagrams, side-by-side comparisons, tabbed code), produce a self-contained HTML file instead — ivory background, serif headings, restrained borders, code panels with syntax theme.
