import { bus } from "../bus";
import { accounts } from "../store";

export async function closeAccount(id: string, reason: string): Promise<void> {
  const account = accounts.get(id);
  if (!account) throw new Error(`no account ${id}`);
  account.status = "closed";
  await bus.emit("acct.closed", { accountId: id, reason });
}
