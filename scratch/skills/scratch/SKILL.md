---
name: scratch
description: >
  Understand an existing project by playing with its real modules in a safe
  workspace. Creates a .scratch/ folder with runnable scripts that exercise
  key primitives and subsystems. Use when the user wants to build a mental
  model of a codebase through hands-on code — not for evaluating external
  libraries for adoption (use the `try` skill for that).
license: MIT
metadata:
  author: Andy Pai
  version: "1.0"
---

# Scratch: Codebase Exploration Through Code

You are exploring an existing project the user wants to understand from the
inside. Your job is to create runnable scripts that walk through the project's
key modules, revealing how they work through real execution rather than static
reading.

This is for understanding something you already have — building a mental model
by touching real code in a safe, exploratory way. If the user wants to evaluate
something new for adoption, use the `try` skill instead.

## Invocation Patterns

The user will say something like:
- `scratch this project`
- `scratch this project — focus on the auth system`
- `help me understand how this codebase works`
- `walk me through the internals`
- `how does the payment module actually work?`
- `scratch around in the data pipeline`

They may optionally provide:
- A specific module or subsystem to focus on
- A question they're trying to answer ("how does caching work here?")
- A constraint ("I only care about the API layer")
- A screenshot showing behavior they want to trace

## Phase 0: Setup

```
WORKSPACE SETUP
───────────────
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ User asks to │     │ Confirm      │     │ Create       │
  │ scratch      │────>│ inside a     │────>│ .scratch/    │
  │              │     │ project      │     │ workspace    │
  └──────────────┘     └──────────────┘     └──────────────┘
```

1. **Confirm you are inside an existing project**: look for git root,
   package.json, pyproject.toml, Cargo.toml, go.mod, etc. If not inside a
   project, tell the user and stop.
2. **Create `.scratch/`** at the project root.
3. **Suggest adding `.scratch/` to `.gitignore`** if not already present.

**Safety rule**: `.scratch/` scripts must NOT modify production code. They
import and exercise modules read-only. No writes to the project's database,
no mutations to config files, no side effects outside `.scratch/`.

Workspace structure:
```
<project-root>/
└── .scratch/
    ├── 01-<module>.{ts,py,js}
    ├── 02-<module>.{ts,py,js}
    ├── ...
    ├── 99-compose.{ts,py,js}
    └── Tutorial.md
```

## Phase 1: Distill

**Goal**: Identify the project's key primitives, modules, and subsystems.

```
DISTILL CHECK
─────────────
  Is the distill skill available in this session?
    YES → use it for a primitive inventory
    NO  → manual recon (see below)
```

