# hookshot

Delivers outbound webhooks for the events service. `deliver()` sends one event
to one subscriber endpoint; `drainQueue()` works through pending deliveries and
records the outcome.

Receivers verify `x-signature` (HMAC-SHA256 of the body with the endpoint
secret).

```sh
bun test
```
