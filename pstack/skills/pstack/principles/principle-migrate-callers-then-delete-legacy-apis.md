# Migrate callers, then delete legacy APIs

When replacing an internal API as part of a simplification or refactor, and
the project can update all code using it together without breaking external users:

- Update the code using the API and remove the old API in the same change or
  coordinated set of changes.
- Avoid compatibility layers that only preserve the old internal API.
- Update tests to check the new API's promised behavior. Remove tests that
  only preserve details of the old implementation.
