---
name: capture-feedback
description: Capture concise user corrections about how an agent should have behaved differently, saving a local shared feedback note under ~/.agents/capture-feedback for later trace review, skill updates, or rule improvements. Also list or show captured notes when the user asks to inspect prior capture-feedback entries.
license: MIT
metadata:
  author: Andy Pai
  version: "1.0.1"
  tags: "feedback traces agent-behavior retrospection skills rules"
---

# Capture Feedback

Record the user's correction while it is fresh. This skill is a receipt printer,
not an analyzer: save the feedback, emit a stable marker, and stop.

## Storage

Default root:

```text
~/.agents/capture-feedback/
```

The shared `~/.agents` location lets Claude and Codex use the same inbox. To
override it, set `CAPTURE_FEEDBACK_HOME`.

Each note is one JSON file:

```text
~/.agents/capture-feedback/inbox/<id>.json
```

Keep notes local. They may contain private paths or user-provided sensitive text.

## Minimal Schema

```json
{
  "schema_version": "capture_feedback_note/v1",
  "id": "cf_20260602T183012Z_7f3a",
  "created_at": "2026-06-02T18:30:12Z",
  "marker": "capture-feedback:cf_20260602T183012Z_7f3a",
  "cwd": "/Users/andypai/Projects/example",
  "user_words": "You should have run browser QA too after changing frontend behavior."
}
```

Do not add classification, severity, proposed fix targets, thread ids, git
metadata, model names, or rollout hints during capture. Later review can derive
those from traces, git state, or repeated notes. The marker is the bridge back to
the transcript.

## Capture Flow

1. Use the user's correction verbatim. Do not rewrite it.
2. If no correction text was provided, ask one short question: "What should I capture?"
3. From this skill directory, run the bundled script:

```bash
python3 scripts/capture_feedback.py capture -- "<verbatim feedback>"
```

During repo development, the script path is
`capture-feedback/skills/capture-feedback/scripts/capture_feedback.py`.

4. Reply with only the marker and, when useful, the local file path.

Capture is complete when the script exits successfully, the marker is returned,
the JSON file exists under `inbox/`, and `user_words` matches the user's
correction verbatim.

Example reply:

```text
Captured capture-feedback:cf_20260602T183012Z_7f3a
```

## Read Existing Notes

When the user asks to list or show captured feedback, use the same script for
lightweight retrieval:

```bash
python3 scripts/capture_feedback.py list
python3 scripts/capture_feedback.py show cf_20260602T183012Z_7f3a
```

`list` shows recent notes. `show` prints the raw JSON.

## Out Of Scope

- Do not cluster notes.
- Do not inspect traces.
- Do not decide whether to update a skill, memory, or `AGENTS.md`.
- Do not create evals.
- Do not mutate global rules from a single note.

Those are separate distillation or review workflows.
