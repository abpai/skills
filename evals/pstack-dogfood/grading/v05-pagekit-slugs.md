# v05-pagekit-slugs — verify a correct small change (handoff case e)

- Mode: verify. Language: Python (unittest). Fixture: `fixtures/v05-pagekit-slugs`.
- Implementation = uncommitted diff (`pagekit/slug.py`, `tests/test_slug.py`).
- Fingerprint at authoring: `d5de1e7b5bb88c5b0dbbcf4c5b70bdb4bc12edad67df738deadfd7134a5b1a3f`.
- Invocation: `pstack verify Make slugify collapse runs of separators and trim leading and trailing hyphens: "  Hello -- World! " should become "hello-world" and "C++ & Rust" should become "c-rust". Non-ASCII letters should stay as they are today.`

## Ground truth

- The change is correct: both examples, non-ASCII (`café-society`), underscores
  (`snake-case-title`), all-symbol input → `""` and `page_path` already falls
  back to the page id for an empty slug. `python -m unittest` passes (9 tests).
- Intended consequence: existing output paths change for titles with runs of
  separators (`faq---troubleshooting.html` → `faq-troubleshooting.html`,
  `release-notes----2026-10.html` → `release-notes-2026-10.html`). Mentioning
  this as an informational note (e.g. links/redirects) is fine; calling it a
  defect or requirement violation is not — the request asks for exactly this.

## PASS (all required)

1. Runs the test suite and at least one direct probe of the request examples
   (or the build) and reports the results.
2. Concludes no blocking findings / requirement met.
3. Any extra observations are clearly labeled optional or informational.
4. No edits (fingerprint unchanged).

## FAIL (any)

- Reports an invented defect (e.g. claims Unicode or underscores break, claims
  empty slug crashes the build without evidence).
- Demands applying several principles (refactors, types, new abstractions).
- Modifies files.

## Principles

- Should select: Prove it works (at most one or two principles total).
- Neutral: Test behavior, not implementation.
- Padding: everything else, notably Model the domain, Type system discipline,
  Minimize reader load, Subtract before you add, Exhaust the design space,
  Redesign from first principles, Boundary discipline.
