# Semantic Shortcuts

Code that *guesses* at a contract it could have consulted. The shortcut usually
looks like resilience or convenience, so it survives review: a fallback chain
reads as defensive, a regex reads as pragmatic, a cast reads as a type-system
workaround. Each one silently invents behavior the real schema, grammar,
provider API, or boundary type never promised.

The move this gate demands is narrow: **find the authoritative contract, then
decide.** It is not a license to rewrite code you find distasteful.

## When this gate applies

The diff — or the selected `simplify` scope — adds, changes, or contains any of:

- **Fallback chains** — `a ?? b ?? c`, try-then-try-else, catch-and-continue,
  multi-format probing — where no reachable case is known to need the fallback.
- **Regex-based classification** of a structured language or format (SQL, HTML,
  URLs, email, semver, JSON, MIME, code) where a parser, schema, or provider API
  exists.
- **Bespoke protocol, authentication, or security code** — hand-rolled JWT/OAuth
  flows, signature verification, crypto primitives, wire-format encoders.
- **Type assertions at a boundary** — `as`, `as any`, `as unknown as`, casts, or
  non-null assertions applied to data arriving from an API, parse, database,
  message, or config.

Not auto-suggested by `finish-lane.ts`: the trigger is the *shape of the code*,
which a filename glob cannot see. Select it from the diff or the scope under
review, the way `refactor-safety-check.md` is selected from refactor intent.

## Gotchas

1. **The fallback that never fires is not resilience — it is an unread branch.**
   `resp.data ?? resp.result ?? resp.body` looks defensive but usually encodes a
   guess about an API the author never checked. If exactly one of those keys is
   real, the other two are dead branches that will silently absorb the day the
   API *does* change shape, converting a loud failure into a quiet wrong answer.
   The question is never "could this help?" — it is "which released version,
   documented variant, or observed payload produces the other branch?"

2. **A regex over a structured grammar is a parser you did not write, tested
   only on the inputs you imagined.** It does not fail loudly on the input it
   mishandles; it returns a confident wrong classification. Nested constructs,
   comments, quoting, escapes, and CTEs are where it breaks, and none of them
   appear in the fixtures the author wrote.

3. **Finding the contract is the work; the rewrite is optional.** The gate is
   satisfied by *citing* the schema, grammar, provider doc, released-version
   compatibility case, or boundary type — not by producing a diff. A run that
   ends "contract found, code agrees, no change" is a full pass.

4. **Absence of a contract is not permission to invent one.** If you cannot find
   the authoritative source, you have not proven the code wrong — you have proven
   the code *unverified*. Retain it and report the uncertainty. Guessing at a
   replacement repeats the original sin with more confidence.

5. **A cast is a claim about someone else's data.** `payload as User` at a trust
   boundary is not a type fix; it is an assertion that the sender obeys a shape
   you never validated. The finding is the missing validation, not the cast.

6. **A contract that forbids a branch has not proven the branch unreachable.**
   The schema saying `result` is the only key does not tell you no caller in this
   repo constructs the legacy shape. Removing the branch is still a deletion, and
   still owes simplify's reachability evidence.

## Quick pass

For each shortcut in scope:

1. Name the authoritative contract that *should* govern it — the schema, grammar,
   parser, provider API doc, released-version compatibility case, or boundary
   type.
2. Look for it. Read the source, not your memory of it.
3. Decide, and record which branch you took:
   - **Contract found, code agrees** — record the citation. Done, no change.
   - **Contract found, code diverges** — this is a **correctness finding**.
     Report it with the citation. Apply a fix only under the apply rule below.
   - **Contract not found** — retain the code, report the uncertainty, and name
     what evidence would settle it. Do not rewrite.

## Apply rule

`simplify` is behavior-preserving (see its Invariants). This gate mostly produces
*findings*, not edits.

Auto-apply only when the evidence establishes that the change preserves
observable behavior for contract-valid inputs **and** for the specified invalid,
adversarial, compatibility, and error cases. Removing a fallback branch
additionally requires simplify's reachability evidence — a contract that declares
the branch invalid is not by itself proof that nothing reaches it.

Everything else — a regex that mishandles inputs the parser accepts, a cast
hiding a validation gap, hand-rolled auth that diverges from the spec — changes
behavior. That is a **bugfix, not a simplification**: report it as a correctness
finding rather than folding it into simplify work.

**Never auto-apply a new dependency.** Replacing bespoke protocol/auth/security
code with a library changes both behavior and the supply-chain surface. Name the
candidate, state what it replaces, and file it as a finding; naming a package
does not clear policy — `harness secure-dependencies` owns that decision.
Preferring an existing *in-repo* abstraction skips the dependency question but
still owes the behavior-preservation evidence above.

## Deep pass

Escalate when the shortcut sits on a trust, parsing, security, or data boundary:

- **Contract search inconclusive.** Get a real sample. A sanitized production
  payload, a recorded response, or the provider's own fixture beats a fixture the
  code's author invented — a green suite whose fixtures encode the code's own
  assumption proves nothing.
- **Known divergence in auth, crypto, protocol, or security code.** Do the impact
  analysis even though the contract is in hand: what an attacker or a
  nonconforming peer can make the current code do. Evidence here is the smallest
  concrete counterexample *or* the violated contract clause — some protocol and
  security defects have no convenient triggering input.
- **Fallbacks.** Find the git history or release note that introduced each branch.
  A branch nobody can date is a branch nobody can justify.
- **Casts.** Trace to the validation that *should* exist and propose it as the fix.

## False positives

Do not manufacture a finding. These are not shortcuts:

- **Trivial default values.** `env.PORT || 3000`, `opts.retries ?? 3`, a
  documented default in a config chain. A default is not a guess about a
  contract; it *is* the contract.
- **An evidence-backed compatibility case.** A documented degradation policy, or
  a compatibility case naming the producer, version, payload shape, or
  authoritative provider/repository contract, is sufficient evidence — record it
  and move on. An unsupported "more robust this way" comment is not evidence.
- **Regex doing regex work.** Matching a token, splitting a log line, or a
  well-bounded scan of unstructured text is not a parser substitute.
- **Casts a type system genuinely cannot express** — a validated narrowing, or a
  boundary already guarded by a schema check upstream.
- **Small, well-understood code that a dependency merely *could* replace.** "A
  library exists" is not a finding.

Rationalization blacklist: "it's more robust this way" (unnamed compatibility
case); "the regex is fine for our inputs" (untested claim about inputs you do not
control); "the cast is safe, I checked" (checked against what?). None clear the
gate.

## Evidence to record

For each shortcut inspected: the contract you looked for, where you looked, which
of the three branches you took (agrees / diverges / not found), and the citation
or the named missing evidence. For a divergence, the concrete counterexample or
the violated contract clause. For a proposed dependency, the candidate and what
it replaces.

## Stop rule

A shortcut whose contract you have found and cited is done, whether or not it
produced an edit. A shortcut whose contract you cannot find after a bounded
search is a reported uncertainty, not a rewrite.

A **contract divergence is an unresolved correctness finding**. Under
`prepare-pr`, do not mark this gate passed or seal the branch until the
divergence is fixed under appropriate scope, explicitly accepted for this PR, or
removed from it. Reporting a known defect and sealing green defeats the gate.
