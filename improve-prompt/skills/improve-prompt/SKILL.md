---
name: improve-prompt
disable-model-invocation: true
description: Improve, rewrite, or sharpen prompts into reusable instructions for planning, coding, review, eval, or decision-making — cutting vagueness, sycophancy, and success theater. Not for copyediting or humanizing prose.
argument-hint: "[draft prompt or rough goal]"
metadata:
  author: Andy Pai
  version: "1.4.0"
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

Ask one question at a time, and only about a gap that would materially change
the prompt. Stop interviewing once the next rewrite can preserve intent without
guessing. Typical gaps:

- **Deliverable** — recommendation, decision memo, plan, code, review, spec, research, eval?
- **Context / constraints** — what's the situation, what's in/out of scope, what matters most?
- **Failure mode to avoid** — sycophancy, hallucinated success, scope creep, nitpicking, over-engineering?

Skip any question you can answer from context. If the draft is already clear, do not interview — just rewrite.

This step is complete when each material gap is either answered, inferred with a
stated assumption, or intentionally left as a variable in the prompt.

### 3. Rewrite

Produce a prompt shaped to the actual deliverable. Then return:

1. **Improved prompt** (ready to paste, complete)
2. **What changed** — 3–5 bullets on the main upgrades
3. **Optional tighter version** — only if a shorter variant adds value

Keep commentary minimal. Lead with the rewritten prompt.

This step is complete when the improved prompt is paste-ready, preserves the
user's intent, names constraints and failure modes, and includes the requested
return shape.

---

## Load-bearing clauses

Drop into any prompt as needed.

**Anti-sycophancy:**
> Your job is not to agree with me; it is to tell me what is true, including where my premise is wrong. Prioritize accuracy over smoothness.

**Failure-mode contract:**
> Priority order: (1) be correct, (2) be honest about uncertainty, (3) do not invent facts or successful completion, (4) if requirements conflict, stop and point to the inconsistency, (5) offer the best next step.

**Per-step reset (multi-step / adversarial flows):**
> For this step only: be skeptical, prefer explicit uncertainty to guesswork, do not optimize for agreement.

## Specialized patterns

For decision memos, coding executors, reviews, specs, or final summaries, use templates in [references/patterns.md](references/patterns.md). Load it only when the deliverable matches one of those shapes.

Preserve placeholders, examples, and deliberate omissions from the draft unless
the user asks to replace them. Never invent a metric, percentage, authority, or
success claim to make the prompt sound more precise.
