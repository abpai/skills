# Dependency Resolution Hardening Policies

## Contents

- Global editing rules
- Python / uv
- Python / pip or pip-tools without uv
- Bun
- npm
- pnpm
- Go
- Dependabot
- Renovate
- CI hardening
- DEPENDENCY_SECURITY.md requirements

## Global Editing Rules

- Preserve existing private registries, package scopes, mirrors, and custom index configuration.
- Merge into existing config files instead of replacing them.
- Prefer root/workspace config, but respect established monorepo boundaries.
- Never remove lockfiles.
- Do not introduce unpinned `latest` installs.
- Do not switch package managers.
- Do not disable cooldown globally for private registries unless validation proves the registry lacks required metadata. Prefer the narrowest index-specific exception.
- If validation requires dependency resolution, avoid opportunistic upgrades and explain any lockfile changes.

## Python / uv

If the repo uses uv, merge this into the root `pyproject.toml`, preserving existing `[tool.uv]` values:

```toml
[tool.uv]
exclude-newer = "1 week"
```

Validate with:

```bash
uv lock --check
uv sync --locked
```

If a custom/internal index lacks upload-time metadata and uv fails, document the failure and add the narrowest index-specific override only for that index:

```toml
[[tool.uv.index]]
name = "internal"
url = "https://internal.example.com/simple"
exclude-newer = false
```

## Python / pip or pip-tools without uv

Do not convert a pip-only project to uv.

If `requirements.in` exists and pip-tools is already used, prefer hash-locked output:

```bash
pip-compile --generate-hashes -o requirements.lock requirements.in
python -m pip install --require-hashes -r requirements.lock
```

If uv is already allowed as a tool in the repo, this is acceptable:

```bash
uv pip compile --generate-hashes --exclude-newer "1 week" -o requirements.lock requirements.in
```

For plain pip-only projects with no lock or hashes, add a `DEPENDENCY_SECURITY.md` note that pip itself does not provide a native rolling package-age cooldown. Enforce the cooldown through Dependabot or Renovate.

## Bun

Create or update `bunfig.toml`:

```toml
[install]
minimumReleaseAge = 604800 # 7 days in seconds
exact = true
auto = "disable"
```

Prefer CI installs:

```bash
bun install --frozen-lockfile
```

For install scripts, try this only after the baseline install/test path still passes:

```toml
[install]
ignoreScripts = true
```

If legitimate native packages need scripts, do not replace this with allow-everything behavior. Document which packages require scripts and why.

## npm

For npm v11 or newer, create or update project `.npmrc`:

```ini
min-release-age=7
save-exact=true
package-lock=true
audit=true
```

Prefer CI installs:

```bash
npm ci
```

For lifecycle scripts, try:

```bash
npm ci --ignore-scripts
```

If scripts are required, explicitly rebuild only reviewed packages:

```bash
npm rebuild <reviewed-package-name> --ignore-scripts=false
```

Do not globally allow unknown `postinstall` or `preinstall` scripts. If the repo uses npm older than v11 and `min-release-age` is unsupported, do not fake support silently. Recommend upgrading npm or use an install wrapper with `--before` computed as 7 days ago.

## pnpm

Create or update `pnpm-workspace.yaml` at the workspace root:

```yaml
minimumReleaseAge: 10080 # 7 days in minutes
strictDepBuilds: true
```

If dependency build scripts are required, add a precise allowlist only after review:

```yaml
allowBuilds:
  esbuild: true
  sharp: true
```

Rules:

- Do not set `dangerouslyAllowAllBuilds: true`.
- Do not add broad wildcard allow rules.
- Prefer CI installs:

```bash
pnpm install --frozen-lockfile
```

## Go

Go has no native dependency publish-age cooldown. Do not claim that it does.

Harden Go by enforcing reproducible module resolution and checksum validation:

- Ensure `go.mod` and `go.sum` are committed.
- CI should use read-only module mode:

```bash
GOFLAGS="-mod=readonly" go test ./...
go mod verify
go mod tidy -diff
```

Prefer these CI environment defaults unless the repo has a documented reason otherwise:

```bash
GOPROXY=https://proxy.golang.org,direct
GOSUMDB=sum.golang.org
GOVCS=public:git|hg,private:git
```

If private modules use non-git VCS, document the exception and keep `GOVCS` as tight as possible.

## Dependabot

If the repo already uses Dependabot, merge cooldown into existing entries. If no Dependabot config exists and the repo is on GitHub, create `.github/dependabot.yml` with entries only for ecosystems actually present.

Example entries:

```yaml
version: 2
updates:
  - package-ecosystem: "gomod"
    directory: "/"
    schedule:
      interval: "weekly"
    cooldown:
      default-days: 7

  - package-ecosystem: "uv"
    directory: "/"
    schedule:
      interval: "weekly"
    cooldown:
      default-days: 7

  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
    cooldown:
      default-days: 7

  - package-ecosystem: "bun"
    directory: "/"
    schedule:
      interval: "weekly"
    cooldown:
      default-days: 7

  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    cooldown:
      default-days: 7
```

For monorepos, add one entry per manifest directory or use supported directory patterns only if the existing config already uses them safely. npm, pnpm, and yarn use package-ecosystem `npm` in Dependabot.

## Renovate

If the repo uses Renovate instead of Dependabot, merge:

```json
{
  "minimumReleaseAge": "7 days",
  "internalChecksFilter": "strict"
}
```

Do not create both Dependabot and Renovate configs unless the repo already intentionally uses both.

## CI Hardening

Treat the runner's tools as dependencies as well as the application packages:

- Pin third-party GitHub Actions `uses:` references to full commit SHAs and keep
  the human-readable release tag in a trailing comment.
- Replace required CI or documented-gate invocations that fetch the latest CLI
  (`npx --yes <tool>`, `uvx <tool>`, curl-piped installers) with an exact version
  backed by the ecosystem's lockfile or a verified checksum.
- A minimal tool-only manifest/lockfile is justified when it makes a required
  validation gate reproducible. Do not introduce a package manager only to pin
  an optional local convenience command.

Update CI install commands to frozen/locked equivalents:

```bash
# uv
uv lock --check
uv sync --locked

# npm
npm ci

# pnpm
pnpm install --frozen-lockfile

# bun
bun install --frozen-lockfile

# go
GOFLAGS="-mod=readonly" go test ./...
go mod verify
go mod tidy -diff
```

Also update Dockerfiles, release scripts, setup scripts, and copied documentation when they contain install commands used as CI or onboarding gates.

## DEPENDENCY_SECURITY.md Requirements

Create or update `DEPENDENCY_SECURITY.md` with:

- The 7-day dependency cooldown policy.
- Which ecosystems enforce cooldown natively in this repo.
- Which ecosystems only enforce cooldown via Dependabot or Renovate.
- The frozen/locked install commands maintainers should use.
- How to intentionally bypass cooldown for emergency security fixes.
- How to review packages that need lifecycle/build scripts.
- Any strict settings that could not be enabled and the precise reason.

Emergency bypass guidance:

- Bypass only for a specific security advisory, CVE, or incident.
- Prefer an exact version or lockfile-only change for the affected package.
- Temporarily relax the smallest relevant setting only for the lock update, then restore policy.
- Record the package, version, advisory link, approver, commands run, and follow-up cleanup.

Lifecycle/build-script review guidance:

- Verify the package is already present in the lockfile before allowing scripts.
- Review the package purpose, transitive chain, maintainer/source, script contents when available, and native build need.
- Add exact allowlist entries only for reviewed packages.
- Never use allow-all switches such as pnpm `dangerouslyAllowAllBuilds: true`.
