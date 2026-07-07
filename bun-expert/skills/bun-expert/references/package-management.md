# Package Management Reference

Doc-aligned guidance for Bun installs, monorepos, and dependency diagnostics.

---

## Core Commands

```bash
bun install
bun install --frozen-lockfile
bun add <pkg>
bun add -d <pkg>
bun remove <pkg>
bun update
bun outdated
bun why <pkg>
bun audit
bun list
bun pm migrate
```

Use `bun pm migrate` when bringing an npm, Yarn, or pnpm project over to Bun's
lockfile.

---

## Lockfiles

- `bun.lock` is the modern text lockfile.
- `bun.lockb` remains supported for older projects.
- Use `bun install --save-text-lockfile` when you need to force text lockfile
  output.

---

## Isolated Installs

Use isolated installs when a workspace needs pnpm-style dependency isolation and
protection from phantom dependencies.

```bash
bun install --linker isolated
```

Or configure it:

```toml
[install]
linker = "isolated"
```

Notes:
- New workspace projects can default to isolated installs depending on lockfile
  `configVersion`.
- Existing projects may keep hoisted installs unless you opt in.
- Try isolated installs before abandoning Bun in peer-heavy monorepos.

---

## Global Virtual Store

The global virtual store is experimental and applies only to the isolated
linker. Package contents live once in a shared store, and each project's
`node_modules` mostly links into it.

```toml
[install]
linker = "isolated"
globalStore = true
```

Per invocation:

```bash
BUN_INSTALL_GLOBAL_STORE=1 bun install --linker isolated
```

Use it when:
- You repeatedly install the same dependency graph across worktrees or CI
  workspaces.
- Warm install time or per-checkout disk usage matters.

Watch-outs:
- Ineligible packages fall back to project-local copies automatically.
- `node_modules` becomes symlink-heavy, so tooling that assumes real files may
  need verification.
- Do not turn it on blindly in production CI without comparing cache behavior
  and artifact packaging.

---

## Workspaces and Catalogs

Bun supports workspace catalogs from the workspace root:

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

Package references:

```json
{
  "dependencies": {
    "react": "catalog:"
  }
}
```

Use `bun outdated` to inspect catalog-aware updates.

---

## Lifecycle Script Security

Bun does not run arbitrary dependency lifecycle scripts by default. If a package
must run scripts during install, list it in `trustedDependencies`.

```json
{
  "trustedDependencies": ["my-trusted-package"]
}
```

Do this intentionally; it changes the install security posture.

---

## Primary Docs

- https://bun.com/docs/cli/pm
- https://bun.com/docs/pm/cli/install
- https://bun.com/docs/pm/isolated-installs
- https://bun.com/docs/pm/global-store
- https://bun.com/docs/pm/catalogs
- https://bun.com/docs/pm/lifecycle
