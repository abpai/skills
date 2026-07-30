---
name: lateral-thinking
disable-model-invocation: true
description: >
  Generate non-obvious hypotheses by decomposing a problem to its mechanism
  and raiding distant fields for transferable patterns, beyond standard
  advice. Use distill first when the system itself is still unclear.
license: MIT
metadata:
  author: Andy Pai
  version: "1.1.4"
  upstream_skill: "https://github.com/ogiberstein/lateral-thinking-skill"
---

# Lateral Thinking

Generate novel, testable ideas by finding mechanisms that transfer across fields.

Adapted from [ogiberstein/lateral-thinking-skill](https://github.com/ogiberstein/lateral-thinking-skill),
with a repo-native rewrite for portability and clearer boundaries with nearby skills.

Use this skill when ordinary analysis is already exhausted and the user needs a
good second or third lens, not a recap of the obvious first one. `distill`
compresses a system to its essential primitives; `lateral-thinking` uses those
primitives to generate non-obvious hypotheses. If both apply, distill first,
then run lateral thinking on the clarified skeleton.

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

Example: "We ship features, users sample them once, then their behavior snaps
back."

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

Produce 3-5 non-obvious observations about the parts themselves. These should
already feel sharper than a normal domain-only answer.

### 4. Run a cross-domain raid

Search for the same mechanism in distant fields. Good source domains include,
among others:

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

### 7. Rank and kill

Run an adversarial pass on every surviving hypothesis:

- does the mechanism transfer, or only the metaphor?
- do the quantitative assumptions port?
- is this already known and discredited elsewhere?
- does it produce an actionable next step?

Kill or downrank ideas that fail these tests. Rank survivors by mechanistic
plausibility, domain distance, and testability. Penalize obvious domain advice,
ideas already tried, hand-wavy suggestions with no test, and ideas far outside
the user's practical reach. Judge reach against the authority the user's own
framing implies; ask only if the ranking turns on it.

This step is complete when every hypothesis carries a verdict (survives,
downranked, or killed), and the survivors are ranked.

### 8. Recommend actions

Turn the top-ranked survivors into two to four concrete next steps. Each step
names what to do and which hypothesis it tests.

## Output Format

Follow the template in [references/output-format.md](references/output-format.md).

## Output Choice

Return Markdown by default. For workshops, strategy debates, or broad ideation
sets, create a self-contained HTML hypothesis board instead of a long Markdown
report. Use cards for Ring 2 discoveries and Ring 3 hypotheses, show source
fields as labels, make tests/falsifiers visible, and group intersections so the
user can compare candidates side by side.

## Iteration

If the best hypothesis reframes the problem, run one more cycle with the
updated skeleton. Stop when the skeleton stabilizes, another pass adds little,
or the user has enough to test.
