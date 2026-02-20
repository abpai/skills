# Contributing Skills

## Scope

Contributions should add or improve reusable skills that can be used across compatible agent runtimes.

## Add a New Skill

1. Create a new folder using kebab-case (example: `my-skill`).
2. Add `SKILL.md` with YAML frontmatter and markdown instructions.
3. Keep the skill self-contained and include optional folders only when needed:
   - `scripts/`
   - `references/`
   - `assets/`

## Forked Skills

When importing from upstream:

1. Preserve attribution and license in `SKILL.md` frontmatter (for example: `license`, `metadata.author`, `metadata.version`).
2. Keep a note of upstream source/version in frontmatter metadata.
3. Re-validate after local modifications.

## Pre-Publish Checklist

- [ ] `SKILL.md` exists for every skill folder.
- [ ] Frontmatter contains valid `name` and `description`.
- [ ] `name` matches folder name.
- [ ] `name` is lowercase kebab-case, <= 64 chars.
- [ ] `description` is specific enough to trigger correct usage.
- [ ] Validation script passes.

## Validation

Install the official validator (recommended):

```bash
uv tool install "git+https://github.com/agentskills/agentskills.git#subdirectory=skills-ref"
```

Run:

```bash
scripts/validate-skills.sh
```

If `skills-ref` is installed, this uses official validation. Otherwise it performs basic local checks and reports failures.

## Pre-commit Hook

To run skill validation automatically before each commit, install pre-commit hooks:

```bash
uv tool install pre-commit
uvx pre-commit install
```

Then commits will run:

- `scripts/validate-skills.sh` (structural checks)
- `skill-scanner` via `scripts/run_skill_scanner.py` (security scanning)
