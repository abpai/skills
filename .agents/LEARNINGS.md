# LEARNINGS

## Corrections

| Date       | Source | What Went Wrong                                    | What To Do Instead                                                           |
| ---------- | ------ | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| 2026-02-07 | user   | Skill name `napkin` was unclear                    | Prefer clearer, intent-based skill names (for example, `project-memory`)    |
| 2026-02-07 | user   | Reviewed all skills in a single-agent pass         | Use a different subagent per skill for reviews and improvements              |
| 2026-02-07 | user   | Manual validation relied on ad-hoc runs            | Wire `scripts/validate-skills.sh` into pre-commit to enforce checks pre-commit |

## User Preferences

- Repository goal: publish created/forked skills that follow the Open Agent Skills specification (`https://agentskills.io/specification`).
- Prefer clear, descriptive skill names over metaphorical names.
- For cross-skill quality passes, use distinct subagents with explicit per-file ownership.
- Prefer automated local quality gates (pre-commit hooks) for skill validation.
- Use `.agents/LEARNINGS.md` going forward as the single project memory file.

## Patterns That Work

- Add repo-level `README.md` + `CONTRIBUTING.md` that encode the publishing standard and checklist.
- Provide a local `scripts/validate-skills.sh` entrypoint that uses `skills-ref validate` when available and falls back to structural checks.
- Run skill reviews in parallel with one worker subagent per skill folder to improve speed and avoid edit conflicts.
- Verify latest OpenAI/Codex model names in official OpenAI docs before updating skill defaults.
- Add `.pre-commit-config.yaml` local hooks for repeatable pre-commit checks.

## Patterns That Don't Work

- Relying on memory of the standard without a local validation command.
- Using vague skill names that do not communicate intent.

## Domain Notes

- Skills in this repository are stored as top-level folders, each with `SKILL.md`.
