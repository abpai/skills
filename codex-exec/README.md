# codex-exec

Run the Codex CLI from Claude Code for second opinions, code review, and
multi-model consensus.

## Modes

```
/codex-exec
  ├── exec ────── one-shot task (analysis, generation, structured output)
  ├── review ──── code review (uncommitted changes or specific files)
  └── resume ──── continue the most recent saved session
```

## Quick Reference

```bash
# One-shot analysis (read-only)
codex exec --sandbox read-only "Summarize uncommitted changes"

# Code review
codex review --uncommitted "Focus on bugs and regressions"

# Resume last session
codex exec resume --last

# Structured output (for tool consumption)
codex exec --sandbox read-only --output-schema schema.json "Review the diff"
```

## Key Defaults

- Model: use the user's configured Codex default; pass `--model` only when explicitly requested
- Sandbox: `read-only` for analysis, `workspace-write` when edits needed
- Reasoning: `medium` (ordinary), `high` (hard tasks), `low` (quick checks)

## Prerequisites

- `codex` CLI installed and authenticated
