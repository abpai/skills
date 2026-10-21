# Separate before serializing shared state

When concurrent workers may change the same file, branch, key, or state object:

- Identify what they can both change, then ask whether it must be shared.
- Prefer separate files, keys, branches, or state directories owned by each
  worker. Combine their results when reading or reporting them.
- Different fields in one shared file still share a write target; separate
  ownership requires separate write targets.
- If one shared object is necessary, enforce safe access with a lock, a single
  writer, or sequential phases. Instructions alone cannot prevent conflicting writes.

Example: give an indexer and a metrics worker separate state files instead of
having both update one shared state file.
