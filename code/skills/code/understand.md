# Understand

> You can outsource thinking, but not your understanding.

Trace one real code path and produce an executable path, with an optional
spatial map. The deliverables live together:

```text
.understand/<topic>/
├── index.html                    (only with --map)
└── how_<topic>_works.<ext>
```

The snippet imports and calls the actual implementation in a flat
top-to-bottom sequence so the user can run it, change the input, and step
through it. The HTML, when requested, makes the flow visible.

## Modes

Default mode writes only the runnable snippet. Pass `--map` (or an explicit
"with the HTML map" / "also show me the map" request) to additionally write
the HTML map. Everything else — path resolution, side-effect preview, and the
snippet contract itself — is unchanged between modes.

## Resolve the path

Accept a symbol, feature/behavior, file, or module. Find viable entry points
across public exports, routes, CLI commands, events/jobs, and UI handlers. If
multiple entry points tell materially different stories, present a short
numbered list and wait for the user to choose. Do not guess.

Trace before writing:

- Follow imports and definitions through the requested happy path.
- Expand a function when it branches, transforms the data, or orchestrates the
  behavior the user cares about.
- Treat trivial getters, formatters, loggers, thin wrappers, and third-party
  library calls as leaves.
- Note meaningful alternate branches without recursively tracing them.
- Prefer a realistic input from tests or fixtures; otherwise state the invented
  sample explicitly.
- Mark DB writes, cache mutations, events, files, clocks, queues, and network
  calls at the step where they occur.

## Side-effect preview

Before running the snippet, list every external boundary it will exercise and
the expected effect. Continue without another approval for ordinary local,
reversible, in-scope I/O. Ask before anything destructive, costly,
production-facing, credential-sensitive beyond the stated task, or otherwise
consequential. If approval is withheld, still generate the snippet and mark its
run status `NOT RUN` with the exact boundary.

## Runnable snippet

Write `.understand/<topic>/how_<topic>_works.<ext>` in the repository's language.
It must:

1. Start with the exact one-command invocation and a list of temporary exports.
2. Import and call real repository functions. Never reimplement their bodies.
3. Thread one concrete input through a flat, readable sequence.
4. Put a real `path:line` or `path#symbol` pointer on every meaningful step.
5. Label external boundaries inline as `[net]`, `[db]`, `[fs]`, `[queue]`, or
   `[clock]` and execute the real dependency when authorized and available.
6. Expand only the few orchestration/transform steps that earn it. Keep leaf
   calls intact rather than copying their logic.
7. Add a fidelity assertion against the real entry point when it can be called
   without distorting the example.

When a required function is module-private, prefer a public caller, adapter, or
test seam that exercises it. Do not edit production source only to make the
artifact runnable. If no faithful path exists, explain the limitation and ask
before adding a temporary export. An approved export must be the smallest
possible change, tagged `// TEMP-EXPORT (understand)`, enumerated in the snippet
header, and removed before completion unless the user explicitly asks to keep
it.

Run the snippet with the repository's actual runtime. Fix trace, import, type,
or runtime errors caused by the artifact and rerun. Do not hide unavailable
services behind silent mocks; mark the blocked line and the required setup.

## HTML map

Applies only with `--map`; skip this section entirely in default mode.

Write `.understand/<topic>/index.html` as a self-contained HTML/CSS artifact
with small JavaScript only when it improves navigation. Include:

1. Entry point, traced date, input, branch, run command, and run status.
2. A spatial hot-path map with boundaries and side effects.
3. A call table: function, concrete input/output, source pointer, and side effect.
4. The same worked values used by the runnable snippet.
5. Shallow notes for alternate branches.
6. Links or copyable paths to the snippet and every source file touched.
7. Temporary exports and external-I/O disclosures.

Escape repository-derived text; never pass it to `innerHTML` unsafely. Open the
HTML in a browser when practical and verify that it renders.

## Completion

Done means every artifact selected by the mode exists (the snippet alone, in
default mode; both, with `--map`), the snippet uses real code, source pointers
are verified, production source is unchanged unless the user approved a
temporary export, approved temporary exports are enumerated and cleaned up,
external side
effects were disclosed before execution, and the snippet either ran
successfully or records an exact blocker. Reply with the artifact path(s), run
command, validation result, temporary exports, and any consequential I/O not
executed.
