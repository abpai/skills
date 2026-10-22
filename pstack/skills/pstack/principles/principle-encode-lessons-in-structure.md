# Encode lessons in structure

When the same correction or instruction keeps recurring:

- When a rule can be checked automatically, enforce it with a lint rule, test,
  schema validation, configuration rule, or runtime check.
- Put the check in the code responsible for that rule.
- Once a check fully enforces the rule, remove reminders that merely repeat it.
- When the rule requires judgment, keep a clear instruction and a concrete
  example of the failure it prevents.
- Update the relevant skill or closest existing project guidance where the
  decision is made.
- Keep one maintained version of the instruction. Make references to it clear
  about when to read it, instead of copying it into several documents.

Related: [Script Bulk Operations](principle-script-bulk-operations.md) automates
the work at hand; this principle prevents recurring mistakes.
