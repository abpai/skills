# Design-memo template

For reframes that earned their own file. One idea, one file. Use this when the finding is structural (a primitive is misdrawn, two things should be one, one thing should be two).

**File path convention:** `docs/todos/{topic}.md` where `{topic}` names the reframe (e.g. `dispatch-as-scheduler.md`, `agent-tracker-tools.md`).

## Structure

```markdown
# {Reframe title as a declarative statement}

> TL;DR: {one-sentence statement of the reframe}

## The current shape

{What the code looks like today. Name the files, functions, and the implicit model they embody. Use quoted snippets where helpful. This section should be grounded — no hand-waving.}

## Why it's awkward

{The specific friction: what becomes hard, what bugs this shape invites, what future evolutions it blocks. Be concrete. Prefer naming two or three downstream consequences over one abstract complaint.}

## The reframe

{The proposed mental model. State it in plain language, without jargon from the current code. Show how the awkwardness dissolves under this model. If this collapses two things into one, say which. If it splits one into two, say along what axis.}

## Target state

{What the code looks like after. Pseudocode is fine. List the files that appear, disappear, or change role. If interfaces change, show the before/after shape.}

## What this buys us

- {Concrete benefit 1, tied to a current pain point}
- {Concrete benefit 2}
- {Concrete benefit 3}

## What this costs us

- {Honest downside 1}
- {Migration risk}
- {Things that get harder under this model, not just easier}

## Precedent (optional)

{If someone else has done this — e.g. "OpenAI Symphony architecture matches this pattern, see github.com/openai/symphony/SPEC.md" — cite and briefly summarize. Don't fabricate precedent.}

## Migration notes

{High-level phasing. If the migration is substantial enough to warrant its own file, stub it here and cross-link to `docs/todos/{topic}-migration.md` written from `references/walkthrough-template-migration-order.md`.}

## Open questions

- {Specific uncertainty that needs a decision}
- {Specific uncertainty that needs more research}

## Cross-references

- See `docs/todos/{area}.md` sharp-edges list for the concrete findings that motivated this.
- See `docs/todos/{topic}-migration.md` for the ordered migration plan.
```

## Writing rules

- **State the reframe in plain language.** If you can't express the idea without using current code names, the reframe hasn't clarified anything. "Collapse `structurer` into `harness`" is fine as a shorthand after you've explained it as "triage is already an agent — model, tools, loop — and we have a general abstraction for agents."
- **Ground the "current shape" section against actual code.** Anyone reading this memo cold should be able to verify the claims by opening the cited files.
- **Be honest about costs.** If the memo only lists benefits, it'll get dismissed. Real reframes have real costs — find and name them.
- **Don't write the implementation.** Memos describe the *target*, not the diff. The diff is a separate conversation.
