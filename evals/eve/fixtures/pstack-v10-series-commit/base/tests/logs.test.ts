import { expect, test } from "bun:test";
import { runLogs } from "../src/logs";
import { capture, tempLog } from "./helpers";

const LOG = "GET /health 200\nPOST /login 200 token=abc123\nGET /orders 500\n";

test("prints the log with secrets redacted", async () => {
  const io = capture();
  expect(await runLogs([tempLog(LOG)], io)).toBe(0);
  expect(io.lines).toEqual(["GET /health 200", "POST /login 200 token=[REDACTED]", "GET /orders 500"]);
});

test("--grep keeps matching lines", async () => {
  const io = capture();
  await runLogs([tempLog(LOG), "--grep", "GET"], io);
  expect(io.lines).toEqual(["GET /health 200", "GET /orders 500"]);
});
