import { expect, test } from "bun:test";
import { redact } from "../src/redact";

test("masks key=value secrets", () => {
  expect(redact("login ok user=ann token=abc123 password=hunter2")).toBe(
    "login ok user=ann token=[REDACTED] password=[REDACTED]",
  );
});

test("masks bearer tokens and secret keys", () => {
  expect(redact("Authorization: Bearer eyJhbGciOi.x.y")).toBe("Authorization: Bearer [REDACTED]");
  expect(redact("charge with sk_live_9fQ2xYz")).toBe("charge with sk_live_[REDACTED]");
});

test("leaves ordinary lines alone", () => {
  expect(redact("GET /health 200 3ms")).toBe("GET /health 200 3ms");
});
