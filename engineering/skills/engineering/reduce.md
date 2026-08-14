# Reduce

Workflow module for `/engineering:reduce`.

Inspiration: Elon Musk's five-step design algorithm — question the requirements,
delete, simplify/optimize, accelerate, automate. Applied to a plan so we never
optimize work that should not exist: "the most common mistake of smart engineers
is to optimize a thing that should not exist."

## Input

Accept a **goal** ("ship X" — draft a first-pass task list yourself before
optimizing it), an **existing plan** already in the conversation, or a **path
to a plan/spec file** (read it). Normalize the input into a numbered task list
and echo it back so we agree on the starting point before touching it.

## Optional independent review

Do not send the plan, code, or repository context to another provider unless the
user explicitly asks for cross-provider review or approves that transfer after
you name the provider and the data scope. The workflow is complete with one
provider.

When independent review is authorized and available:

1. Send the raw task list and goal first so the reviewer is not anchored on the
   orchestrator's answer.
2. Ask for the strongest independent case for what to cut and what must stay.
3. The orchestrator reconciles both positions into one recommendation and records
   material disagreement.

Use review on the two gated steps where judgment is contested. If the requested
provider or its skill is unavailable, say so and continue with one provider.

## The five steps, in order

Run the steps strictly in order — never optimize, accelerate, or automate a
task you have not first tried to delete.

### Step 1 — Question the requirements ⟨GATE⟩

For each requirement behind the plan:

- **Make it less dumb** — question it regardless of who set it, or you get a
  perfect answer to the wrong question.
- **Name its authority or source.** Product owners, contracts, regulations,
  platform constraints, and inherited compatibility can all be legitimate;
  absence of a named person is not evidence that a requirement is disposable.
- Ask what actually breaks if it disappears, and what it is really for.

Present the questioned requirements with a sharper version of each and any
review disagreement. **Stop and get my sign-off before continuing.**

### Step 2 — Delete the task ⟨GATE⟩

For every task, part, or process step that survived Step 1, **delete it
entirely** — not soften it, delete it. Do not optimize for an arbitrary deletion
quota; preserve everything needed for the stated goal, safety, compliance, and
compatibility.

Present the proposed deletions, reasons, and goal-critical items that must stay.
**Stop and get my sign-off before continuing.**

### Step 3 — Simplify / optimize ⟨auto⟩

Only on the tasks that survived deletion, simplify and optimize. Apply the
changes and note each one — no gate.

### Step 4 — Accelerate ⟨auto⟩

Speed up each surviving, simplified task — only now that it has earned its
place.

### Step 5 — Automate ⟨auto⟩

Last, automate the surviving steps. Never automate before deleting and
simplifying, or you automate waste.

If independent review was authorized, run one final read-only review over the
surviving plan and fold accepted points in.

## Final review ⟨GATE⟩

Produce the reworked plan and present it for one final review. Offer a visual
artifact only when it would materially clarify the before/after relationship
and the `visualize` skill is available.

## Rules

- One gate at a time — wait for my response at each ⟨GATE⟩ before moving on.
- Any independent reviewer is read-only; it argues, it never edits the plan or
  the repo.
- If a question can be answered by inspecting the codebase, inspect it instead of
  asking me.
- When in doubt, prefer deleting over keeping, and prefer keeping-and-questioning
  over silently optimizing.