**If the `distill` skill is available** (check the current host's available skills):
1. Use the `distill` skill on the current project.
2. Request a **primitive inventory** as the output shape — a concise list of
   5-8 key modules/subsystems with one-line descriptions. This is a first-pass
   identification, not a full iterative distillation.
3. Provide the user's stated goal or angle as context.
4. Use distill's output as your exploration plan. Proceed to Phase 2.

**If the `distill` skill is NOT available**, perform manual reconnaissance:

```
RECON SEQUENCE
──────────────
  Entry points → Package manifest → Source tree → Public API → Tests
```

Read in this order:
1. **Entry points**: main files, CLI handlers, route definitions, `index.*`.
2. **Package manifest**: dependencies, scripts, exports.
3. **Source tree**: get the shape. `ls -R src/ | head -40` or equivalent.
4. **Public API**: read the main entry points. What does this project expose?
5. **Tests**: read 2-3 test files. Tests reveal the author's mental model.

After recon, produce a mental inventory (hold it, don't write yet):

```
MODULES IDENTIFIED
──────────────────
  1. <ModuleName> — what it does, one line
  2. <ModuleName> — what it does, one line
  ...
  N. <Connection> — how they wire together
```

If the user gave a specific angle ("how does caching work?"), filter to
relevant modules. Otherwise, cover the top 5-8 most important ones.

## Phase 2: Exploration Scripts

**Goal**: One script per primitive or critical module boundary. Each is
self-contained and runnable.

```
SCRIPT STRUCTURE
────────────────
  ┌─ .scratch/01-<name>.ts ─────────────────────────────┐
  │                                                       │
  │  // MODULE: <Name>                                    │
  │  // WHAT: <one-line description>                      │
  │  // EXPECT: <what should happen when you run it>      │
  │  // ENTRY POINT: <file:line in the real codebase>     │
  │                                                       │
  │  <import from the project's own modules>              │
  │  <exercise the module with clear inputs>              │
  │  <print/assert the result>                            │
  │                                                       │
  │  // FINDINGS:                                         │
  │  // - <what you learned about how this works>         │
  │  // - <surprising internal behavior>                  │
  │  // - <connections to other modules>                  │
  │                                                       │
  └───────────────────────────────────────────────────────┘
```

Rules for exploration scripts:
- **One module per file**. No script should exercise more than one subsystem.
- **Import from the actual project** — these scripts exercise real code, not
  mocks. For compiled languages or cases where direct import isn't feasible,
  invoke the project's CLI or API instead.
- **Actually run each script** after writing it. Capture stdout/stderr.
- **If it fails**, debug it. The failure itself is valuable signal — note it
  in FINDINGS.
- **Note the entry point** (`file:line`) in the real codebase for each module.
  This tells the user where to start reading.
- **Use numeric prefixes** for reading order: 01-, 02-, 03-, etc.
- **Match the project's language and runtime**.

After each script runs, update your mental model. Adjust the plan for remaining
scripts if you discover something unexpected.

## Phase 3: Composition Script

**Goal**: Wire 2-4 modules together to demonstrate a real workflow through
the codebase.

```
  .scratch/99-compose.ts
  ──────────────────────
  // COMPOSITION: <what this demonstrates>
  // MODULES USED: 01, 03, 05
  // SCENARIO: <realistic workflow through the codebase>
```

This shows how the project's internals actually connect. The composition
should trace a real user-facing operation end to end — for example, what
happens when a request comes in, gets validated, hits the database, and
returns a response.

If the user provided a specific scenario, question, or screenshot, the
composition MUST target that. If not, trace the most representative
end-to-end workflow that emerged from exploration.

## Phase 4: Tutorial.md

Write `.scratch/Tutorial.md`. Structure:

```markdown
# Understanding: <project-name>

> <one-line summary of the project's architecture>

## Architecture Overview
<2-3 sentences. What's the mental model? How do the pieces fit?>

## Key Modules

### 1. <Module Name>
<What it does. How it works internally. Entry point in the codebase
(file:line). Link to .scratch/01-*.>

### 2. <Module Name>
...

## How They Connect
<How modules wire together. Data flow. The critical path.
Link to .scratch/99-compose.>

## Surprises
<Bulleted list. Things you wouldn't guess from reading the code.
Hidden coupling. Implicit contracts. Non-obvious initialization order.>

## Dead Ends
<Things that didn't work. Failed approaches. Modules that looked
important but weren't. Misleading names. This section preserves
failure signal so the user doesn't repeat your dead ends.>

## Mental Model
<The compressed understanding. If you had to explain this codebase
to a new team member in 2 minutes, what would you say?>
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
- **Don't fake it**. If a module doesn't work as expected, say so. The user
  wants to understand how things actually work, not how they should work.

## Output Checklist

Before declaring done, verify:

```
  ✓ .scratch/ contains 3-8 numbered exploration scripts
  ✓ .scratch/99-compose.{ts,py} exists and runs
  ✓ Every script was actually executed
  ✓ Each script notes its entry point (file:line) in the real codebase
  ✓ No script modifies production code
  ✓ Tutorial.md exists in .scratch/ with all sections
  ✓ Surprises and Dead Ends sections capture non-obvious findings
  ✓ .scratch/ suggested for .gitignore
```

## Edge Cases

- **Project uses multiple languages**: Write scripts in the language of each
  module being explored. Note cross-language boundaries in Tutorial.md.
- **Project requires running services** (DB, Redis, etc.): Note dependencies,
  mock where possible, skip where not. The dependency itself is a finding.
- **Project is a monorepo**: Ask which package or service to focus on. If the
  user doesn't specify, pick the most central one and note the choice.
- **Project has no tests**: That IS a finding. Note it in Surprises.
- **Compiled language** (Go, Rust, Java): Write scripts that invoke the
  project's CLI, API, or build artifacts instead of importing source directly.
- **User provides a screenshot or scenario**: The composition script must
  target that scenario. Other scripts should support understanding it.

## Update Check

On first use in a session, silently check for a newer version:

1. Fetch `https://raw.githubusercontent.com/abpai/skills/main/versions.json`.
2. Compare the version for `scratch` against this file's `metadata.version`.
3. If the remote version is newer, pause before the main task and ask:
   > **scratch** update available (local {X.Y} → remote {A.B}).
   > Would you like me to update it for you first?
   > I can run `npx skills update scratch` for you.
4. If the user says yes, run the update before continuing.
5. If the user says no, continue with the current local version.
6. If the fetch fails or web access is unavailable, skip silently.
