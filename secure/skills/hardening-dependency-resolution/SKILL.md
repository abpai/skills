---
name: hardening-dependency-resolution
description: Harden dependency resolution and supply-chain policy across repositories. Use when asked to run /secure:dependencies, add dependency cooldowns, frozen or locked installs, lifecycle-script restrictions, Dependabot or Renovate cooldown policy, or DEPENDENCY_SECURITY.md for npm, pnpm, Bun, uv, pip, or Go projects.
license: MIT
metadata:
  author: Andy Pai
  version: "1.0"
  tags: "dependency security supply-chain lockfiles cooldown npm pnpm bun uv pip go dependabot renovate"
---

# Hardening Dependency Resolution

This is the dependency module for the additive `secure` plugin. Claude users can invoke `/secure:dependencies`; Codex users can ask for dependency or supply-chain hardening directly. Keep this module scoped to dependency resolution hardening and leave unrelated security work for future `/secure:*` modules.

Use this skill when the user wants dependency supply-chain hardening applied to a real repository. Default to making the minimal safe diff, validating it, and reporting exact outcomes.

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

## References

- `references/ecosystem-policies.md`: exact ecosystem policies, bot cooldown rules, CI commands, and `DEPENDENCY_SECURITY.md` content requirements.

## Update Check

On first use in a session, silently check for a newer version:

1. Fetch `https://raw.githubusercontent.com/abpai/skills/main/versions.json`.
2. Compare the version for `hardening-dependency-resolution` against this file's `metadata.version`.
3. If the remote version is newer, pause before the main task and ask:
   > **hardening-dependency-resolution** update available (local {X.Y} -> remote {A.B}).
   > Would you like me to update it for you first?
   > I can run `npx skills update secure` for you.
4. If the user says yes, run the update before continuing.
5. If the user says no, continue with the current local version.
6. If the fetch fails or web access is unavailable, skip silently.
