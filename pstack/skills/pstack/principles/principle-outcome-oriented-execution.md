# Outcome-oriented execution

For planned rewrites or migrations that run in phases, where intermediate
states tempt compatibility code.

- Prioritize the intended, verified end state over keeping every intermediate
  step working. Avoid temporary compatibility code that becomes lasting debt.
- Temporary breakage is acceptable when it is planned, scoped, and reversible.
- Define the phases and where temporary breakage is acceptable before starting.
- Check the affected areas throughout the work and verify correctness at each
  planned checkpoint.
- At completion, run the full relevant static checks and verify runtime behavior.
