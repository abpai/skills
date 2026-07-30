# Spec contract

Specs executed against this repo must meet this bar. A spec that promises a
proof not listed in the proof menu is invalid — extend the menu (and the
validation surface behind it) first.

## Quality bar

A spec is ready when it:

- Is self-contained: an agent with no prior context can execute it.
- Names a goal as a user-visible outcome, not an implementation.
- Lists acceptance criteria that each map to a proof in the menu below.
- Names the files/interfaces it expects to touch, when known.
- States what is out of scope.
- States risk and taste constraints the agent must not trade away.
- Ends with an end-to-end verification step drawn from the proof menu.

## Proof menu

Each command belongs to a lane: the **fast lane** (deterministic, runs in
seconds) is the inner loop an agent runs after every edit; the **full lane**
(slow unit, integration, e2e, browser) is the gate for done. Done = the full
lane green; a green fast lane never certifies done. The **Sufficiency** column
marks whether a passing run is sufficient evidence (`auto`) or the change still
needs human sign-off (`human-gate`) — a false green on a `human-gate` row would
merge broken work, the failure that is worse than a false red.

Keep the table in the machine-readable proof-row shape (`./INTERFACES.md`) so
tooling can parse it: fixed columns in the order below, the **Lane** cell holding
only `fast` or `full`, and the **Validation command** cell holding only
backtick-wrapped command IDs from the repo's signals menu — put a proof artifact
like a screenshot diff in the **Proof artifact** column, never as prose in the
command cell. For package scripts, use the script ID (`test`, `ui:build`) rather
than the shell invocation (`bun test`, `pnpm run ui:build`) so Harness Doctor can
resolve the row deterministically.

| Change type | Lane | Validation command | Proof artifact | Sufficiency |
| --- | --- | --- | --- | --- |
| <area> logic | full | `<script-or-target-id>` | passing run output | auto |
| <area> UI | full | `<script-or-target-id>` | screenshot pair | human-gate |
| API surface | full | `<contract-script-id>` | passing run + response trace | auto |
| Cross-cutting | full | `<full-check-script-id>` | CI-green equivalent locally | auto |

## Escalation boundaries

Agents stop and surface instead of guessing when:

- An acceptance criterion cannot be proven with the menu above.
- The change requires an irreversible action (deploy, migration apply, data deletion).
- The spec's scope and the code's reality conflict.

Prefer reversibility by construction — idempotent migrations, flag-gated rollout,
transactional changes — so the agent can proceed and roll back cleanly; escalate
only the irreducibly irreversible. A documented rollback path is the fallback,
not the first choice.
