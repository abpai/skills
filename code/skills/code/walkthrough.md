# Walkthrough

Paired architectural audit. The user drives a fresh reader (you) through a partially-understood system in gated, source-grounded stops. Each stop produces:

1. Mental-model corrections (via comprehension check)
2. Durable todos in `docs/todos/*.md`
3. Design-level reframes when the model is wrong

This is **not** onboarding, code review, or general architecture explanation. The user already knows the code partially. Your job is to force grounding, surface what they missed, and volunteer reframes they wouldn't have asked for.

## The 4 primitives

1. **Segment** — you propose the breakdown into stops; user picks. You also gate every transition ("ready for step N+1?").
2. **Ground** — every stop opens with "what's in play at step N, grounded in spec + latest code." File paths, line numbers, authoritative sources. No vibes.
3. **Probe** — within-stop interrogation, user-initiated: clarify / counterfactual / scope-check / concept-explain / reframe.
4. **Capture** — durable todos in `docs/todos/*.md`, always with file path + the *why*. Three shapes: sharp-edges list, design memo, migration-order plan.

## The 6 user prompt-moves

Every user message is one of these. You don't need to teach them — just recognize them:

| Move | Primitive | Example |
|---|---|---|
| Seed | Segment | "Walk me through X, propose the split" |
| Zoom | Ground | "What's in play at step N?" |
| Probe | Probe | "Explain Y" / "Assuming Z, does W hold?" / "What if we reframed this as…?" |
| Capture | Capture | "Add a todo in `docs/todos/foo.md` explaining X because Y" |
| Sweep | Segment | "Any other todos before step N+1?" |
| Advance | Segment | "Ready for step N+1" / "yes, write them" |

## Workflow

### Step 0: Owner framing (always check first)

Before anything else, check whether the repo owner has left framing:

- [ ] Read `WALKTHROUGH_NOTES.md` at the repo root if present.

If it exists, treat it as **authoritative framing**, not a hypothesis to verify. It supersedes your default priors about which subsystems matter, what the project is *for*, what reframes are in scope, and what to skip. Use it to:

- Bias the segmentation (Step 2) toward the subsystems the owner flagged.
- Quote it when a stop turns on owner-stated framing ("per `WALKTHROUGH_NOTES.md`: …").
- Suppress reframes the owner explicitly ruled out of scope.

If `WALKTHROUGH_NOTES.md` is absent, proceed normally — the workflow works without it. A template ships at `references/walkthrough-notes-template.md`; copy it to repo root as `WALKTHROUGH_NOTES.md` to author one.

### Step 1: Pre-seed (cold start)

When the user seeds a walkthrough, do NOT immediately propose stops. First ground yourself. See **references/walkthrough-workflow-pre-seed.md** for the checklist.

Skip pre-seed only if the user explicitly points at a file or gives a specific starting focus (e.g. "walk me through dispatch.ts").

### Step 2: Propose the segmentation

After pre-seeding, propose 3–5 stops with citations. If `WALKTHROUGH_NOTES.md` was present, weight the split toward the subsystems and questions the owner called out, and call that out in the pre-seed notes block. Format:

```
Proposed stops for [system]:

1. [Stop name] — covers [X] → [Y]. Files: `path/a.ts`, `path/b.ts`.
2. [Stop name] — …
3. …

Pre-seed notes:
- No `spec.md` found → first stop reconstructs implicit spec. (See references/walkthrough-workflow-no-spec.md.)
- [other flags — in-flight refactors, missing entry points, etc.]

Which stop to start with, or should I revise the split?
```

Use **AskUserQuestion** only if you want the user to pick from the list. Max 4 options per AskUserQuestion.

### Step 3: Run the Ground → Probe → End-of-turn loop

At each stop:

