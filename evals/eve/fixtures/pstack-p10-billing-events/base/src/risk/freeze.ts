import { bus } from "../bus";
import { accounts } from "../store";

export async function freezeAccount(id: string, until: string): Promise<void> {
  const account = accounts.get(id);
  if (!account) throw new Error(`no account ${id}`);
  account.status = "frozen";
  await bus.emit("acct.frozen", { accountId: id, until });
}
