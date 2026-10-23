import { appendFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { runTail } from "../src/tail";
import { capture, tempLog } from "./helpers";

test("prints build output as written", async () => {
  const io = capture();
  expect(await runTail([tempLog("step 1\nstep 2\n")], io)).toBe(0);
  expect(io.lines).toEqual(["step 1", "step 2"]);
});

test("--follow prints lines appended later", async () => {
  const controller = new AbortController();
  const io = capture(controller.signal);
  const path = tempLog("step 1\n");
  const running = runTail([path, "--follow"], io);
  setTimeout(() => appendFileSync(path, "step 2\n"), 50);
  setTimeout(() => controller.abort(), 700);
  await running;
  expect(io.lines).toEqual(["step 1", "step 2"]);
});
