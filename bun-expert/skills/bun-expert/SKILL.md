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
  version: "1.4.5"
  upstream_skill: "https://bun.com/docs"
  tags: "bun javascript typescript runtime server bundler test image webview"
---

# Bun Runtime Development Guide

This skill is intentionally grounded in official Bun documentation. Bun moves
quickly, so prefer current docs over hard-coded release timelines or benchmark
claims.

---

## Recent Capability Radar

Latest reviewed changelog: Bun v1.3.14 (May 13, 2026). For exact current flags
or brand-new APIs, check `https://bun.com/blog` first.

Capabilities that land after most model cutoffs:

- `Bun.Image`: built-in image pipeline (decode/resize/rotate/encode) without
  `sharp` or native addon setup.
- `bun install --linker=isolated` with `globalStore = true` (or
  `BUN_INSTALL_GLOBAL_STORE=1`): experimental global virtual store for faster
  warm installs and smaller per-project `node_modules`.
- `Bun.serve()` supports experimental HTTP/3 over QUIC via `http3: true` + TLS;
  don't recommend it for production without checking current release status.
- `fetch()` has experimental HTTP/2 and HTTP/3 client paths via `protocol:
  "http2" | "h2" | "http3" | "h3"`.
- `Bun.WebView`: experimental browser automation (system `WKWebView` on macOS,
  Chrome DevTools Protocol backends on Linux/Windows).
- Built-in Markdown APIs (`Bun.markdown.html/.render/.react`); `bun ./file.md`
  renders Markdown in the terminal.
- `bun run --parallel`/`--sequential` control script concurrency; `--no-orphans`
  (or `run.noOrphans` in `bunfig.toml`) exits when the parent process dies.
- Rewritten POSIX `fs.watch()`, `process.execve()` on POSIX, `Bun.Terminal` on
  Windows via ConPTY, and first-party native builds for FreeBSD and Android.

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
