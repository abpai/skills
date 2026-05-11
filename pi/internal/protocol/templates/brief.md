# Brief: <short project title>

<The coordinator may derive `title` and a default run slug from this H1. Keep
it short, specific, and easy to kebab-case.>

## Goal

<One paragraph describing the outcome. Written from the user's point of view.
State what the build produces and what problem it solves.>

## Posture

<One of: `expand`, `selective`, `reduce`. See the protocol Phase 1 posture check.
One sentence explaining the tradeoff this posture made.>

## Constraints

- <Hard requirements: languages, frameworks, deployment target, existing code
  that must be preserved, API compatibility, etc.>
- <Performance or operational constraints worth calling out up front>
- <Non-goals — what this build intentionally does NOT do>

## Primitives

<Ordered list of the core primitives (data models, services, flows) the build
needs. Each primitive is a noun the generator can build independently.>

- <primitive name> — <one-sentence description>
- <primitive name> — <one-sentence description>

## Tech Decisions (from consensus matrix)

<Reference `research/consensus-matrix.md`. Capture the decisions reached
(Claude + Codex agreed, or user resolved tiebreak). One line per primitive.>

- <primitive name>: <chosen approach>

## UI Direction (if applicable)

<For UI work, reference `artifacts/layout-options.html` and
`research/ui-layout-decision.md`. State the selected layout direction, what it
optimizes for, and which alternatives were rejected. Omit this section for
non-UI work.>

## Success Signal

<How the user knows the build is done. Concrete: a URL returns X, a CLI command
exits zero, a test suite passes. Not "it works.">

## Risks

- <Risks surfaced during planning that repair passes cannot silently absorb>
