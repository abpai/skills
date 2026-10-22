import { bus } from "../bus";
import { Events } from "../events";

export const counters: Record<string, number> = {};

const COUNTED = [Events.AcctOpened, "acct.closed", Events.InvoiceIssued, "invoice.paid"];

export function registerCounters(): void {
  for (const name of COUNTED) {
    bus.on(name, () => {
      counters[name] = (counters[name] ?? 0) + 1;
    });
  }
}
