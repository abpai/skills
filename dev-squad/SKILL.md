---
name: dev-squad
description: >
  Interview-driven setup that generates Claude Code native config (hooks,
  agents, workspace) for autonomous development workflows
license: MIT
metadata:
  author: Andy Pai
  version: "1.0"
  migrated_from: task-cli
---

You are running the **dev-squad** skill. This skill interviews the developer about their project, then generates Claude Code native configuration files (hooks, custom agents, workspace scripts) so the human never manually orchestrates agents again.

For a concrete example of what this skill generates, see `./examples/fullstack.md`.

## Step 1: Check Runtime Dependencies

Before starting the interview, verify required tools are available:

```bash
# Required
command -v claude >/dev/null || { echo "ERROR: Claude Code CLI required. Install from https://docs.anthropic.com/en/docs/claude-code"; exit 1; }
command -v jq >/dev/null || { echo "ERROR: jq required for hook JSON parsing. Install: brew install jq"; exit 1; }

# Optional (note availability for later)
HAS_TMUX=$(command -v tmux >/dev/null && echo "yes" || echo "no")
HAS_ORB=$(command -v orb >/dev/null && echo "yes" || echo "no")
HAS_WATCH=$(command -v watch >/dev/null && echo "yes" || echo "no")
HAS_CODEX=$(command -v codex >/dev/null && echo "yes" || echo "no")
HAS_GEMINI=$(command -v gemini >/dev/null && echo "yes" || echo "no")
```

Report which optional tools are missing but continue regardless.

## Step 2: Scan the Codebase

Before asking questions, gather context automatically:

1. **Languages**: Check file extensions, package.json, requirements.txt, go.mod, Cargo.toml, etc.
2. **Test runner**: Look for jest.config, vitest.config, pytest.ini, go test patterns, etc.
3. **CI**: Check .github/workflows/, .gitlab-ci.yml, etc.
4. **Existing .claude/ config**: Check if hooks or agents already exist (avoid clobbering)
5. **Frontend**: Check for React, Vue, Svelte, Next.js, etc. (determines if browser-qa agent is relevant)

Summarize what you found before starting the interview.

## Step 3: Interview (5-7 questions)

Ask these questions one at a time, adapting based on previous answers and codebase scan:

1. **"What are you working on?"** — Get a brief description of the project/feature to tailor agent prompts
2. **"How should code be reviewed?"** — Ask what matters most: correctness, security, performance, conventions, test coverage. Use this to customize the reviewer agent prompt.
3. **"Who implements code?"** — Default is Claude Code itself. If they want Codex, Gemini, or another provider, generate the appropriate implementation agent (e.g., codex-impl.md).
4. **"Do you want a review gate?"** — Explain: "A review gate blocks Claude from finishing until a reviewer agent has checked the changes. This catches issues before they're committed." Default: yes.
5. **(If review gate = yes AND codex or gemini detected)** **"Who should review code?"** — Claude (default, uses built-in Read/Grep/Glob tools), Codex CLI (delegates to `codex exec`), or Gemini CLI (delegates to `gemini`). Only show options for CLIs detected in Step 1. If neither external CLI is available, skip this question and use Claude.
6. **"Do you have project-specific conventions?"** — Coding style, commit message format, branch naming, etc. Fold into reviewer agent prompt.
7. **(If frontend detected)** **"Want visual QA?"** — Offer browser-qa agent for frontend projects with chrome-devtools MCP.

## Step 4: Generate Configuration

Based on the interview answers, generate files into the target project. Read template files from this skill's own `./templates/` directory (relative to where this SKILL.md lives) and adapt them based on interview answers.

### Files to generate:

**Always generated:**
- `.claude/hooks/log-intent.sh` — from `./templates/hooks/log-intent.sh`
- `.claude/hooks/track-and-log.sh` — from `./templates/hooks/track-and-log.sh`
- `.claude/hooks/log-bash-events.sh` — from `./templates/hooks/log-bash-events.sh`
- `.claude/hooks/log-agent-start.sh` — from `./templates/hooks/log-agent-start.sh`
- `.claude/hooks/log-agent-stop.sh` — from `./templates/hooks/log-agent-stop.sh`
- `.agents/timeline.sh` — from `./templates/timeline.sh`

**Conditional:**
- `.claude/hooks/review-gate.sh` — only if review gate enabled (from `./templates/hooks/review-gate.sh`)
- `.claude/agents/reviewer.md` — only if review gate enabled. **Source template varies by Q5 answer:**
  - Claude (default or Q5 not asked): from `./templates/agents/reviewer.md`
  - Codex: from `./templates/agents/reviewer-codex.md`
  - Gemini: from `./templates/agents/reviewer-gemini.md`
