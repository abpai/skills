# devkit

Developer CLI for the storefront services.

```sh
bun src/cli.ts logs [file] [--grep TEXT]   # print a service log, secrets redacted
bun src/cli.ts tail <file> [--follow]      # print build output as-is
bun test
```

## Logs and secrets

Service logs contain tokens, passwords, and API keys. Every command that prints
a service log must pass each line through `redact()` (`src/redact.ts`) before it
reaches the terminal. `devkit tail` is for build output only and prints raw.

## Errors and stack traces

Production errors go to Tracewell, our error-tracking service. The deploy
pipeline uploads source maps for every release, and Tracewell symbolicates
uploaded errors against them, so stack traces in Tracewell already point at
original source lines. Open the error there rather than decoding traces by
hand.
