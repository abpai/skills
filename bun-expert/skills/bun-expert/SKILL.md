---
name: bun-expert
description: >
  Bun runtime guidance for JavaScript and TypeScript projects. Use when
  starting Bun projects, managing packages, building HTTP servers, using Bun
  APIs (`Bun.serve`, SQL, S3, Redis, `Bun.$`), testing, bundling, migrating
  from Node.js, or troubleshooting Bun-specific behavior.
license: MIT
metadata:
  author: Andy Pai
  version: "1.4.1"
  upstream_skill: "https://bun.com/docs"
  tags: "bun javascript typescript runtime server bundler test"
---

# Bun Runtime Development Guide

This skill is intentionally grounded in official Bun documentation. Bun moves
quickly, so prefer current docs over hard-coded release timelines or benchmark
claims.

---

## Project Setup

### Initialize a new project

```bash
bun init                      # Interactive setup (package.json + tsconfig.json)
bun init -y                   # Accept defaults
bun create <template> <dir>   # Scaffold from a template
```

### TypeScript notes

- Bun runs TypeScript directly.
- `bun init` generates a compatible `tsconfig.json`.
- Add extra typing packages only when your editor/toolchain requires them.

---

## Package Management

### Essential commands

```bash
bun install
bun add <pkg>
bun add -d <pkg>
bun add -g <pkg>
bun remove <pkg>
bun update
bunx <pkg>
```

### Lockfile

- `bun.lock` is the default text lockfile format in modern Bun.
- `bun.lockb` remains supported for compatibility.
- Force text lockfile output:

```bash
bun install --save-text-lockfile
```

### Diagnostics and security

```bash
bun why <pkg>
bun audit
bun list
bun pm migrate
```

### Install strategy notes

- `bun install` now streams tarballs to disk by default, which lowers memory
  usage on large installs.
- If you need to debug an install regression, temporarily disable streaming with
  `BUN_FEATURE_FLAG_DISABLE_STREAMING_INSTALL=1`.
- In peer-heavy monorepos, try `bun install --linker=isolated` before falling
  back to another package manager.

### Monorepo catalogs

Bun supports dependency catalogs in workspace roots:

```json
{
  "workspaces": {
    "packages": ["packages/*"],
    "catalog": {
      "react": "^19.0.0",
      "typescript": "^5.7.0"
    }
  }
}
```

Reference from packages:

```json
{
  "dependencies": {
    "react": "catalog:"
  }
}
```

---

## Running Code

```bash
bun index.ts
bun run start
bun --watch index.ts
bun --hot index.ts
bun run --parallel script1 script2    # run concurrently
bun run --sequential script1 script2  # run one after another
```

### Environment variables

Bun auto-loads `.env` files. Order is:

1. `.env`
2. `.env.{NODE_ENV}` (`development`, `production`, `test`)
3. `.env.local`

```typescript
const apiKey = process.env.API_KEY;
const bunApiKey = Bun.env.API_KEY;
```

### HTML entrypoints (zero-config)

```bash
bun --hot index.html
bun --watch index.html
```

---

## HTTP Server

Bun supports route-based servers with `Bun.serve()`.

```typescript
Bun.serve({
  port: 3000,
  routes: {
    "/": new Response("Hello"),
    "/api/users/:id": (req) => Response.json({ id: req.params.id }),
    "/api/posts": {
      GET: () => Response.json({ posts: [] }),
      POST: async (req) => Response.json(await req.json(), { status: 201 }),
    },
  },
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});
```

For large downloads or media, prefer file-backed responses such as
`new Response(Bun.file("./video.mp4"))`. Bun now streams these efficiently
across HTTP and TLS, and single-range requests (`Range: bytes=...`) are handled
automatically for whole-file responses.

---

## Built-in API Map

| Need | Bun API |
|---|---|
| HTTP server + WebSockets | `Bun.serve()` |
| SQL databases | `sql`, `SQL`, `Bun.sql`, `Bun.SQL` |
| S3-compatible storage | `s3`, `S3Client` |
| Redis | `redis`, `RedisClient` |
| Scheduled tasks (cron) | `Bun.cron`, `Bun.cron.parse` |
| Shell scripting | `Bun.$` / `$` |
| Local files | `Bun.file`, `Bun.write` |
| SQLite (embedded) | `bun:sqlite` |
| Password hashing | `Bun.password` |

---

## Testing and Bundling

### Test runner (`bun test`)

```bash
bun test
bun test --watch
bun test --test-name-pattern "auth"
bun test --changed
bun test --isolate
bun test --parallel=8
bun test --shard=1/3
bun test --bail
bun test --coverage
bun test --coverage-reporter text
bun test --path-ignore-patterns "*/fixtures/*"
```

### Bundling

```bash
bun build ./src/index.ts --outdir ./dist
bun build --target=bun ./src/server.ts --outfile ./dist/server.js
bun build --compile ./src/cli.ts --outfile ./dist/my-cli
bun build --compile --target=browser ./src/index.html --outdir ./dist
```

When the entrypoint is HTML, Bun inlines file-loader assets imported from
JavaScript into the standalone HTML output, so the result stays single-file.

---

## Node.js Migration Checklist

1. Install Bun and run `bun install`.
2. Keep existing Node APIs where they work; Bun is highly Node-compatible.
3. Replace tooling incrementally (`bun test`, `bun build`, `bun run`).
4. Adopt Bun-native APIs where they simplify code (`Bun.serve`, `sql`, `redis`, `s3`, `Bun.$`).
5. Run your full tests in CI on Bun before removing Node-specific fallbacks.

Migration is complete when the lockfile is updated, the chosen Bun commands run
locally, CI executes the same commands, and any retained Node fallback is named
with its reason.

---

## Deep-Dive References

| Reference | Contents |
|-----------|----------|
| [references/builtin-apis.md](references/builtin-apis.md) | `Bun.serve`, WebSockets, SQL, S3, Redis, cron, shell, filesystem, and crypto APIs |
| [references/testing-and-bundling.md](references/testing-and-bundling.md) | `bun test` usage, suite-splitting flags, mocking patterns, `bun build` CLI and API |
| [references/node-migration.md](references/node-migration.md) | Practical Node-to-Bun migration steps and compatibility guidance |

---

## Authoritative Docs

- https://bun.com/docs
- https://bun.com/docs/cli/test
- https://bun.com/docs/cli/pm
- https://bun.com/docs/runtime/http/routing
- https://bun.com/docs/runtime/http/websockets
- https://bun.com/docs/runtime/env
- https://bun.com/docs/runtime/sql
- https://bun.com/docs/runtime/s3
- https://bun.com/docs/runtime/redis
- https://bun.com/docs/runtime/cron
- https://bun.com/docs/api/hashing
- https://bun.com/docs/guides/ecosystem/migrate-from-nodejs
