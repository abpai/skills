import { bus } from "../bus";
import { outbox } from "../store";

export function registerFrozenNotice(): void {
  bus.on("acct.frozen", ({ accountId }) => {
    outbox.push({ to: accountId, template: "account-frozen" });
  });
  bus.on("acct.limit_changed", ({ accountId }) => {
    outbox.push({ to: accountId, template: "limit-changed" });
  });
}
