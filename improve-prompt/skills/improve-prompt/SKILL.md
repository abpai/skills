---
name: improve-prompt
disable-model-invocation: true
description: Improve, rewrite, or sharpen prompts into reusable instructions for planning, coding, review, eval, or decision-making — cutting vagueness, sycophancy, and success theater. Not for copyediting or humanizing prose.
argument-hint: "[draft prompt or rough goal]"
metadata:
  author: Andy Pai
  version: "1.3.4"
  tags: "prompting prompt-engineering rewriting agent-workflows handoff"
---

# Improve Prompt

## How to run this skill

The goal is a **sharp prompt produced fast** via a short back-and-forth with the user. Do not lecture about prompt engineering.

### 1. Read what you have

`$ARGUMENTS` (or the conversation) contains a draft prompt or rough goal. Classify it:

- **Clear draft** — has goal + context + deliverable. Skip to step 3.
- **Rough goal** — missing deliverable, context, or constraints. Go to step 2.
- **Already specialized** (decision memo, coding task, review, spec, final summary) — check `references/patterns.md` for a matching template, then go to step 2 or 3.

Complete once the input is classified and any needed reference pattern is
selected.

### 2. Interview (only if needed)

Use `AskUserQuestion` to ask **at most 2–3 questions**. Only ask about what you actually cannot infer. Typical gaps:

- **Deliverable** — recommendation, decision memo, plan, code, review, spec, research, eval?
- **Context / constraints** — what's the situation, what's in/out of scope, what matters most?
- **Failure mode to avoid** — sycophancy, hallucinated success, scope creep, nitpicking, over-engineering?

Skip any question you can answer from context. If the draft is already clear, do not interview — just rewrite.

This step is complete when each material gap is either answered, inferred with a
stated assumption, or intentionally left as a variable in the prompt.

### 3. Rewrite

Produce the improved prompt using the skeleton below, tailored to the deliverable. Then return:

1. **Improved prompt** (ready to paste, complete)
2. **What changed** — 3–5 bullets on the main upgrades
3. **Optional tighter version** — only if a shorter variant adds value

Keep commentary minimal. Lead with the rewritten prompt.

This step is complete when the improved prompt is paste-ready, preserves the
user's intent, names constraints and failure modes, and includes the requested
return shape.

---

## Universal skeleton

```md
Approach this calmly and methodically.

Goal: [outcome]

Context: [background]

Constraints: [time, scope, tradeoffs]

Your task:
1. [step]
2. [step]

Rules:
- Prioritize correctness over agreeableness.
- Do not optimize for appearance of success.
- Do not invent missing facts.
- If ambiguous, state the assumption.
- If constraints conflict, say so.
- If uncertain, quantify and name what would resolve it.
- Prefer a correct partial result over a polished wrong one.

Return:
1. [main deliverable]
2. [reasoning]
3. [risks / unknowns that could change the answer]
4. [next step]
```

## Load-bearing clauses

Drop into any prompt as needed.

**Anti-sycophancy:**
> Your job is not to agree with me; it is to tell me what is true, including where my premise is wrong. Prioritize accuracy over smoothness.

**Failure-mode contract:**
> Priority order: (1) be correct, (2) be honest about uncertainty, (3) do not invent facts or successful completion, (4) if requirements conflict, stop and point to the inconsistency, (5) offer the best next step.

**Per-step reset (multi-step / adversarial flows):**
> For this step only: be skeptical, prefer explicit uncertainty to guesswork, do not optimize for agreement.

## Phrase rewrites (quick fixes)

- "well researched answer" → "recommendation with reasoning, assumptions, counterarguments, unknowns, next steps"
- "make it better" → "improve for clarity and force; preserve intent"
- "most of the benefits" → "~80% of the value, fastest path"
- "make the tests pass" → "satisfy the real requirement without exploiting weaknesses in the tests"
- "be comprehensive" → "cover what's needed to make the decision"
- "you must / at all costs / don't fail" → "solve this if possible; if blocked, surface the blocker and propose a fallback"
- "be nice / pleasant" → "accurate first, then polish tone — do not weaken caveats during polish"

## Specialized patterns

For decision memos, coding executors, reviews, specs, or final summaries, use templates in [references/patterns.md](references/patterns.md). Load it only when the deliverable matches one of those shapes.

## Optional prompt tuner

When the prompt has many variables, examples, or output modes, create a throwaway HTML prompt tuner instead of only returning a rewritten prompt. Use it for side-by-side editing, highlighted variable slots, sample input previews, token/character counts, and a copy button that exports the final prompt.

Keep the final improved prompt as copyable text. The HTML exists to help the user tune it.
