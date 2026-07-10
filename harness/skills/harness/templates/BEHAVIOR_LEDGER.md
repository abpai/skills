# Behavior ledger

This file is machine-maintained by `harness baseline`. It records the proof
created for ratified behavior rows. Edit the inventory for human decisions; edit
this file only when deliberately updating captured proof.

Allowed `Status` values:

- `captured` — proof exists and passed against unchanged code.
- `bug-pinned` — current behavior looked wrong but was pinned as observed.
- `gap` — no safe deterministic capture was possible.
- `failed` — capture was attempted and abandoned with a recorded reason.
- `stale` — inventory row or proof no longer matches the repo.

Allowed `Capture type` values: `unit`, `integration`, `golden`, `snapshot`,
`screenshot`, `contract`, `none`.

| ID | Status | Capture type | Test paths | Run command | Run evidence | Confidence | Remaining gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