1. **Ground** the stop. Read the files. Produce a grounded answer with file paths + line numbers + quoted snippets where relevant.
2. **Answer** the current probe (or the initial Zoom if it's the first turn of the stop).
3. **End every turn with the end-of-turn contract** (see below). No exceptions.

User then issues a Probe, Capture, Sweep, or Advance. Loop.

### Step 4: Transition gate

Only advance when the user explicitly says so. Before advancing:

- Sweep: offer any residual todos you noticed but didn't capture.
- Write/update `docs/walkthrough-state.md` (see references/walkthrough-template-walkthrough-state.md).

## End-of-turn contract (REQUIRED every turn)

Every single turn ends with this block. No exceptions. If you can't fill a section, say so explicitly — don't skip it and don't fabricate.

```
—

**Do you understand:**
- [falsifiable claim referencing a concrete symbol/path]
- [falsifiable claim referencing a concrete symbol/path]
- [3rd claim, optional]

**Potential reframes I noticed:**
- [file X + why it's awkward + what the collapse/split might be — want to explore?]
- [2nd reframe, optional; cap at 2]

(If nothing qualifies: "No reframes at this bar — the structure here looks right.")

**Next:** advance to step N+1, drill on a bullet, or "I need to read more."
```

See **references/walkthrough-template-end-of-turn.md** for the full template + examples.

## The three rules (non-negotiable)

### Rule 1 — Comprehension bullets must be falsifiable

Every "do you understand" bullet references at least one concrete symbol or path AND is a claim the user could disagree with.

✓ "Do you understand that `dispatch.ts:202` triages **before** the budget gate at `:257`, which means a rejected triage never costs budget?"

✗ "Do you understand dispatch?"
✗ "Do you understand the triage flow?"

If you can't generate a falsifiable bullet, the stop wasn't grounded enough. Loop back and read more. Don't paper over.

### Rule 2 — Reframe bar (the whole game)

A reframe is only worth offering if it **both**:

- **(a)** Names two things currently separate that might be one (or one thing currently unified that might be two).
- **(b)** Is expressible without jargon from the current code — i.e. if you stripped the current naming, would the observation still land?

Cap: 1–2 reframes per stop. Scarcity forces quality.

Examples of reframes that clear the bar (from a real prior session):
- "Triage is modeled as an LLM wrapper, but it's already an agent (model + tools + loop). Want to collapse `structurer` into the general `harness` abstraction?" — clears (a) and (b).
- "Dispatch both polls for new work *and* enacts column transitions. Those are two different responsibilities. Want to split so only agents move tickets?" — clears (a) and (b).

Examples of things that are **not** reframes (these are todos):
- "`PRIOR_COMMENTS_LOOKBACK = 50` is a magic number."
- "This function could be renamed."
- "Missing test coverage here."

If nothing clears the bar, say so. "No reframes at this bar" is a better answer than noise.

### Rule 3 — Todos need a trigger condition

A captured todo must have a **trigger**: the concrete future event that makes this matter. Cap 3 captures per stop to force prioritization.

✓ "When we add a second tracker backend, the hardcoded `provider === 'local'` check at `dispatch.ts:267` becomes wrong."
✗ "Someday we should refactor `dispatch.ts`."

Trigger-less observations stay in the conversation; they don't earn a file.

## Capture shapes

When the user issues a **Capture** move, pick the right template:

- **Sharp-edges list** — a bullet list of small, trigger-gated issues in one area. Use `docs/todos/{area}.md`. See **references/walkthrough-template-sharp-edges.md**.
- **Design memo** — one idea, one file. For reframes that earn their own doc. Use `docs/todos/{topic}.md` with full rationale, target state, and migration notes. See **references/walkthrough-template-design-memo.md**.
- **Migration-order plan** — step-ordered plan to get from here to a target state. Use `docs/todos/{migration}-migration.md`. See **references/walkthrough-template-migration-order.md**.

Default to **sharp-edges** unless the user explicitly asks for a memo or the finding is reframe-level.

## State file (for resume across compactions)

Long walkthroughs blow context. Write `docs/walkthrough-state.md` after each advance. Minimal schema in **references/walkthrough-template-walkthrough-state.md**. On a fresh session, if that file exists, read it before pre-seeding — it replaces pre-seed.

## Optional HTML Map

When a walkthrough spans multiple stops, creates several todos, or leaves the user holding a large architecture picture, write a companion HTML map. This is a review surface, not the source of truth.

Use it for:

- stop-by-stop navigation with the current stop highlighted
- subsystem cards with file:line refs
- reframe candidates with trigger conditions
- captured todos grouped by area
- flow diagrams that would be unreadable as ASCII

Keep durable todos in `docs/todos/*.md` and state in `docs/walkthrough-state.md`. The HTML map helps the human read and share the walkthrough.

## Failure modes and branches

- **No spec.md or authoritative doc exists** → see **references/walkthrough-workflow-no-spec.md**. First stop becomes "reconstruct the implicit spec."
- **Mid-refactor state** → pre-seed asks "anything in-flight?" Mark aspirational vs. actual in the proposed segmentation.
- **User goes off-script** (asks a question unrelated to the current stop) → answer it, but flag which stop it actually belongs to and offer to defer the capture.
- **User skips end-of-turn** (just replies with "next") → still emit the end-of-turn block before advancing. The contract is on you, not them.

## What this workflow is NOT for

- Reading a single file (just read it).
- Onboarding someone who doesn't know the codebase at all (walkthrough assumes partial knowledge — otherwise there's nothing to correct).
- Generic "explain this architecture" (no artifacts produced).
- Writing implementation code (walkthrough produces *plans*, not diffs).

If any of these fit better, say so and bail.
