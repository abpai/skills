---
name: decision-worksheet
disable-model-invocation: true
description: Capture concise user feedback notes, or build an evidence-backed HTML worksheet for triaging many similar items (keep/cut/unsubscribe/approve) one by one.
argument-hint: "[feedback text or scope to review]"
license: MIT
metadata:
  author: Andy Pai
  version: "1.1.2"
  tags: "decision review worksheet feedback capture triage ratify-override"
---

# Decision Worksheet

Use the smallest shape that fits the request:

- **Feedback note:** the user gives one correction, asks to capture feedback, or
  asks to list/show prior notes. Use the bundled secure helper, return its result,
  and stop.
- **Worksheet:** the user needs to decide many similar items. Inventory the real
  scope, recommend a verdict per item, then build one self-contained HTML file so
  they can ratify or override quickly.

## Feedback Note

Use this mode for requests like "capture that feedback", "remember this
correction", or explicit `capture-feedback` wording.

Resolve `<skill-dir>` to the directory containing this `SKILL.md`, then run:

```bash
python3 <skill-dir>/scripts/feedback_notes.py capture "<verbatim feedback>"
```

Pass the correction as one quoted argument so spacing and punctuation stay exact.
The helper writes private directories/files (`0700`/`0600`) with exclusive
creation and collision retries under:

```text
${DECISION_WORKSHEET_HOME:-~/.agents/decision-worksheet}/feedback/<id>.json
```

It uses this schema:

```json
{
  "schema_version": "decision_feedback_note/v1",
  "id": "df_20260708T183012Z_7f3a",
  "created_at": "2026-07-08T18:30:12Z",
  "marker": "decision-feedback:df_20260708T183012Z_7f3a",
  "cwd": "/current/working/directory",
  "user_words": "<verbatim feedback>"
}
```

Rules:

- Preserve the user's words exactly; do not classify, summarize, or propose fixes.
- Ask "What should I capture?" only when no feedback text was provided.
- Reply only with `Captured <marker>` and, when useful, the local file path.
- For requests to inspect prior notes, run `feedback_notes.py list [--limit N]`
  or `feedback_notes.py show <id-or-marker>`. These commands read both the new
  store and legacy `${CAPTURE_FEEDBACK_HOME:-~/.agents/capture-feedback}/inbox`
  notes, so consolidation does not strand existing feedback.
- If the helper is missing or fails, report the error. Do not reconstruct a less
  secure direct-write path from memory.

Done means the helper succeeds, the file exists with private permissions, the
marker is stable, and `user_words` matches the correction verbatim.

## Worksheet

Build one offline `.html` file when the user needs to rule on many items.

1. **Pin the shape.** Infer `ITEM`, `SCOPE`, `VERDICTS`, and `FIELDS`; ask at
   most two concise questions if a missing slot is risky. Keep verdict sets
   small, usually 2-4 choices, with one recommended default.
2. **Inventory from evidence.** Read the real source material first. Every item
   needs a stable id, source anchor, 3-6 evidence-backed fields, recommended
   verdict, confidence (`high`, `med`, `low`), and a one-line reason. Use
   `unverified` for gaps and surface conflicts instead of smoothing them away.
3. **Render the worksheet.** Include one row or card per item, preselected
   recommendation, one-click segmented verdict controls, notes, search/filter,
   a live tally, `localStorage` persistence, and a `Download decisions` JSON
   button with copy-to-clipboard fallback. No external network or CDN assets.
4. **Reconcile counts.** Verify the rendered item count, tally totals, and final
   summary all match the inventory. Call out any mismatch explicitly.

Design it as a dense, calm work surface: readable columns, semantic colors per
verdict, visible confidence, no layout shift, and a clear distinction between
defaulted, ratified, and overridden items.

## Decisions payload schema

Per item, include enough for you to act on the decision *and* understand the reasoning:

```json
{
  "scope": "<what was reviewed>",
  "verdicts": ["keep", "unsubscribe"],
  "created_at": "<iso timestamp from the browser>",
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

The `overrode` flag and `note` are the point: when the user hands the file back,
you get their reasoning, not just their verdicts.
