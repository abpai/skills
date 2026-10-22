// OpenAI Structured Outputs strict mode requires every object node's
// `required` array to list *every* key in its `properties`; optional fields use
// a nullable type instead. codex-exec passes these schemas to
// `codex exec --output-schema`, and a violation only fails ~5s into a real run
// (the dry-run path never calls the API), so lint for it statically.

export function strictModeViolations(node: unknown, path: string, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach((value, i) => strictModeViolations(value, `${path}[${i}]`, out));
  } else if (typeof node === "object" && node !== null) {
    const record = node as Record<string, unknown>;
    const properties = record.properties;
    if (typeof properties === "object" && properties !== null && !Array.isArray(properties)) {
      const required = record.required;
      if (!Array.isArray(required)) {
        out.push(`${path}: object has properties but no \`required\` array`);
      } else {
        const missing = Object.keys(properties).filter((key) => !required.includes(key)).sort();
        if (missing.length > 0) {
          out.push(
            `${path}: \`required\` is missing property key(s): ${missing.join(", ")} ` +
              "(strict mode requires every property in `required`; use a nullable type for optional fields)",
          );
        }
      }
    }
    for (const [key, value] of Object.entries(record)) strictModeViolations(value, `${path}/${key}`, out);
  }
  return out;
}
