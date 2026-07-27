# Built-in APIs Reference

Doc-aligned quick reference for Bun native APIs.

---

## Bun.serve()

HTTP/HTTPS server with route dispatch and WebSocket upgrades.

```typescript
Bun.serve({
  port: 3000,
  routes: {
    "/": new Response("Home"),
    "/users/:id": (req) => Response.json({ id: req.params.id }),
    "/api/items": {
      GET: () => Response.json([]),
      POST: async (req) => Response.json(await req.json(), { status: 201 }),
    },
    "/favicon.ico": Bun.file("./public/favicon.ico"),
  },
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});
```

### Server control

```typescript
const server = Bun.serve({ fetch: () => new Response("ok") });

server.reload({ fetch: () => new Response("updated") });
server.stop();

console.log(server.port, server.hostname, server.url);
```

### TLS

```typescript
Bun.serve({
  tls: {
    key: Bun.file("./key.pem"),
    cert: Bun.file("./cert.pem"),
  },
  fetch() {
    return new Response("secure");
  },
});
```

### HTTP/3 (experimental)

HTTP/3 support requires TLS and is experimental.

```typescript
Bun.serve({
  port: 443,
  tls: {
    key: Bun.file("./key.pem"),
    cert: Bun.file("./cert.pem"),
  },
  http3: true,
  fetch() {
    return new Response("Hello over HTTP/3");
  },
});
```

With `http3: true`, Bun serves HTTP/1.1 over TCP and HTTP/3 over UDP on the same
port. Set `http1: false` only when you intentionally want an HTTP/3-only
listener.

### File-backed responses

```typescript
Bun.serve({
  routes: {
    "/video.mp4": new Response(Bun.file("./video.mp4")),
  },
  fetch() {
    return new Response(Bun.file("./large-file.bin"));
  },
});
```

Notes:
- Bun streams file-backed responses efficiently, including TLS and Windows
  paths.
- Single-range requests such as `Range: bytes=0-1023` are handled
  automatically for whole-file responses.

---

## Fetch HTTP/2 and HTTP/3 Clients

HTTP/2 and HTTP/3 fetch support is experimental.

```typescript
const h2 = await fetch("https://example.com", { protocol: "http2" });
const h3 = await fetch("https://example.com", { protocol: "http3" });

console.log(h2.status, h3.status);
```

Accepted protocol values are:
- HTTP/2: `"http2"`, `"h2"`
- HTTP/3: `"http3"`, `"h3"`
- HTTP/1.1 pinning: `"http1.1"`, `"h1"`

For global opt-in:

```bash
BUN_FEATURE_FLAG_EXPERIMENTAL_HTTP2_CLIENT=1 bun run app.js
bun run --experimental-http2-fetch app.js
BUN_FEATURE_FLAG_EXPERIMENTAL_HTTP3_CLIENT=1 bun app.ts
bun --experimental-http3-fetch app.ts
```

Notes:
- HTTP/2 fetch does not support HTTP proxies, CONNECT tunneling, Unix sockets,
  server push, or cleartext h2c yet.
- HTTP/3 fetch is an early preview; pin it per request when testing rather than
  silently changing all outbound traffic.

---

## WebSockets

```typescript
interface WsData {
  user: string;
}

Bun.serve<WsData>({
  routes: {
    "/ws": (req, server) => {
      const user = new URL(req.url).searchParams.get("user") ?? "anon";
      if (server.upgrade(req, { data: { user } })) return;
      return new Response("Upgrade failed", { status: 400 });
    },
  },
  websocket: {
    open(ws) {
      ws.subscribe("chat");
      ws.publish("chat", `${ws.data.user} joined`);
    },
    message(ws, message) {
      ws.publish("chat", `${ws.data.user}: ${message}`);
    },
    close(ws) {
      ws.unsubscribe("chat");
    },
  },
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});
```

For client connections over Unix domain sockets, Bun also supports
`ws+unix://` and `wss+unix://` URLs via the standard `WebSocket` client.

---

## SQL

### `sql` (shared singleton)

```typescript
import { sql } from "bun";

const users = await sql`SELECT * FROM users WHERE active = ${true}`;
```

### `SQL` (explicit clients)

```typescript
import { SQL } from "bun";

const pg = new SQL(process.env.POSTGRES_URL!);
const mysql = new SQL(process.env.MYSQL_URL!);
const sqlite = new SQL("sqlite://local.sqlite");

const rows = await pg`SELECT NOW()`;
await pg.close();
```

Aliases `Bun.sql` and `Bun.SQL` are also available.

