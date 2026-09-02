---
name: bun-expert
disable-model-invocation: true
description: >
  Bun runtime guidance for JavaScript and TypeScript projects — package
  management, HTTP servers, Bun-specific APIs (`Bun.serve`, SQL, S3, Redis,
  `Bun.Image`, `Bun.WebView`, `Bun.$`), testing, bundling, and migrating from
  Node.js.
license: MIT
metadata:
  author: Andy Pai
  version: "1.4.7"
  upstream_skill: "https://bun.com/docs"
  tags: "bun javascript typescript runtime server bundler test image webview"
---

# Bun Runtime Development Guide

This skill is intentionally grounded in official Bun documentation. Bun moves
quickly, so prefer current docs over hard-coded release timelines or benchmark
claims.

---

## Recent Capability Radar

Bun ships new built-ins constantly. This list covers what landed roughly
between Bun 1.3 (Oct 2025) and Bun 1.3.14 (May 2026) — the kind of thing a
model's training data likely predates. For anything newer, check
`https://bun.com/blog` before assuming a capability doesn't exist.

Reach for these instead of the dependency you'd otherwise install:

- `Bun.SQL`: one client for Postgres, MySQL/MariaDB, and SQLite — skip `pg`,
  `mysql2`, or `postgres`.
- `Bun.redis`: native Redis/Valkey client — skip `ioredis`/`node-redis`.
- `Bun.secrets`: OS-keychain-backed credential storage — skip `keytar`.
- `Bun.YAML.parse`/`.stringify`: built-in YAML — skip `js-yaml`/`yaml`.
- `CompressionStream`/`DecompressionStream` now support `"brotli"` and
  `"zstd"` formats, not just gzip/deflate.
- `Bun.stripANSI`, `URLPattern`, and `DisposableStack`/`AsyncDisposableStack`
  are built in — skip `strip-ansi` and userland URL-pattern/cleanup helpers.
- `Bun.markdown` (`.html`/`.render`/`.react`): built-in CommonMark+GFM parser;
  `bun ./file.md` renders Markdown in the terminal — skip `markdown-it`/`marked`
  for common cases.
- Fake timers landed in `bun:test` (`useFakeTimers`, `advanceTimersByTime`,
  `setSystemTime`, `useRealTimers`) — skip `sinon`/`@sinonjs/fake-timers`.
- HTML-entrypoint dev server gained hot module replacement via
  `import.meta.hot` — skip a separate Vite/webpack dev server for simple
  frontends.
- `bun install --linker=isolated` with `globalStore = true` (or
  `BUN_INSTALL_GLOBAL_STORE=1`): still-experimental global virtual store for
  much faster warm installs.
- Still experimental, don't default to these in production: `Bun.WebView`
  (browser automation without Puppeteer/Playwright) and HTTP/3 over QUIC in
  both `Bun.serve({ http3: true })` and `fetch({ protocol: "h3" })`.

---

## Built-in API Map

| Need | Bun API |
|---|---|
| HTTP server + WebSockets | `Bun.serve()` |
| SQL databases | `sql`, `SQL`, `Bun.sql`, `Bun.SQL` |
| S3-compatible storage | `s3`, `S3Client` |
| Redis | `redis`, `RedisClient` |
| Scheduled tasks (cron) | `Bun.cron`, `Bun.cron.parse` |
| Image processing | `Bun.Image`, `Blob#image()`, `Bun.file().image()` |
| Browser automation | `Bun.WebView` |
| Markdown rendering | `Bun.markdown.html`, `Bun.markdown.render`, `Bun.markdown.react` |
| Shell scripting | `Bun.$` / `$` |
| Local files | `Bun.file`, `Bun.write` |
| SQLite (embedded) | `bun:sqlite` |
| Password hashing | `Bun.password` |
| PTY-backed subprocesses | `Bun.Terminal`, `Bun.spawn({ terminal })` |

---

## Deep-Dive References

| Reference | Contents |
|-----------|----------|
| [references/builtin-apis.md](references/builtin-apis.md) | `Bun.serve`, HTTP/3, WebSockets, SQL, S3, Redis, `Bun.Image`, `Bun.WebView`, Markdown, cron, shell, PTY, filesystem, and crypto APIs |
| [references/package-management.md](references/package-management.md) | Installs, lockfiles, isolated linker, global virtual store, catalogs, and lifecycle-script security |
| [references/testing-and-bundling.md](references/testing-and-bundling.md) | `bun test` usage, suite-splitting flags, mocking patterns, `bun build` CLI and API |
| [references/node-migration.md](references/node-migration.md) | Practical Node-to-Bun migration steps and compatibility guidance |

---

## Authoritative Docs

- https://bun.com/docs
- https://bun.com/blog
