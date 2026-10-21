import { expect, test } from "bun:test";
import { deliver } from "../src/dispatch";
import { sign } from "../src/sign";
import { endpoint, event, scriptedSend } from "./helpers";

test("delivers a signed JSON body", async () => {
  const { send, requests } = scriptedSend([200]);
  const result = await deliver(event, endpoint, { send });
  expect(result).toEqual({ ok: true, status: 200, attempts: 1 });
  const req = requests[0];
  expect(JSON.parse(req.body)).toMatchObject({ id: "evt_01HZX3", type: "invoice.paid" });
  expect(req.headers["x-signature"]).toBe(sign(endpoint.secret, req.body));
});

test("reports a client error without throwing", async () => {
  const { send } = scriptedSend([410]);
  const result = await deliver(event, endpoint, { send });
  expect(result.ok).toBe(false);
  expect(result.status).toBe(410);
});
