# billing-core

Account, invoicing, and payment logic for the billing service. Modules talk
through the in-process event bus in `src/bus.ts`; nothing outside this
repository subscribes to these events.

```sh
bun test
```

See `docs/events.md` for the event catalogue and `CONTRIBUTING.md` for review
expectations.
