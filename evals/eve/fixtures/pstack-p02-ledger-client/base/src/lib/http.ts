export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpResponse {
  status: number;
  body: string;
}

export type Transport = (req: HttpRequest) => Promise<HttpResponse>;

const BASE_URL = process.env.LEDGER_API_URL ?? "https://ledger.internal.example";

const fetchTransport: Transport = async (req) => {
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
  return { status: res.status, body: await res.text() };
};

let transport: Transport = fetchTransport;

export function setTransport(next: Transport): void {
  transport = next;
}

export function resetTransport(): void {
  transport = fetchTransport;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
  }
}

type Query = Record<string, string | number | undefined>;

function buildUrl(path: string, query?: Query): string {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function parseBody(body: string): unknown {
  if (!body) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function jsonHeaders(hasBody: boolean): Record<string, string> {
  return hasBody
    ? { accept: "application/json", "content-type": "application/json" }
    : { accept: "application/json" };
}

export interface FetchJsonInit {
  method?: string;
  query?: Query;
  body?: unknown;
}

export async function fetchJson<T>(path: string, init: FetchJsonInit = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await transport({
    method: init.method ?? "GET",
    url: buildUrl(path, init.query),
    headers: jsonHeaders(hasBody),
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });
  const data = parseBody(res.body);
  if (res.status < 200 || res.status >= 300) throw new HttpError(res.status, data);
  return data as T;
}

export interface LegacyRequestOptions {
  method?: string;
  path: string;
  query?: Record<string, string>;
  json?: unknown;
}

export type LegacyCallback = (err: Error | null, data?: any, status?: number) => void;

/** @deprecated Use fetchJson. */
export function legacyRequest(opts: LegacyRequestOptions, callback: LegacyCallback): void {
  const hasBody = opts.json !== undefined;
  transport({
    method: opts.method ?? "GET",
    url: buildUrl(opts.path, opts.query),
    headers: jsonHeaders(hasBody),
    body: hasBody ? JSON.stringify(opts.json) : undefined,
  }).then(
    (res) => {
      const data = parseBody(res.body);
      if (res.status >= 400) callback(new Error(`HTTP ${res.status}`), data, res.status);
      else callback(null, data, res.status);
    },
    (err) => callback(err instanceof Error ? err : new Error(String(err))),
  );
}
