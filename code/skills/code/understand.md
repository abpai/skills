# Understand

> You can outsource thinking, but not your understanding.

Build a mental model of a real code path. The output is a self-contained HTML artifact that makes the hot path spatial: entry points, call graph, concrete values, side effects, branches, and an import skeleton all visible in one browser page.

Use when the user asks to understand a specific symbol, feature, behavior, file, or module in an existing codebase, especially when the shape of the code matters more than a prose explanation.

Do not use this for hands-on tutorials; use `/tutorial` for that. Do not use this for extracting general primitives; use `distill` for that. Do not use this to generate runnable exploration scripts; write a one-off script only when the current task requires it.

## Input forms

Auto-detect which one you got:

1. **Symbol** - `addTodo`, `UserService.save`, `handleAuth`
2. **Feature/behavior** - `"how todos get saved"`, `"the login flow"`
3. **File or module path** - `src/todos/`, `src/api/auth.ts`

## Process

### 1. Resolve entry point(s)

- **Symbol** - grep for the definition (`function addTodo`, `def add_todo`, `func AddTodo`, `class addTodo`, `const addTodo = `). Multiple matches across files means ambiguous.
- **Feature** - grep across each entry layer the codebase exposes:
  - HTTP route handlers / framework decorators
  - CLI commands / argv parsers
  - Event, queue, or cron handlers
  - Public exports of named modules
  - UI event handlers (`onSubmit`, `onClick`, etc.)
- **File or module** - identify the public surface (top-level exports, default export, route registrations).

### 2. Disambiguate if needed - STOP and ask

If there's more than one viable entry point, output a numbered list and wait for the user's pick. Do not trace yet.

```text
Found 3 candidates for "how todos get saved":

1. src/api/todos.ts:14 - POST /todos handler
2. src/cli/add.ts:8 - `cli add` command
3. src/sync/inbound.ts:42 - pulls from upstream queue

Which one? (number, or "all" for separate artifacts)
```

### 3. Trace happy path only

From the entry, follow each call:

- Resolve imports, jump to definition, recurse.
- Stop and do not recurse at:
  - I/O boundaries (DB driver, HTTP client, fs, queue producer, network socket)
  - Third-party library calls
  - "Obvious" helpers: loggers, type guards, simple formatters, identity transforms, trivial getters
- Branches: trace happy path only. If a branch meaningfully changes the path (early returns, alternate destinations, fallback strategies), capture it as a one-liner in the branches section. Do not recurse into branch paths.

### 4. Capture concrete sample values

While tracing, note realistic values flowing through. Prefer values from real fixtures or tests in the repo. Invent reasonable ones if none exist. These power the worked-example panel.

### 5. Annotate side effects inline

Tag every DB write, cache mutation, event emission, file write, network call, or external state change with `side effect:` at the relevant line in both the call graph and worked example.

### 6. Collect import skeleton

For each module touched on the happy path, record the real import path and the symbols needed. These go into the HTML artifact's import skeleton panel. No placeholders, no `TODO: figure out import`.

### 7. Write the HTML artifact - do NOT render it in chat

Write to `.understand/<topic>.html` at the repo root. Create the directory if missing. `<topic>` is a short kebab-case slug derived from the entry, such as `add-todo`, `todos-save-flow`, or `auth-middleware`.

Open the file in a browser when practical. Confirm the path with the user. The file is the deliverable; the chat reply is just the path confirmation plus any disambiguation the user needed to make.

## HTML artifact structure

The file should be self-contained: HTML, CSS, and small JavaScript only when it helps navigation. No build step.

Use this structure:

1. **Header** - title, entry point, traced date, stack/language badges.
2. **Hot path map** - SVG or CSS boxes/arrows showing the happy path. Mark boundaries and side effects visually.
3. **Call stack table** - function, input shape, output shape, file:line, side effect.
4. **Worked example** - concrete values flowing top-to-bottom with file:line refs in comments.
5. **Branches noted** - collapsible one-line branch notes. Keep them shallow.
6. **Import skeleton** - code block with real imports and TODOs for manual wiring.
7. **Pointers** - entry, core logic, boundaries, fixtures/tests.

For the visual style, prefer the same editorial card language as `visualize`: ivory background, serif headings, clay accent, restrained borders, spatial diagrams over ASCII.

## Example content shape

The artifact should express this information, but not as Markdown:

```text
Entry: addTodoHandler @ src/api/todos.ts:14

Happy path:
addTodoHandler(req) -> validateBody(body) -> addTodo(input)
  -> sanitize(text)
  -> saveTodo(draft) side effect: DB write [boundary]
  -> notify("todo.saved", todo) side effect: event emit [boundary]

Worked value:
req.body = { text: "buy milk" }
validateBody(req.body) -> { text: "buy milk" }
saveTodo({ text: "buy milk", createdAt: <now> }) -> { id: "t_01H..." }

Import skeleton:
import { addTodo } from "../src/todos/service"
import { sanitize } from "../src/todos/sanitize"
import { saveTodo } from "../src/todos/repo"
import { notify } from "../src/events"
```

## Conventions

- HTML/SVG over ASCII. Diffs and call graphs are spatial information.
- Concrete file:line refs. Never paraphrase locations as "in the service file".
- Polyglot adaptation. Match the codebase's idiom: TypeScript uses `.ts` plus ES imports, Python uses `.py` plus `from X import Y`, Go uses `.go` plus package imports, PHP uses `.php` plus `use` statements.
- Density over completeness. Every panel earns its place. Drop sections that add nothing.
- No tutorial voice. The reader is the code owner. Do not explain language features, apologize, or preface.
- Do not paste the artifact into chat. Write the file. Confirm the path.
- Never use `innerHTML` with untrusted repository content. Escape code, comments, filenames, and sample values.

## Anti-patterns

- Dumping the walkthrough into chat instead of writing the HTML artifact
- Generating a Markdown companion by default
- Tracing branches when the user asked for happy path
- Recursing into third-party libraries or obvious helpers
- Vague refs like "in the service file"; always use `file:line`
- Auto-completing the import skeleton; logic should stay as TODOs
- Skipping disambiguation when there are multiple candidates
- Inventing function names or paths. If you cannot find it, say so.

## What this is NOT

- Not `/tutorial`: no tutorial framing, no analogies, no progressive disclosure for newcomers. The reader already owns the code.
- Not `distill`: not extracting general primitives. Trace one specific real path.
- Not a runnable exploration script. The TODOs are the point.
