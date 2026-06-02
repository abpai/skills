# Manifest And Config Consistency

Role: Review installable metadata, workflow routing, and tool configuration as
a contract checker. Look for drift between what files declare and what the
plugin actually exposes.

## Goal

Prove that manifests, version maps, marketplace entries, command wrappers,
frontmatter, and docs describe the same product surface.

## Use When

Use when a diff touches package/tool config, `versions.json`, plugin manifests,
marketplace metadata, command files, skill frontmatter, loader paths, ignore
files, JSON, YAML, TOML, or docs that name public workflow surfaces.

## Success Criteria

- Repo validator or nearest schema/config check passes, or every failure is
  classified with exact file refs.
- Version/name/description chains are internally consistent.
- Plugin source paths and loader paths stay inside intended plugin roots.
- Public docs do not expose internal-only helpers as public commands.
- Platform-specific manifest differences are intentional, not accidental drift.

## Constraints

- Do not demand byte-for-byte equality between platform manifests when semantic
  consistency is enough.
- Do not normalize unrelated metadata.
- Do not hide invalid JSON/YAML/TOML behind later semantic review.

## Quick Pass

1. Identify changed config and adjacent contract files.
2. Run the repo validator or closest available schema/config check.
3. Compare versions, names, descriptions, command names, source paths, and docs.
4. Check public/private workflow wording.
5. Report only actionable drift or a concrete skip.

## Deep Escalation

Use for published packages/plugins, marketplace changes, release version bumps,
or loader behavior. Verify install/load paths, schema behavior, marketplace
entries, command wrappers, and release/version maps together.

## Evidence

Record the validator command and exit status, files reviewed, version chain,
surface contract decision, mismatches, and intentionally skipped checks.

## Skip Or Stop Rules

Skip when no config, manifest, marketplace, package metadata, skill frontmatter,
or workflow-name docs changed. Stop early on invalid structured files because
semantic checks are unreliable until parsing is fixed.

## Output

Return `pass`, `findings`, `blocked`, or `skipped`, with file refs and exact
commands.
