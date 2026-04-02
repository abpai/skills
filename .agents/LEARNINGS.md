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
| 2026-03-08 | self   | Generated an execution-flow explainer with hand-built HTML boxes instead of a diagram engine | For execution flow / code flow explainers, use Mermaid.js for the primary diagram instead of mimicking a flow layout with CSS |
| 2026-03-08 | self   | Used `git write-tree` and `eval` in a loop wrapper, which missed unstaged edits and let prompt text hit shell parsing | For agent wrappers, detect changes from `git status --porcelain` and pass user prompt text as a literal argv entry instead of shell-evaluating it |
| 2026-03-09 | user   | A review note claimed `agent-browser` lacked `--native`, but upstream now documents `--native` and `AGENT_BROWSER_NATIVE=1` | Re-check the latest upstream README/skill before removing or downgrading agent-browser flags that may have changed recently |
| 2026-03-09 | self   | A multi-mode shell script treated preview and prebuilt-input flows like full live execution | Gate required args and binary checks by the execution mode so `--dry-run` and `--context-file` paths stay usable |
| 2026-03-09 | self   | `arch-council` passed full prompt files as argv strings and used GNU-only `find -maxdepth`, breaking large runs and stock macOS | For shell skills, stream large prompts over stdin and prefer BSD/POSIX-friendly directory traversal patterns when macOS is a target |
| 2026-03-11 | user   | `visualize` reports could still come out prose-heavy with too little actual diagramming | In the skill and report prompts, require a structural visual plus an evidence visual for report-style pages and add a first-screen visual check |
| 2026-03-11 | user   | `visualize` could leave users with several output files and no obvious starting point | Default to one HTML file; if multiple files are necessary, make the main file an index that links to every companion file |
| 2026-03-12 | self   | `arch-council` context scanning used bare substrings like `gin`, which matched unrelated words like `margin` and polluted the API surface section | For heuristic code scanners, use word boundaries or syntax-shaped patterns, and prefer `rg --pcre2` over loose substring grep when available |
| 2026-03-12 | self   | Used a bare zsh glob against `/tmp/arch-council-fixture.*`, which failed with `nomatch` when the pattern didn't expand | In this environment, prefer `find`, `ls`, or quoted/glob-safe patterns over bare zsh globs for ad-hoc temp paths |
| 2026-03-12 | self   | Ran `rg` with a pattern that began with `--`, so ripgrep parsed it as flags instead of a search pattern | When searching for literals or regexes that start with dashes, insert `rg -- <pattern> <paths>` so option parsing stops first |
| 2026-03-12 | self   | The `claude` skill recommended temp-file command substitution for long prompts, which still pushes the full prompt through argv | For CLI skills, prefer stdin-first examples (`< file` or pipes) over `$(cat file)` when prompts can be large or multi-line |
| 2026-03-12 | self   | Used `status` as a shell variable name in this zsh environment, but `$status` is read-only | In ad-hoc shell snippets here, use names like `rc` or `exit_code` instead of `status` |
| 2026-03-12 | self   | Tried to run multiple `git add`/`git commit` sequences in parallel, which collided on `.git/index.lock` and blurred commit boundaries | Serialize staged Git operations; never parallelize commits or other index-mutating commands in the same repo |
| 2026-03-16 | self   | Wrote a Python heredoc that referenced `$tmpdir` inside a single-quoted heredoc body, so the temp path stayed literal and the check hit the wrong file | For ad-hoc Python snippets with temp paths, pass the path as `sys.argv` (or via env) instead of relying on shell expansion inside the heredoc |
| 2026-03-17 | self   | Added `agent-browser` doc examples before checking the installed CLI surface, which let unsupported commands and flags slip into the skill docs | For external CLI-backed skills, verify new commands/options against the installed tool's `--help` output before updating `SKILL.md` or references |
| 2026-03-17 | user   | Passive "update available" notices were too easy to ignore during skill startup | For skill update checks, pause before task work, ask whether to update now, and explicitly offer to run the update command on the user's behalf |
| 2026-03-21 | self   | The `claude` skill documented shell commands like `claude config list` that are not real CLI subcommands and missed current flags/behaviors | For Claude Code updates, verify both the installed `claude --help` surface and Anthropic's current Claude Code docs, and prefer harness-tested flows over REPL-only affordances |
| 2026-03-21 | self   | Repo-wide pre-commit validation failed on an unrelated commit because a new untracked skill folder existed without a matching `versions.json` entry yet | As soon as a new top-level skill folder with `SKILL.md` exists, regenerate `versions.json` before attempting unrelated commits, because validation scans the whole repo, not just staged files |
| 2026-03-21 | self   | A `claude` streaming note promoted a local `--verbose` quirk as a hard requirement, even though Anthropic's docs show `stream-json` examples without it | For Claude Code behavior notes, treat official docs as the baseline and phrase local observations as optional unless reproduced and clearly documented upstream |
| 2026-03-22 | self   | A hook-based review workflow template blocked on `Stop` without exempting the reviewer itself, which can deadlock the review pass | When a queue-clearing reviewer relies on a `Stop` hook, explicitly let the reviewer bypass that gate so it can finish and clear the queue |
| 2026-03-22 | self   | A delegated reviewer template used stale non-interactive CLI assumptions for Codex/Gemini | Verify current CLI help for delegation tools and prefer stdin/headless flows like `codex review -` and `gemini -p ... < file` over vague or interactive invocations |
| 2026-03-22 | self   | Assumed an MCP startup failure around `chrome-devtools` was a shell PATH issue before checking whether the configured launcher binary actually existed | For command-based MCP servers, verify the exact configured `command` first; interactive shell wrappers like lazy-loaded `nvm` can make `node --version` succeed while direct `npx` execution still fails |
| 2026-03-24 | self   | The `claude` skill's review guidance was too generic, which led to repeated retries across stdin-vs-repo review modes and unusably low `--max-turns` caps | For Claude reviews, document one default repo-native path, one narrowed diff path, and explicit retry rules so review runs do not thrash |
| 2026-03-24 | self   | The `claude` skill repeated the same guidance across too many sections, which made the intended workflow harder to follow | For CLI skills, consolidate overlapping advice into a small set of opinionated workflows and keep the sharp edges in one troubleshooting section |
| 2026-03-25 | self   | Deep skill rewrites drifted toward long inline policy docs instead of reusable skill bodies | Keep `SKILL.md` focused on trigger, default flow, and gotchas; move matrices, examples, and report shapes into `references/`, and add scripts only when they remove real repeated mechanics |
| 2026-03-25 | self   | Bumping a skill version in `SKILL.md` without updating `versions.json` breaks repo-wide validation | Keep `SKILL.md` and `versions.json` in sync whenever a skill version changes |
| 2026-03-25 | self   | Upstream `agent-browser` docs exposed more features than I had surfaced locally, but not every tempting addition was verified in the installed CLI | For external CLI skill syncs, compare upstream docs against the installed `--help` output before documenting new commands, and only port the features that exist locally |
| 2026-03-25 | self   | A `claude` skill rewrite carried over unsupported local flags like `--max-turns` and `--*-system-prompt-file` even though the installed CLI help no longer exposed them | For CLI skill refreshes, verify every documented flag against the current installed `--help` output before keeping legacy examples or fallback variants |
| 2026-03-26 | self   | The `claude` skill still allowed ambiguous retry behavior and mixed stdin-plus-argv prompt shapes, which let review runs thrash instead of narrowing cleanly | For `claude`, document a failure-classified retry budget, require scope changes instead of prompt-only retries, and use exactly one prompt source per `claude -p` invocation |
| 2026-03-26 | self   | Ran `git diff -- <absolute-path-outside-repo> <repo-path>`, which produced a misleading cross-file patch view during verification | When checking edits for files outside the repo root, inspect the file directly or diff one path at a time instead of mixing external absolute paths with repo-relative pathspecs |
| 2026-03-26 | self   | Treated a quiet `claude -p` run as hung after empty intermediate polls even though the final result arrived on a later read | For `claude -p` in this harness, allow an extra final poll before declaring the run stuck; silence during intermediate reads is not by itself a failure |
| 2026-03-31 | self   | Hand-editing a new skill into `versions.json` and patching frontmatter separately led to a stale manifest check and a missing opening `---` fence during release prep | For new or renamed skills, fix the `SKILL.md` frontmatter first, then run `scripts/generate-versions.sh` instead of manually editing `versions.json`, and validate immediately |

