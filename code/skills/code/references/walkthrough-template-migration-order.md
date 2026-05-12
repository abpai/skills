# Migration-order template

Step-ordered plan to get from current state to a target state. Written when a design memo's migration notes outgrew the memo itself, or when the user explicitly asks for "the migration plan."

**File path convention:** `docs/todos/{topic}-migration.md`, paired with the design memo at `docs/todos/{topic}.md`.

## Structure

```markdown
# {Topic} — migration order

> Related memo: `docs/todos/{topic}.md`. Read that first.

## Goal

{One-sentence target state. Copy from the design memo's TL;DR if that works.}

## Phasing principle

{How we ordered the steps. Example: "Each step leaves the system in a shippable state — no half-migrated middle where both old and new paths exist in production." Or: "Strangler pattern — new path added alongside old, old path removed last."}

## Steps

### 1. {Step title — ideally a verb phrase}

**Does:** {the concrete change in 1–2 sentences}
**Touches:** `{file1}`, `{file2}`
**Leaves system in:** {"both paths coexist; default is old" / "new path is default; old still reachable via flag" / etc.}
**Reversible?** {yes / yes with data migration / no — name the point of no return}
**Depends on:** {earlier step numbers, or "none"}

### 2. {Next step}

…

### N. {Final step}

…

## Parallelizable vs. strictly sequential

{Call out which steps can happen in any order and which must strictly follow. A diagram or table here is worth it.}

## Abort conditions

{When to stop the migration mid-way and roll back. Examples: "if step 3 reveals that the new interface can't express X," "if the performance regression exceeds Y%."}

## Open migration questions

- {Specific decision to make before starting}
- {Specific decision that can wait until step N}

## What we're NOT doing

{Scope discipline. List the related refactors deliberately excluded, and why. "We're not renaming X in this migration because it's orthogonal and the rename alone is noisy."}
```

## Writing rules

- **Each step must be shippable on its own.** If step N leaves the system broken until step N+1 lands, they're one step, not two.
- **Name reversibility honestly.** "This step drops the old column" is a point of no return; call it out.
- **Count the steps.** If you have more than 8, you probably haven't phased aggressively enough — collapse or split into multiple migration files.
- **Don't guess timelines.** Migrations slip. Say "ordered" not "week 1, week 2."
