# Agent guide

Code, tests, and runtime behavior are the source of truth. Docs route you to the right code and validation path.

## Operating model

- Specs come from intake against `docs/SPEC_CONTRACT.md`; you own implementation through end-to-end proof.
- Identify the validation command before editing. Escalate per the spec contract; otherwise execute end-to-end.

## Where to look

- Spec contract: `docs/SPEC_CONTRACT.md`
- Index: `docs/INDEX.md` · Architecture: `docs/ARCHITECTURE.md`
- Commands: `docs/engineering/commands.md` · Validation: `docs/engineering/testing.md`

## Rules

- If a rule can be tested, linted, or scripted, enforce it there — do not add it here.
- Do not duplicate product truth in docs.
- If you struggle to find the right code, say so in your handoff (that is a harness gap).

## Done means

- The full validation lane passed — `<full-lane command>`, not the fast lane — or the failure is explained.
- End-to-end proof produced per the spec.
- Durable knowledge landed on the smallest relevant surface; deferred work in `docs/todos` only if real and actionable.
