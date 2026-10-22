import { bus } from "../bus";
import { Events } from "../events";
import { outbox } from "../store";

export function registerGoodbye(): void {
  bus.on(Events.AcctClosed, ({ accountId }) => {
    outbox.push({ to: accountId, template: "goodbye" });
  });
}
