# Model the domain

When state is spread across flags or branches, a lifecycle spans callbacks,
timers or components, one shape assumption repeats across files, or core types
and data structures are being chosen:

- Identify the allowed states, the code responsible for them, and the rules
  that must always hold.
- Choose data structures that make common lookups and updates straightforward.
- Represent those states and rules directly with types, a state machine,
  or a lookup table.
- Keep rules together and make invalid combinations hard or impossible to
  represent.
- For lifecycles, identify where state lives, which events change it, who owns
  each transition, and what evidence permits it. Distinguish a request,
  acceptance, and confirmed completion where they allow different actions.
- Match asynchronous results to the operation and resource generation they
  belong to before applying them.
- Check competing event orderings and recovery after partial failure. Use
  [Make operations idempotent](principle-make-operations-idempotent.md) when
  transitions may be retried or resumed after a crash.
- Use the smallest representation that enforces the rules: a type, transition
  function, or ownership token may be enough.
- Keep simple code when another helper or layer would only make it harder
  to follow.

Example: a cancellation request moves a job to `cancelling`; confirmation that
its process stopped permits `cancelled` and replacement work. A late callback
from an earlier attempt cannot settle the current attempt.
