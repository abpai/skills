# Pinned scanner and CI setup

The canonical setup recipe for durable local and CI enforcement of
`harness-doctor`. Other Harness modules route here instead of copying commands.

1. Detect the package manager from the lockfile or `package.json#packageManager`.
   The lockfile decides who owns installs; a script body invoking another
   runtime (`bun test` beside a `package-lock.json`) is a runtime choice, not a
   conflict. Ask which manager owns dependency changes only when two lockfiles
   disagree or a lockfile contradicts `packageManager`.

   A repo with no `package.json` has no place to pin this scanner. Do not add
   one to a Python, Go, or Rust repo to hold a dev tool. Stop, say the pinned
   setup does not apply, and offer the unpinned `npx @andypai/harness-doctor@latest`
   audit — invoked from CI as a step, not as a repo dependency — under the same
   confirmation rule as **Fast path**.
2. After the user approves dependency and config edits, run the one add-dev-dependency
   command matching the detected manager (`bun add -d`, `pnpm add -D`,
   `yarn add -D`, or `npm install -D` `@andypai/harness-doctor`). Do not present
   all four to the user; the lockfile pins the resolved version.
3. Preserve an existing `harness.config.*` format (`.ts`/`.mts`/`.cts`/`.js`/`.mjs`/`.cjs`/`.json`/`.jsonc`,
   or `package.json#harnessDoctor`). A repo only needs a config when it
   overrides a default. For a new TypeScript config:

   ```ts
   import type { HarnessDoctorConfig } from "@andypai/harness-doctor/api";

   export default {
     failOn: "error",
   } satisfies HarnessDoctorConfig;
   ```

   Only write fields that exist on `HarnessDoctorConfig` for the pinned
   version — an unknown key fails typecheck. Re-check the pinned type and
   `--help` rather than assuming a field from a past version (see the baseline
   note under **Fast path** in `doctor.md`).

   Knip-backed dead-code discovery requires a released
   `@andypai/harness-doctor >= 2.0.0` — a source worktree may report a
   pre-release version even with a pending changeset; that is not an
   installable release. Wait for publication, install through the repo's
   package manager, and confirm the lockfile resolved `>=2.0.0` before adding
   Knip config. Older pinned versions use the prior dead-code engine; upgrade
   the scanner first or preserve the older setup.

   Dead-code configuration is repository-owned Knip configuration, not
   `harness.config.*` — Harness Doctor bundles and invokes Knip, so do not add
   a separate `knip` dependency or a second CI command. Preserve an existing
   `.knip.json(c)`, `knip.json(c)`, `knip.ts`, `knip.js`, `knip.config.*`, or
   `package.json#knip` surface; create one only on a demonstrated config gap.

   Before writing that config, inspect the repo's real entry mechanisms —
   package scripts, framework routes/plugins, workers, subprocess targets,
   generated modules, fixtures, workspace boundaries — and add the narrowest
   `entry`/`project`/workspace/ignore setting that describes them; never
   blanket-ignore a reported directory. In a monorepo, configure the root
   workspace under `workspaces["."]` (root-level `entry`/`project` are
   ignored). Preserve any configuration hints the scan prints in the proof
   report, then rerun the exact same command after each config edit.

   | Evidence | Knip treatment |
   | --- | --- |
   | Package scripts, `bin`, framework/plugin routes | Confirm auto-discovery; add `entry` only when the scan proves it missed one. |
   | Literal worker or subprocess target | Add the launched file as `entry` when Knip did not recognize the edge. |
   | Dynamically discovered eval, fixture, migration, or generated module | Describe its real glob under the owning workspace; use `entry` when executable and `project` when analyzed source. |
   | Generated or vendored output outside the source contract | Exclude the narrow generated path; never suppress the whole workspace. |

   A repo may intentionally keep `deadCode: false` in `harness.config.*` for
   its ordinary readiness scan while a dedicated CI script explicitly passes
   `--dead-code`. Preserve that two-mode setup when it is documented and
   tested — the explicit CLI lane is the dead-code receipt.
4. Add one package script that invokes the pinned local binary:

   ```json
   {
     "scripts": {
       "harness:check": "harness-doctor --json --verbose --dead-code --warnings --fail-on error --no-score"
     }
   }
   ```
5. Run the script with the detected manager. Retain the exit result, stdout
   JSON, and stderr configuration hints as one proof receipt (a local artifact
   may store the streams separately as long as the report links the pair).
6. Add the same package script to the repo's existing CI workflow. Do not
   create a CI system when none exists without user approval. A repository
   administrator, not the agent, decides whether the job becomes a required
   branch-protection check.

   The starter command is **dead-code visibility/receipt enforcement**, not a
   merge-blocking dead-code gate: `--fail-on error` still fails existing error
   rules, while Knip-backed findings stay warnings for classification. Once the
   repo has an accepted Knip config and reviewed finding corpus, require an
   explicit maintainer choice before tightening policy — `--fail-on warning`
   blocks on every warning, or promote selected stable `knip/<rule>` overrides
   to `error` and keep `--fail-on error` gating only those classes. Record
   which policy CI uses; never call the starter lane merge-blocking dead-code
   enforcement.

Setup is done when a clean checkout installs the pinned dependency and the
same `harness:check` script passes locally and in CI. CI runs this
deterministic scanner only; it never runs `harness baseline`, `harness
compliant`, or another agent workflow.

Dead-code output is a lead, not deletion proof. For each candidate, inspect its
callers, package exports, runtime loading, and nearby tests, then classify it
`confirmed`, `false-positive`, or `config-gap`. A config gap is repaired in the
repo-owned Knip config and proved by rerunning `harness:check`, not hidden with
a Harness severity override. If JSON reports `dead-code` in `skippedChecks`,
that coverage is missing even when the process exits `0` — surface
`skippedCheckReasons` prominently and do not claim a clean scan.

Knip-backed findings use public `knip/<rule>` IDs. If a repository's config
still carries `deslop/<rule>` overrides or suppressions from the earlier
engine, rename them to the matching `knip/*` IDs; there are no compatibility
aliases. Prefer the `dead-code` tag when one setting applies to the whole
family.
