# Reduce

Workflow module for `/engineering:reduce`.

Inspiration: Elon Musk's five-step design algorithm — question the requirements,
delete, simplify/optimize, accelerate, automate. Applied to a plan so we never
optimize work that should not exist: "the most common mistake of smart engineers
is to optimize a thing that should not exist."

## Input

Accept any of:

- a **goal** ("ship X") — draft a first-pass task list yourself before optimizing it,
- an **existing plan** already in the conversation, or
- a **path to a plan/spec file** — read it.

Normalize the input into a numbered task list and echo it back so we agree on the
starting point before touching it.

## Two-provider debate

Each step is argued between **two providers** — an orchestrator and a debate
partner — so neither model's blind spots go unchallenged.

- **Orchestrator** = whichever provider is running this skill. It drives the five
  steps, owns the reconciliation, and talks to the user.
- **Partner** = the *other* provider, reached read-only through its sibling skill:
  - Claude orchestrating → partner is **Codex**, via the `codex-exec` skill
    (`codex exec --sandbox read-only`).
  - Codex orchestrating → partner is **Claude**, via the `claude` skill
    (`claude -p` / the tmux wrapper, no edits).

Debate protocol for a step:

1. The orchestrator drafts its own position for the step.
2. It sends the task list plus its draft to the partner and asks for the
   strongest counter-argument — what the orchestrator over-cut, under-cut, or got
   wrong. Keep the partner read-only; it argues, it does not edit.
3. The orchestrator reconciles both positions into one recommendation and records
   where the two providers disagreed.

Run a full debate on the two gated steps (1 and 2), where the judgment is
contested. For the auto steps (3–5), a single partner pass over the surviving
tasks is enough. If the partner provider is unavailable, say so, fall back to a
single-provider pass, and continue.

## The five steps, in order

Run the steps strictly in order — the order is the point. Never optimize,
accelerate, or automate a task you have not first tried to delete.

### Step 1 — Question the requirements ⟨GATE · debate⟩

For each requirement behind the plan:

- **Make it less dumb.** Every requirement is dumb to some degree, no matter how
  smart the person who set it. Start here, or you get a perfect answer to the
  wrong question.
- **Attribute it to a named person, not a department.** A requirement no one will
  put their name to is a requirement to cut.
- Ask what actually breaks if it disappears, and what it is really for.

Debate it with the partner, then present the questioned requirements with your
reconciled sharper version of each and any provider disagreement. **Stop and get
my sign-off before continuing.**

### Step 2 — Delete the task ⟨GATE · debate⟩

For every task, part, or process step that survived Step 1, try to **delete it
entirely** — not soften it, delete it.

- If you are not later forced to add back **at least 10%** of what you deleted,
  you did not delete enough — go back and cut more.
- Leaving too much in is the common failure: people feel they have succeeded if
  nothing was added back, when really they were just over-conservative.

Debate it with the partner — deletion is where the two providers most often
disagree, so make the partner argue for cutting more *and* for what must stay.
Present the reconciled deletions, plus the small set you expect to be forced to
add back, as a list. **Stop and get my sign-off before continuing.**

### Step 3 — Simplify / optimize ⟨auto⟩

Only on the tasks that survived deletion, simplify and optimize. Apply the
changes and note each one — no gate. Deletion in Step 2 already guarded against
the cardinal mistake of optimizing something that should not exist.

### Step 4 — Accelerate ⟨auto⟩

Speed up each surviving, simplified task. Anything can be done faster than you
think — but only now that it has earned its place.

### Step 5 — Automate ⟨auto⟩

Last, automate the surviving steps. Never automate before deleting and
simplifying, or you automate waste.

Run one partner pass over the Step 3–5 output to catch simplifications,
accelerations, or automations either provider missed, then fold its accepted
points in.

## Final review ⟨GATE⟩

Produce the reworked plan, then render a single visual artifact via the
**visualize** skill (`/visualize`) showing, per task: before → after, what was
deleted, the ~10% added back, the simplify / accelerate / automate annotations,
and — where the two providers split — the debate outcome. Present it for one
final review before locking the plan in.

## Rules

- One gate at a time — wait for my response at each ⟨GATE⟩ before moving on.
- The partner is always read-only; it argues, it never edits the plan or the repo.
- If a question can be answered by inspecting the codebase, inspect it instead of
  asking me.
- When in doubt, prefer deleting over keeping, and prefer keeping-and-questioning
  over silently optimizing.
