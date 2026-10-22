import type { HttpRequest, HttpResponse, Transport } from "../src/lib/http";

export function fakeTransport(routes: Record<string, (req: HttpRequest) => HttpResponse>) {
  const calls: HttpRequest[] = [];
  const transport: Transport = async (req) => {
    calls.push(req);
    const url = new URL(req.url);
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) return { status: 404, body: JSON.stringify({ error: "not found" }) };
    return handler(req);
  };
  return { transport, calls };
}

export const json = (status: number, body: unknown): HttpResponse => ({
  status,
  body: JSON.stringify(body),
});
