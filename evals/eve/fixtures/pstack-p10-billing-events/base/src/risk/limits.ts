import { bus } from "../bus";
import { Events } from "../events";
import { accounts } from "../store";

export async function changeLimit(id: string, limitCents: number): Promise<void> {
  const account = accounts.get(id);
  if (!account) throw new Error(`no account ${id}`);
  account.limitCents = limitCents;
  await bus.emit(Events.AcctLimitChanged, { accountId: id, limitCents });
}
