# Sharp-edges template

For a bullet list of small, trigger-gated issues in one area of the system. Default capture shape.

**File path convention:** `docs/todos/{area}.md` where `{area}` matches the subsystem (e.g. `kanban.md`, `dispatch.md`, `budget.md`).

## Structure

```markdown
# {Area} — sharp edges & cleanup

Accumulated findings from walkthrough sessions. Each bullet has a **trigger**: the concrete future event that makes it matter. No trigger → not on this list.

## {Section title, e.g. "Sharp edges in the poll loop"}

- **{One-line problem statement}** — `{file}:{line}` currently {does X}. **Trigger:** when we {future event}, this becomes {concrete failure}. Possible fix: {brief suggestion or "needs design pass"}.
- **{Next bullet}** — …

## {Next section, e.g. "Sharp edges in the budget gate"}

- …

## Cross-references

- See `docs/todos/{related-memo}.md` for the design-level reframe.
- See `docs/walkthrough-state.md` for the walkthrough this came from.
```

## Rules for each bullet

- **Cite a file + line** where feasible. If the problem is cross-cutting, name the at-least-two files it spans.
- **State the trigger.** No "someday" items. A trigger is a concrete event: "when we add a second tracker," "when the table exceeds N rows," "when we stop being the only writer."
- **Keep the fix suggestion brief.** Full design work goes in a design memo, not here.
- **One sentence per bullet** where possible. Long-form goes in a memo.

## Appending to an existing file

When the user issues a Capture move pointing at an existing sharp-edges file:
- Add to the relevant section. Create a new section if the finding doesn't fit any existing one.
- Don't rewrite earlier sections. Append only.
- If findings from this stop contradict earlier ones, add a `> UPDATE (YYYY-MM-DD):` note under the old bullet. Don't delete history.
