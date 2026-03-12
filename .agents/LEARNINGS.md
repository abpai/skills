# LEARNINGS

## Corrections

| Date       | Source | What Went Wrong                                    | What To Do Instead                                                           |
| ---------- | ------ | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| 2026-03-10 | user   | `arch-council` could leave a `tail -f` monitor running when interrupted | Track monitor PIDs and kill them in an `EXIT/INT/TERM` cleanup path |
| 2026-02-07 | user   | Skill name `napkin` was unclear                    | Prefer clearer, intent-based skill names (for example, `project-memory`)    |
| 2026-02-07 | user   | Reviewed all skills in a single-agent pass         | Use a different subagent per skill for reviews and improvements              |
| 2026-02-07 | user   | Manual validation relied on ad-hoc runs            | Wire `scripts/validate-skills.sh` into pre-commit to enforce checks pre-commit |
| 2026-02-19 | user   | New `agent-browser` skill missed upstream credit in frontmatter metadata | Add `metadata.upstream_skill` with the source URL for imported/adapted skills |
| 2026-02-20 | user   | Docs referenced `skills-ref` checks but omitted install guidance | Document install commands in README/CONTRIBUTING and print hint in validation scripts |
| 2026-02-21 | self   | Assumed Bun TS config should pin a `types` entry | Prefer Bun's current `docs/runtime/typescript.md` defaults; avoid extra `types` overrides unless needed |
| 2026-02-21 | self   | Bun examples drifted to outdated imports/flags (`bun:redis`, older test flag names) | Re-verify Bun APIs and CLI flags against `bun.com/docs` and local `bun --help` before publishing skill updates |
| 2026-03-02 | self   | Draft skill passed content review but failed publish gate due to folder/name mismatch (`dokploy` vs `dokploy-cli`) | Run `scripts/validate-skills.sh` immediately after drafting or renaming a skill, before broader polish |
| 2026-03-03 | self   | Removed/added skills without updating the root README skill list | When adding/removing skills, update `README.md` skill inventory in the same commit |
| 2026-03-08 | self   | Generated an execution-flow explainer with hand-built HTML boxes instead of the Excalidraw flowchart pipeline | For execution flow / code flow explainers, the primary diagram itself should render through the Excalidraw pipeline, not just mimic a flow layout with CSS |
| 2026-03-08 | self   | Removed the exported Excalidraw SVG width/height, which collapsed the rendered diagram to `0x0` even though the SVG existed in the DOM | Preserve or restore intrinsic SVG dimensions from `viewBox`, then scale responsively with CSS instead of stripping sizing attrs |
| 2026-03-08 | self   | Used `git write-tree` and `eval` in a loop wrapper, which missed unstaged edits and let prompt text hit shell parsing | For agent wrappers, detect changes from `git status --porcelain` and pass user prompt text as a literal argv entry instead of shell-evaluating it |
| 2026-03-09 | user   | A review note claimed `agent-browser` lacked `--native`, but upstream now documents `--native` and `AGENT_BROWSER_NATIVE=1` | Re-check the latest upstream README/skill before removing or downgrading agent-browser flags that may have changed recently |
| 2026-03-09 | self   | A multi-mode shell script treated preview and prebuilt-input flows like full live execution | Gate required args and binary checks by the execution mode so `--dry-run` and `--context-file` paths stay usable |
| 2026-03-09 | self   | `arch-council` passed full prompt files as argv strings and used GNU-only `find -maxdepth`, breaking large runs and stock macOS | For shell skills, stream large prompts over stdin and prefer BSD/POSIX-friendly directory traversal patterns when macOS is a target |
| 2026-03-11 | user   | `visual-explainer` reports could still come out prose-heavy with too little actual diagramming | In the skill and report prompts, require a structural visual plus an evidence visual for report-style pages and add a first-screen visual check |
| 2026-03-11 | user   | `visual-explainer` could leave users with several output files and no obvious starting point | Default to one HTML file; if multiple files are necessary, make the main file an index that links to every companion file |

## User Preferences

- Repository goal: publish created/forked skills that follow the Open Agent Skills specification (`https://agentskills.io/specification`).
- Prefer clear, descriptive skill names over metaphorical names.
- For cross-skill quality passes, use distinct subagents with explicit per-file ownership.
- Prefer automated local quality gates (pre-commit hooks) for skill validation.
- Use `.agents/LEARNINGS.md` going forward as the single project memory file.
- For locally authored skills, prefer `metadata.author: Andy Pai`; keep upstream credit in separate metadata fields.
- For `visual-explainer`, prefer Excalidraw-style diagram rendering over plain Mermaid when possible.
- For editorial UI, prefer Medium-like styling aligned with `threaded` (Merriweather + Inter, slate palette, restrained visuals).
- For execution flow / code flow visuals, explicitly route to Excalidraw flowchart rendering.
- For `agent-browser`, prefer a CDP attach-once workflow (`agent-browser connect ...`) over repeatedly launching fresh browser instances when session reuse is desired.

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
- Update root docs (`README.md` skill inventory) whenever skill folders are added, renamed, or removed.
- For `visual-explainer` execution-flow pages, pair one real Excalidraw-rendered flowchart with supporting editorial sections instead of replacing the flowchart with static HTML boxes.
- For exported Excalidraw SVGs in standalone HTML, keep intrinsic dimensions and apply responsive scaling with `width: 100%`, `height: auto`, and a `max-width` derived from `viewBox`.
- For Codex-related skills, prefer `gpt-5.4` as the default model; OpenAI now recommends the general-purpose GPT-5.4 over `gpt-5.3-codex` for most coding tasks.
- For `agent-browser`, use `agent-browser connect "${AGENT_BROWSER_CDP_PORT:-9222}"` to reuse a logged-in Chrome, and use an empty config plus unset persistence env vars for truly clean sessions.
- For skill renames, update the skill folder name, `SKILL.md` `name` field, and root `README.md` inventory atomically, then run a repository-wide text check for stale references.

## Patterns That Don't Work

- Relying on memory of the standard without a local validation command.
- Using vague skill names that do not communicate intent.
- Running dependent filesystem operations in parallel (for example, reading a file before its copy command completes).

## Domain Notes

- Skills in this repository are stored as top-level folders, each with `SKILL.md`.
