# Testing and Bundling Reference

Doc-aligned reference for Bun's built-in test runner and bundler.

---

## Testing with `bun test`

### Basic structure

```typescript
import { describe, test, expect } from "bun:test";

describe("math", () => {
  test("addition", () => {
    expect(1 + 1).toBe(2);
  });

  test("async", async () => {
    const value = await Promise.resolve("ok");
    expect(value).toBe("ok");
  });
});
```

### Common commands

```bash
bun test
bun test src/
bun test --watch
bun test --test-name-pattern "auth"
bun test --changed
bun test --changed=main
bun test --isolate
bun test --parallel
bun test --parallel=8
bun test --shard=1/3
bun test --timeout 30000
bun test --bail
bun test --bail 3
bun test --rerun-each 5
bun test --only
bun test --coverage
bun test --coverage-reporter text
bun test --coverage-reporter lcov
bun test --path-ignore-patterns "*/fixtures/*"
```

Notes:
- `--test-name-pattern` is the canonical flag for filtering test names.
- Default timeout is 5000ms unless overridden.

### Scaling suites and CI

- `--isolate` runs each test file with a fresh global object, which helps when
  files leak timers, sockets, or other process-wide state.
- `--parallel[=N]` distributes files across worker processes and implies
  `--isolate`.
- `--shard=M/N` splits files deterministically across CI jobs using a 1-based
  shard index.
- `--changed[=<ref>]` filters to tests affected by local git changes or by a
  specific commit/branch diff.
- In parallel runs, Bun sets both `JEST_WORKER_ID` and `BUN_TEST_WORKER_ID`.

### Matchers (selected)

```typescript
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(value).toBeDefined();
expect(value).toBeTruthy();
expect(array).toContain(item);
expect(string).toMatch(/regex/);
await expect(promise).resolves.toBe("ok");
await expect(promise).rejects.toThrow();
expect(value).not.toBe(other);
```

### Hooks and lifecycle

```typescript
import { beforeAll, afterAll, beforeEach, afterEach, describe, test } from "bun:test";

beforeAll(() => {
  // once per file
});

afterAll(() => {
  // once per file
});

beforeEach(() => {
  // before each test
});

afterEach(() => {
  // after each test
});

describe("scoped", () => {
  beforeEach(() => {
    // scoped to this block
  });

  test("example", () => {});
});
```

### Mocking

```typescript
import { test, expect, mock, spyOn } from "bun:test";

const fn = mock((x: number) => x * 2);
expect(fn(2)).toBe(4);
expect(fn).toHaveBeenCalledTimes(1);

const obj = { greet: (name: string) => `hi ${name}` };
const spy = spyOn(obj, "greet");
obj.greet("alice");
expect(spy).toHaveBeenCalledWith("alice");
spy.mockRestore();
```

Both `mock()` and `spyOn()` support `Symbol.dispose`, enabling auto-cleanup with the `using` keyword:

```typescript
using fn = mock(() => "hello");
// fn is automatically restored when scope exits
```

### Module mocking

```typescript
import { mock } from "bun:test";

mock.module("./database", () => ({
  getUser: mock(() => ({ id: 1, name: "Test" })),
}));

mock.restore();
```

---

## Bundling with `bun build`

### Common commands

```bash
bun build ./src/index.ts --outdir ./dist
bun build ./src/index.ts --outfile ./dist/bundle.js
bun build ./src/index.ts --target=bun --outfile ./dist/server.js
bun build ./src/index.ts --target=browser --outfile ./dist/app.js
bun build ./src/index.ts --minify
bun build ./src/index.ts --sourcemap=external
bun build ./src/cli.ts --compile --outfile ./dist/my-cli
bun build ./src/index.html --compile --target=browser --outdir ./dist
```

When the entrypoint is HTML, file-loader assets imported from JavaScript are
inlined as `data:` URIs in the standalone output, so the final `index.html`
does not need sidecar asset files.

### JavaScript API

```typescript
const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "browser",
  sourcemap: "external",
  minify: true,
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
}
```

---

## Primary Docs

- https://bun.com/docs/cli/test
- https://bun.com/docs/test
- https://bun.com/docs/cli/build
- https://bun.com/docs/bundler
