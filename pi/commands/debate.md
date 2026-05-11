---
description: Run a structured architecture, product, or UI layout debate with an independent Codex critique and final ADR.
argument-hint: "[question or decision]"
allowed-tools: >
  Bash(codex *) Bash(git status *) Bash(git log *) Bash(git diff *)
  Bash(git branch *) Bash(git rev-parse *) Read Grep Glob
---

# /pi:debate

## Pi debate snapshot

```!
echo "PI_DEBATE_PREFLIGHT_$(date +%s%N)"
git rev-parse --show-toplevel 2>/dev/null || echo "not a git repo"
git branch --show-current 2>/dev/null
git status --short 2>/dev/null | head -40
git log --oneline -n 15 2>/dev/null
git diff --stat 2>/dev/null | head -40
timeout 3 codex --version 2>&1 || echo "codex: not installed"
```

Use Pi's internal debate module for a structured propose -> critique ->
synthesize pass.

1. Read `internal/debate/README.md`.
2. Follow its process exactly, including the repo snapshot and Codex critique
   fallback behavior.
3. Treat `$ARGUMENTS` as the architecture question, product workflow tradeoff,
   UI layout direction, or technical decision to debate.

User input: $ARGUMENTS
