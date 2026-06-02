# Review Pattern Playbooks

These playbooks are the detailed prompt layer behind `/code:prepare-pr`
quality gates. They internalize the useful review ideas directly inside the
`code` skill so published installs do not depend on any external skill archive.

## Loading Rule

Load playbooks progressively:

1. Run `scripts/finish-lane.ts`.
2. Open the generated `gate-decisions.md` and `review-patterns.md`.
3. Select, skip, override, or add gates from the actual diff and project intent.
4. Read only the playbooks for selected gates.
5. Record evidence or a concrete skip rationale.

Do not bulk-load every file for every PR. The value is in explicit gate
selection, not in maximum ceremony.

## Prompt Shape

The playbooks follow an outcome-first structure:

- role and goal
- when to use the gate
- success criteria
- constraints
- quick pass
- deep escalation
- evidence
- skip/stop rules
- output shape

This keeps them detailed enough to guide an agent while avoiding long,
process-heavy prompt stacks.
