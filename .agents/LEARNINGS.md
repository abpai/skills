# LEARNINGS

## Corrections

| Date       | Source | What Went Wrong                                    | What To Do Instead                                                           |
| ---------- | ------ | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| 2026-02-07 | user   | Skill name `napkin` was unclear                    | Prefer clearer, intent-based skill names (for example, `project-memory`)    |
| 2026-02-07 | user   | Reviewed all skills in a single-agent pass         | Use a different subagent per skill for reviews and improvements              |
| 2026-02-07 | user   | Manual validation relied on ad-hoc runs            | Wire `scripts/validate-skills.sh` into pre-commit to enforce checks pre-commit |
| 2026-02-19 | user   | New `agent-browser` skill missed upstream credit in frontmatter metadata | Add `metadata.upstream_skill` with the source URL for imported/adapted skills |
| 2026-02-20 | user   | Docs referenced `skills-ref` checks but omitted install guidance | Document install commands in README/CONTRIBUTING and print hint in validation scripts |
| 2026-02-21 | self   | Assumed Bun TS config should pin a `types` entry | Prefer Bun's current `docs/runtime/typescript.md` defaults; avoid extra `types` overrides unless needed |
| 2026-02-21 | self   | Bun examples drifted to outdated imports/flags (`bun:redis`, older test flag names) | Re-verify Bun APIs and CLI flags against `bun.com/docs` and local `bun --help` before publishing skill updates |
| 2026-03-02 | self   | Draft skill passed content review but failed publish gate due to folder/name mismatch (`dokploy` vs `dokploy-cli`) | Run `scripts/validate-skills.sh` immediately after drafting or renaming a skill, before broader polish |

## User Preferences

- Repository goal: publish created/forked skills that follow the Open Agent Skills specification (`https://agentskills.io/specification`).
- Prefer clear, descriptive skill names over metaphorical names.
- For cross-skill quality passes, use distinct subagents with explicit per-file ownership.
- Prefer automated local quality gates (pre-commit hooks) for skill validation.
- Use `.agents/LEARNINGS.md` going forward as the single project memory file.
- For locally authored skills, prefer `metadata.author: Andy Pai`; keep upstream credit in separate metadata fields.

## Patterns That Work

- When adapting non-skill agent prompts into this repo, strip non-spec frontmatter fields and rewrite `description` as explicit trigger conditions.
- Add repo-level `README.md` + `CONTRIBUTING.md` that encode the publishing standard and checklist.
- Provide a local `scripts/validate-skills.sh` entrypoint that uses `skills-ref validate` when available and falls back to structural checks.
- Run skill reviews in parallel with one worker subagent per skill folder to improve speed and avoid edit conflicts.
- Verify latest OpenAI/Codex model names in official OpenAI docs before updating skill defaults.
- Add `.pre-commit-config.yaml` local hooks for repeatable pre-commit checks.
- For forked/adapted skills, keep explicit upstream attribution in `SKILL.md` and run `scripts/validate-skills.sh` immediately after creation.
- For forked/adapted skills, include upstream attribution in frontmatter metadata (for example, `metadata.upstream_skill`) when available.
- When imported `SKILL.md` links many `references/*.md` files, copy the full `references/` folder to avoid broken in-skill links.
- For scanner integration, keep existing hooks and append `skill-scanner` as another local hook invoked through `uv run --with ...` to avoid global Python dependency drift.
- When adding env-driven scanner features (for example, LLM mode), include commented required API variables in `.env.example` so setup is self-documenting.
- Use block-style YAML lists/maps in SKILL frontmatter; `skills-ref`/StrictYAML rejects JSON-style flow syntax (for example, `bins: ["vk", "bun"]`).
- For Bun-focused skills, verify release chronology and feature introduction points against `https://bun.com/blog.md` + linked release notes before finalizing timelines/CLI guidance.
- For Bun-focused skills, prefer evergreen doc-backed guidance over hard-coded benchmark percentages and long version timelines.
- In bash templates, pull repeated condition logic into small helpers first, then flatten nested branches; this keeps behavior stable while improving readability.

## Patterns That Don't Work

- Relying on memory of the standard without a local validation command.
- Using vague skill names that do not communicate intent.
- Running dependent filesystem operations in parallel (for example, reading a file before its copy command completes).

## Domain Notes

- Skills in this repository are stored as top-level folders, each with `SKILL.md`.
