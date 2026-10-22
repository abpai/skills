import { expect, test } from "bun:test";
import { drainQueue } from "../src/queue";
import type { DeliveryResult } from "../src/types";
import { endpoint, event, scriptedSend } from "./helpers";

test("records each delivery outcome", async () => {
  const { send } = scriptedSend([200, 404]);
  const records: Array<[string, DeliveryResult]> = [];
  const totals = await drainQueue(
    [
      { event, endpoint },
      { event: { ...event, id: "evt_2" }, endpoint },
    ],
    { send },
    { record: (id, _url, result) => records.push([id, result]) },
  );
  expect(totals).toEqual({ delivered: 1, failed: 1 });
  expect(records.map(([id, r]) => [id, r.ok])).toEqual([
    ["evt_01HZX3", true],
    ["evt_2", false],
  ]);
});
