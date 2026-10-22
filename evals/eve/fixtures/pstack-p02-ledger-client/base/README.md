# @acme/ledger-client

Typed client for the internal ledger API. Only code in this package's `src/`
imports `src/lib/http.ts`; consumers use the functions exported from
`src/index.ts`.

- `src/lib/http.ts` holds the transport. `fetchJson` is the current request
  helper; `legacyRequest` predates it.
- Tests swap the transport with `setTransport` so nothing touches the network.

```sh
bun test
```
