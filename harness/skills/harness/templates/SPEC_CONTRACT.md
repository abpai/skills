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

Document the broader fast, full, and live/human policy in the repository's
command guide. Each proof row still declares whether its command is fast
feedback or a full completion gate. Evidence binds to the exact candidate;
deployment proof also names the environment and execution identity.

Keep the table in the machine-readable proof-row shape (`./INTERFACES.md`) so
tooling can parse it: fixed columns in the order below, `Lane` containing only
`fast` or `full`, and **Validation command** containing only backtick-wrapped
command IDs. Put screenshots, traces, and other evidence in **Proof artifact**.
Use package script IDs rather than shell invocations so Doctor can resolve them.

| Change type | Lane | Validation command | Proof artifact | Sufficiency |
| --- | --- | --- | --- | --- |
| <area> logic | full | `<script-or-target-id>` | passing run output | auto |
| <area> UI | full | `<script-or-target-id>` | screenshot pair | human-gate |
| API surface | full | `<contract-script-id>` | passing run and response trace | auto |
| Cross-cutting | full | `<full-check-script-id>` | passing full validation | auto |

## Escalation boundaries

Agents stop and surface instead of guessing when:

- An acceptance criterion cannot be proven with the menu above.
- The change requires an irreversible action (deploy, migration apply, data deletion).
- The spec's scope and the code's reality conflict.

Prefer reversibility by construction — idempotent migrations, flag-gated rollout,
transactional changes — so the agent can proceed and roll back cleanly; escalate
only the irreducibly irreversible. A documented rollback path is the fallback,
not the first choice.
