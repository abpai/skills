# Node.js Migration Reference

Practical guide for migrating Node.js projects to Bun using current Bun docs.

---

## Compatibility Reality Check

Bun provides broad Node.js compatibility, but migration should still be verified
with your own test suite and production workflows.

Use Bun's compatibility pages as source of truth:
- Node.js APIs: https://bun.com/docs/runtime/nodejs-apis
- Node.js globals: https://bun.com/docs/runtime/nodejs-globals

Notable Bun behavior for migration:
- Bun exposes Node globals like `process`, `Buffer`, and friends.
- In ESM, Bun also provides `__dirname`, `__filename`, and `require()` for compatibility.
- Modern Bun has first-party `process.execve()` on POSIX, improved
  `fs.watch()` behavior on POSIX platforms, and `Bun.Terminal` PTY support on
  Windows through ConPTY.
- TLS-heavy libraries and pools, including Postgres/MySQL via `Bun.SQL`,
  MongoDB/Mongoose-style connection churn, Redis/Valkey, `new WebSocket()`, and
  `node:tls`, benefit from shared native TLS context caching in recent Bun.

---

## Migration Steps

### 1. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. Install dependencies with Bun

```bash
bun install
```

If migrating from Yarn or pnpm lockfiles:

```bash
bun pm migrate
```

### 3. Update scripts incrementally

```json
{
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "test": "bun test",
    "build": "bun build ./src/index.ts --outdir ./dist"
  }
}
```

### 4. Keep Node compatibility mode available where needed

```bash
bun --bun run <script>
```

Use this while migrating scripts/packages that still assume a Node runtime.

### 5. Validate in CI before removing fallbacks

```yaml
- uses: oven-sh/setup-bun@v2
  with:
    bun-version: latest
- run: bun install --frozen-lockfile
- run: bun test
- run: bun run build
```

Migration is complete when the lockfile is updated, the chosen Bun commands run
locally, CI executes the same commands, and any retained Node fallback is named
with its reason.

---

## API Mapping Patterns

Use these as migration defaults:

| Existing Node stack | Bun-first option |
|---|---|
| Jest/Vitest | `bun test` (rewrite `jest.fn()`/`jest.mock()` call sites to `mock()`/`mock.module()`; `jest.config.js` and transform setup have no equivalent) |
| esbuild/webpack scripts | `bun build` |
| dotenv bootstrap | Bun automatic `.env` loading |
| child_process shell snippets | `Bun.$` |
| Custom HTTP framework for simple APIs | `Bun.serve()` (Express, Fastify, and Hono run on Bun via its Node compatibility layer; port to `Bun.serve()` only for the performance or the built-in WebSocket and routing support) |
| Sharp-style image transforms | `Bun.Image` |
| Puppeteer/Playwright for simple page automation | `Bun.WebView` if experimental status is acceptable |
| Markdown parsing/rendering | `Bun.markdown.*` |

For databases/storage:
- SQL: `sql` / `SQL` from `bun`
- Redis: `redis` / `RedisClient` from `bun`
- S3-compatible object storage: `s3` / `S3Client` from `bun`
- Embedded SQLite: `bun:sqlite`

---

## `.env` Behavior

Bun automatically loads `.env` files in this order:

1. `.env`
2. `.env.{NODE_ENV}`
3. `.env.local`

If your Node app used `dotenv`, remove duplicate loading to avoid confusion.

---

## Common Pitfalls

1. Treating experimental APIs (`Bun.WebView`, HTTP/3, HTTP/2/3 fetch paths) as
   production defaults without validating current release status.
2. Passing untrusted path strings directly into `new Bun.Image()`.

## Modern Bun Checks Before Adding Dependencies

Before adding or keeping a dependency, check whether Bun now has a native API:

- Image processing: `Bun.Image`
- Browser automation: `Bun.WebView`
- Markdown rendering: `Bun.markdown.*`
- Archive creation/extraction: `Bun.Archive`
- Glob matching: `Bun.Glob`
- JSON variants: `Bun.JSONC`, `Bun.JSON5`, `Bun.JSONL`
- CSRF tokens, semver, CSS color conversion, ANSI width/wrapping, HTML escaping:
  `Bun.CSRF`, `Bun.semver`, `Bun.color`, `Bun.stringWidth`, `Bun.wrapAnsi`,
  `Bun.escapeHTML`

---

## Primary Docs

- https://bun.com/docs/guides/ecosystem/migrate-from-nodejs
- https://bun.com/docs/runtime/nodejs-apis
- https://bun.com/docs/runtime/nodejs-globals
- https://bun.com/docs/runtime/env
- https://bun.com/docs/cli/pm
- https://bun.com/docs/cli/test
- https://bun.com/docs/cli/build
- https://bun.com/docs/runtime/image
- https://bun.com/docs/runtime/webview
- https://bun.com/docs/runtime/markdown
- https://bun.com/docs/runtime/child-process
