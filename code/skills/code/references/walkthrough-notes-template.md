<!--
Owner framing for the walkthrough workflow.

Copy this file to the **repo root** as `WALKTHROUGH_NOTES.md` and edit it with
your view of how a fresh reader should think about this codebase. The workflow
will read it before pre-seeding and treat it as authoritative — not as a
hypothesis to verify.

Keep it short. Short and sharp beats long and fuzzy. Every section is
optional; delete the ones that don't apply. Update it as the project's
center of gravity moves.
-->

# Walkthrough notes

## What this project actually is

<!--
One or two sentences. The framing the README *should* have but probably
doesn't. Describe the system in your own words, not the marketing version.

Example:
"Garage Band is a ticket-as-state-machine. The Jira board IS the workflow;
dispatch is just a polling daemon that reacts to column transitions. If you
think of it as 'an agent platform', you'll segment wrong — segment around
the column lifecycle instead."
-->

## What to walk first (and why)

<!--
The 1–3 subsystems where the highest-leverage understanding lives. Order
matters; the first one is where a stranger should start.

- `apps/dispatch/src/index.ts` — the column lifecycle is the spine of the system. Walk this before any adapter.
- `packages/harness-core/src/subagents/*` — where the model loop lives. The triager / planner / executor distinction is load-bearing.
- `adapters/tracker-agent-kanban` — the only adapter currently exercised end-to-end; treat it as the reference impl.
-->

## What to skip / deprioritize

<!--
Things that look important but aren't, or are mid-rewrite, or are vestigial.
Saying "skip X" saves more time than "look at Y".

Examples:
- `infra/terraform/` — outdated, mid-migration to a new layout. Skip unless asked.
- The `evaluator-agent` adapter — built speculatively, not on the critical path yet.
- Anything under `.garage-smoke-*/` — generated test fixtures, ignore.
-->

## Reframes I'd like surfaced (and ones I wouldn't)

<!--
- **Welcome:** [areas where you suspect there's a wrong abstraction and want a fresh reader to challenge it]
  e.g. "I think the boundary between dispatch and the harness might be in the wrong place — push on this."

- **Out of scope:** [reframes you've already considered and rejected, or that would burn a stop without helping]
  e.g. "Don't suggest splitting the monorepo. We've debated it; not this quarter."
-->

## Glossary / non-obvious vocabulary

<!--
Terms a fresh reader will misread without help. Pull from a domain-vocab file
if the repo has one (DEFINED_TERMS.md or CONTEXT.md), but only the terms that
genuinely trip people up.

- "tier-1 / tier-2 merger" — not seniority, refers to two retry attempts at a clean squash-merge.
- "preserved sandbox" — a sandbox that survived past the ticket-done event, kept around for human inspection.
-->

## Questions I want answered

<!--
Specific things you'd like the walkthrough to push on. These bias the
segmentation toward stops that produce answers.

- Is the typed-comment protocol load-bearing or accidental complexity?
- Where does the cost-tracking abstraction leak? I suspect it's not as clean as I want.
- The triager-as-LLM-wrapper — should this collapse into the general harness?
-->