TLS-using Bun APIs now share native TLS context caches for identical TLS
configuration. This matters for Postgres/MySQL pools, MongoDB/Mongoose-style
connection churn, Redis/Valkey, `Bun.connect`, `new WebSocket()`, and
`node:tls` users.

---

## SQLite (`bun:sqlite`)

```typescript
import { Database } from "bun:sqlite";

const db = new Database("app.sqlite");
db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)");
db.run("INSERT INTO users (name) VALUES (?)", ["Alice"]);

const users = db.query("SELECT * FROM users").all();
console.log(users);

db.close();
```

---

## S3-Compatible Storage

Use Bun's built-in helpers for S3, R2, and compatible providers.

```typescript
import { s3, S3Client } from "bun";

const file = s3.file("path/to/file.json"); // Uses default env-backed bucket config
const text = await file.text();
await file.write("hello");

const client = new S3Client({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION ?? "us-east-1",
  bucket: "my-bucket",
});

const other = client.file("path/to/object.txt");
await other.write("ok");
```

---

## Redis

```typescript
import { redis, RedisClient } from "bun";

await redis.set("key", "value");
const value = await redis.get("key");

const custom = new RedisClient("redis://localhost:6379");
await custom.set("hello", "world");
await custom.close();
```

`redis` uses `REDIS_URL` by default.

---

## Bun.Image

`Bun.Image` is a built-in image pipeline for decoding, transforming, and
encoding JPEG, PNG, WebP, HEIC, and AVIF.

```typescript
await Bun.file("photo.jpg")
  .image()
  .resize(400, 400, { fit: "inside" })
  .webp({ quality: 80 })
  .write("thumb.webp");
```

Inputs can be a file path, bytes, a `Blob`, `Bun.file()`, or `Bun.s3()` object:

```typescript
const image = new Bun.Image(Bun.file("photo.jpg"));
const metadata = await image.metadata();
console.log(metadata.width, metadata.height, metadata.format);
```

Security notes:
- Do not pass untrusted user-controlled path strings directly to
  `new Bun.Image()`. That creates an arbitrary-file-read primitive.
- For untrusted uploads, validate and read into bytes first, then pass the bytes.
- Use `maxPixels` to guard against decompression bombs.

```typescript
const safe = new Bun.Image(buffer, {
  maxPixels: 4096 * 4096,
  autoOrient: true,
});
```

---

## Bun.markdown

Bun includes an unstable built-in Markdown parser and renderer with GitHub
Flavored Markdown options.

```typescript
const html = Bun.markdown.html("# Hello **world**");
```

Choose the API by output:
- `Bun.markdown.html()` for an HTML string.
- `Bun.markdown.render()` for custom callbacks and terminal/ANSI renderers.
- `Bun.markdown.react()` for React JSX elements.

```typescript
const html = Bun.markdown.html(markdown, {
  tables: true,
  strikethrough: true,
  tasklists: true,
  autolinks: true,
});
```

For terminal reading, `bun ./README.md` renders Markdown directly.

---

## Bun.WebView

`Bun.WebView` is experimental browser automation built into the runtime.

```typescript
await using view = new Bun.WebView({ width: 1280, height: 720 });

await view.navigate("https://example.com");
await view.click("a[href]");

const title = await view.evaluate("document.title");
await Bun.write("page.png", await view.screenshot());

console.log(title);
```

Backend notes:
- macOS uses the system `WKWebView`.
- Linux and Windows use an installed Chrome, Chromium, Edge, or Brave over the
  Chrome DevTools Protocol.
- Treat it as experimental and verify selectors, screenshot behavior, and
  lifecycle cleanup on the target platform.

---

## Bun.cron

Register and manage OS-level cron jobs (crontab on Linux, launchd on macOS, Task Scheduler on Windows).

### Parse a cron expression

```typescript
const next = Bun.cron.parse("*/5 * * * *"); // next matching Date
```

### Register a cron job

```typescript
Bun.cron("cleanup-temp", "0 3 * * *", {
  scheduled() {
    console.log("Running nightly cleanup");
  },
});
```

### Remove a registered job

```typescript
Bun.cron.remove("cleanup-temp");
```

---

## Bun.$ (Shell)

```typescript
import { $ } from "bun";

const whoami = await $`whoami`.text();
const files = await $`ls -1`.lines();

const result = await $`grep "needle" README.md`.nothrow();
if (result.exitCode !== 0) {
  console.log("not found");
}

await $`echo ${"unsafe; rm -rf /"}`; // Interpolations are escaped
```

