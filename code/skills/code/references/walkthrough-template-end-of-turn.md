# End-of-turn template

Emit this block at the end of every walkthrough turn. No exceptions.

## The template

```
—

**Do you understand:**
- [falsifiable claim referencing a concrete symbol/path]
- [falsifiable claim referencing a concrete symbol/path]
- [optional 3rd claim]

**Potential reframes I noticed:**
- [file/area] looks awkward because [specific reason]. It might collapse into [other thing], or split into [two things]. Want to explore?
- [optional 2nd reframe, max 2 total]

(If nothing clears the reframe bar: "No reframes at this bar — the structure here looks right.")

**Next:** advance to step N+1, drill on a bullet above, or "I need to read more."
```

## Rules

### Falsifiable bullets (Rule 1)

Every "do you understand" bullet must:
- Reference a concrete symbol, file, or line number.
- Be a claim the user could disagree with (has a truth value).

If you can't write such a bullet, the stop wasn't grounded enough. Loop back and read more. Explicit fallback: `"I can't ground a falsifiable claim yet — need to read [files] before I can."` That's the ONLY acceptable substitute.

### Reframe bar (Rule 2)

A reframe must **both**:
- Name two things currently separate that might be one, OR one thing currently unified that might be two.
- Be expressible without jargon borrowed from the current code.

Cap 1–2 per stop. If nothing clears the bar: say so explicitly. "No reframes at this bar" is a good answer.

### Escape hatch

The `"Next:"` line ALWAYS offers `"I need to read more"` as an option. The user must be able to punt a stop without signing off. Never force an advance when the ground isn't firm.

## Good example

```
—

**Do you understand:**
- `dispatch.ts:202` calls `triageTicket()` BEFORE `cost.enforce()` at `:257`, which means a rejected ticket (e.g. no repo) never consumes project budget.
- The column transition at `:290` moves to `completionColumn` for accepted-but-rejected tickets, not `humanReviewColumn` — this is an asymmetry with the `!accepted` branch at `:217` which goes to human review.
- `AGENT_COMMENT_PREFIX = 'garage-band: '` (line 21) is the dedup key; `ActivityEntry` has no author field, so this prefix is how dispatch recognizes its own prior comments.

**Potential reframes I noticed:**
- `dispatch.ts` mixes polling + triaging + budget-enforcement + ticket-moving. Those are arguably two things wearing one hat — a *scheduler* (poll + assign) and an *enactor* (budget + move). If enactment moved into the agents (via tracker tools), dispatch collapses to a ~50-line poller. Want to explore?

**Next:** advance to Step 2 (triage + budget gate), drill on one of the above, or "I need to read more."
```

## Bad example (do not emit)

```
—

**Do you understand:**
- How dispatch works?                        ← unfalsifiable
- The triage flow?                            ← vague
- Budget enforcement?                         ← not a claim

**Potential reframes I noticed:**
- Could probably clean up some naming         ← not a reframe, it's a nit
- Tests could be better                       ← not a reframe
- Might want to refactor dispatch.ts someday  ← vague, no trigger, not a reframe

**Next:** continue?
```

Every bullet violates the rules. This is what lazy end-of-turn output looks like; don't ship it.
