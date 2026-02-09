# Skills Repository

This repository publishes skills that are either:
- Created in-house
- Forked and adapted from upstream skill authors

## Goal

Publish high-quality, portable skills that follow the Open Agent Skills standard:

- Specification: https://agentskills.io/specification

## Repository Layout

Each skill is a top-level directory that contains at least:

```text
<skill-name>/
└── SKILL.md
```

Optional directories per the standard:

- `scripts/`
- `references/`
- `assets/`

## Publishing Standard

Before publishing any skill from this repo:

1. Ensure `SKILL.md` contains valid YAML frontmatter with required fields:
   - `name`
   - `description`
2. Ensure the `name` matches the skill directory name.
3. Validate the skill against the spec using:

```bash
scripts/validate-skills.sh
```

## Existing Skills

- `cli-design-expert`
- `beautiful-mermaid`
- `code-simplifier`
- `codex`
- `project-memory`
- `slidev`
- `vibe-kanban`

## Security scanning

This repository is configured with [Cisco Skill Scanner](https://github.com/cisco-ai-defense/skill-scanner)
via pre-commit.

1. Install pre-commit: `uv tool install pre-commit`
2. Install hooks: `uvx pre-commit install`
3. (Optional) copy `.env.example` to `.env` and customize scanner settings
4. Run manually: `uvx pre-commit run --all-files`
