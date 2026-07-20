---
name: lateral-thinking
disable-model-invocation: true
description: >
  Generate non-obvious hypotheses by decomposing a problem to its mechanism and
  raiding distant fields for transferable patterns. Use when the user asks what
  we are missing, wants to go deeper, needs cross-domain ideas, is stuck in a
  local optimum, has repeated obvious fixes that fail, or wants mechanism-level
  brainstorming beyond standard advice. Use distill first when the system itself
  is still unclear.
license: MIT
metadata:
  author: Andy Pai
  version: "1.1.3"
  upstream_skill: "https://github.com/ogiberstein/lateral-thinking-skill"
---

# Lateral Thinking

Generate novel, testable ideas by finding mechanisms that transfer across fields.

Adapted from [ogiberstein/lateral-thinking-skill](https://github.com/ogiberstein/lateral-thinking-skill),
with a repo-native rewrite for portability and clearer boundaries with nearby skills.

Assume ordinary analysis is already exhausted. Deliver a second or third lens,
not a recap of the obvious first one.

## When the mechanism is muddy

If the problem's mechanism is still unclear, run `distill` first to compress
it to essential primitives, then apply lateral thinking to the clarified
skeleton. Skip straight to the workflow below if the skeleton is already clear.

## Ring Model

Start beyond the obvious.

- **Ring 0-1:** standard advice, baseline literature, first-order domain answers
- **Ring 2:** component decomposition and overlooked regulators
- **Ring 3:** cross-domain transfer of mechanisms from distant fields

Do not waste most of the response on Ring 0-1. A brief baseline is fine only if
it helps make the lateral leap understandable.

## Workflow

### 1. State the problem skeleton

Strip away jargon and restate the raw mechanics of the problem in 2-3 sentences.

Examples:

- Product: "We ship features, users sample them once, then their behavior snaps back."
- Engineering: "A disruption is brief, but recovery is slow enough that the next disruption lands before the system has reset."
- Operations: "The metric is managed locally, but each local optimization worsens the whole system."

If the framing is ambiguous, high-stakes, or likely to drift, confirm the skeleton
with the user before going deeper. Otherwise, proceed with the explicit stated
skeleton and note that it is your working model.

### 2. Decompose into primitives

Inspect the mechanism through a few consistent lenses:

- information flow
- timing and sequencing
- incentives
- structural constraints
- feedback loops
- resource flows

Ask:

- What regulates this component that no one is watching?
- What adjacent system touches it?
- What happens if the sign flips?
- What is the dual or inverse?

This step is complete when the skeleton names the main actors, constraints,
feedback loops, and a likely regulator or missing variable.

### 3. Generate Ring 2 discoveries

Produce 3-5 non-obvious observations about the parts themselves:

- hidden modulators
- missing feedback terms
- untracked constraints
- misaligned incentives
- timing dependencies

These should already feel sharper than a normal domain-only answer.

### 4. Run a cross-domain raid

Search for the same mechanism in distant fields. Good source domains include:

- biology and ecology
- control systems and physics
- economics and game theory
- information theory
- military strategy
- network science
- psychology and behavioral science
- urban planning
- medicine and pharmacology
- mathematics

For each candidate analogy, name the mechanism that transfers. Avoid surface-level
metaphors.

This step is complete when every candidate names the source field, transferable
mechanism, and reason it is not a decorative analogy.

### 5. Synthesize hypotheses

For each promising mechanism transfer, write:

- the non-obvious connection
- the mechanism chain
- why this idea is not already standard in the target field
- what nearby evidence or adjacent literature would support it
- what concrete test would falsify or validate it
- the likely impact if true

Aim for 3-7 hypotheses.

### 6. Check intersections

Look for combinations where two hypotheses reinforce or unlock each other.

Sometimes the real insight is not one borrowed mechanism, but the interaction of
two borrowed mechanisms.

This step is complete when each surviving hypothesis has a falsifier or concrete
test, and intersections are named separately from standalone ideas.

### 7. Kill weak ideas

Run an adversarial pass on every surviving hypothesis:

- does the mechanism transfer, or only the metaphor?
- do the quantitative assumptions port?
- is this already known and discredited elsewhere?
- does it produce an actionable next step?

Downrank or kill ideas that fail these tests.

### 8. Rank and recommend

Prioritize by:

- mechanistic plausibility
- domain distance
- testability

Penalize:

- obvious domain advice
- ideas already tried
- hand-wavy suggestions with no test
- ideas far outside the user's practical reach

## Output Format

```markdown
## Lateral Thinking: [Problem]

### Mechanism Skeleton
[Working problem skeleton]

### Ring 2 Discoveries
- ...

### Ring 3 Hypotheses
#### Hypothesis 1: [Name]
- Source field:
- Non-obvious connection:
- Mechanism chain:
- Why not already standard:
- Adjacent evidence:
- Test:
- Estimated impact:

### Hypothesis Intersections
- ...

### Adversarial Review
- [Hypothesis]: SURVIVES / DOWNRANKED / KILLED

### Cross-Domain Pointers
- ...

### Recommended Actions
1. ...
2. ...
3. ...
```

## Output Choice

Return Markdown by default. For workshops, strategy debates, or broad ideation
sets, create a self-contained HTML hypothesis board instead of a long Markdown
report. Use cards for Ring 2 discoveries and Ring 3 hypotheses, show source
fields as labels, make tests/falsifiers visible, and group intersections so the
user can compare candidates side by side.

## Guardrails

- Favor mechanism transfer over decorative analogy
- Every surviving idea must imply a concrete test or next step
- Do not turn this into a standard literature review
- Do not spend the answer rehashing Ring 0-1 advice
- Novelty is useful only if it survives the adversarial pass

## Iteration

If the best hypothesis changes the way the problem should be framed, run one more
cycle with the updated skeleton.

Stop when:

- the skeleton stabilizes
- a second pass adds little
- the user has enough to test
