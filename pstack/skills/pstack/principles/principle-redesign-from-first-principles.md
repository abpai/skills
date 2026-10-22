# Redesign from first principles

When a new requirement no longer fits the existing design cleanly:

- Understand the affected code and which assumptions the new requirement breaks.
- Sketch the design you would choose if the requirement existed from the start.
- Compare it with the current design; adopt changes whose benefits justify
  their cost.
- Update the affected calling code, types, and documentation.
- Deliver the change in small steps whose results can each be checked.
