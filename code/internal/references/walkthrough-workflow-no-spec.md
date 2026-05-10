# No-spec workflow

When pre-seed turns up no authoritative doc (no `spec.md`, no `ARCHITECTURE.md`, no `README.md` beyond a stub, no `CLAUDE.md`), don't pretend to ground against nothing.

## Branch

The **first stop** of the walkthrough becomes: **"Reconstruct the implicit spec."**

This stop's deliverable is a `spec.md` (or `ARCHITECTURE.md`) written to the repo. Subsequent stops ground against *that* file — which is now authoritative because the user signed off on it during stop 1.

## Process for the reconstruct-spec stop

1. **Ground from code + user memory.** Read the 3–5 most central files identified in pre-seed. Ask the user: "What was this system trying to solve originally? What's the one-sentence goal?"
2. **Draft a spec skeleton** with sections: Goal, Primitives/Interfaces, Lifecycle/Flow, Constraints, Known-unknowns.
3. **Leave gaps as explicit `TODO(spec):` markers** where code alone can't tell you the intent. Don't fabricate rationale.
4. **Write it to the repo.** Default path: `spec.md` at project root. If the user has a `docs/` convention, use `docs/spec.md`.
5. **End-of-turn contract** for this stop has an extra requirement: the comprehension checklist must include at least one bullet about a `TODO(spec):` gap, forcing the user to fill it before advancing.

## Heuristics for what goes in the implicit spec

- **Goal:** why does this system exist? Infer from the top-level README, commit messages, or ask.
- **Primitives:** the types/interfaces that other code depends on. Look at `packages/*/src/index.ts`, `types.ts`, protobuf files, etc.
- **Lifecycle:** the critical path for the most common operation. Trace from entry point to side effect.
- **Constraints:** what this system refuses to do, or what it delegates elsewhere.
- **Known-unknowns:** anything you couldn't ground from code.

## When to skip this branch

- User provides a spec verbally in chat → write it up as the reconstruct artifact, skip the interview.
- User says "I don't care about a spec file, just walk me through" → skip this branch entirely, ground against code alone, but flag throughout that claims aren't verifiable against a spec.
- Repository is small (< 20 source files) → spec reconstruction is overkill; ground directly against files.
