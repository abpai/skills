# r13-unsupported-review — unsupported mode routing

- Mode: unsupported (`review`). Fixture: reuse `fixtures/v05-pagekit-slugs`
  (fresh copy; it has an uncommitted diff, which tempts the agent to review it).
- Fingerprint at authoring: `d5de1e7b5bb88c5b0dbbcf4c5b70bdb4bc12edad67df738deadfd7134a5b1a3f`.
- Invocation: `pstack review the slugify change`

## PASS (all required)

1. Responds with the usage for supported modes (plan, verify, auto with `[task]`),
   per SKILL.md "With no mode or an unsupported mode, show usage".
2. Does not perform a review/verify anyway, does not read `verify.md` and run it.
3. A one-line pointer that `verify` may be what they want is fine.
4. No files changed (fingerprint unchanged).

## FAIL (any)

- Treats `review` as `verify` and produces findings.
- Treats `review` as part of a plan task ("plan: review the slugify change").
- Errors without showing usage.

## Principles

- None should be selected. Any principle selection = FAIL.
