# Agent-ready repository guidance

Make repository knowledge easy to find and hard to contradict. Prefer routes to
code and executable enforcement over comprehensive prose.

## 1. Audit before adding

Find existing `AGENTS.md`/`CLAUDE.md` files, docs indexes, architecture and
testing docs, command references, CI, linters, and runtime checks. For each
instruction, decide:

- **Keep** — project-specific, current, and useful before acting.
- **Move** — useful detail that belongs beside its code or in a focused doc.
- **Enforce** — a deterministic invariant better expressed in tests, lint,
  scripts, runtime validation, or CI.
- **Delete** — generic, duplicated, stale, or obvious from the repository.

Do not create a new surface when a credible owner already exists.

## 2. Keep the entry point small

Create or reduce the root `AGENTS.md` to a one-page router. Use
`./templates/AGENTS.md` as a shape, not mandatory wording. Include only:

- what the repository does and its normal delivery loop;
- where to find architecture, commands, testing, specifications, and glossary;
- the few project-specific rules that must be known before editing;
- how to validate a change and what requires a human.

If both hosts need guidance, make `CLAUDE.md` a small compatible shim rather
than a second policy document. Use nested agent guides only when a subtree has
different commands or invariants.

## 3. Establish canonical knowledge

Create or repair only the surfaces the repository has earned:

- `docs/index.md` for navigation when the docs tree is non-trivial;
- architecture documentation for stable boundaries and dependency direction;
- a commands/testing reference for canonical bootstrap, fast, full, and live
  proof paths;
- `docs/SPEC_CONTRACT.md` for specification quality and the project proof menu;
- a glossary only when domain terms are genuinely ambiguous;
- `docs/todos/` for accepted gaps with owners or triggers.

Prefer concrete file paths, script IDs, and ownership boundaries. Do not copy
facts that are clearer in code, manifests, or generated schemas.

## 4. Build the proof menu

Start from `./templates/SPEC_CONTRACT.md`, then replace its placeholders with
proof already present in the repository. Follow the `ProofRow` shape in
`./INTERFACES.md`.

Each important change type must name:

- repository-owned validation command IDs;
- the evidence or artifact that demonstrates success;
- whether command success is sufficient or a human must judge the result.

A proof row is invalid when its command does not exist, its artifact cannot be
produced, or it promises stronger coverage than the command provides. Extend
the validation surface before documenting unsupported proof.

## 5. Convert rules into enforcement

Use this order when a rule repeatedly matters:

1. test or contract test;
2. lint/static rule;
3. CI gate or validation script;
4. runtime boundary check;
5. concise route or warning in agent guidance.

Keep prose for judgment, context, and human escalation. Delete the prose copy
after the executable owner is clear, unless agents must know the rule before
they can reach that owner.

## 6. Verify

Run Harness Doctor's deterministic scanner and every safe command you created
or changed. Confirm routes and local links resolve. Report unavailable coverage
as unknown; do not replace scanner or runtime proof with manual confidence.

## Completion

Documentation work is complete when the root guide is skimmable, every route
lands on a current owner, the proof menu resolves to real validation, repeated
rules have one canonical enforcement surface, and changed commands were run or
explicitly marked unverified.

Report files kept, moved, enforced, and deleted; proof rows added or corrected;
commands run; and unresolved knowledge gaps.
