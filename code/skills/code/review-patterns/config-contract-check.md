# Manifest And Config Consistency

Contract-check installable metadata, command registration, and the version
fan-out so a diff that parses cleanly does not ship a broken or misrepresented
surface.

## When this gate applies

- Any change under `.claude-plugin/`, `.codex-plugin/`, `versions.json`, a
  model-invocable `SKILL.md` `metadata.version`, or a plugin manifest description.
- A skill moved into/out of `skills/`, a new `commands/*.md`, or new/edited
  wrapper frontmatter (`disable-model-invocation`, `user-invocable`,
  `metadata.internal`).
- A loader/source path referenced from a skill, or a change to the
  `codex-run.sh` / `claude-tmux-run.sh` runner wrappers.
- New or edited JSON/YAML/TOML config, ignore files, or docs that name a public
  `/<plugin>:<command>` surface.

## Gotchas

1. **Version bump is a FOUR-file fan-out, not one manifest.** A plugin version
   lives in `<plugin>/.claude-plugin/plugin.json`,
   `<plugin>/.codex-plugin/plugin.json`, the model-invocable `SKILL.md`
   `metadata.version` (when the plugin has one), AND root `versions.json`. Miss
   any one and users *silently never receive the update*. "Versions agree" is not
   enough — open all four files and confirm each carries the bump. A one-manifest
   bump that passes a casual diff is the single most common failure this gate
   exists to catch.
2. **Codex manifests are real and must stay paired.** Every Claude plugin keeps a
   sibling `.codex-plugin/plugin.json` next to `.claude-plugin/plugin.json`
   (Codex has a real plugin system). A diff that bumps or edits only the Claude
   manifest and leaves the Codex one stale is the divergence this gate is for —
   *not* a benign platform difference. Do not rationalize a missing/stale
   `.codex-plugin/plugin.json` as "platform-specific"; it must EXIST and stay
   version-synced.
3. **`X.Y` vs `X.Y.Z` is consistency, not drift.** A `SKILL.md`
   `metadata.version` of `"1.4"` normalizes to `"1.4.0"` in `plugin.json`;
   `"1.4.2"` stays `"1.4.2"`. Comparing `1.4` against `1.4.0` across files is the
   sync rule, NOT a mismatch — do not raise a false finding on the
   two-vs-three-component format. This is exactly what `sync-plugin-versions.sh`
   encodes.
4. **Namespaced commands MUST be `skills/<name>/SKILL.md`, never `commands/`.** A
   namespaced command like `/code:review` only registers from a skill
   subdirectory. A flat `commands/*.md` file parses fine but *never acquires the
   plugin namespace and never appears in the `/` menu*. Any diff that
   (re)introduces a plugin-root `commands/` dir, or moves a skill out of
   `skills/`, is a broken-surface violation even though every file is valid — a
   generic "loader path resolves inside plugin root" check will not catch it.
   This is a regression the team hit and fixed once.
5. **Internal-wrapper three-flag invariant (CI-enforced).** A wrapper with
   `disable-model-invocation: true` MUST also set `metadata.internal: true`, and
   — when its pack has an umbrella sibling `skills/<plugin>/SKILL.md` — also
   `user-invocable: false`. Missing either fails `validate-skills.sh` (lines
   ~239 and ~251) → `validate-pr.yml`. Each flag prevents a specific failure, so
   you can judge intent rather than pattern-match:
   - `disable-model-invocation: true` — stops the model auto-invoking the wrapper
     instead of routing through the umbrella.
   - `user-invocable: false` — keeps the bare leaf name out of the `/` menu;
     without it a pack's `/review` collides with the built-in `/review` and
     sprays duplicate `/<workflow>` entries.
   - `metadata.internal: true` — hides the wrapper from flat-list installers like
     `npx skills` (which Codex uses); overridable with `INSTALL_INTERNAL_SKILLS=1`.

   A wrapper that sets one flag but not the others may be deliberate (see `pi`)
   or a mistake — check for an umbrella sibling to decide.
6. **`pi` is the named exception — do not flag it.** `pi` has NO umbrella; its
   phase commands (`/pi:plan`, `/pi:execute`, …) are the primary interface, so
   they stay `user-invocable` and are exempt from the `user-invocable: false`
   rule. They still set `metadata.internal: true`. The validator encodes this as
   "only require `user-invocable: false` when an umbrella sibling exists," so a
   reviewer applying the invariant blindly would wrongly flag `pi`.
