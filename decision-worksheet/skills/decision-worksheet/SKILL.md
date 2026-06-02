---
name: decision-worksheet
description: Inventory every item in a scope from real evidence, then build one self-contained HTML worksheet that lets the user ratify or override a recommended verdict per item and export the decisions back.
when_to_use: User wants to review and rule on many similar items one-by-one — unsubscribe candidates in an inbox, dead-code functions, PRs, files, rows, vendors, line items — and wants a fast ratify-or-override surface instead of deciding each from scratch. Any "go through X and let me decide keep/cut on each" task.
argument-hint: "[what to review, e.g. 'inbox for unsubscribe candidates']"
license: MIT
metadata:
  author: Andy Pai
  version: "1.0.0"
  tags: "decision review worksheet html triage ratify-override export"
---

# Decision Worksheet

Build **one** self-contained HTML file that lets the user rule on every item in a
scope, then export those rulings back to you as JSON.

The core idea: **ratify-or-override beats decide-from-scratch.** You do the reading,
pre-select a recommended verdict with a reason and a confidence tag, and the user's
job shrinks to confirming or flipping each one. Their overrides become meaningful
signal — and the export hands you their reasoning, not just their verdict.

Do not lower the bar because there's a default. The recommendation is a starting
point that must be honestly reasoned, not the answer.

## 1. Pin the four variables

Every worksheet is the same shape with four task-specific slots. Infer them from the
request; only ask (via `AskUserQuestion`, max 2 questions) about what you genuinely
can't:

- **ITEM** — the unit being ruled on (sender, function, PR, file, row, vendor).
- **SCOPE** — where they come from (the inbox, this directory, these PRs, this sheet).
- **VERDICTS** — the choices per item, with **one marked recommended/default**.
  Adapt the verbs to the task: `keep / unsubscribe` · `keep / reshape / cut / discuss`
  · `approve / reject`. Two is fine; four is the practical max.
- **FIELDS** — the 3–6 facts the user needs to decide each item. Pick what the task
  needs, e.g. *what it is · the evidence quote/metric · frequency/volume ·
  last-seen/recency · dependency/risk · suggested better-shape*.

State the four back in one line before building, so the user can correct a wrong guess
cheaply.

## 2. Ground it first — real evidence only

Before generating anything, actually inventory the SCOPE: read the real emails / files
/ PRs / rows. Then:

- Every field on every item must cite **real evidence** — a quote, `file:line`, a
  sender address, a metric, a date. Never invent behavior or fill a gap with a
  plausible guess.
- If you couldn't verify a field, render it `unverified` rather than asserting it.
- If two sources disagree, **surface the conflict in the item** instead of papering
  over it.
- Assign each item its recommended verdict + a confidence tag (high/med/low) + a
  one-line *why*. Confidence reflects how sure you are, given the evidence you found.

For large scopes, fan out the inventory across subagents (one per batch/area), then
merge — but the merged set must still reconcile to one honest count (step 4).

## 3. Build one self-contained HTML file

A single `.html` file. No external network/CDN dependencies — it must open offline by
double-click. One row (or card) per item, each showing:

- a **stable id** + title + an **anchor** back to source (sender / `file:line` / URL).
- the chosen **FIELDS** for that item.
- the **recommended verdict pre-selected**, with its confidence tag and one-line why.
- **segmented buttons** to set the verdict (the VERDICTS set) — overriding is one click.
- a **notes field** per item.

Controls:

- a **sticky top bar**: search box + filters (by verdict, by confidence, by group).
- a **live tally header** that updates as the user marks: total, a count per verdict,
  and how many still sit at the recommended default vs. overridden.
- optional grouping into ~N areas, each with a one-line blurb and its own
  recommended-verdict mix bar.

Export:

- an **Export button** that serializes all marks to a JSON file (with a
  copy-to-clipboard fallback). See the schema below.
- **persist marks to `localStorage`** so a reload never loses work.
- after writing the file, **tell the user exactly what the exported JSON looks like**
  (show the shape) so they know what to paste back.

## 4. Reconcile before finishing

Confirm the tally header's per-verdict counts sum to the real number of items you
inventoried, and that the count you cite in your summary matches what's rendered in the
file. Call out any mismatch **explicitly** rather than silently rounding — this check is
what catches a worksheet that quietly dropped or double-counted items.

## Design — make it genuinely good to read

This is a tool the user will stare at while making dozens of judgments. Design it well.

- **Dark, dense, calm.** Generous line-height, a clear type scale, comfortable column
  widths. The verdict and confidence must read instantly at a glance.
- **Monospace** for code/paths/addresses; proportional for prose.
- **One consistent, semantic color per verdict**, used everywhere it appears (button,
  row accent, tally segment). Color is meaning, never decoration.
- **Confidence via weight/opacity**, not a second clashing palette.
- **Unreviewed-but-defaulted items look distinct from ones the user has actively
  ratified**, so progress through the list is visible.
- **Quiet, smooth interactions** (hover, selection, filter). No jank, no layout shift.
- Default every item to its recommended verdict; overriding stays one click.

## Export schema

Per item, include enough for you to act on the decision *and* understand the reasoning:

```json
{
  "scope": "<what was reviewed>",
  "verdicts": ["keep", "unsubscribe"],
  "exported_at": "<iso timestamp from the browser>",
  "items": [
    {
      "id": "<stable id>",
      "title": "<item title>",
      "anchor": "<sender / file:line / url>",
      "recommended": "unsubscribe",
      "mine": "keep",
      "overrode": true,
      "note": "<my one-line rationale>"
    }
  ]
}
```

The `overrode` flag and `note` are the point: when the user hands the file back, you
get their reasoning, not just their verdicts — so the follow-up action is informed.
