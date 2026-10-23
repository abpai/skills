const KEY_VALUE = /\b(token|secret|password|api[_-]?key)=("[^"]*"|\S+)/gi;
const BEARER = /\b(Bearer)\s+[A-Za-z0-9._~+/-]+=*/g;
const SECRET_KEY = /\bsk_(live|test)_[A-Za-z0-9]+/g;

/** Mask secrets in one log line. */
export function redact(line: string): string {
  return line
    .replace(KEY_VALUE, (_m, key: string) => `${key}=[REDACTED]`)
    .replace(BEARER, "$1 [REDACTED]")
    .replace(SECRET_KEY, "sk_$1_[REDACTED]");
}
