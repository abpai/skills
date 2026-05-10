# Debate

Run a structured propose → critique → synthesize debate on an architecture or
technical question. Claude owns the proposal and synthesis. Codex provides an
independent critique via the CLI.

This is an internal Pi module. Invoke it through `/pi:debate`; do not expose it
as a standalone skill.

## Process

### 1. Confirm the Question

Clarify:
- The architecture or technical question
- Which repos or areas of the codebase are relevant
- Any constraints the user wants respected

### 2. Build Context

Use the `/pi:debate` preflight snapshot plus targeted Read/Grep/Glob on files
the user named. Do not re-run git commands already present in the command
snapshot.

Focus on:
- Directory structure and key files
- Dependencies (package.json, go.mod, Cargo.toml, etc.)
- API surface (routes, handlers, endpoints)
- Auth patterns if relevant

Compile this into a context summary to feed into the propose step.

### 3. Propose

Adopt the role defined in `prompts/propose.md` in this module directory.
Using the codebase context, produce an opinionated architecture proposal with:

1. Problem reframing
2. Recommended approach (reference specific files and patterns)
3. Key tradeoffs
4. Cross-repo impact
5. Migration path

Present the proposal to the user before continuing.

### 4. Critique

Run Codex to produce an independent critique of the proposal:

```bash
codex exec \
  --model gpt-5.4 \
  --sandbox read-only \
  -c model_reasoning_effort="high" \
  "<the critique prompt from prompts/critique.md, with the codebase context and proposal embedded>"
```

The critique prompt instructs Codex to attack the proposal on five vectors
(hidden coupling, migration traps, auth edge cases, operational complexity,
elegant-but-wrong abstractions) and provide concrete alternatives for every
criticism.

If `codex` is unavailable, perform the critique yourself. Note the absence so
the user knows it was single-model.

### 5. Synthesize

Adopt the role defined in `prompts/synthesize.md`. Produce the final
recommendation:

1. Final recommendation (decisive, no averaging)
2. What changed from the proposal
3. What was rejected from the critique
4. Unresolved tensions
5. Concrete next steps
6. ADR (Architecture Decision Record) — use the template at
   `templates/adr.md` in this module directory for the shape.

### 6. Present

Show the full synthesis to the user. Highlight:
- The ADR
- Unresolved tensions that need human judgment
- The first concrete next step

### 7. Additional Rounds (optional)

If the user wants to go deeper, feed the synthesis back into step 3 as
additional context and run another propose → critique → synthesize cycle.
Each round refines the recommendation.

## Rules

- Be opinionated. Pick sides, do not hedge.
- Every criticism must include a concrete alternative.
- Reference actual files, modules, and patterns from the codebase.
- The synthesis decides — it does not split the difference.
- Keep it to one round unless the user asks for more.
