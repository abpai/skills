"""Apply the reference config change to a COPY of the fixture: python3 config.patch.py <copy-root>."""
import sys

path = sys.argv[1] + "/src/config.ts"
src = open(path).read()
src = src.replace(
    'export class ConfigError',
    'import { parseDuration } from "./duration";\n\nexport class ConfigError',
    1,
)
old = '''function millis(value: unknown, job: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {'''
new = '''function millis(value: unknown, job: string, field: string): number {
  if (typeof value === "string") {
    try {
      return parseDuration(value);
    } catch {
      throw new ConfigError(`job "${job}": ${field} must be milliseconds or a duration like "1h30m"`);
    }
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {'''
assert old in src
open(path, "w").write(src.replace(old, new, 1))
