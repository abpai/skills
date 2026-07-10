# Behavior inventory

This file is the human ratification gate for `harness baseline`. The agent
drafts rows from repo evidence. A human edits `Status`, `Priority`, and `Notes`
before the capture loop runs.

Allowed `Status` values:

- `proposed` — drafted by the agent, not approved for capture.
- `confirmed` — capture this behavior.
- `corrected` — capture this behavior after the row has been edited to match
  reality.
- `skip` — do not capture.
- `deferred` — real behavior, but not part of the current baseline.
- `stale` — entry point appears deleted or moved during refresh.

Allowed `Priority` values: `P0`, `P1`, `P2`.
Allowed `Confidence` values: `high`, `medium`, `low`.
Allowed `Risk` values: `high`, `medium`, `low`.

| ID | Area | Behavior | Entry points | Existing proof | Missing proof | Confidence | Risk | Status | Priority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
