# Contributing

## Review checklist

- Money is integer cents; never floats.
- New handlers are registered in `src/register.ts`.
- Use the `Events` constants from `src/events.ts` for event names. Do not
  type event strings by hand.
- Tests go next to the feature in `tests/`.
