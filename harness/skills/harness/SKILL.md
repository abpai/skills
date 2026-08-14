---
name: harness
disable-model-invocation: true
description: "Prepare a repository for reliable agent-driven development. Adopt builds the behavior baseline, agent guidance, proof contract, and enforcement; doctor audits readiness or a diff; capture protects one uncertain behavior before it changes."
argument-hint: "[adopt [assess]|doctor|capture] [scope]"
metadata:
  version: "1.10.0"
---

# Harness

Harness makes a repository legible and provable enough for a software factory
to change it without rediscovering the system or guessing whether the result is
safe. Repository knowledge and validation stay in the repository; task
execution, grading, and proof receipts stay with the factory.

## Choose a workflow

| Request | Load | Done when |
| --- | --- | --- |
| Prepare or overhaul a repo | `./adopt.md` | The repo has a ratified baseline, concise guidance, an executable proof contract, enforced prerequisites, and a fresh Doctor result. |
| Assess adoption without edits | `./adopt.md` with `assess` | The report identifies adoption facts, unknowns, blockers, and a remediation plan without changing the repo. |
| Audit readiness or review a diff | `./doctor.md` | The report names observed facts, unknowns, blockers, required proofs, and what actually ran. |
| Protect one behavior before changing it | `./capture.md` | Characterization proof passes against unchanged code and remaining gaps are named. |

Advanced phases are directly addressable when the user names them:

- `baseline` → `./baseline.md`
- `docs` → `./docs.md`

`./dogfood.md` is for Harness maintainers testing this skill, not for preparing
the target repository.

## Routing

Accept `harness <workflow> ...` and `harness --<workflow> ...`. Strip a leading
`--` from the first token, load exactly one module, and pass it the remaining
input. `compliant` and `overhaul` are compatibility aliases for `adopt`;
`secure-dependencies` routes directly to the dependency phase for migration
compatibility without becoming a main workflow.

If no workflow is named, route repository preparation to `adopt`, read-only
adoption assessment to `adopt assess`, readiness/diff audits to `doctor`, and a
named behavior safety net to `capture`. Ask one short question only when those
outcomes would materially differ.

## Product boundary

Harness owns repo-local behavior maps, guidance, proof availability,
enforcement, and readiness inspection. It does not register repositories,
dispatch tasks, invent agent evals from validation commands, grade work, or
decide whether a factory may merge. Doctor emits the machine-readable boundary
defined in `./INTERFACES.md`.
