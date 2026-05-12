# Hexagon Audit

Audit Ports & Adapters (Hexagonal Architecture, Cockburn 2005) compliance in a
monorepo that separates interface packages from provider implementations —
typically a top-level `packages/` (ports, shared kernel, inner-core code) and
`adapters/` (provider implementations). This is a read-only audit unless the
user explicitly asks for fixes.

Use this module when the user asks to audit hexagon compliance, check
ports/adapters separation, or verify architecture invariants in a repo with
that layout.

## Invariants

1. **Inward dependency flow.** Files under `packages/` must not import from
   `adapters/`, either by relative path or by a workspace package whose
   `package.json` lives under `adapters/`.
2. **No peer-adapter imports.** An adapter may self-import its own package name,
   but it must not import another package whose `package.json` lives under
   `adapters/`.
3. **Vendor I/O is classified.** Port/interface packages should not import
   vendor SDKs (for example `@modelcontextprotocol/sdk`, `@anthropic-ai/sdk`,
   `@google-cloud/*`, `bun:sqlite`, `postgres`, `pg`, `kubernetes-client`).
   Treat these as findings to classify, not automatic violations.
4. **One adapter, one transport.** Do not bundle two backends in one adapter
   package.

## Process

### 1. Run the deterministic scan

Run the bundled scanner from the repo root. When this skill is installed via
`npx skills add`, the script lives at:

```bash
bun .agents/skills/code/scripts/audit-hexagon.ts
```

Under a Claude Code plugin install it is `${CLAUDE_PLUGIN_ROOT}/skills/code/scripts/audit-hexagon.ts`.

The script discovers workspace package names and dependency edges from
`packages/*/package.json` and `adapters/*/package.json`, then reports:

- `packages/` source or package manifests that import/depend on adapters.
- `adapters/` source or package manifests that import/depend on peer adapters.
- vendor SDK imports and dependency declarations found inside `packages/`.

If the script reports package-to-adapter or adapter-to-peer-adapter imports,
surface them as Tier 1 hard violations. Vendor SDK hits need human
classification in step 3. If the repo does not have `packages/` and `adapters/`
top-level directories, this module does not apply — say so instead of guessing.

### 2. Run focused source checks

Use `rg` to inspect the code around any script findings. These are useful spot
checks, not the source of truth:

```bash
rg -n "from ['\"](\.\./)*adapters/|/adapters/" packages adapters
rg -n "@modelcontextprotocol/sdk|@anthropic-ai/sdk|bun:sqlite|@google-cloud/|^import .*postgres|from ['\"]pg['\"]|kubernetes-client" packages
```

If the script reports an unexpected dependency edge, inspect the corresponding
`package.json` and the source import that uses it.

### 3. Audit by domain group

If subagents are available and the user has explicitly allowed delegation, split
related package/adapter clusters across explorer subagents. Otherwise audit the
groups locally. Group packages with their matching adapters (e.g. a `session`
port with `session-postgres` / `session-sqlite` adapters).

For each group, answer:

- Does any package import an adapter package or path?
- Does any adapter import a peer adapter package or path?
- Are vendor SDKs confined to adapters, or is a `packages/*` module acting as
  runnable inner-hexagon code or shared infrastructure?
- Does each adapter represent one transport/provider?

Adapters may import their port package, shared kernel/domain packages, inner-core
packages, and vendor SDKs. They may not import peer adapters.

### 4. Classify findings

Sort each finding into one bucket:

- **Hard violation**: `packages/*` imports an adapter, an adapter imports a peer
  adapter, or concrete vendor I/O implementation lives in a package that is
  meant to be a pure port.
- **Soft smell**: a package mixes interface and reference implementation, an
  infra package lives under `packages/` without a clear boundary, or a transport
  name obscures ownership.
- **Clean**: the package is interface-only, shared kernel/domain code, or
  runnable inner-hexagon core with I/O behind abstract ports.

## Report Format

Produce a single markdown report with these sections:

1. **Headline Result**: does the hexagon hold? Include the deterministic scan
   counts and name any Tier 1 violations.
2. **Hard Violations**: cite `file:line` for every Tier 1 finding.
3. **Soft Smells**: cite `file:line` and explain why it is cleanup rather than
   a blocker.
4. **Clean Groups**: summarize the groups that preserve the boundary.
5. **Recommendations**: split into Tier 1 fixes and Tier 2 cleanup. Be concrete:
   name the package, adapter directory, or file to move.
6. **Verification**: include the script command and focused `rg` checks so the
   audit can be rerun later.

## Layout Notes

- Common project rule for this layout: interfaces live in `packages/<name>/`;
  implementations live in `adapters/<name>/`; adapters depend on interface
  packages, never on each other.
- An "inner-core" package (e.g. a runnable harness core) may contain code as
  long as I/O sits behind abstract ports.
- Shared infrastructure packages (e.g. an MCP toolkit) are not pure ports —
  classify their role explicitly when vendor SDKs appear there.
- Storage/provider-shaped code under `packages/` deserves extra scrutiny: it can
  look adapter-shaped even when it is consumed as shared infrastructure.
- Companion repos outside the monorepo are out of scope unless the user includes
  them.
