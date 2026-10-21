# Make operations idempotent

When designing commands or processing steps that may restart or retry, make
them safe to repeat—even after a partial failure.

- Read the current state, compare it with the goal, and apply only the changes
  still needed. Do not assume the previous run finished.
- Make leftover locks, temporary files, and unfinished work recognizable and
  recoverable by the next run, wherever the previous run stopped.
- Use reliable evidence to decide what is complete or stale. For example,
  compare file contents rather than creation order, or write to a temporary
  file and rename it into place when complete.
- Check both cases: run twice in a row, and restart after failure at each point
  that changes state. Both should reach the same correct end state.
