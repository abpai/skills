# Explain the number

Before trusting, reporting, or acting on performance measurements or evaluation results:

- **Ask "why not double?"** Identify the resource or part of the code limiting
  the result: a CPU core, lock, disk, network, or even the tool generating
  requests. Use profiles or system measurements collected during the run and
  identify the responsible code. Reading the code and guessing is not evidence
  of the limit.
- **Rule out other explanations.** Check for errors, skipped or cached work,
  code that never ran, one side left poorly configured, measurement noise, and
  changes too small to explain the claimed improvement in the whole operation.
- **Keep evidence with the number.** Include what was measured, the work being
  performed, the result being compared against, settings, number of runs,
  variation between runs, and observed limit in the report or linked evidence.

For performance measurements, follow [Benchmark Checklist](../benchmark-checklist.md).
For agent or model evaluations, verify that every run did the task, the
difference persists across repeated runs and relevant models, and the scenario
represents a task that matters.

**Check:** Without the number of runs, their variation, or evidence of the
limit, the measurement does not support the claim. Time saved cannot exceed
the time the changed component originally took.

[Prove It Works](principle-prove-it-works.md) checks that an output is real;
this principle checks whether a measured number means what is being claimed.
