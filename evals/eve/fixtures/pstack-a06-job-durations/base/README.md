# jobrunner

Runs the maintenance jobs listed in `jobs.json`, one after another, with a
per-job timeout and retry policy.

```sh
bun src/cli.ts jobs.json
bun test
```

Job fields: `name` (required), `command` (argv array, required), `timeout`
(ms, default 60000), `retryDelay` (ms, default 1000), `retries` (default 0).
