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
- [ ] `metadata.version` is set in frontmatter (see Versioning below).
- [ ] Validation script passes.

## Versioning

Every skill must have a `metadata.version` field in its YAML frontmatter. This powers the auto-update check that notifies users when a newer version is available.

When publishing changes to a skill:

1. Bump `metadata.version` in the skill's `SKILL.md`.
2. Run `scripts/generate-versions.sh` to regenerate `versions.json`.
3. Commit both files together.

The pre-commit hook validates that every skill has a version and that `versions.json` stays in sync.

## Validation

Install the official validator (recommended):

```bash
uv tool install "git+https://github.com/agentskills/agentskills.git#subdirectory=skills-ref"
```

Run:

```bash
scripts/validate-skills.sh
```

If `skills-ref` is installed, the script runs official validation and still enforces the local version/manifest checks. Otherwise it falls back to local structural checks plus the version/manifest checks.

## Pre-commit Hook

To run skill validation automatically before each commit, install pre-commit hooks:

```bash
uv tool install pre-commit
uvx pre-commit install
```

Then commits will run:

- `scripts/validate-skills.sh` (structural checks)
- `skill-scanner` via `scripts/run_skill_scanner.py` (security scanning)
