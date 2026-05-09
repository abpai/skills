# Understand

> You can outsource thinking, but not your understanding.

Build a mental model of a real code path. The output is a high-density walkthrough that makes the next move, assembling a scratch script by hand, obvious. The skeleton has imports filled in but logic left as TODOs because manually wiring it is how understanding lands.

Use when the user asks to understand a specific symbol, feature, behavior, file, or module in an existing codebase, especially when they want to trace the call stack so they can build a scratch script themselves.

Do not use this for general concept explanations; use `explain` for that. Do not use this for extracting general primitives; use `distill` for that. Do not use this to auto-generate runnable scripts; use `scratch` for that.

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

Which one? (number, or "all" for separate walkthroughs)
```

### 3. Trace happy path only

From the entry, follow each call:

- Resolve imports, jump to definition, recurse.
- Stop and do not recurse at:
  - I/O boundaries (DB driver, HTTP client, fs, queue producer, network socket)
  - Third-party library calls
  - "Obvious" helpers: loggers, type guards, simple formatters, identity transforms, trivial getters
- Branches: trace happy path only. If a branch meaningfully changes the path (early returns, alternate destinations, fallback strategies), capture it as a one-liner in the "Branches" section. Do not recurse into branch paths.

### 4. Capture concrete sample values

While tracing, note realistic values flowing through. Prefer values from real fixtures or tests in the repo. Invent reasonable ones if none exist. These power the worked-example section.

### 5. Annotate side effects inline

Tag every DB write, cache mutation, event emission, file write, network call, or external state change with `side effect:` at the relevant line in both the call stack and the worked example.

### 6. Locate scratch-file imports

For each module touched on the happy path, record the real import path and the symbols needed. These go straight into the skeleton's import block. No placeholders, no `TODO: figure out import`.

### 7. Write the file - do NOT render in chat

Write to `.understand/<topic>.md` at the repo root. Create the directory if missing. `<topic>` is a short kebab-case slug derived from the entry, such as `add-todo`, `todos-save-flow`, or `auth-middleware`.

Confirm the path with the user. The file is the deliverable; the chat reply is just the path confirmation plus any disambiguation the user needed to make.

## Output format

The file has these sections, in order. Match the exact headings.

```markdown
# /understand: <topic>

**Entry**: `<symbol>` at `<file>:<line>`
**Traced**: <YYYY-MM-DD>
**Stack**: <languages / runtimes touched>

---

## 1. Call stack (shapes)

Indented ASCII tree. Each node: `name(arg: Shape) -> ReturnShape @ file:line`
Boundaries marked `[boundary]`. Side effects tagged inline.

addTodoHandler(req: AddTodoRequest) -> Response @ src/api/todos.ts:14
|-- validateBody(body: unknown) -> AddTodoInput @ src/api/todos.ts:23
|-- addTodo(input: AddTodoInput) -> Todo @ src/todos/service.ts:8
|   |-- sanitize(text: string) -> string @ src/todos/sanitize.ts:3
|   `-- saveTodo(draft: TodoDraft) -> Todo @ src/todos/repo.ts:12
|       `-- db.todos.insert(...) side effect: DB write @ [boundary]
`-- notify('todo.saved', todo: Todo) -> void @ src/events.ts:30
    `-- eventBus.emit(...) side effect: emits 'todo.saved' @ [boundary]

---

## 2. Worked example (concrete values)

Pseudocode-flavored, real file:line refs in comments. Values flow top-to-bottom.

# user submits the form with text "buy milk"
req = { body: { text: "buy milk" } }

# src/api/todos.ts:14 - entry
input = validateBody(req.body)
# -> { text: "buy milk" } (rejects empty, trims whitespace)

# src/todos/service.ts:8 - orchestration
todo = addTodo(input)

  # src/todos/sanitize.ts:3
  cleaned = sanitize("buy milk")
  # -> "buy milk" (strips control chars, collapses whitespace)

  # src/todos/repo.ts:12
  draft = { text: "buy milk", createdAt: <now> }
  saved = saveTodo(draft)
  # side effect: INSERT into todos
  # -> { id: "t_01H...", text: "buy milk", createdAt: ... }

# src/events.ts:30
notify("todo.saved", saved)
# side effect: eventBus.emit("todo.saved", saved)

# response back to client
return Response.json(saved, { status: 201 })

---

## 3. Branches noted in passing

One line each. Just enough to know they exist.

- `validateBody` throws `ValidationError` on empty text -> handler returns 400 (not traced)
- `saveTodo` retries once on transient DB errors before throwing (not traced)
- If `eventBus` is offline, `notify` swallows the error and logs (not traced)

---

## 4. Build the scratch yourself

Save as `.understand/<topic>.scratch.<ext>` and fill in the TODOs.

import { addTodo } from "../src/todos/service"
import { sanitize } from "../src/todos/sanitize"
import { saveTodo } from "../src/todos/repo"
import { notify } from "../src/events"
import type { AddTodoInput } from "../src/todos/types"

async function main() {
  // TODO: build a realistic AddTodoInput
  const input: AddTodoInput = { text: "buy milk" }

  // TODO: stub or mock the DB so saveTodo doesn't actually write
  // real repo lives at src/todos/repo.ts:12, calls db.todos.insert

  // TODO: stub eventBus so notify doesn't actually emit
  // real bus lives at src/events.ts, .emit is the boundary

  // TODO: call addTodo(input) and inspect what comes back
  // TODO: log what saveTodo received (the sanitized draft)
  // TODO: log what notify was called with
}

main()

**Worth instrumenting at each step**:
- input shape going into `addTodo`
- sanitized text going into `saveTodo`
- final `Todo` returned
- exact payload to `notify`

---

## 5. Pointers

- Entry: src/api/todos.ts:14
- Core logic: src/todos/service.ts
- Boundaries: src/todos/repo.ts (DB), src/events.ts (eventBus)
- Fixtures: src/todos/__tests__/service.test.ts
```

## Conventions

- ASCII over Mermaid, always.
- Concrete file:line refs. Never paraphrase locations as "in the service file".
- Polyglot adaptation. Match the codebase's idiom: TypeScript uses `.ts` plus ES imports, Python uses `.py` plus `from X import Y`, Go uses `.go` plus package imports, PHP uses `.php` plus `use` statements.
- Density over completeness. Every line earns its place. Drop sections that add nothing.
- No tutorial voice. The reader is the code owner. Do not explain language features, apologize, or preface.
- Do not render the walkthrough in chat. Write the file. Confirm the path.

## Anti-patterns

- Dumping the walkthrough into chat instead of writing to `.understand/`
- Tracing branches when the user asked for happy path
- Recursing into third-party libraries or obvious helpers
- Vague refs like "in the service file"; always use `file:line`
- Auto-completing the scratch script; logic should stay as TODOs
- Skipping disambiguation when there are multiple candidates
- Inventing function names or paths. If you cannot find it, say so.

## What this is NOT

- Not `explain`: no tutorial framing, no analogies, no progressive disclosure for newcomers. The reader already owns the code.
- Not `distill`: not extracting general primitives. Trace one specific real path.
- Not `scratch`: not producing a runnable script. The TODOs are the point.
