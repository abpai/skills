# Model the domain

When state is spread across flags or many branches, one shape assumption
repeats across files, or core types and data structures are being chosen:

- Identify the allowed states, the code responsible for them, and the rules
  that must always hold.
- Choose data structures that make common lookups and updates straightforward.
- Represent those states and rules directly with types, a state machine,
  or a lookup table.
- Keep rules together and make invalid combinations hard or impossible to
  represent.
- Keep simple code when another helper or layer would only make it harder
  to follow.
