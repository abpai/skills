# pstack principle examples

Human quick reference: illustrative breaches and corrections in a background-job
service. Each principle name links to its authoritative guidance; examples are
not additional requirements.

| Principle | Illustrative breach | Better approach |
| --- | --- | --- |
| [Laziness protocol](principles/principle-laziness-protocol.md) | A missing retry limit prompts a new workflow framework and unrelated scheduler cleanup. | Add the limit where retries are owned, reusing the existing scheduler. |
| [Redesign from first principles](principles/principle-redesign-from-first-principles.md) | A scheduler built for one customer gains scattered special cases when jobs become multi-tenant. | Revisit ownership and isolation with tenants as a core requirement; adopt the redesign where its benefit justifies migration. |
| [Attack the premise](principles/principle-attack-the-premise.md) | Two increases to a timeout fail to fix stuck jobs, but the next fix increases it again. | Test the shared assumption that workers are slow: check whether they receive the jobs at all. |
| [Boundary discipline](principles/principle-boundary-discipline.md) | A worker trusts unparsed queue data, while business functions repeatedly check raw payload fields and depend on HTTP objects. | Validate and convert the payload at entry; pass domain values to business functions that can run without HTTP or the queue. |
| [Script bulk operations](principles/principle-script-bulk-operations.md) | Rename a job API by hand in 70 callers, then spot-check a few. | Verify one conversion, automate the rest, and scan for old calls alongside behavior checks. |
| [Encode lessons in structure](principles/principle-encode-lessons-in-structure.md) | Reviews repeatedly remind authors to include tenant identity in every job lookup. | Enforce tenant-scoped lookups through the owning API and a check that rejects cross-tenant access. |
| [Exhaust the design space](principles/principle-exhaust-the-design-space.md) | With no established interaction or settled requirement, choose a new job-monitor UI solely because a table is familiar. | Compare a table, timeline and grouped queue; prototype the uncertain interaction before choosing. |
| [Prioritize usability](principles/principle-prioritize-usability.md) | Expose eight internal retry settings to everyone because they already exist in configuration. | Design around the user's recovery task, with clear feedback and only controls that help complete it. |
| [Outcome-oriented execution](principles/principle-outcome-oriented-execution.md) | A phased queue migration keeps a temporary dual-write bridge forever to preserve every intermediate step. | Define scoped, reversible phases and checkpoints, then deliver the verified new queue path and remove the bridge. |
| [Explain the number](principles/principle-explain-the-number.md) | Claim a worker is twice as fast from one run that skipped half the jobs. | Check completed work and errors, repeat comparable runs, and use measurements to identify the actual limit. |
| [Subtract before you add](principles/principle-subtract-before-you-add.md) | Add a third retry branch around two obsolete branches left from a retired queue. | Remove the obsolete paths, then add the behavior still required. |
| [Minimize reader load](principles/principle-minimize-reader-load.md) | To understand whether a job can run, trace five forwarding wrappers and reconcile two manually synchronized eligibility flags. | Keep the eligibility rule together and derive the answer from its source data. |
| [Model the domain: valid states](principles/principle-model-the-domain.md) | Independent flags allow a job to be both running and finished. | Represent the allowed alternatives directly, with the data each state requires. |
| [Model the domain: explicit lifecycles](principles/principle-model-the-domain.md) | Mark a job cancelled when Stop is requested; a replacement starts while the old process runs. A late callback can finish the replacement. | Distinguish cancelling from confirmed cancellation, assign transition ownership, and match callbacks to the correct attempt. |
| [Fix root causes](principles/principle-fix-root-causes.md) | Hide a missing-result error with retries although the worker marks jobs complete before storing their results. | Reproduce the ordering failure and fix the premature completion where it originates. |
| [Prove it works](principles/principle-prove-it-works.md) | Declare cancellation fixed because the code compiles and a log says “stopped.” | Observe the process stopping and replacement behavior; demonstrate that the check detects a process that remains alive. |
| [Sequence verifiable units](principles/principle-sequence-verifiable-units.md) | Migrate all job producers before checking whether the new queue supports their required ordering. | Resolve ordering first, then migrate in useful steps with a check before each dependent step. |
| [Make operations idempotent](principles/principle-make-operations-idempotent.md) | A billing job charges a customer, crashes before recording success, then charges again on retry. | Use a stable payment identity recognized by the payment service and reconcile the recorded outcome on restart. |
| [Migrate callers, then delete legacy APIs](principles/principle-migrate-callers-then-delete-legacy-apis.md) | Keep an old internal enqueue API and compatibility adapter after all callers could move together. | Update the owned callers and remove the old API in the same change or coordinated set. |
| [Separate before serializing shared state](principles/principle-separate-before-serializing-shared-state.md) | Two workers update different fields in one JSON file and overwrite each other's changes. | Give each worker its own state file and combine results when reading; coordinate writes if one shared object is necessary. |
| [Test behavior, not implementation](principles/principle-test-behavior-not-implementation.md) | A cancellation test only asserts that a private `killWorker` helper was called. | Cancel through the public interface and check that work stops, including a control where work continues. |
| [Type system discipline](principles/principle-type-system-discipline.md) | Both tenant IDs and job IDs are strings, so a lookup accepts them in the wrong order. | Give the two identities distinct types and validate external values before using them. |

## Three different state questions

- **Model the domain:** can the data represent contradictory facts?
- **Model the domain, lifecycle guidance:** who may advance the workflow, and
  what evidence permits it?
- **Make operations idempotent:** does repeating a step after partial failure
  reach the same correct outcome?

A job can have valid state types and still advance too early. Its transitions
can be explicit and still charge twice on retry. Use the principles together
when both failures are possible.
