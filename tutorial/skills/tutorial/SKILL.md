---
name: tutorial
disable-model-invocation: true
description: >
  Write hands-on, self-verified, code-first tutorials where every step ends
  in a runnable action and the reader finishes able to do the thing.
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
  version: "1.0.3"
---

# Tutorial

Write tutorials that are dense, hands-on, and code-first. The reader finishes
able to do the thing. Knowing the name is not enough. Every step gives the
reader one action to take and one done-when check.

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

Use as many numbered steps as the tutorial needs. Never target a fixed count,
and never pack several actions into the last step to make the outline fit. Split
again whenever a reader needs a separate action, observation, or concept.

## Voice

- **Sentences: 5–12 words.** Rhythm is short-short-earned-long — two short declarative sentences, then a longer one when the concept demands it.
- **Keep paragraphs to 2 sentences max.** More goes into code or a table.
- **Use everyday verbs** — run, wrap, pull, swap, check, build, set, add, read, find, make, start, stop.
- **Use contractions.** First and second person only. Zero passive voice. No hedging.
- **Show before tell.** Lead with the code snippet, then explain it. Never explain then show.
- **Repeat names consistently.** If it's called a "handler," call it "handler" every time.
- **Define terms inline on first use.** `"a JWT (JSON Web Token)"`. No footnotes, no forward references.

## Structure

- **Numbered steps** — the reader always knows where they are.
- **Opening: name what you'll build, in one sentence.** No preamble. Do not promise a step count. `"You'll build a rate limiter for an Express API."`
- **Prerequisites block** — what the reader needs before step 1 (tools, versions, prior knowledge). Exact versions. Keep it short.
- **Each step: show → explain → run.**
  1. Action block first: source code when they write a file, shell command when they set up or inspect.
  2. One short paragraph explaining what it does and why.
  3. A command to run, or output to verify the step worked.
  4. A done-when check the reader can observe before moving on.
- **Checkpoint every 2–3 steps.** Put it after the relevant done-when check. It is a self-check, not a second action.
- **Closing: one sentence pointing forward.** Where does the reader go next? Never summarize what was just done.

## Code blocks

- Runnable as written. No pseudocode. No placeholder stubs.
- When a code block's location matters, identify the filename. Use a top filename comment like `// src/server.ts`; for shebang files, put the shebang first and the filename comment second.
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

## Prove the path

When local execution is possible, run the tutorial yourself before returning it.
Use a clean scratch directory or resettable fixture, then follow only the
prerequisites, file edits, and commands the tutorial gives the reader.
Record the working directory for each verification command.

Treat the runnable artifact as the source of truth. Build or run the final
example first, then write the tutorial from the command history that produced
that result.

If a command depends on unavailable hardware, credentials, paid services, or a
remote account you cannot access, run every local step around it. Mark the
blocked command clearly, give the exact blocker, and include the next command
the reader should run once the dependency exists. Never show unrun output as
observed output.

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

1. Every step gives the reader one action to take (run a command, write a file, open a URL) and one done-when check
2. Step 2 or earlier produces something visible — a working result, not scaffolding alone
3. Every code block is complete and runnable as written
4. No step teaches two things
5. Checkpoints are present after every 2–3 steps
6. The tutorial uses as many steps as needed, with no compressed final step
7. Runnable commands were executed from a clean scratch path or fixture, unless a named blocker prevents it
8. Expected output matches observed output, or the command is clearly marked unrun
9. The final answer names the verification command plus working directory, or blocker
10. No passive voice (is/was/been + past participle)
11. No paragraph over 2 sentences

## Format

Choose the output format before writing. Return Markdown by default. If the
tutorial has many code files or exceeds 50 lines, write to a descriptive local
path. For tutorials with visual structure (architecture diagrams,
side-by-side comparisons, tabbed code), produce a self-contained HTML file
instead — ivory background, serif headings, restrained borders, code panels
with syntax theme.
