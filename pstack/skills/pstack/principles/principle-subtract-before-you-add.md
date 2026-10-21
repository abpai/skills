# Subtract before you add

When changing a system:

- Remove obsolete code and unnecessary layers before building on them.
- Simplify before polishing or adding new behavior.
- Design for current requirements and how the system is actually used.
- Add input validation, parsing, and defensive checks for specific requirements
  or failure cases.
- Remove redundant prompt instructions and excessive templates.
- Delete references that add no new information rather than leaving empty stubs.

Related principles:

- [Laziness Protocol](principle-laziness-protocol.md) keeps the change small.
- [Sequence Verifiable Units](principle-sequence-verifiable-units.md) helps
  check removals and additions separately.
