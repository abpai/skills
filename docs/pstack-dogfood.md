# pstack 0.1.0 dogfood

Scope: the first `poteto-mode`, its shared module, and the Claude/Codex entrypoints.
Source inspiration: open-pstack at `9046eecb4ec4461374b1fd8cda7bd60abbaa6d9e`.
The upstream MIT notice is retained in `pstack/LICENSE`.

## Behavioral passes

All passes used real subagents on read-only repository tasks. No provider CLI
or installed Claude session was used; these are Codex subagent receipts.

| Pass | Task and evidence | Observation and suspected cause | Resolution |
| --- | --- | --- | --- |
| `dogfood_plan` | Apply the initial mode to planning a future principle addition; inspect the actual metadata and validation code. Direct validation rejected the standalone `poteto-mode` entrypoint. | Packaging mismatch: this repository classifies non-umbrella entries as internal commands. No friction in the mode instructions. | Use a public `pstack` umbrella, a shared `poteto-mode.md` module, and an internal namespaced wrapper. No shared validator changes. |
| `dogfood_routed` | Apply the repaired umbrella with `--poteto-mode` to investigate installer error handling. The agent read the shell script, ran `bash -n`, and exercised five mocked installer outcomes. | No routing or mode friction. It distinguished an offline skip from discovery failure and found a diagnostic limitation in the existing installer script. | Clean pass. The installer finding is outside this chunk and was not patched. |
| `dogfood_wrapper` | Apply the repaired wrapper to investigate version-gate coverage for uncommitted work. The agent ran the gate and observed `Checked 0 plugin(s)`, then traced the committed-diff/current-filesystem behavior. | No wrapper or mode friction. It identified the check's limited coverage and proposed an isolated committed candidate. | Clean pass. The parent subsequently tested the candidate in a temporary clone and observed `Checked 1 plugin(s)` with `pstack: new -> 0.1.0`. |

Two consecutive passes through the repaired entrypoints reported no skill-caused
friction. Their scope was read-only planning and investigation, not code-writing
behavior or live Claude runtime integration.

## Packaging proof

- Version synchronization and generation completed with `pstack` at `0.1.0`.
- `scripts/validate-skills.sh` reported `Validation passed.` The default Python
  lacked PyYAML; a separate run of `scripts/validate_skills.py` with the existing
  pre-commit Python environment passed with PyYAML 6.0.3.
- `scripts/validate-npx-install.sh` skipped because the npm registry could not
  resolve. The cached real `skills` CLI 1.7.2 discovered the public `pstack`
  entrypoint and, with `INSTALL_INTERNAL_SKILLS=1`, the `poteto-mode` wrapper.
  Both were discovery-only runs.
- The version gate passed for one new plugin in an isolated temporary clone
  containing a commit of the candidate. The user's working tree was not
  committed. `git diff --check` passed.

# pstack 0.2.0 plan

Replaces the initial mode with `plan`. Four condensed principles are adapted
from the same pinned open-pstack source: laziness protocol, model the domain,
fix root causes, and sequence verifiable units. The plan's short, selective
structure follows the linked writing-for-agents guidance; there is no runtime
dependency on that external skill.

| Pass | Evidence | Observation and suspected cause |
| --- | --- | --- |
| `plan_dogfood_bug` | Public `plan` route; real installer-diagnostics task. Reproduced early exits with local fixtures and returned three pointers plus two selected principles. | No skill-caused friction. Research informed the plan; no implementation edits. |
| `plan_dogfood_feature` | Namespaced wrapper; plan for a future general-purpose verification mode. Returned four pointers plus three selected principles. | No skill-caused friction. Reused the catalog, preserved host boundaries, and stopped at the plan. |

Both fresh subagents completed unaided. Their plans were reviewed for source
grounding, selective principle use, brevity, and implementation overreach.
Neither pass required a repair. These are Codex behavioral checks, not a live
Claude installation test.

