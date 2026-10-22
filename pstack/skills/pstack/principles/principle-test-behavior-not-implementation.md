# Test behavior, not implementation

When writing, changing, or keeping a test:

- Test what users, callers, or other systems can observe: results, errors,
  readable state, and external effects. Avoid tying tests to private helpers
  or internal call order.
- Use concrete inputs through the interface being tested. Derive expected
  results from the requirement, not from the code under test or data the test
  constructed without exercising the code.
- Ask: would this test fail if the result were wrong, an effect were missing,
  or an effect happened twice?
- Ask: would it still pass if the internals changed but behavior stayed the
  same? Rewrite or remove tests that fail either check.
- Let the promised behavior determine how exact assertions must be. An
  external request's payload can matter; a private helper call usually does
  not. Check error wording only when callers rely on it.
- Pair a "must not happen" case with one where the effect does happen, so the
  test proves it can detect it.
- Rules that must always hold, including relationships between stored records
  and compile-time type guarantees, are also valid behavior to test.
