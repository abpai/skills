import { bus } from "../bus";
import { Events } from "../events";
import { invoices } from "../store";

export function registerCleanup(): void {
  bus.on(Events.AcctClosed, ({ accountId }) => {
    for (const invoice of invoices.values()) {
      if (invoice.accountId === accountId && invoice.status === "issued") invoice.status = "failed";
    }
  });
}
