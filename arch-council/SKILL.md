---
name: arch-council
description: Orchestrate a structured architecture debate between Claude and Codex. Claude proposes, Codex critiques, Claude synthesizes. Use for cross-repo architecture decisions that benefit from adversarial review by models with different training biases.
metadata:
  version: "1.1"
---

# Architecture Council Skill Guide

## Workflow

1. Confirm the architecture question with the user. Clarify scope and which repos are relevant.
2. Build context: run `build-context.sh` to extract structure, dependencies, API surface, and auth patterns from each repo.
3. Run debate: execute `debate.sh` to orchestrate propose → critique → synthesize cycle.
4. Present the final synthesis to the user. Highlight the ADR, unresolved tensions, and concrete next steps.
5. Offer follow-up: additional rounds, deeper dive into a specific repo, or implementation planning.

### Quick Reference

| Use case                          | Key flags                                                     |
| --------------------------------- | ------------------------------------------------------------- |
| Single-repo architecture review   | `--repos "/path/to/repo"`                                     |
| Multi-repo decision               | `--repos "/path/repo1,/path/repo2,/path/repo3"`               |
| Quick review (tighter timeouts)   | `--claude-timeout 300 --codex-timeout 240`                    |
| Deep multi-round debate           | `--rounds 3`                                                  |
| Pre-built context                 | `--context-file /path/to/context.md`                          |
| Dry run (preview commands)        | `--dry-run`                                                   |
| Custom models                     | `--claude-model sonnet --codex-model gpt-5.4-pro`             |

## Command Patterns

### Full debate (single repo)

```bash
bash arch-council/scripts/debate.sh \
  --question "Should we split the API into microservices or keep the monolith?" \
  --repos "/path/to/my-api"
```

### Multi-repo debate

```bash
bash arch-council/scripts/debate.sh \
  --question "How should we share auth tokens across these three services?" \
  --repos "/path/to/auth-service,/path/to/api-gateway,/path/to/user-service" \
  --rounds 2
```

### Context-only (for inspection before running debate)

```bash
bash arch-council/scripts/build-context.sh \
  --repos "/path/repo1,/path/repo2" \
  --output /tmp/context.md
```

### Dry run

```bash
bash arch-council/scripts/debate.sh \
  --question "test" \
  --repos "/path/to/repo" \
  --dry-run
```

## Debate Structure

Each round follows three phases:

1. **Propose** (Claude): Analyzes codebase context and answers the architecture question with a specific, opinionated recommendation including tradeoffs and migration path.
2. **Critique** (Codex): Attacks the proposal on hidden coupling, migration traps, auth edge cases, operational complexity, and elegant-but-wrong abstractions. Every criticism must include a concrete alternative.
3. **Synthesize** (Claude): Produces the final recommendation, incorporating valid critiques and rejecting invalid ones. Includes an ADR and concrete next steps.

Multi-round debates feed the previous synthesis back as input to the next round's proposal, refining through iteration.

## Output Artifacts

All artifacts are saved to the output directory (`/tmp/arch-council-<timestamp>/` by default):

| File                          | Description                    |
| ----------------------------- | ------------------------------ |
| `context.md`                  | Multi-repo context pack        |
| `round<N>_proposal.md`       | Claude's architecture proposal |
| `round<N>_critique.md`       | Codex's critical review        |
| `round<N>_synthesis.md`      | Final synthesized decision     |
| `round<N>_*_prompt.txt`      | Prompts sent to each agent     |

## Error Handling

- **Timeout**: If Claude or Codex exceeds their timeout, the script continues with partial output if any was captured. Adjust with `--claude-timeout` / `--codex-timeout`.
- **Empty output**: Each agent call retries once on empty output (with stderr visible on retry) before failing.
- **Missing CLI**: Fails fast with install instructions if `claude` or `codex` binaries are not found.
- **Non-existent repo**: `build-context.sh` warns and skips missing directories.

## Prerequisites

- `claude` CLI installed and authenticated
- `codex` CLI installed and authenticated
- `git` available on PATH
- For reliable timeouts on macOS: `brew install coreutils` (provides `gtimeout`)

## Update Check

On first use in a session, silently check for a newer version:

1. Fetch `https://raw.githubusercontent.com/abpai/skills/main/versions.json`.
2. Compare the version for `arch-council` against this file's `metadata.version`.
3. If the remote version is newer, pause before the main task and ask:
   > **arch-council** update available (local {X.Y} → remote {A.B}).
   > Would you like me to update it for you first?
   > I can run `npx skills update arch-council` for you.
4. If the user says yes, run the update before continuing.
5. If the user says no, continue with the current local version.
6. If the fetch fails or web access is unavailable, skip silently.
