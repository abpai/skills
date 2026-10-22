import { bus } from "../bus";
import { outbox } from "../store";

export function registerWelcome(): void {
  bus.on("acct.opened", ({ accountId }) => {
    outbox.push({ to: accountId, template: "welcome" });
  });
}
