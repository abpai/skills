# Minimize reader load

Reduce both **layers to trace** and **changing values to keep track of**.
These are separate problems: code with few layers can still be hard to follow
if values change in places the reader must remember.

- Prefer explicit code over clever shortcuts.
- Remove wrappers that only pass calls along and add more navigation than clarity.
- Make interfaces hide implementation details or important decisions, rather
  than making readers learn both the interface and its implementation.
- Prefer returning a result to changing existing state.
- Limit how much code can read or change a value. Compute values from source
  data instead of keeping duplicate copies in sync.
- Define rules that must always hold where they are enforced, so readers
  learn them once.
- Add a layer or stored value only when it reduces reader effort elsewhere by at
  least as much as it adds.

**Check:** Can a new reader quickly explain where a value comes from and what
can change it?
