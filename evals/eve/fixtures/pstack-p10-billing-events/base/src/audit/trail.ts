import { bus } from "../bus";

export const trail: string[] = [];

const ACCOUNT_ACTIONS = ["opened", "closed", "frozen", "limit_changed"] as const;

export function registerAudit(): void {
  for (const action of ACCOUNT_ACTIONS) {
    bus.on(`acct.${action}`, ({ accountId }) => trail.push(`${accountId} ${action}`));
  }
  bus.on("invoice.issued", ({ invoiceId }) => trail.push(`${invoiceId} issued`));
}
