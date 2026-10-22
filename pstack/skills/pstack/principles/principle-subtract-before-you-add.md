# Subtract before you add

When dead code, redundant checks, or unneeded layers sit where an addition or
refactor will land:

- Remove obsolete code and unnecessary layers before building on them.
- Simplify before polishing or adding new behavior.
- Design for current requirements and how the system is actually used.
- Add input validation, parsing, and defensive checks for specific requirements
  or failure cases.
- Delete references that add no new information rather than leaving empty stubs.

Related principles:

- [Laziness Protocol](principle-laziness-protocol.md) keeps the change small.
- [Sequence Verifiable Units](principle-sequence-verifiable-units.md) helps
  check removals and additions separately.
