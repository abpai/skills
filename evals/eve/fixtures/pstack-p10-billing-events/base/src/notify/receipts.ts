import { bus } from "../bus";
import { Events } from "../events";
import { outbox } from "../store";

export function registerReceipts(): void {
  bus.on(Events.InvoicePaid, ({ accountId }) => outbox.push({ to: accountId, template: "receipt" }));
  bus.on("payment.failed", ({ accountId }) => outbox.push({ to: accountId, template: "payment-failed" }));
}
