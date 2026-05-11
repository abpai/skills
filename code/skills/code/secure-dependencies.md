# Secure Dependencies

This is the dependency hardening module in the `code` workflow pack. Claude users can invoke `/code:secure-dependencies`; Codex users can ask for dependency or supply-chain hardening directly. Keep this module scoped to dependency resolution hardening and leave unrelated security work for a future focused `/code:secure-*` workflow.

Use this module when the user wants dependency supply-chain hardening applied to a real repository. Default to making the minimal safe diff, validating it, and reporting exact outcomes.

## Core Policy

- Default dependency cooldown is 7 days.
- Treat live manifests, lockfiles, CI, and bot config as source of truth.
- Preserve existing private registries, scopes, and package managers.
- Prefer committed project-local config over global machine config.
- Never remove lockfiles or introduce broad `latest` usage.
- Pin tool versions where scripts install tools.
- Reduce install/build script attack surface, but do not silently allow all scripts.
- Do not upgrade dependencies unless needed to regenerate or verify lockfiles.

## Workflow

1. Inspect all dependency surfaces before editing:
   - Manifests and lockfiles: `go.mod`, `go.sum`, `pyproject.toml`, `uv.lock`, `uv.toml`, `requirements*.txt`, `requirements*.in`, `bun.lock`, `bun.lockb`, `bunfig.toml`, `package.json`, `package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`.
   - Update bots: `.github/dependabot.yml`, `renovate.json`, `renovate.json5`, `.github/renovate.json`, `.renovaterc*`.
   - CI install commands in `.github/workflows/`, other CI config, Dockerfiles, setup scripts, and docs that developers copy.
2. Determine ecosystems from lockfiles first, then manifests and `packageManager` fields.
3. Read `references/ecosystem-policies.md` before editing and apply only the sections for ecosystems actually present.
4. Update package-manager config, CI install commands, and existing dependency bot policy. Do not create both Dependabot and Renovate unless the repo already intentionally uses both.
5. Create or update `DEPENDENCY_SECURITY.md` with the repo-specific policy, native-vs-bot enforcement table, emergency bypass process, and lifecycle-script review rules.
6. Validate with the relevant locked/frozen commands. If a strict lifecycle-script setting breaks install or tests, keep the cooldown and lockfile hardening, document the incompatible setting, and add a precise allowlist only for a reviewed package already present in the lockfile.

## Stop Conditions

Ask the user only when the repository cannot be inspected, a private registry blocks validation, a project document explicitly conflicts with the policy, or a lifecycle/build-script allowlist would require guessing.

## Output Contract

Return:

- Files changed.
- Exact config added per ecosystem.
- Commands run and results.
- Strict settings not applied and why.
- Packages allowed to run install/build scripts and why.
- Remaining supply-chain gaps.

For multi-ecosystem repositories, optionally add a self-contained HTML dependency hardening dashboard with ecosystem cards, bot policy table, lifecycle-script allowlist, and remaining gaps. Keep `DEPENDENCY_SECURITY.md` as the committed policy surface.

## References

- `references/ecosystem-policies.md`: exact ecosystem policies, bot cooldown rules, CI commands, and `DEPENDENCY_SECURITY.md` content requirements.
