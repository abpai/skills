import { legacyRequest } from "./lib/http";

export interface Account {
  id: string;
  name: string;
  currency: string;
  balanceCents: number;
}

export function getAccount(id: string): Promise<Account | null> {
  return new Promise((resolve, reject) => {
    legacyRequest({ path: `/accounts/${encodeURIComponent(id)}` }, (err, data, status) => {
      if (status === 404) return resolve(null);
      if (err) return reject(err);
      resolve(data as Account);
    });
  });
}

export function listAccounts(): Promise<Account[]> {
  return new Promise((resolve, reject) => {
    legacyRequest({ path: "/accounts" }, (err, data) => {
      if (err) return reject(err);
      resolve((data as { accounts: Account[] }).accounts);
    });
  });
}