## User Preferences

- Repository goal: publish created/forked skills that follow the Open Agent Skills specification (`https://agentskills.io/specification`).
- For `dev-squad`, keep the skill focused on configuring Claude Code agents/hooks; treat `tmux-squad` as the optional launcher for Orb + timeline instead of generating a repo-local workspace script.
- Prefer clear, descriptive skill names over metaphorical names.
- For cross-skill quality passes, use distinct subagents with explicit per-file ownership.
- Prefer automated local quality gates (pre-commit hooks) for skill validation.
- Use `.agents/LEARNINGS.md` going forward as the single project memory file.
- For locally authored skills, prefer `metadata.author: Andy Pai`; keep upstream credit in separate metadata fields.
- For `visualize`, use Mermaid with Threaded theming for all diagrams.
- For editorial UI, prefer Medium-like styling aligned with `threaded` (Merriweather + Inter, slate palette, restrained visuals).
- For `agent-browser`, prefer a CDP attach-once workflow (`agent-browser connect ...`) over repeatedly launching fresh browser instances when session reuse is desired.

## Patterns That Work

- When adapting non-skill agent prompts into this repo, strip non-spec frontmatter fields and rewrite `description` as explicit trigger conditions.
- For skill authoring/review, keep the core `SKILL.md` focused on trigger, category, decision rules, and gotchas; move long templates, examples, and rigid output contracts into `references/` when they start reducing flexibility.
- For CLI-heavy skills, keep `SKILL.md` focused on triggers, decision rules, and high-signal gotchas; move volatile command recipes into `references/` or scripts when they start crowding the core workflow.
- Keep `versions.json` aligned with any `metadata.version` change before running validation.
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
- For `visualize` execution-flow pages, pair one Mermaid-rendered flowchart with supporting editorial sections instead of replacing the flowchart with static HTML boxes.
- For Codex-related skills, prefer `gpt-5.4` as the default model; OpenAI now recommends the general-purpose GPT-5.4 over `gpt-5.3-codex` for most coding tasks.
- For `agent-browser`, use `agent-browser connect "${AGENT_BROWSER_CDP_PORT:-9222}"` to reuse a logged-in Chrome, and use an empty config plus unset persistence env vars for truly clean sessions.
- For skill renames, update the skill folder name, `SKILL.md` `name` field, and root `README.md` inventory atomically, then run a repository-wide text check for stale references.

## Patterns That Don't Work

- Relying on memory of the standard without a local validation command.
- Using vague skill names that do not communicate intent.
- Running dependent filesystem operations in parallel (for example, reading a file before its copy command completes).

## Domain Notes

- This repository now uses Claude plugin packaging: each top-level plugin folder contains `.claude-plugin/plugin.json` and skill content under `skills/<name>/SKILL.md` plus supporting files alongside that manifest.
- For Codex compatibility, distinguish raw skills from plugins: raw Codex skills still expect a folder with root `SKILL.md`, while Codex plugins use `.codex-plugin/plugin.json` plus `skills/<name>/SKILL.md`.
