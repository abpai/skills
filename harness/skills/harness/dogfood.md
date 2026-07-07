# Harness Dogfood

Harden a skill (or the harness itself) by using it under observation and repairing
what fought back. A sub-agent runs the skill on a real task; the orchestrator
reads the full transcript, finds where the skill caused friction, repairs the
smallest durable surface, and loops until the runs come out clean. This is the
harness's slice of the outer loop — the mechanism that makes the substrate improve
itself.

Use this workflow when the user wants to dogfood a skill, iteratively refine a
skill or the harness against real usage, or "loop until the skill is reliable."

## Ownership boundary

Harness owns being the **patchable target** of the outer loop: the skill, prompt,
doc, and tool surfaces the loop edits, plus an append-only evidence ledger of
observed friction. It does **not** own the feedback-ingestion pipeline — pulling
signals from PR comments, failed evals, DataDog alerts, or support tickets and
routing them to repairs is the downstream factory's job. This module is the
hands-on dogfood loop; the automated ingestion that feeds it at scale lives
outside the harness.

## Process

### 1. Run the skill under a sub-agent

Spawn a sub-agent and have it use the target skill on a real, representative task
— not a toy. The orchestrator does not help mid-run; the point is to see the skill
perform unaided, exactly as it would for any user.

If the task or environment is explicitly read-only, run an **observed dogfood**
pass instead: the sub-agent still performs the representative task unaided, but
the orchestrator records friction and recommended repairs without patching
files. Label the result `observed-only`, not `hardened`, and follow it with a
normal repair pass once the target surface is patchable.

### 2. Review the transcript for friction

Read the full sub-agent transcript and locate where the skill — not the task —
caused cost: the agent misread an instruction, searched too long before acting,
took a wrong route the skill should have prevented, fought a tool, or produced a
result the orchestrator had to correct. Each observation is evidence; record it
in an append-only ledger (`observation | where in the transcript | suspected
skill cause`). One friction point is an anecdote; a recurrence is a gap worth
fixing.

### 3. Repair the smallest durable surface

For each real gap, walk `docs.md`'s enforcement hierarchy top-down and fix the
smallest durable surface: prefer a test/lint/script/route over prose, tighten an
ambiguous instruction, add the missing route, or beautify an illegible failure
message that burned the run. Repair the skill, do not append a warning — a
warning is the thing that bloats and degrades adherence.

### 4. Loop until clean

Re-run step 1 with the patched skill. Keep looping until you get consecutive
clean runs (no new friction) — a single clean run is luck; convergence is the
signal. If a repair introduces new friction, that is itself a ledger entry.

## Completion

A dogfood pass is done when: a sub-agent ran the skill on a real task; the
transcript was reviewed and friction recorded in the evidence ledger; the
smallest durable repair was applied per the enforcement hierarchy; and a re-run
confirms the friction is gone (or you report the remaining friction and why it
was not yet fixable). Do not claim the skill is hardened from one run or from
intent — claim it when the loop converged and the ledger shows what changed and why.

For an observed-only pass, completion is narrower: transcript reviewed, friction
ledger emitted, and each repair mapped to the smallest durable surface. It does
not count as a hardened skill until those repairs are applied and re-run.
