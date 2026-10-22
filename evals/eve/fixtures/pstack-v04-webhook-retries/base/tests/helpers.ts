import type { OutgoingRequest, Send, WebhookEvent } from "../src/types";

export const event: WebhookEvent = {
  id: "evt_01HZX3",
  type: "invoice.paid",
  payload: { invoiceId: "inv_88", amountCents: 4200 },
  createdAt: "2026-10-20T09:15:00Z",
};

export const endpoint = { url: "https://hooks.example.test/in", secret: "whsec_test" };

export function scriptedSend(outcomes: Array<number | Error>) {
  const requests: OutgoingRequest[] = [];
  const send: Send = async (req) => {
    requests.push(req);
    const next = outcomes.shift();
    if (next === undefined) throw new Error("unexpected extra request");
    if (next instanceof Error) throw next;
    return { status: next };
  };
  return { send, requests };
}
