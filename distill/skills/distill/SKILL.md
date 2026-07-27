---
name: distill
disable-model-invocation: true
description: >
  Decompose a complex system (codebase, architecture, paper, transcript, or
  document set) into essential primitives and a compressed mental model,
  without a line-by-line walkthrough. Prefer lateral-thinking for non-obvious
  hypotheses or cross-domain mechanism transfer.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - AskUserQuestion
  - Agent
license: MIT
metadata:
  author: Andy Pai
  version: "1.2.4"
---

# Distill

A skill for iteratively compressing complex systems down to their essential primitives —
the minimal set of abstractions that captures the full behavioral essence while
discarding accidental complexity.

Think of it like Andrej Karpathy reducing an automated research system to three files
(`train.py`, `prepare.py`, `program.md`). The goal is not summarization — it's
**re-expression in minimal form**.

Read `references/input-strategies.md` when starting on a codebase, research paper,
transcript, or article — it has input-type-specific starting heuristics.

## Core Concepts

**Primitives**: the irreducible building blocks that can't be decomposed further
without losing essential behavior. A good primitive set is:
- **Complete** — you can reconstruct the full system's behavior from just these pieces
- **Orthogonal** — each primitive captures something the others don't
- **Minimal** — removing any one primitive loses something essential
- Sized independently — don't force primitives to the same level of abstraction when
  one is genuinely bigger than the others
- Usually 3-5 primitives. More than 7 means the decomposition isn't compressed enough.

**Distillation vs. summarization**: summarization preserves information at lower
fidelity. Distillation re-expresses the essence in a new, cleaner form, which is
often *more useful* than the original because it strips away accidental complexity.
For example, "uses PostgreSQL" is implementation; "needs durable ordered storage"
is essence.

**Accidental vs. essential complexity** (per Fred Brooks): essential complexity is
inherent to the problem. Accidental complexity comes from the implementation.
Distillation separates them.

## Workflow

Two phases, Orient and Compress, iterate until the user is satisfied with the
decomposition.

### Phase 1: Orient

Before proposing any decomposition, understand what the user cares about — it
determines what counts as "essential." Ask 2-4 lightweight questions:
- What are you trying to *do* with this understanding? (Build on top of it?
  Rewrite it? Teach it? Make decisions about it?)
- What layer are you most interested in? (Business logic? Data flow? API surface?
  Conceptual model?)
- Is there a part you already understand well vs. a part that's opaque?

Skip straight to Phase 2 when the user's intent is already obvious from context or
for one-shot asks. Ask again only if the intended layer or use of the distillation
is unclear enough to change the primitive set.

### Phase 2: Compress

Each turn follows this pattern:

**Step 1 — Propose primitives.** Present a candidate decomposition (format depends
on context; see Output Formats), always including:
1. The primitive set — named, with a one-sentence description of each
2. Proposed granularity — how many primitives, and why this number
3. What was discarded as accidental complexity
4. Confidence flags — where you're least sure about the decomposition

**Step 2 — Invite pushback.** Ask the user to challenge the decomposition rather
than presenting it as final — surface where it might be wrong, not just whether it's
acceptable.

**Step 3 — Refine.** Based on feedback, propose a revised decomposition, showing
what changed and why. Repeat until the user says it feels right. For one-shot asks,
stop after a candidate decomposition that is complete, orthogonal, minimal, and
annotated with confidence flags.

### Convergence Signals

You're done when:
- The user confirms the primitive set matches their intuition
- Each primitive feels irreducible — you can't merge or remove any
- The user can explain the system to someone using only these primitives
- (For code) you could sketch a minimal implementation from just the primitive set

## Output Formats

Choose based on what the user needs; ask when in doubt.

- **Conceptual Map** (the default; use it for any input unless a format below is
  requested or its trigger fires) — a structured document listing
  the primitives, their relationships, and how they compose to produce the full
  system's behavior. Template:

  ```markdown
  # [System Name] — Distilled

  ## Primitives
  1. **Name** — description
  2. **Name** — description

  ## Relationships
  - Primitive A feeds into Primitive B via [mechanism]
  - Primitives C and D are independent but both required for [outcome]

  ## Reconstruction
  Given these primitives, here's how the full system works: [narrative]

  ## What Was Discarded
  - [thing] — accidental complexity because [reason]
  ```

- **Minimal Implementation** (only when requested or explicitly useful) — a set of
  files (like Karpathy's 3 files) that capture the essential behavior: actually
  runnable, named to reflect the primitives, stripped of accidental complexity,
  commented to map each piece back to the original.
- **Behavioral Spec** (when the user wants a SKILL.md or similar) — captures what
  the system *does* without prescribing *how*; useful when the distillation will
  guide an agent or a rewrite.
- **Hybrid** — combine formats for complex systems, e.g. a conceptual map plus a
  minimal implementation, or a behavioral spec with a reference implementation.
- **HTML Map** (only when requested, or spatial comparison is the deliverable) — a
  self-contained HTML artifact with primitive cards, relationship arrows,
  confidence flags, and a discarded-as-accidental section. Good fit for codebase
  maps, architecture primitives, research-paper concept graphs, and multi-document
  synthesis. Keep names and reconstruction concise enough to read in one pass.

## Session Management

Distillation often spans multiple turns. If the session gets long, offer to write
the current primitive set, open questions, and discarded items to a file so the
user can resume later or hand it to another agent session.