Validation: the full repository lane passed in a clean temporary checkout of
the candidate, excluding unrelated local worktrees. Strict YAML validation
also passed with the existing PyYAML environment. Cached `skills` 1.7.2
discovered the public entrypoint and internal plan wrapper; the online npx
lane skipped on unavailable registry access. The bundled generic quick
validator rejects this repo's required `argument-hint` and
`disable-model-invocation` fields, so the repository validator is authoritative.
The isolated committed-candidate version gate checked one plugin at `0.2.0`;
the working checkout remains uncommitted. `git diff --check` passed.

# pstack 0.2.1 wording

Replaced role-specific wording with “implementation plan” across instructions
and public descriptions. `plan_neutral_wording` used the revised skill on the
installer-diagnostics task, returned a concise three-step plan with two
selected principles, and reported no friction. Strict structural validation
and cached installer discovery passed. The online installer check remained
unavailable, as in the preceding run.
The full repository lane passed in the clean checkout, and the isolated
version gate confirmed `0.2.0 -> 0.2.1`. `git diff --check` passed.

# pstack 0.2.2 planning lens

Added the structural-decisions and prerequisites prompt to `plan.md`; no
separate Foundational Thinking principle was added. `plan_foundations_check`
used the revised skill on a general-purpose verification-workflow task,
produced four concise steps with two relevant principles, and reported no
friction. It identified the shared inputs and output contract before packaging
and validation. No implementation edits or external calls were made.
The full validation lane and strict structural check passed. Cached installer
discovery passed; online discovery remained unavailable. The isolated version
gate confirmed `0.2.1 -> 0.2.2`, and `git diff --check` passed.

# pstack 0.2.3 planning order

Changed the internal sequence to research, draft, then select and apply
principles. Only the refined plan is returned. `plan_order_check` researched
the installer-diagnostics task and reproduced its failures, drafted the small
fix before opening the principle catalog, then consulted Fix root causes and
Laziness protocol. Its process note confirmed that order; its final response
contained only the refined plan. No skill-caused friction was reported.
Full repository and strict structural validation passed. Cached installer
discovery passed; online discovery remained unavailable. The isolated version
gate confirmed `0.2.2 -> 0.2.3`, and `git diff --check` passed.

# pstack 0.3.0 redesign principle

Ported Redesign from First Principles as five short bullets, with a conditional
trigger and a benefit-versus-cost decision instead of a mandatory rewrite.
`redesign_principle_check` used the catalog on a multiple-public-skills planning
task and selected Model the Domain instead: the new principle did not add a
distinct useful decision for that task. `redesign_direct_check` applied the new
principle to machine-readable validator output and identified the existing
reporter as the narrow change boundary. It considered the scale of redesign
and used the cost comparison to keep the proposal small. No repair was needed.
Both were read-only design tasks; no implementation was performed.
Full repository and strict structural validation passed. Cached installer
discovery passed; online discovery remained unavailable. The isolated version
gate confirmed `0.2.3 -> 0.3.0`, and `git diff --check` passed.

# pstack 0.3.1 principle bullets

Split the existing Laziness Protocol, Model the Domain, and Sequence Verifiable
Units guidance into short bullets while retaining their meaning.
`principle_bullets_check` consulted and used all three on a real packaging-plan
task. It reported no material ambiguity, kept the proposed scope small, and
sequenced the ownership contract before consumer updates. No instruction
repair was needed.

## Expanded-library draft PR snapshot

The current draft adds the remaining reviewed principles and approved verify
and auto modules. Only plan is connected to the public router. The earlier
behavioral runs above do not validate this expanded snapshot; fresh dogfood,
focused evals, and live Claude/Codex compatibility checks remain in the handoff.

Packaging was checked from a clean temporary copy of the current draft:

- Version synchronization completed without changes; version generation passed.
- `scripts/validate-skills.sh` passed, using the existing pre-commit Python
  environment with PyYAML available.
- `scripts/validate-npx-install.sh` skipped because the npm CLI was unreachable.
  Separately, the cached real skills CLI discovered both pstack and the hidden
  plan wrapper in list-only mode. This is discovery evidence, not installation.
- All pstack Markdown links resolved and `git diff --check` passed.

The committed version-bump gate is run separately when the draft is committed.
