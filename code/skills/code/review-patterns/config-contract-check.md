# Manifest And Config Consistency

Role: Review installable metadata, workflow routing, and tool configuration as a
contract checker. Catch drift between what config files declare and what the
plugin actually loads and exposes.

## Goal

Confirm that every config surface in the diff agrees: manifests, `versions.json`,
marketplace entries, command wrappers, skill frontmatter, loader paths, and docs
must name the same versions, command names, and source paths. The risk this gate
catches is a config that ships a broken or misrepresented surface: a version that
disagrees across files, a loader path that points outside its plugin root, or
docs that advertise an internal-only helper as a public command.

## Use When

Use when a diff touches package/tool config, `versions.json`, plugin manifests,
marketplace metadata, command files, skill frontmatter, loader paths, ignore
files, JSON, YAML, TOML, or docs that name public workflow surfaces.

## Success Criteria

- Repo validator (or nearest schema/config check) passes, or every failure is
  classified with exact `file:line` refs.
- Version, name, and description fields agree across all files that declare them.
- Plugin source paths and loader paths resolve inside their intended plugin root.
- No public doc names an internal-only helper as a public command.
- Platform-specific manifest differences are confirmed intentional, not accidental
  divergence.

## Constraints

- Do not demand byte-for-byte equality between platform manifests when semantic
  consistency is enough.
- Do not normalize unrelated metadata.
- Do not defer invalid JSON/YAML/TOML to later semantic review.

## Quick Pass

1. List changed config files and the adjacent contract files they reference.
2. Run the repo validator or nearest schema/config check; record command and exit
   status.
3. Diff versions, names, and descriptions across the files that declare them.
4. Resolve each command name, source path, and loader path against its plugin root.
5. Check docs for internal helpers exposed as public commands.
6. Report actionable drift with `file:line` refs, or a concrete skip.

## Deep Escalation

Escalate for published packages/plugins, marketplace changes, release version
bumps, or loader-behavior changes. Verify install/load paths, schema behavior,
marketplace entries, command wrappers, and release/version maps together as one
chain.

## Evidence

Record in `gate-decisions.md`: validator command and exit status, files reviewed,
the version chain and where it diverges, the public/private surface decision,
each mismatch with `file:line`, and any check intentionally skipped.

## Skip Or Stop Rules

Skip when no config, manifest, marketplace, package metadata, skill frontmatter,
or workflow-name docs changed. Stop early on an invalid structured file: semantic
checks are unreliable until parsing is fixed.

## Output

Return the gate decision (`run`, `skip`, `deep`, `override`, or `blocked`), with
`file:line` refs and the exact commands run.
