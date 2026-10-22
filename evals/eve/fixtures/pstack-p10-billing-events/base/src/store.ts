export interface Account {
  id: string;
  plan: "starter" | "growth" | "enterprise";
  status: "open" | "frozen" | "closed";
  limitCents: number;
}

export interface Invoice {
  id: string;
  accountId: string;
  totalCents: number;
  status: "issued" | "paid" | "failed";
}

export const accounts = new Map<string, Account>();
export const invoices = new Map<string, Invoice>();
export const outbox: Array<{ to: string; template: string }> = [];

export function resetStore(): void {
  accounts.clear();
  invoices.clear();
  outbox.length = 0;
}
