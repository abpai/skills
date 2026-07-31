// Minimal real fixture for the `understand` artifact-mode eval. Small and
// branching on purpose: enough for a genuine trace (one entry point, one
// branch, no external I/O), nothing understand would need to expand further.
export function greet(name) {
  const trimmed = name.trim()
  if (trimmed.length === 0) {
    return "Hello, stranger!"
  }
  return `Hello, ${trimmed}!`
}