---

## Process and Terminal Controls

### No orphaned descendants

Use `--no-orphans` when Bun is launched by a supervisor that may be force-killed.
Bun exits when the parent dies and recursively kills descendants it spawned.

```bash
bun --no-orphans run worker
```

Or configure it:

```toml
[run]
noOrphans = true
```

Linux and macOS only; it is a no-op on Windows.

### `process.execve()`

On POSIX platforms, Bun implements Node.js v24-style `process.execve()`. It
replaces the current process image in place and never returns on success.

```typescript
process.execve("/usr/bin/echo", ["echo", "hello from execve"], {
  PATH: process.env.PATH,
});
```

### `Bun.Terminal`

Use a PTY when a subprocess expects an interactive terminal.

```typescript
await using terminal = new Bun.Terminal({
  cols: 80,
  rows: 24,
  data(_terminal, data) {
    process.stdout.write(data);
  },
});

const proc = Bun.spawn(["bash", "-lc", "echo hello"], { terminal });
await proc.exited;
```

`Bun.Terminal` uses `openpty()` on Linux/macOS and ConPTY on Windows.

---

## File and Utility APIs

```typescript
const text = await Bun.file("./README.md").text();
await Bun.write("./out.txt", text);

const hash = new Bun.CryptoHasher("sha256").update("data").digest("hex");
const passwordHash = await Bun.password.hash("secret");
const ok = await Bun.password.verify("secret", passwordHash);
```

### Web Crypto and `node:crypto`

```typescript
import crypto from "node:crypto";

const sha3 = crypto.createHash("sha3-256").update("data").digest("hex");

const digest = await crypto.subtle.digest(
  "SHA3-256",
  new TextEncoder().encode("data"),
);

const local = await crypto.subtle.generateKey("X25519", false, ["deriveBits"]);
const remote = await crypto.subtle.generateKey("X25519", false, ["deriveBits"]);

const sharedSecret = await crypto.subtle.deriveBits(
  { name: "X25519", public: remote.publicKey },
  local.privateKey,
  256,
);
```

### YAML

```typescript
import { YAML } from "bun";

const config = YAML.parse(await Bun.file("./config.yaml").text());
const text = YAML.stringify({ name: "app", replicas: 3 });
```

Multi-document YAML (`---`-separated) returns an array from `parse()`.

### Compression streams

```typescript
const compressed = new Response(data).body!.pipeThrough(
  new CompressionStream("zstd"),
);
const decompressed = new Response(compressed).body!.pipeThrough(
  new DecompressionStream("zstd"),
);
```

`CompressionStream`/`DecompressionStream` support `"gzip"`, `"deflate"`,
`"deflate-raw"`, `"brotli"`, and `"zstd"`.

### Secrets

```typescript
import { secrets } from "bun";

await secrets.set({ service: "my-cli", name: "api-token" }, token);
const stored = await secrets.get({ service: "my-cli", name: "api-token" });
await secrets.delete({ service: "my-cli", name: "api-token" });
```

Backed by Keychain (macOS), libsecret (Linux), and Windows Credential
Manager. Experimental; API may change.

### Other built-ins to check before adding dependencies

- `Bun.Glob` for fast glob scanning.
- `Bun.Archive` for tarball creation/extraction.
- `Bun.JSONC`, `Bun.JSON5`, and `Bun.JSONL` for nonstandard JSON formats.
- `Bun.CSRF` for CSRF token generation/verification.
- `Bun.semver`, `Bun.color`, `Bun.escapeHTML`, `Bun.stringWidth`,
  `Bun.wrapAnsi`, and `Bun.stripANSI` for common utility needs.
- `URLPattern` (standard Web API) for declarative URL matching.
- `DisposableStack`/`AsyncDisposableStack` (TC39) for resource cleanup.

---

## Primary Docs

- https://bun.com/docs/runtime/http/routing
- https://bun.com/docs/runtime/http/server
- https://bun.com/docs/runtime/http/websockets
- https://bun.com/docs/runtime/sql
- https://bun.com/docs/runtime/sqlite
- https://bun.com/docs/runtime/s3
- https://bun.com/docs/runtime/redis
- https://bun.com/docs/runtime/cron
- https://bun.com/docs/runtime/image
- https://bun.com/docs/runtime/markdown
- https://bun.com/docs/runtime/webview
- https://bun.com/docs/runtime/child-process
- https://bun.com/docs/runtime/shell
- https://bun.com/docs/api/file-io
- https://bun.com/docs/api/hashing