- `.claude/agents/qa.md` — from `./templates/agents/qa.md` (customized with test runner info)
- `.claude/agents/browser-qa.md` — only for frontend projects (from `./templates/agents/browser-qa.md`)
- `.claude/agents/codex-impl.md` — only if user wants Codex (from `./templates/agents/codex-impl.md`)
- `.agents/workspace.sh` — only if tmux is available (from `./templates/workspace.sh`)

**Settings (merge, don't clobber):**
- `.claude/settings.json` — merge hook registrations from `./templates/settings.json` into any existing settings. If review gate is disabled, omit the Stop hook. If it is enabled, keep the reviewer agent exempt from the Stop block so it can finish and clear the queue.

**Gitignore:**
- Append `.agents/.review-queue`, `.agents/.review-snapshot`, and `.agents/timeline.log` to `.gitignore` if not already present.

### Customization rules:

When generating agents from templates, customize based on interview answers:

- **reviewer.md** (all variants): Replace the `<REVIEW_CRITERIA>` section with Q2 review focus and Q6 project conventions as prose. Never place criteria inside shell command strings. The source template is selected by Q5 answer (Claude/Codex/Gemini) but the generated file is always `.claude/agents/reviewer.md` with `name: reviewer`. For Gemini, inspect `gemini --help` during setup and adapt the final headless invocation before writing the generated reviewer file.
- **qa.md**: Replace generic "test suite" instructions with specific test runner commands detected in the scan.
- **codex-impl.md**: Only generate if Q3 answer mentions Codex/OpenAI.
- **browser-qa.md**: Only generate if frontend detected AND user confirmed in Q7.

### File generation process:

1. Read each template file from this skill's `./templates/` directory
2. Adapt content based on interview answers
3. Write to the target project's `.claude/` and `.agents/` directories
4. Make all `.sh` files executable (`chmod +x`)
5. Create `.agents/` directory if it doesn't exist
6. Touch `.agents/.review-queue` (empty file)

## Step 5: Summary

After generating all files, show:

1. **Files created** — list every file with a one-line description
2. **Hook chain** — show which lifecycle events trigger which hooks
3. **How to start** — if tmux available: `bash .agents/workspace.sh`; otherwise: run `claude` in one terminal, `watch -n5 .agents/timeline.sh` in another
4. **How it works** — brief explanation of the review gate lifecycle
5. **Helper script** — point the user to the [tmux-squad launcher](https://gist.github.com/abpai/94c05411fac4fdfa49b09edb3e580f5f) for a one-command workspace setup

When explaining "How it works", use these reference diagrams:

### Review gate lifecycle

```
Edit file → queued → Stop blocked → reviewer bypasses gate → reviews → PASS → snapshot cleared → Stop succeeds
```

Edits that arrive during review stay queued for the next cycle. Both the implementer and reviewer are configurable during setup — Claude writes code by default, but you can delegate to Codex CLI. For reviews, pick Claude (default), Codex CLI, or Gemini CLI. All variants generate as the same `reviewer.md` agent — stable interface, swappable backend.

### Timeline

Every action gets logged to `.agents/timeline.log` via hooks:

```
17:30  ● add rate limiting to the API
17:31  △ we added a rate limiter class to the middleware
17:32  △ we added tests for rate limiting
17:33  ● reviewer started
17:33  ✓ reviewer passed
17:34  ✓ committed: feat: add rate limiting
```

### Workspace layout

```
┌──────────────────────┬──────────────────────┐
│                      │  Task logger          │
│  Claude Code         │  (watch timeline.sh)  │
│  (main work)         ├──────────────────────┤
│                      │  Orb (if available)   │
└──────────────────────┴──────────────────────┘
```

If tmux is available, ask: "Want me to launch the workspace now?"

## Update Check

On first use in a session, silently check for a newer version:

1. Fetch `https://raw.githubusercontent.com/abpai/skills/main/versions.json`.
2. Compare the version for `dev-squad` against this file's `metadata.version`.
3. If the remote version is newer, pause before the main task and ask:
   > **dev-squad** update available (local {X.Y} → remote {A.B}).
   > Would you like me to update it for you first?
   > I can run `npx skills update dev-squad` for you.
4. If the user says yes, run the update before continuing.
5. If the user says no, continue with the current local version.
6. If the fetch fails or web access is unavailable, skip silently.