7. **Paths must stay inside the owning plugin — because installs copy into a
   runtime cache.** A repo-relative or cross-plugin path resolves at author time
   in the checkout and *breaks after install*, when the plugin is copied into a
   runtime cache and the sibling no longer sits where the path expects. A passing
   local path check is therefore meaningless if the path escapes the plugin
   root; confine every referenced path to its owning plugin.
8. **Runner-wrapper parity is a config contract.** The `codex-run.sh` and
   `claude-tmux-run.sh` wrappers must expose the same surface (flags, file modes,
   error contract). `test-wrapper-parity.sh` is the committed, runnable check —
   run it instead of eyeballing whenever either runner wrapper changes.

## Quick pass

1. List changed config files and the contract files they reference (manifests,
   `versions.json`, `SKILL.md`, loader paths).
2. Run `validate-skills.sh`; record the command and exit status.
3. Confirm the four-file version fan-out agrees, treating `X.Y` ↔ `X.Y.0` as
   equal (Gotcha 3).
4. Confirm `.codex-plugin/plugin.json` exists and is version-synced with the
   Claude manifest.
5. Resolve each changed command to `skills/<name>/SKILL.md` → `/<plugin>:<name>`,
   and each referenced path inside its plugin root.
6. Check wrapper frontmatter against the three-flag invariant, skipping `pi`.
7. Report drift with `file:line`, or record a concrete skip.

## Deep pass

Escalate for published/marketplace changes, release version bumps, new wrappers,
or loader-behavior changes. Run the version-spine checkers end to end:
`generate-versions.sh` (regenerates/validates root `versions.json` from the
manifests — the canonical four-file agreement check) and
`sync-plugin-versions.sh` (surfaces `SKILL.md` → `plugin.json` drift with the
`X.Y` → `X.Y.0` rule). On runner-wrapper changes run `test-wrapper-parity.sh`.
Verify install/load paths, the namespaced-registration of every changed command,
and the version map together as one chain.

## Scripts

This gate is repo-native: the checkers already live at the marketplace repo root
under `scripts/` and are the canonical source of truth. Run them from the repo
root — do not vendor copies into this lens, which would silently drift from the
real CI checkers.

- `scripts/validate-skills.sh` — the real contract checker: frontmatter validity,
  the wrapper three-flag invariant, and the version map. Run:
  `bash scripts/validate-skills.sh` (add `--skip-versions` to isolate
  frontmatter). Fails CI via `validate-pr.yml`.
- `scripts/generate-versions.sh` — validates root `versions.json` against the
  plugin manifests (the four-file agreement). Run: `bash scripts/generate-versions.sh`.
- `scripts/sync-plugin-versions.sh` — syncs `plugin.json` from `SKILL.md`
  `metadata.version`, encoding `X.Y` → `X.Y.0`. Run:
  `bash scripts/sync-plugin-versions.sh` to surface or fix version drift.
- `scripts/test-wrapper-parity.sh` — checks `codex-run.sh` / `claude-tmux-run.sh`
  parity. Run: `bash scripts/test-wrapper-parity.sh` when either runner wrapper
  changes.

## False positives

- **`X.Y` vs `X.Y.0` flagged as a mismatch.** That's the sync rule (Gotcha 3),
  not drift. Normalize before comparing.
- **Demanding byte-for-byte equality between the Claude and Codex manifests.**
  They legitimately differ (e.g. Codex has no Claude hooks); require version +
  description parity and that the Codex manifest EXISTS, not identical bytes.
- **Flagging `pi`'s `user-invocable` phase commands.** Exempt (Gotcha 6); the
  invariant only requires `user-invocable: false` when an umbrella sibling exists.
- **Treating a path that works in the checkout as proven.** It can still break
  post-install (Gotcha 7) — the passing local check is not evidence.
- Do not normalize unrelated metadata, and do not defer invalid JSON/YAML/TOML to
  later semantic review.

## Evidence to record

In your review notes and the PR text: the validator command + exit status, the
files reviewed, the four-file version chain and where (if anywhere) it diverges, the
`.codex-plugin` parity decision, the namespaced-registration check per changed
command, the wrapper three-flag decision (and any `pi`-style exemption), each
mismatch with `file:line`, and any check intentionally skipped with rationale.
Stop early on an invalid structured file — semantic checks are unreliable until
parsing is fixed.
