# Secure Dependencies

Harden dependency resolution as part of an agent-ready repository: reproducible
installs, bounded update freshness, reviewed lifecycle scripts, and CI commands
that use the committed lock state.

## Policy

- Default dependency cooldown: seven days.
- Treat manifests, lockfiles, CI, update-bot config, registries, and package
  manager declarations as source of truth.
- Preserve private registries, scopes, package managers, and lockfiles.
- Prefer committed project-local configuration over global machine settings.
- Never introduce broad `latest` usage or silently allow all install/build
  scripts.
- Do not upgrade dependencies unless regeneration or verification requires it.
- Pin tools installed by scripts and CI.

## Workflow

1. Inventory manifests, lockfiles, workspace/package-manager config, Dockerfiles,
   setup scripts, CI install commands, dependency bots, and developer docs that
   contain copied install commands. Treat third-party GitHub Actions and ad hoc
   tool fetches (`npx`, `uvx`, downloaded binaries/installers) as dependency
   surfaces too.
2. Determine ecosystems from lockfiles first, then manifests and
   `packageManager` fields.
3. Read `references/ecosystem-policies.md` and load only the sections for the
   ecosystems and update bot actually present.
4. Apply the minimal safe project-local configuration. Use locked/frozen CI
   installs, merge cooldown into the existing bot, and never create both
   Dependabot and Renovate unless the repo intentionally uses both.
   - Pin third-party GitHub Actions to full commit SHAs and retain a version
     comment for readability and update tooling.
   - Pin required CI/tooling CLIs to an exact version plus a lockfile or verified
     checksum. A minimal tool-only manifest is appropriate when a required CI or
     documented validation command otherwise fetches an unpinned CLI; do not add
     a package manager merely for an optional convenience command.
5. Create or update `DEPENDENCY_SECURITY.md` with the repository's enforcement
   table, seven-day policy, emergency security bypass, and lifecycle-script
   review rules.
6. Validate with the relevant frozen/locked commands. If lifecycle restrictions
   break a required package, allowlist only a reviewed package already present in
   the lockfile and explain why.

Ask only when a private registry blocks validation, project policy conflicts
with the default, or a lifecycle allowlist would require guessing. Ordinary
manifest, config, CI, bot, and policy-file edits are part of this workflow.

## Completion

Report files changed, exact policy per ecosystem, validation commands/results,
allowed lifecycle scripts and reasons, settings intentionally not applied, and
remaining supply-chain gaps. Done means installs remain reproducible from the
committed lock state and the policy is both enforced and documented.
