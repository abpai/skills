---
name: try
description: >
  Systematically explore and evaluate a library, tool, or GitHub repo in an isolated
  scratch environment. Use this skill whenever the user asks to "try", "evaluate",
  "explore", or "kick the tires" on a library/repo/tool, especially when they provide
  a GitHub URL, npm/pip package name, or repo shorthand like "owner/repo". Use it when
  they want real primitives, failure modes, and composability beyond quickstarts before
  deciding on integration. Produces runnable scratch/ scripts demonstrating key primitives,
  a composition script, and a Tutorial.md with honest findings. This is NOT for full
  integration into an existing codebase.
license: MIT
metadata:
  author: Andy Pai
  version: "1.1"
---

# Try: Structured Library Exploration

You are exploring a library the user wants to evaluate. Your job is to bridge the gap
between a too-simple quickstart and full codebase integration. You will:

1. Set up an isolated workspace
2. Discover the library's real API surface (not just what the README shows)
3. Write small, runnable scripts that each prove ONE primitive works
4. Write a composition script that wires primitives together
5. Document everything in Tutorial.md with an honest verdict

Keep this scoped to disposable exploration only. Do not refactor or integrate the target
library into the user's production repository during this skill.

## Invocation Patterns

The user will say something like:
- `/try ComposioHQ/agent-orchestrator`
- `/try https://github.com/some/repo — help me build X`
- `explore langgraph, I want to understand the state machine primitives`
- `kick the tires on better-auth`

They may optionally provide:
- A screenshot or context about what they want to build
- A specific angle ("focus on the streaming API")
- A constraint ("I need this to work with Bun")

## Phase 0: Setup

```
WORKSPACE SETUP
───────────────
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ User says    │     │ Clone repo   │     │ Create       │
  │ "/try X"     │────>│ into         │────>│ scratch/     │
  │              │     │ /tmp/try-X/  │     │ workspace    │
  └──────────────┘     └──────────────┘     └──────────────┘
```

1. **Determine the target**: Parse the repo URL, package name, or shorthand.
2. **Clone or install** into an isolated directory:
   - GitHub repo → `git clone --depth 1` into `/tmp/try-<name>/`
   - npm package → `mkdir /tmp/try-<name> && cd $_ && npm init -y && npm i <pkg>`
   - pip package → `mkdir /tmp/try-<name> && cd $_ && python -m venv .venv && source .venv/bin/activate && pip install <pkg>`
3. **Create the scratch workspace** inside the clone:
   ```
   /tmp/try-<name>/
   ├── scratch/           ← your scripts go here
   │   ├── 01-<primitive>.{ts,py,js}
   │   ├── 02-<primitive>.{ts,py,js}
   │   ├── ...
   │   └── 99-compose.{ts,py,js}
   └── Tutorial.md        ← your writeup
   ```

If `try` CLI (github.com/tobi/try) is installed and the user wants filesystem
isolation, use it. Otherwise, `/tmp/` is fine — this is disposable exploration.

## Phase 1: Recon

**Goal**: Understand the library's actual surface area. Do NOT start writing code yet.

```
RECON SEQUENCE
──────────────
  README → package.json/pyproject.toml → src/ tree → exports → examples/ → tests/
```

Read in this order. Stop at each step and extract:

