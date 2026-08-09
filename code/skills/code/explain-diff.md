# Explain Diff

Explain code changes as an aligned before-and-after execution path. The default
is read-only. Use static tools to find leads, then verify the reported path in
the source on both sides of the diff.

## Resolve the comparison

Accept a working tree, one ref against the working tree, two refs, a
`base...head` range, a commit, or a PR. Resolve named refs to exact object IDs
before analysis. State the resolved **from** and **to** sides. Label a live
working tree as `WORKTREE` and include staged, unstaged, and relevant untracked
files in the initial inventory.

Resolve a single commit as its first parent against the commit. For a root
commit, use the repository's empty tree from `git hash-object -t tree /dev/null`
as the **from** side. Resolve `base...head` as `merge-base(base, head)` against
`head`. For a PR, resolve its live base and head object IDs, then compare their
merge base with the head. Pass the resulting two refs to tools; do not pass a
three-dot expression as one `calldiff` ref. If a static tool rejects an empty
tree, use the general lane. Analyze untracked files through source inspection
because `calldiff` cannot read them from a git tree.

If no scope is given, compare `HEAD` with `WORKTREE`. If the requested scope or
entry point is ambiguous, show the viable choices and ask one short question.
Do not silently choose a different range.

Start the analysis with the changed-file and hunk inventory. When the user
limits the request to files or paths, inventory that scope and list material
out-of-scope commit changes only under `Also changed`; do not expand the main
walkthrough to the full commit. Separate generated files, lockfiles, snapshots,
formatting-only changes, and other non-behavior changes from the paths that can
change execution. This inventory is evidence gathering; the final answer still
starts with the behavior-change sentence required by [Report](#report).

## Select the analysis lane

Choose per changed path. Mixed-language changes can use more than one lane.

### calldiff 0.3 and supported languages

Prefer an existing local `calldiff` version 0.3.0 or newer when its required
Tree-sitter grammar is already available. Run it directly:

```bash
calldiff [from] [to] [--entry symbol] [--max-depth n] [-- path ...]
```

Check the project-local binary before a global command. Do not download or
install `calldiff` during the skill. Version 0.3 can install missing grammars
into `~/.cache/calldiff/grammars` on first use. Do not trigger that install.
Run the command only when the grammar is bundled with the local package,
resolves from the local dependency tree, or is already present in the grammar
cache. If availability is uncertain, use the language-specific source fallback
and state that the optional call-graph lead was unavailable.

Confirm version 0.3 or newer from the installed package metadata. Before a
non-TypeScript run, read the installed language extractor's `grammarPackage`
value and confirm that package resolves locally or exists under
`${CALLDIFF_GRAMMAR_CACHE:-$HOME/.cache/calldiff/grammars}/node_modules`.
Do not run `calldiff` as the availability check. Version 0.3 bundles the
TypeScript and TSX grammar; JSX still needs the JavaScript grammar.

Match its git-shaped forms to the resolved comparison:

- no refs: `HEAD` against the working tree;
- one ref: that ref against the working tree;
- two refs: the first ref against the second ref.

Use repeated `--entry` options for known `functionName` or `ClassName.method`
symbols. Use path arguments to exclude unrelated source.

Version 0.3 supports TypeScript, TSX, JavaScript, JSX, Python, Go, Rust, Java,
Ruby, C, C++, C#, PHP, Kotlin, Swift, Scala, Lua, Elixir, Bash, Haskell, Zig,
Solidity, and OCaml. Treat TSX and JSX component tags as calls: include added,
removed, moved, or re-parented React components, with children nested under
their parent. Verify props, hooks, conditional rendering, and runtime behavior
in source because the component tree is syntactic.

Bun is a runtime, not a source language. Use the matching TypeScript,
JavaScript, TSX, or JSX lane, then inspect Bun entry points such as package
scripts, `bunfig.toml`, server handlers, tests, and workers. When `calldiff` is
already a Bun project dependency, a project-local Bun script or binary is an
equivalent command path.

`calldiff` 0.3 uses Tree-sitter and is syntactic, not a typechecker. Treat its
output as a lead. It does not prove dynamic dispatch, runtime values, framework
wiring, or side effects. If it fails, is unavailable, or omits a relevant path,
continue with the fallback lane and state the reason in one line.

### Python

Use `calldiff` when the safe preflight above passes. Otherwise inspect both
snapshots with Python's standard `ast` module when it helps find definitions
and call sites. Trace from the changed public function, CLI command, route,
task, event handler, or test-visible behavior. Resolve imports, methods,
decorators, callbacks, and dependency injection from source. Mark dynamic
attribute calls, monkey-patching, and framework registration as inference
unless current source or a focused runtime check proves them.

Do not require Node, `calldiff`, or a new Python package for this lane.

### Unsupported or unavailable language tools

For a language outside the `calldiff` list, or when its grammar is unavailable,
prefer a repository-provided language server, call-hierarchy tool, compiler
metadata, or Tree-sitter query when it already exists. Otherwise use symbol
search, imports, tests, and direct source inspection. Do not add a parser or
project dependency only to produce the explanation.

## Trace both sides

Choose the smallest entry point that explains the changed behavior. Infer a
candidate from changed exports, routes, commands, handlers, jobs, and tests.
If the user names an entry point, verify it exists on the applicable side.

For both **from** and **to**:

1. Follow definitions and calls from the entry point to the changed outcome.
2. Expand calls that branch, transform data, select dependencies, or cause a
   meaningful side effect.
3. Keep trivial wrappers, accessors, formatters, loggers, and third-party calls
   as leaves.
4. Record changed conditions, concrete data shape, return values, errors, and
   `[net]`, `[db]`, `[fs]`, `[queue]`, or `[clock]` boundaries.
5. Cite each changed meaningful step. For an immutable snapshot use
   `path@short-object:line` or `path@short-object#symbol`. For the live working
   tree use `path:line (WORKTREE)` or `path#symbol (WORKTREE)`. Never use an
   unqualified current-tree line number to support historical source. Derive
   historical line numbers from numbered snapshot text, for example
   `git show <object>:<path> | nl -ba`; do not use current-tree line numbers as
   a proxy.

Align corresponding calls. Use `-` for a removed call or branch, `+` for an
added call or branch, `~` for a call whose meaningful contract changed, and a
space for context. Do not mark a moved but unchanged call as behavior change.

## Verify the explanation

Read the surrounding source for every reported changed step. Check focused
tests, fixtures, and configuration when they establish entry-point wiring or
runtime values. Run a small existing test only when it is safe and materially
resolves uncertainty; keep the workflow read-only.

Separate these evidence classes:

- **Verified:** direct source, resolved refs, or a focused runtime result.
- **Inferred:** static dispatch or framework wiring that is plausible but not
  proven.
- **Unknown:** a path that cannot be resolved from available evidence.

Do not copy raw scanner output as the answer. Remove false leads and say when a
tool could not represent a language or dynamic call.

## Report

Start with one sentence that states the behavior change. Then use this compact
shape:

```text
<entry point and concrete intent>
  <unchanged call>
- <old call or branch>
+ <new call or branch>
~ <same call, changed input/output/side effect>
```

After the tree, explain:

- **Before:** the old path and outcome.
- **After:** the new path and outcome.
- **Why it matters:** the user-visible or system effect.
- **Evidence limits:** only inferred or unknown steps and tool failures.

Put material out-of-scope, unrelated, or non-behavior changes under
`Also changed` as one-line bullets. Omit that section when empty. Keep the
explanation understandable without the ordinary line diff.

When the user requests more than one independent comparison, repeat the tree,
before, after, why, evidence limits, and `Also changed` block for each range.
Do not merge separate execution paths into one tree.

## GitHub pull request automation

When the user asks to add `@call-diff` PR comments, read
`references/github-call-diff.md` and start from
`assets/call-diff-review.yml`. Keep the trigger authorization, immediate eyes
reaction, exact base and head objects, read-only Luna analysis job, and separate
comment job. Adapt repository names and pinned refs, but do not weaken those
trust boundaries.

## Completion

Done means the comparison sides are exact, at least one changed behavior is
traced before and after, each reported changed step has a verified source
pointer, static-tool output was checked against source, inference is labeled,
and unrelated changes are separated. If no execution behavior changed, say so
directly and summarize only the structural changes.
