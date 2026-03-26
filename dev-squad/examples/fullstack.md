# Example: Fullstack TypeScript Project

Interview answers:
- **Project**: Next.js app with Express API
- **Review focus**: Correctness, security, TypeScript conventions
- **Implementer**: Claude Code (default)
- **Review gate**: Yes
- **Conventions**: Prefer `type` over `interface`, no default exports, tests colocated
- **Visual QA**: Yes (React frontend)

## Generated files

```
.claude/
├── hooks/
│   ├── log-intent.sh
│   ├── track-and-log.sh
│   ├── log-bash-events.sh
│   ├── log-agent-start.sh
│   ├── log-agent-stop.sh
│   └── review-gate.sh
├── agents/
│   ├── reviewer.md          ← customized with TS conventions
│   ├── qa.md                ← configured for vitest
│   └── browser-qa.md        ← enabled (React frontend)
└── settings.json            ← all 6 hooks registered

.agents/
├── timeline.sh
├── timeline.log             ← gitignored
└── .review-queue            ← gitignored
```

For the full tmux layout with Orb and a live timeline pane, launch the repo with
the optional `tmux-squad` helper instead of a generated project-local workspace
script.

## Customized reviewer.md

```markdown
---
name: reviewer
description: Reviews code changes for correctness, security, and project conventions
tools: Read, Grep, Glob, Bash
model: sonnet
maxTurns: 20
---

Review the current git diff for:
- Correctness and logic errors
- Security vulnerabilities (OWASP top 10)
- TypeScript best practices: prefer `type` over `interface`, no default exports
- Colocated test files exist for new modules
- Test coverage gaps

After review, output exactly one of:
  VERDICT: PASS
  VERDICT: FAIL: <brief reason>
```

## Customized qa.md

```markdown
---
name: qa
description: Runs tests and validates changes don't break existing functionality
tools: Read, Grep, Glob, Bash
model: haiku
maxTurns: 10
---

Run the test suite with `npx vitest run`. Validate:
1. All existing tests pass
2. New/modified code has colocated test files
3. No regressions introduced

Output exactly one of:
  VERDICT: PASS
  VERDICT: FAIL: <brief reason>
```

## Sample timeline

```
14:20  ● build a user settings page with email preferences
14:21  △ we added a settings page component with preference toggles
14:22  △ we created an API route for saving email preferences
14:23  △ we added tests for the settings API endpoint
14:24  ● reviewer started
14:24  ✓ reviewer passed
14:25  ● qa started
14:25  ✓ qa passed
14:26  ● browser-qa started
14:26  ✓ browser-qa passed
14:27  ✓ committed: feat: add user settings page with email preferences
```
