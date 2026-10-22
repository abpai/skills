import { legacyRequest } from "./lib/http";

export interface Transaction {
  id: string;
  accountId: string;
  amountCents: number;
  memo: string;
  postedAt: string;
}

export interface NewTransaction {
  amountCents: number;
  memo: string;
}

export class ValidationError extends Error {
  constructor(readonly fields: Record<string, string>) {
    super(`invalid transaction: ${Object.keys(fields).join(", ")}`);
    this.name = "ValidationError";
  }
}

export function listTransactions(
  accountId: string,
  options: { since?: string; limit?: number } = {},
): Promise<Transaction[]> {
  const query: Record<string, string> = {};
  if (options.since) query.since = options.since;
  if (options.limit !== undefined) query.limit = String(options.limit);
  return new Promise((resolve, reject) => {
    legacyRequest(
      { path: `/accounts/${encodeURIComponent(accountId)}/transactions`, query },
      (err, data) => {
        if (err) return reject(err);
        resolve((data as { transactions: Transaction[] }).transactions);
      },
    );
  });
}

export function createTransaction(accountId: string, input: NewTransaction): Promise<Transaction> {
  return new Promise((resolve, reject) => {
    legacyRequest(
      { method: "POST", path: `/accounts/${encodeURIComponent(accountId)}/transactions`, json: input },
      (err, data, status) => {
        if (status === 422) {
          return reject(new ValidationError((data as { errors: Record<string, string> }).errors));
        }
        if (err) return reject(err);
        resolve(data as Transaction);
      },
    );
  });
}
