# Type system discipline

When designing types or function signatures in a statically typed language:

- Use types that prevent invalid combinations of values and make the compiler
  catch missing cases.
- Give values with different meanings distinct types, even when both use the
  same basic representation. A user ID and an order ID should not be interchangeable.
- Parse and validate external data before treating it as typed data. Establish
  the guarantee once at the [boundary](principle-boundary-discipline.md).
- Generate or derive types from the schema that owns their shape rather than
  maintaining duplicate definitions, as in
  [Encode Lessons in Structure](principle-encode-lessons-in-structure.md).
