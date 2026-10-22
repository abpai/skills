import { bus } from "../bus";
import { freezeAccount } from "../risk/freeze";

const failures = new Map<string, number>();

export function registerDunning(): void {
  bus.on("payment.failed", async ({ accountId }) => {
    const count = (failures.get(accountId) ?? 0) + 1;
    failures.set(accountId, count);
    if (count >= 3) await freezeAccount(accountId, "2099-01-01");
  });
  bus.on("acct.closed", ({ accountId }) => failures.delete(accountId));
}

export function resetDunning(): void {
  failures.clear();
}
