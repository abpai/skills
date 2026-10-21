import { legacyRequest } from "./lib/http";

export interface Payee {
  id: string;
  displayName: string;
}

export function getPayee(id: string): Promise<Payee | null> {
  return new Promise((resolve, reject) => {
    legacyRequest({ path: `/payees/${encodeURIComponent(id)}` }, (err, data, status) => {
      if (status === 404) return resolve(null);
      if (err) return reject(err);
      resolve(data as Payee);
    });
  });
}

export function renamePayee(id: string, displayName: string): Promise<Payee> {
  return new Promise((resolve, reject) => {
    legacyRequest(
      { method: "PUT", path: `/payees/${encodeURIComponent(id)}`, json: { displayName } },
      (err, data) => {
        if (err) return reject(err);
        resolve(data as Payee);
      },
    );
  });
}