1. **README / docs/**: What does the library claim to do? What's the mental model?
2. **Package manifest**: What are the dependencies? What does it actually export?
3. **Source tree**: `find src/ -name "*.ts" -o -name "*.py" | head -40` — get the shape.
4. **Public API**: Read the main entry point (index.ts, __init__.py, mod.rs).
   Extract every public function/class/type. This is the REAL API, not the README's
   cherry-picked version.
5. **Examples/**: If they exist, read them. Note what they cover and what they skip.
6. **Tests/**: Read 2-3 test files. Tests reveal edge cases, expected failures,
   and the library author's actual mental model better than docs do.

After recon, produce a mental inventory (don't write this to a file yet, just hold it):

```
PRIMITIVES IDENTIFIED
─────────────────────
  1. <PrimitiveName> — what it does, one line
  2. <PrimitiveName> — what it does, one line
  ...
  N. <Composition> — how they wire together
```

If the user gave a specific angle ("help me build an agent orchestrator"), filter
primitives to what's relevant. If not, cover the top 5-8 most important ones.

## Phase 2: Primitive Scripts

**Goal**: One script per primitive. Each script is self-contained and runnable.

```
SCRIPT STRUCTURE
────────────────
  ┌─ scratch/01-<name>.ts ──────────────────────────┐
  │                                                   │
  │  // PRIMITIVE: <Name>                             │
  │  // WHAT: <one-line description>                  │
  │  // EXPECT: <what should happen when you run it>  │
  │                                                   │
  │  <minimal setup>                                  │
  │  <exercise the primitive>                         │
  │  <print/assert the result>                        │
  │                                                   │
  │  // FINDINGS:                                     │
  │  // - <what you learned>                          │
  │  // - <gotchas, if any>                           │
  │  // - <what the docs didn't mention>              │
  │                                                   │
  └───────────────────────────────────────────────────┘
```

Rules for primitive scripts:
- **One concept per file**. No script should exercise more than one primitive.
- **Actually run each script** after writing it. Capture stdout/stderr.
- **If it fails**, debug it. The failure itself is valuable intel — note it in FINDINGS.
- **If the docs are wrong**, note it. This is one of the main values of /try.
- **Use the library's native patterns**, not wrappers. You want to feel the raw API.
- **Name files with numeric prefix** for reading order: 01-, 02-, 03-, etc.
- **Match the library's language**. If it's a TS library, write TS. If Python, write Python.

After each script runs, update your mental model. Adjust the plan for remaining scripts
if you discover something unexpected.

## Phase 3: Composition Script

**Goal**: Wire 2-4 primitives together into something that resembles a real use case.

```
  scratch/99-compose.ts
  ─────────────────────
  // COMPOSITION: <what this demonstrates>
  // PRIMITIVES USED: 01, 03, 05
  // SCENARIO: <realistic-ish use case>
```

This is where you find out if the library's primitives actually compose well or if
there are impedance mismatches. The composition script should:

- Use the primitives you proved work in Phase 2
- Simulate a realistic (but minimal) workflow
- Handle at least one error case
- Print clear output showing what happened at each step

If the user provided a screenshot or description of what they want to build,
the composition should approximate that.

## Phase 4: Tutorial.md

Write `Tutorial.md` in the repo root. Structure:

```markdown
# Trying: <library-name>

> <one-line verdict: would you use this in production?>

## What It Is
<2-3 sentences. What problem does it solve? What's the mental model?>

## Key Primitives

### 1. <Primitive Name>
<What it does. What surprised you. Link to scratch/01-*.>

### 2. <Primitive Name>
...

## Composition
<How the primitives wire together. What worked. What was awkward.
Link to scratch/99-compose.>

## Gotchas
<Bulleted list. Things the docs don't tell you. Failure modes.
Missing features. Version issues.>

## Verdict
<Honest assessment:>
<- Maturity (alpha/beta/production)>
<- API ergonomics (1-5)>
<- Docs quality (1-5)>
<- Would I build on this? Why/why not?>
<- What I'd want to see before committing>
```

## Execution Discipline

Throughout all phases, follow this cadence:

```
LOOP (per script)
─────────────────
  WRITE ──> RUN ──> OBSERVE ──> NOTE FINDINGS
    ^                                 │
    └─────── ADJUST PLAN ─────────────┘
```

- **Write small, run often**. Don't write 5 scripts then run them all.
- **Capture real output**. Include actual stdout in Tutorial.md findings, trimmed.
- **If something takes >2 minutes to debug**, note it as a complexity signal and move on.
- **Don't fake it**. If a primitive doesn't work, say so. The user is evaluating
  whether to invest time in this library. Honest signal > polished demo.

## Output Checklist

Before declaring done, verify:

```
  ✓ scratch/ contains 3-8 numbered primitive scripts
  ✓ scratch/99-compose.{ts,py} exists and runs
  ✓ Every script in scratch/ was actually executed
  ✓ Tutorial.md exists with all sections filled
  ✓ Tutorial.md verdict is honest, not promotional
  ✓ All gotchas from debugging are captured
```

## Edge Cases

- **Repo requires API keys**: Note it, mock if possible, skip if not. Don't ask the
  user for keys unless they offered.
- **Repo is huge (monorepo)**: Focus on the specific package the user mentioned.
  Use `find` and `grep` to navigate, don't try to read everything.
- **Repo is broken / won't install**: That IS the finding. Write a short Tutorial.md
  noting what failed and bail. This saves the user hours.
- **Library is for a different runtime** (e.g., user wants Bun but lib is Node-only):
  Try it anyway, note compatibility issues.
- **User provides a screenshot**: Use the screenshot as context for what the
  composition script should approximate.

## Update Check

On first use in a session, silently check for a newer version:

1. Fetch `https://raw.githubusercontent.com/abpai/skills/main/versions.json`.
2. Compare the version for `try` against this file's `metadata.version`.
3. If the remote version is newer, pause before the main task and ask:
   > **try** update available (local {X.Y} → remote {A.B}).
   > Would you like me to update it for you first?
   > I can run `npx skills update try` for you.
4. If the user says yes, run the update before continuing.
5. If the user says no, continue with the current local version.
6. If the fetch fails or web access is unavailable, skip silently.
